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
  const { start, end } = req.body;

  if (!start || !end) {
    return res.status(400).json({ error: 'Start and End locations are required' });
  }

  try {
    console.log(`Processing route: ${start} -> ${end}`);

    // 1. Geocode
    const startLoc = await geocode(start);
    const endLoc = await geocode(end);

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

    res.json({
      route: routeData.geometry,
      sampledPoints: sampledPoints, // These are [lng, lat]
      weather: weatherData, // This will return array of { lat, lng, weather }
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
