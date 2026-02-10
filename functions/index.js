const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
require('dotenv').config();


const { geocode } = require('./services/geocodingService');

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

if (process.env.FUNCTIONS_EMULATOR) {
  db.settings({
    host: "127.0.0.1:8080",
    ssl: false
  });
}

const app = express();
const router = express.Router();

app.use(cors({ origin: '*' }));
app.use(express.json());

// Log ALL requests before any middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} (Original: ${req.url})`);
  next();
});

router.use((req, res, next) => {
  console.log(`[ROUTER DEBUG] ${req.method} ${req.path} (Full: ${req.originalUrl})`);
  next();
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Wayvue API is running' });
});

// Replaced fileLogger with console.log for Cloud Functions
const logDebug = (msg) => console.log(msg);

router.post('/route', async (req, res) => {
  try {
    const { start, end, startCoords, endCoords, departureDate, departureTime, roundTrip, preference, returnDate, returnTime } = req.body;

    logDebug(`[REQUEST] Route: ${start}->${end}, RT: ${roundTrip} (${typeof roundTrip}), Pref: ${preference}`);

    if (!start || !end) {
      return res.status(400).json({ error: 'Start and End locations are required' });
    }

    // 1. Geocode locations if coordinates not provided
    let sCoords, dCoords;

    if (startCoords && startCoords.lat && startCoords.lng) {
      sCoords = { lat: startCoords.lat, lon: startCoords.lng, display_name: start };
    } else {
      sCoords = await geocode(start);
    }

    if (endCoords && endCoords.lat && endCoords.lng) {
      dCoords = { lat: endCoords.lat, lon: endCoords.lng, display_name: end };
    } else {
      dCoords = await geocode(end);
    }

    if (!sCoords || !dCoords) {
      logDebug(`[ERROR] Geocoding failed`);
      return res.status(422).json({ error: 'Could not resolve locations.' });
    }

    // 2. Process Routes (Parallel: Fastest & Scenic)
    // We compute both to allow instant switching on frontend
    const { processLeg } = require('./services/tripProcessor');

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
      logDebug(`[RESPONSE] Returning Round Trip with Variants`);
      res.json(response);
    } else {
      res.json(response);
    }

    // Log Analytics Event (Fire and Forget)
    try {
      const tripScore = primaryOutbound?.tripScore?.score || 100;
      const duration = primaryOutbound?.metrics?.time || "0";
      const distance = primaryOutbound?.metrics?.distance || "0";

      db.collection('analytics_events').add({
        userId: req.body.userId || 'anonymous-server',
        eventType: 'trip_processed',
        metadata: {
          tripScore,
          duration,
          distance,
          isRoundTrip: !!roundTrip,
          preference: preference || 'fastest',
          start: start,
          end: end
        },
        timestamp: new Date().toISOString(),
        serverTimestamp: admin.firestore.FieldValue.serverTimestamp()
      }).catch(e => console.error('Failed to log trip_processed event:', e.message));
    } catch (e) {
      console.error('Error in trip_processed analytics:', e.message);
    }

  } catch (error) {
    console.error('Route handler error:', error);
    res.status(500).json({ error: 'Failed to generate route data' });
  }
});

// --- Analytics Endpoints ---

// In-Memory Fallback for Analytics (when Firestore is unavailable/emulator issues)
const memoryAnalytics = [];
const USE_MEMORY_ONLY = false; // Enabled persistent Firestore storage

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
router.post('/analytics/event', async (req, res) => {
  try {
    const { userId, eventType, metadata, timestamp } = req.body;

    if (!userId || !eventType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`[ANALYTICS] Received event: ${eventType} from ${userId}`);

    await db.collection('analytics_events').add({
      userId,
      eventType,
      metadata: metadata || {},
      timestamp: timestamp || new Date().toISOString(),
      serverTimestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Analytics Log Error:', error.message);
    // Fallback: Store in memory if DB fails
    const { userId, eventType, metadata, timestamp } = req.body;
    memoryAnalytics.push({
      userId,
      eventType,
      metadata: metadata || {},
      timestamp: timestamp || new Date().toISOString(),
      serverTimestamp: new Date().toISOString()
    });
    if (memoryAnalytics.length > 200) memoryAnalytics.shift();

    res.json({ success: true, _fallback: true });
  }
});

// Get Analytics Data (Admin Only)
router.get('/analytics', checkAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('analytics_events')
      .orderBy('serverTimestamp', 'desc')
      .limit(200)
      .get();

    const events = [];
    snapshot.forEach(doc => {
      events.push({ id: doc.id, ...doc.data() });
    });

    const countSnapshot = await db.collection('analytics_events').count().get();
    const totalEvents = countSnapshot.data().count;

    res.json({
      totalEvents,
      recentEvents: events
    });
  } catch (error) {
    console.error('Analytics Fetch Error:', error.message);
    res.json({
      totalEvents: memoryAnalytics.length,
      recentEvents: [...memoryAnalytics].reverse()
    });
  }
});

// Mount the router at both root and /api to handle Firebase Hosting variants
app.use('/api', router);
app.use('/', router);

// Expose Express App as a Cloud Function
exports.api = functions.runWith({ maxInstances: 2 }).https.onRequest(app);
