const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { geocode, reverseGeocode } = require('./services/geocodingService');
const { getRouteFromOSRM } = require('./services/routeService');
const { sampleRoute, getDistance } = require('./utils/geometry');
const { getWeatherForPoints } = require('./services/weatherService');
const RealCameraService = require('./services/realCameraService');

const app = express();
const PORT = process.env.PORT || 3001;

// Log ALL requests before any middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Wayvue API is running' });
});

app.post('/api/route', async (req, res) => {
  const { start, end, startCoords, endCoords } = req.body;

  if (!start || !end) {
    return res.status(400).json({ error: 'Start and End locations are required' });
  }

  try {
    console.log(`Processing route: ${start} -> ${end}`);

    // 1. Geocode (Use provided coords if available, else fallback to geocoding)
    let startLoc, endLoc;

    if (startCoords && startCoords.lat && startCoords.lng) {
      startLoc = { lat: startCoords.lat, lon: startCoords.lng, display_name: start };
    } else {
      startLoc = await geocode(start);
    }

    if (endCoords && endCoords.lat && endCoords.lng) {
      endLoc = { lat: endCoords.lat, lon: endCoords.lng, display_name: end };
    } else {
      endLoc = await geocode(end);
    }

    if (!startLoc || !endLoc) {
      console.error(`Geocoding failed for Start: ${JSON.stringify(startLoc)} or End: ${JSON.stringify(endLoc)}`);
      return res.status(422).json({ error: 'Could not resolve one or both locations. Please check your spelling.' });
    }

    // 2. Route (OSRM expects lng,lat)
    const routeData = await getRouteFromOSRM(
      startLoc.lon, startLoc.lat,
      endLoc.lon, endLoc.lat
    );

    // 3. Sample
    // routeData.geometry is a GeoJSON LineString: { type: 'LineString', coordinates: [[lng, lat], ...] }
    const fullCoordinates = routeData.geometry.coordinates;

    // Convert meters to miles (1 meter = 0.000621371 miles)
    const totalDistanceMiles = routeData.distance * 0.000621371;

    // Dynamic Sampling: Target ~25 points for the whole route to ensure even spread
    // MIN interval: 5 miles (don't over-sample short routes)
    const TARGET_POINTS = 25;
    let intervalMiles = totalDistanceMiles / TARGET_POINTS;
    if (intervalMiles < 5) intervalMiles = 5;

    console.log(`Route distance: ${totalDistanceMiles.toFixed(1)} miles. Sampling interval: ${intervalMiles} miles. Expected points: ~${Math.ceil(totalDistanceMiles / intervalMiles)}`);

    const sampledPoints = sampleRoute(fullCoordinates, intervalMiles);

    // Pre-calculate cumulative distances for all coordinates in the route
    const cumulativeDistances = [0];
    let totalAccDist = 0;
    for (let i = 1; i < fullCoordinates.length; i++) {
      const [ln1, lt1] = fullCoordinates[i - 1];
      const [ln2, lt2] = fullCoordinates[i];
      totalAccDist += getDistance(lt1, ln1, lt2, ln2);
      cumulativeDistances.push(totalAccDist);
    }

    // We'll pre-calculate some values
    const distanceVal = (routeData.distance / 1609.34).toFixed(1) + " miles";
    const durationVal = Math.round(routeData.duration / 60) + " min";

    console.log('Running parallel enrichments (Weather, Road, AI, Places)...');

    const [weatherData, roadConditions, recommendations] = await Promise.all([
      // A. Weather with City Names
      (async () => {
        const pointsForWeather = sampledPoints.map(([lng, lat]) => [lat, lng]);
        const weatherResults = await getWeatherForPoints(pointsForWeather);

        console.log(`Weather service returned ${weatherResults.length} points.`);
        if (weatherResults.length > 0) {
          console.log('Sample weather data from service:', JSON.stringify(weatherResults[0], null, 2));
        }

        return Promise.all(weatherResults.map(async (w, i) => {
          const [lat, lng] = [w.lat, w.lng];
          const distMiles = Math.round((i / Math.max(1, weatherResults.length - 1)) * Number(totalDistanceMiles));
          let city = `Mile ${distMiles}`;

          try {
            const name = await reverseGeocode(lat, lng);
            if (name) city = name;
          } catch (e) {
            console.error('Reverse geocode failed in weather enrichment:', e.message);
          }

          // Calculate ETA
          // Total Duration (seconds) * (i / totalPoints) -> seconds from now
          const fraction = i / Math.max(1, weatherResults.length - 1);
          const secondsFromNow = routeData.duration * fraction;
          const etaDate = new Date(Date.now() + secondsFromNow * 1000);
          // Format: "2:45 PM"
          const etaString = etaDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

          const finalWeather = {
            temperature: (w.weather && typeof w.weather.temperature === 'number') ? w.weather.temperature : null,
            weathercode: w.weather?.weathercode ?? 0,
            windSpeed: w.weather?.windSpeed ?? 0,
            humidity: w.weather?.humidity ?? 0,
            precipitationProbability: w.weather?.precipitationProbability ?? 0,
            windDirection: w.weather?.windDirection ?? 0,
            eta: `ETA ${etaString}`,
            distanceFromStart: distMiles,
            location: city.includes("Mile") ? "Highway Segment" : city, // Prefer generic over "Mile X" if geocode fails
            lat: lat,
            lng: lng
          };

          if (i === 0 || i === weatherResults.length - 1) {
            console.log(`Enriched weather point ${i}:`, JSON.stringify(finalWeather, null, 2));
          }

          return finalWeather;
        }));
      })(),

      // B. Road Conditions
      (async () => {
        const roadIndices = [0, Math.floor(fullCoordinates.length * 0.33), Math.floor(fullCoordinates.length * 0.66), fullCoordinates.length - 1];
        const uniqueIndices = [...new Set(roadIndices)];
        const { getWeather } = require('./services/weatherService');
        const RealCameraService = require('./services/realCameraService');

        return Promise.all(uniqueIndices.map(async (idx, i) => {
          const [lng, lat] = fullCoordinates[idx];
          let locationName = i === 0 ? "Start Area" : i === uniqueIndices.length - 1 ? "Destination Area" : `Segment ${i + 1}`;
          try {
            const realName = await reverseGeocode(lat, lng);
            if (realName) locationName = realName;
          } catch (e) { }

          // Derive status from weather
          const w = await getWeather(lat, lng);
          const code = w?.weathercode ?? 0;
          console.log(`Road condition weather fetch for segment ${i} (${lat},${lng}): Code ${code}, Temp ${w?.temperature}`);
          let status = "good";
          let desc = "Clear roads, normal traffic flow";
          if ([71, 73, 75, 85, 86].includes(code)) { status = "poor"; desc = "Snow/Ice detected."; }
          else if ([51, 61, 63, 80, 81, 95, 96, 99].includes(code)) { status = "moderate"; desc = "Wet roads."; }
          else if ([45, 48].includes(code)) { status = "moderate"; desc = "Foggy conditions."; }

          // Correct cumulative distance calculation using pre-calculated values
          const segmentDistMiles = cumulativeDistances[idx];

          let cameraObj = null;
          try {
            cameraObj = await RealCameraService.getCamerasNY(lat, lng);
          } catch (e) { }

          if (!cameraObj) {
            cameraObj = {
              id: `sim-cam-${idx}`,
              name: `${locationName} Traffic Cam (Simulated)`,
              url: `https://placehold.co/1280x720/1a1a1a/1a1a1a`,
              timestamp: new Date().toISOString()
            };
          }

          return {
            segment: locationName,
            status: status,
            description: desc,
            distance: `${segmentDistMiles.toFixed(0)} mi`,
            location: { lat: lat, lon: lng },
            camera: cameraObj
          };
        }));
      })(),

      // C. Places Recommendations
      (async () => {
        const { getRecommendations } = require('./services/placesService');

        // Generate context points every ~40 miles
        const samplingIntervalMiles = 40;
        const numPoints = Math.max(5, Math.floor(totalDistanceMiles / samplingIntervalMiles));
        const contextPoints = [];

        for (let i = 0; i <= numPoints; i++) {
          const p = i / numPoints; // percentage 0 to 1
          // Use slightly less than 1.0 to avoid index out of bounds, clamped
          const idx = Math.min(fullCoordinates.length - 1, Math.floor(fullCoordinates.length * p));

          // Current distance from start
          const currentDist = (p * totalDistanceMiles).toFixed(0);

          contextPoints.push({
            segment: `${currentDist} mi`,
            location: { lat: fullCoordinates[idx][1], lon: fullCoordinates[idx][0] },
            miles: Number(currentDist)
          });
        }

        return getRecommendations(contextPoints);
      })()
    ]);

    // D. Wayvue AI Analysis
    const { generateTripAnalysis } = require('./services/aiService');
    const aiAnalysis = generateTripAnalysis(start, end, weatherData, distanceVal);

    console.log(`Sending response: ${weatherData.length} weather points, ${roadConditions.length} road conditions.`);

    res.json({
      route: routeData.geometry, // OSRM GeoJSON
      metrics: {
        distance: distanceVal,
        time: durationVal,
        fuel: `$${(routeData.distance / 1609.34 * 0.15).toFixed(2)}` // Est 15 cents/mile
      },
      weather: weatherData,
      roadConditions: roadConditions,
      aiAnalysis: aiAnalysis, // New AI Summary
      recommendations: recommendations // New Places
    });
  } catch (error) {
    console.error('Route handler error:', error);
    res.status(500).json({ error: 'Failed to generate route data' });
  }
});

// New endpoint to resolve exact address on demand
app.post('/api/place-details', async (req, res) => {
  const { lat, lon } = req.body;

  if (!lat || !lon) {
    return res.status(400).json({ error: 'Lat and Lon are required' });
  }

  try {
    // Request full address
    const fullAddress = await reverseGeocode(lat, lon, true);
    res.json({ address: fullAddress });
  } catch (error) {
    console.error('Place details error:', error);
    res.status(500).json({ error: 'Failed to fetch address' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
