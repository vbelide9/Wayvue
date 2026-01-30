const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { geocode } = require('./services/geocodingService');
const { getRouteFromOSRM } = require('./services/routeService');
const { sampleRoute } = require('./utils/geometry');
const { getWeatherForPoints } = require('./services/weatherService');

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
    const weatherData = await getWeatherForPoints(pointsForWeather);

    // 5. Generate Real Road Conditions
    // Pick 4 equidistant points (Start, 1/3, 2/3, End)
    const conditionSegments = [];
    const segmentIndices = [
      0,
      Math.floor(weatherData.length * 0.33),
      Math.floor(weatherData.length * 0.66),
      weatherData.length - 1
    ];
    // Remove duplicates if route is short
    const uniqueIndices = [...new Set(segmentIndices)];

    // We need reverse geocoding to get location names
    const { reverseGeocode } = require('./services/geocodingService');

    const roadConditions = await Promise.all(uniqueIndices.map(async (idx, i) => {
      const w = weatherData[idx];
      const [lat, lng] = pointsForWeather[idx];

      let locationName = `Segment ${i + 1}`;
      if (i === 0) locationName = "Start Area";
      else if (i === uniqueIndices.length - 1) locationName = "Destination Area";
      else {
        // Try to get real city name
        const realName = await reverseGeocode(lat, lng);
        if (realName) locationName = realName;
      }

      // Determine status based on weather
      let status = "good";
      let desc = "Clear roads, normal traffic flow";
      const code = w.weather?.weather_code || 0; // Check standard OpenMeteo code property name

      // Snow/Ice
      if ([71, 73, 75, 85, 86].includes(code)) {
        status = "poor";
        desc = "Snow/Ice detected. Drive with caution.";
      }
      // Rain/Showers
      else if ([51, 61, 63, 80, 81, 95, 96, 99].includes(code)) {
        status = "moderate";
        desc = "Wet roads, possible visibility reduction.";
      }
      // Fog
      else if ([45, 48].includes(code)) {
        status = "moderate";
        desc = "Foggy conditions, low visibility.";
      }

      return {
        segment: locationName,
        status: status,
        description: desc,
        distance: `${(totalDistanceMiles / uniqueIndices.length).toFixed(0)} mi`,
        estimatedTime: "..." // We don't have real traffic time, leave placeholder or calc
      };
    }));

    res.json({
      route: routeData.geometry,
      sampledPoints: sampledPoints,
      weather: weatherData,
      roadConditions: roadConditions, // New field with real names
      duration: routeData.duration,
      distance: routeData.distance
    });

  } catch (error) {
    console.error('Route handler error:', error);
    res.status(500).json({ error: 'Failed to generate route data' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
