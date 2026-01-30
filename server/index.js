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
      console.log('Geocoding failed');
      return res.status(404).json({ error: 'Could not find one or both locations' });
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

    // 4. Weather
    const pointsForWeather = sampledPoints.map(([lng, lat]) => [lat, lng]);
    const weatherResults = await getWeatherForPoints(pointsForWeather);

    // Add city names to weather points for the timeline
    // Sample only every 4th point to keep speed up, but geocode displayed ones
    const weatherData = await Promise.all(weatherResults.map(async (w, i) => {
      const [lat, lng] = pointsForWeather[i];
      const distMiles = Math.round((i / Math.max(1, weatherResults.length - 1)) * Number(totalDistanceMiles));
      let city = `Mile ${distMiles}`;

      try {
        // Only geocode every 4th point to balance speed and coverage
        if (i % 4 === 0 || i === weatherResults.length - 1) {
          const name = await reverseGeocode(lat, lng);
          if (name) city = name;
        }
      } catch (e) { }

      return { ...w.weather, location: city, lat: w.lat, lng: w.lng };
    }));

    // 5. Road Conditions & Cameras
    console.log('Generating road conditions...');
    const indices = [
      0,
      Math.floor(fullCoordinates.length * 0.33),
      Math.floor(fullCoordinates.length * 0.66),
      fullCoordinates.length - 1
    ];

    const uniqueIndices = [...new Set(indices)]; // Remove duplicates

    const roadConditions = [];

    // Sequential Loop to prevent API Throttling
    for (const [idx, i] of uniqueIndices.entries()) {
      console.log(`Processing road segment ${idx + 1}/${uniqueIndices.length}...`);

      const coords = fullCoordinates[i];
      const lng = coords[0];
      const lat = coords[1];

      // Reverse Geocode (Get city names for all segments)
      let locationName = `Segment ${idx + 1}`;
      try {
        // Add small delay to be nice to API
        await new Promise(r => setTimeout(r, 200));
        const realName = await reverseGeocode(lat, lng);
        if (realName) {
          locationName = realName;
        } else if (idx === 0) {
          locationName = "Start Area";
        } else if (idx === uniqueIndices.length - 1) {
          locationName = "Destination Area";
        }
      } catch (e) {
        console.log('Geocode error:', e.message);
        if (idx === 0) locationName = "Start Area";
        else if (idx === uniqueIndices.length - 1) locationName = "Destination Area";
      }

      // Weather Logic (Find closest sampled weather point)
      const weatherIdx = Math.floor((i / fullCoordinates.length) * weatherData.length);
      const w = weatherData[weatherIdx] || weatherData[0];

      const code = w?.weather?.weather_code || 0;
      let status = "good";
      let desc = "Clear roads, normal traffic flow";

      if ([71, 73, 75, 85, 86].includes(code)) {
        status = "poor";
        desc = "Snow/Ice detected. Drive with caution.";
      }
      else if ([51, 61, 63, 80, 81, 95, 96, 99].includes(code)) {
        status = "moderate";
        desc = "Wet roads, possible visibility reduction.";
      }
      else if ([45, 48].includes(code)) {
        status = "moderate";
        desc = "Foggy conditions, low visibility.";
      }

      // Camera
      let cameraObj = null;
      try {
        // Small delay for camera API too
        await new Promise(r => setTimeout(r, 200));
        cameraObj = await RealCameraService.getCamerasNY(lat, lng);
      } catch (e) { console.log('Cam error:', e.message); }

      if (!cameraObj) {
        let conditionType = "clear";
        if (status === 'poor') conditionType = "snow";
        else if (status === 'moderate') conditionType = "rain";

        const safeImage = `https://placehold.co/1280x720/1a1a1a/1a1a1a`;

        cameraObj = {
          id: `sim-cam-${i}`,
          name: `${locationName} Traffic Cam (Simulated)`,
          url: safeImage,
          timestamp: new Date().toISOString()
        };
      }

      roadConditions.push({
        segment: locationName,
        status: status,
        description: desc,
        distance: `${(totalDistanceMiles / uniqueIndices.length).toFixed(0)} mi`,
        estimatedTime: "...",
        location: { lat: lat, lon: lng },
        camera: cameraObj
      });
    }

    // 6. Generate Wayvue AI Analysis
    const { generateTripAnalysis } = require('./services/aiService');
    const distanceVal = (routeData.distance / 1609.34).toFixed(1) + " miles";
    const durationVal = Math.round(routeData.duration / 60) + " min";

    // We pass the raw locations for analysis
    const aiAnalysis = generateTripAnalysis(start, end, weatherData, distanceVal);

    // 7. Generate Places Recommendations
    const { getRecommendations } = require('./services/placesService');
    const recommendations = await getRecommendations(roadConditions);

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
