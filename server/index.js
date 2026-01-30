const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { geocode, reverseGeocode } = require('./services/geocodingService');
const { getRouteFromOSRM } = require('./services/routeService');
const { sampleRoute } = require('./utils/geometry');
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

    // 4, 5, 6, 7. Run enrichments in parallel to save significant time
    console.log('Running parallel enrichments (Weather, Road, AI, Places)...');

    // We'll pre-calculate some values
    const distanceVal = (routeData.distance / 1609.34).toFixed(1) + " miles";
    const durationVal = Math.round(routeData.duration / 60) + " min";

    const [weatherData, roadConditions, recommendations] = await Promise.all([
      // A. Weather with City Names
      (async () => {
        const pointsForWeather = sampledPoints.map(([lng, lat]) => [lat, lng]);
        const { getWeatherForPoints } = require('./services/weatherService');
        const weatherResults = await getWeatherForPoints(pointsForWeather);
        return Promise.all(weatherResults.map(async (w, i) => {
          const [lat, lng] = pointsForWeather[i];
          const distMiles = Math.round((i / Math.max(1, weatherResults.length - 1)) * Number(totalDistanceMiles));
          let city = `Mile ${distMiles}`;
          try {
            // Geocode every single point to ensure full city name coverage as requested
            const name = await reverseGeocode(lat, lng);
            if (name) city = name;
          } catch (e) { }
          return { ...w.weather, location: city, lat: w.lat, lng: w.lng };
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
          const code = w?.weathercode || 0;
          let status = "good";
          let desc = "Clear roads, normal traffic flow";
          if ([71, 73, 75, 85, 86].includes(code)) { status = "poor"; desc = "Snow/Ice detected."; }
          else if ([51, 61, 63, 80, 81, 95, 96, 99].includes(code)) { status = "moderate"; desc = "Wet roads."; }
          else if ([45, 48].includes(code)) { status = "moderate"; desc = "Foggy conditions."; }

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
            distance: `${(totalDistanceMiles / uniqueIndices.length).toFixed(0)} mi`,
            location: { lat: lat, lon: lng },
            camera: cameraObj
          };
        }));
      })(),

      // C. Places Recommendations
      (async () => {
        const { getRecommendations } = require('./services/placesService');
        const contextPoints = [0, 0.25, 0.5, 0.75, 1.0].map(p => {
          const idx = Math.floor(fullCoordinates.length * 0.999 * p);
          const currentDist = (p * totalDistanceMiles).toFixed(0);
          return {
            segment: `${currentDist} mi`,
            location: { lat: fullCoordinates[idx][1], lon: fullCoordinates[idx][0] },
            miles: currentDist
          };
        });
        return getRecommendations(contextPoints);
      })()
    ]);

    // D. Wayvue AI Analysis
    const { generateTripAnalysis } = require('./services/aiService');
    const aiAnalysis = generateTripAnalysis(start, end, weatherData, distanceVal);

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
