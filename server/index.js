const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { geocode } = require('./services/geocodingService');

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

const logDebug = require('./fileLogger');

app.post('/api/route', async (req, res) => {
  try {
    const { start, end, startCoords, endCoords, departureDate, departureTime, roundTrip, preference, returnDate, returnTime } = req.body;

    logDebug(`[REQUEST] Route: ${start}->${end}, RT: ${roundTrip} (${typeof roundTrip}), Pref: ${preference}`);
    console.log(`[TRACE] Received request: ${start} -> ${end}`);

    if (!start || !end) {
      return res.status(400).json({ error: 'Start and End locations are required' });
    }

    // 1. Geocode locations if coordinates not provided
    let sCoords, dCoords;

    if (startCoords && startCoords.lat && startCoords.lng) {
      sCoords = { lat: startCoords.lat, lon: startCoords.lng, display_name: start };
    } else {
      console.log(`[TRACE] Geocoding start: ${start}`);
      sCoords = await geocode(start);
      console.log(`[TRACE] Geocoding start result:`, sCoords);
    }

    if (endCoords && endCoords.lat && endCoords.lng) {
      dCoords = { lat: endCoords.lat, lon: endCoords.lng, display_name: end };
    } else {
      console.log(`[TRACE] Geocoding end: ${end}`);
      dCoords = await geocode(end);
      console.log(`[TRACE] Geocoding end result:`, dCoords);
    }

    if (!sCoords || !dCoords) {
      logDebug(`[ERROR] Geocoding failed`);
      console.log(`[TRACE] Geocoding failed. Returning 422.`);
      return res.status(422).json({ error: 'Could not resolve locations.' });
    }

    // 2. Process Routes (Parallel: Fastest & Scenic)
    // We compute both to allow instant switching on frontend
    const { processLeg } = require('./services/tripProcessor');

    // Define helper to get both variants for a leg
    // Define helper to get both variants for a leg
    const getLegVariants = async (s, d, date, time) => {
      const results = await Promise.allSettled([
        processLeg(s, d, date, time, false),
        processLeg(s, d, date, time, true)
      ]);

      const fastest = results[0].status === 'fulfilled' ? results[0].value : null;
      const scenic = results[1].status === 'fulfilled' ? results[1].value : null;

      if (results[0].status === 'rejected') logDebug(`[WARN] Fastest route failed: ${results[0].reason}`);
      if (results[1].status === 'rejected') logDebug(`[WARN] Scenic route failed: ${results[1].reason}`);

      // Fallback: If fastest failed but scenic worked, use scenic as fastest (rare but possible)
      return {
        fastest: fastest || scenic,
        scenic: scenic || fastest
      };
    };

    // Outbound
    const outboundVariants = await getLegVariants(sCoords, dCoords, departureDate, departureTime);

    // Return (if applicable)
    let returnVariants = null;
    if (roundTrip) {
      logDebug(`[PROCESS] Calculating return leg variants...`);
      try {
        returnVariants = await getLegVariants(dCoords, sCoords, returnDate || departureDate, returnTime || departureTime);
      } catch (e) {
        logDebug(`[ERROR] Return leg failed: ${e.message}`);
      }
    }

    // Prepare Response
    // We determine the 'primary' result based on the requested preference
    const primaryPref = preference === 'scenic' ? 'scenic' : 'fastest';
    const primaryOutbound = outboundVariants[primaryPref];
    const primaryReturn = returnVariants ? returnVariants[primaryPref] : null;

    const response = {
      isRoundTrip: !!roundTrip,
      outbound: primaryOutbound,
      return: primaryReturn,
      variants: {
        fastest: {
          outbound: outboundVariants.fastest,
          return: returnVariants ? returnVariants.fastest : null
        },
        scenic: {
          outbound: outboundVariants.scenic,
          return: returnVariants ? returnVariants.scenic : null
        }
      }
    };

    if (roundTrip && primaryReturn) {
      logDebug(`[RESPONSE] Returning Round Trip with Variants: ${Object.keys(response.variants).join(', ')}`);
      res.json(response);
    } else {
      res.json({
        ...response,
        // Fallback for flat structure if frontend relies on root props for non-RT
        // But prefer using the structured response above
      });
    }

  } catch (error) {
    console.error('Route handler error:', error);
    res.status(500).json({ error: 'Failed to generate route data' });
  }
});

// --- Analytics Endpoints ---

// In-Memory Fallback for Analytics
const memoryAnalytics = [];

// Middleware to check for Admin Password
const checkAdmin = (req, res, next) => {
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const providedPassword = req.headers['x-admin-password'];

  if (providedPassword === adminPassword) {
    next();
  } else {
    res.status(403).json({ error: 'Unauthorized: Invalid Admin Password' });
  }
};

// Log Analytics Event (Public)
app.post('/api/analytics/event', (req, res) => {
  try {
    const { userId, eventType, metadata, timestamp } = req.body;

    if (!userId || !eventType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`[ANALYTICS] Received event: ${eventType} from ${userId}`);

    const newEvent = {
      userId,
      eventType,
      metadata: metadata || {},
      timestamp: timestamp || new Date().toISOString(),
      serverTimestamp: new Date().toISOString()
    };

    memoryAnalytics.push(newEvent);
    // Keep last 200 events
    if (memoryAnalytics.length > 200) memoryAnalytics.shift();

    res.json({ success: true });
  } catch (error) {
    console.error('Analytics Log Error:', error.message);
    res.status(500).json({ error: 'Failed to log event' });
  }
});

// Get Analytics Data (Admin Only)
app.get('/api/analytics', checkAdmin, (req, res) => {
  try {
    res.json({
      totalEvents: memoryAnalytics.length,
      recentEvents: [...memoryAnalytics].reverse()
    });
  } catch (error) {
    console.error('Analytics Fetch Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

app.listen(5001, () => {
  console.log(`Server running on port 5001`);
});
