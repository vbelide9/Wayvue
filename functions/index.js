const functions = require('firebase-functions');
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
  const { start, end, startCoords, endCoords, departureDate, departureTime } = req.body;

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
    const minutes = Math.round(routeData.duration / 60);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const durationVal = hours > 0 ? `${hours} hr ${mins} min` : `${mins} min`;

    const [weatherData, roadConditions, recommendations] = await Promise.all([
      // A. Weather with City Names
      (async () => {
        const totalDurationSeconds = routeData.duration || 0;
        const pointsForWeather = sampledPoints.map(([lng, lat], i) => {
          const progress = i / Math.max(1, sampledPoints.length - 1);
          const timeOffsetSeconds = progress * totalDurationSeconds;
          // default date now if not provided
          const baseTime = departureDate ? new Date(`${departureDate}T${departureTime || "12:00"}`).getTime() : Date.now();
          const pointEtaDate = new Date(baseTime + (timeOffsetSeconds * 1000));
          return {
            lat,
            lng,
            dateStr: departureDate,
            targetHour: pointEtaDate.getHours()
          };
        });

        const { getWeatherForPoints } = require('./services/weatherService');
        const weatherResults = await getWeatherForPoints(pointsForWeather, departureDate);
        const totalDistanceMiles = (routeData.distance * 0.000621371).toFixed(1);

        // re-calc base time for ETA display
        const baseTime = departureDate ? new Date(`${departureDate}T${departureTime || "12:00"}`).getTime() : Date.now();

        return Promise.all(weatherResults.map(async (w, i) => {
          const { lat, lng } = pointsForWeather[i];
          const progress = i / Math.max(1, weatherResults.length - 1);
          const distMiles = Math.round(progress * Number(totalDistanceMiles));

          // Calculate ETA for display (using human-friendly string)
          const timeOffsetSeconds = progress * totalDurationSeconds;
          const etaDate = new Date(baseTime + (timeOffsetSeconds * 1000));
          const eta = etaDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

          let city = `Mile ${distMiles}`;
          try {
            // Geocode every single point to ensure full city name coverage as requested
            const name = await reverseGeocode(lat, lng);
            if (name) city = name;
          } catch (e) { }

          return {
            ...w.weather,
            location: city,
            lat: w.lat,
            lng: w.lng,
            distanceFromStart: distMiles,
            eta: `ETA ${eta}`,
            gasPrice: (2.90 + Math.random() * 0.7).toFixed(2) // Simulated Gas Price ($2.90 - $3.60)
          };
        }));
      })(),

      // B. Road Conditions
      (async () => {
        const roadIndices = [0, Math.floor(fullCoordinates.length * 0.33), Math.floor(fullCoordinates.length * 0.66), fullCoordinates.length - 1];
        const uniqueIndices = [...new Set(roadIndices)];
        const { getWeather } = require('./services/weatherService');
        const RealCameraService = require('./services/realCameraService');

        // base time for road conditions
        const baseTime = departureDate ? new Date(`${departureDate}T${departureTime || "12:00"}`).getTime() : Date.now();


        return Promise.all(uniqueIndices.map(async (idx, i) => {
          const [lng, lat] = fullCoordinates[idx];
          let locationName = i === 0 ? "Start Area" : i === uniqueIndices.length - 1 ? "Destination Area" : `Segment ${i + 1}`;
          try {
            const realName = await reverseGeocode(lat, lng);
            if (realName) locationName = realName;
          } catch (e) { }

          // Derive status from weather
          const progress = idx / Math.max(1, fullCoordinates.length - 1);
          const timeOffsetSeconds = progress * (routeData.duration || 0);
          const etaDate = new Date(baseTime + (timeOffsetSeconds * 1000));
          const w = await getWeather(lat, lng, departureDate, etaDate.getHours());
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
            distance: `${((idx / fullCoordinates.length) * totalDistanceMiles).toFixed(0)} mi`,
            location: { lat: lat, lon: lng },
            camera: cameraObj
          };
        }));
      })(),

      // C. Places Recommendations
      (async () => {
        const { getRecommendations } = require('./services/placesService');
        // Optimize sampling: Avoid hammering Overpass.
        // For short trips (<50mi), just check start/mid/end.
        // For longer trips, check every ~50 miles, max 5 checks.
        let samplePoints = [0.1, 0.5, 0.9]; // Default 3 points
        const distanceMiles = distanceVal; // "10.4 miles" -> we need number

        if (totalDistanceMiles > 100) {
          samplePoints = [0.1, 0.3, 0.5, 0.7, 0.9];
        }

        const contextPoints = samplePoints.map(p => {
          const idx = Math.floor(fullCoordinates.length * 0.999 * p);
          const currentDist = (p * totalDistanceMiles).toFixed(0);
          return {
            segment: `${currentDist} mi`,
            location: { lat: fullCoordinates[idx][1], lon: fullCoordinates[idx][0] },
            miles: Number(currentDist)
          };
        });
        return getRecommendations(contextPoints);
      })()
    ]);

    // D. Wayvue AI Analysis
    // Prepare enriched context
    const fuelCostStr = `$${(routeData.distance / 1609.34 * 0.15).toFixed(0)}`;
    const evCostStr = `$${(routeData.distance / 1609.34 * 0.10).toFixed(0)}`;

    // Extract unique cities (limit to 3 distinct ones to avoid clutter)
    const uniqueCities = [...new Set(weatherData.map(w => w.location).filter(l => l && !l.includes("Mile")))];
    const cityList = uniqueCities.length > 2
      ? [uniqueCities[0], uniqueCities[Math.floor(uniqueCities.length / 2)], uniqueCities[uniqueCities.length - 1]]
      : uniqueCities;

    // Extract temp range (Celsius from source)
    const temps = weatherData.map(w => w.temperature).filter(t => !isNaN(t));
    const minTempC = Math.min(...temps);
    const maxTempC = Math.max(...temps);
    // Convert to F for AI text
    const minTemp = Math.round((minTempC * 9 / 5) + 32);
    const maxTemp = Math.round((maxTempC * 9 / 5) + 32);

    // Calculate Traffic Delay (baseline with a tiny bit of jitter for realism)
    const baselineSpeed = 50 + (Math.random() * 2 - 1); // 49 to 51 mph
    const baseDurationMins = (routeData.distance * 0.000621371) / baselineSpeed * 60;
    const trafficDelayMins = Math.max(0, Math.round((routeData.duration / 60) - baseDurationMins));

    // Weather Stats
    const maxWindKm = Math.max(...weatherData.map(w => w.windSpeed || 0));
    const maxWind = Math.round(maxWindKm * 0.621371); // Convert km/h -> mph
    const precipCount = weatherData.filter(w => [51, 61, 63, 80, 81, 95, 96, 99, 71, 73, 75, 85, 86].includes(w.weather?.weather_code)).length;
    const precipChance = Math.round((precipCount / weatherData.length) * 100);

    // Suggested Stops (Top 3 Unique Cities)
    const distinctStops = [];
    const seenCities = new Set();
    for (const r of recommendations) {
      const city = r.location.split('•')[0].trim();
      if (!seenCities.has(city)) {
        seenCities.add(city);
        distinctStops.push({ city, reason: r.type });
      }
      if (distinctStops.length >= 3) break;
    }

    const { generateTripAnalysis } = require('./services/aiService');
    const aiAnalysis = generateTripAnalysis(
      start, end, weatherData, distanceVal, durationVal, roadConditions,
      {
        fuelCost: fuelCostStr,
        evCost: evCostStr,
        cities: cityList,
        minTemp, maxTemp,
        trafficDelay: trafficDelayMins,
        maxWind,
        precipChance,
        recommendations: distinctStops,
        departureDate,
        departureTime
      }
    );


    res.json({
      route: routeData.geometry, // OSRM GeoJSON
      metrics: {
        distance: distanceVal,
        time: durationVal,
        fuel: fuelCostStr, // Est 15 cents/mile (Gas)
        ev: evCostStr // Est 10 cents/mile (EV)
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

exports.api = functions.runWith({ maxInstances: 2 }).https.onRequest(app);
