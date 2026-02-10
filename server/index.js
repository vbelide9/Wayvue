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

// --- Community Intelligence Endpoint ---
app.get('/api/community-stats', (req, res) => {
  try {
    // 1. Calculate Active Users (Unique UserIDs in last 10 mins)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const recentEvents = memoryAnalytics.filter(e => e.timestamp > tenMinutesAgo);
    const activeUsers = new Set(recentEvents.map(e => e.userId)).size;

    // 2. Top Destinations (from 'search_route' events)
    const destCounts = {};
    memoryAnalytics
      .filter(e => e.eventType === 'search_route' && e.metadata.end)
      .forEach(e => {
        const dest = e.metadata.end.split(',')[0].trim(); // City only
        destCounts[dest] = (destCounts[dest] || 0) + 1;
      });

    const topDestinations = Object.entries(destCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // 3. Accumulated Miles (from 'trip_generated' events)
    // If we haven't logged any 'trip_generated' yet, we mock a base number to look "alive"
    const loggedMiles = memoryAnalytics
      .filter(e => e.eventType === 'trip_generated' && e.metadata.distance)
      .reduce((acc, curr) => acc + (parseFloat(curr.metadata.distance) || 0), 0);

    // Base miles to make the platform look established + live miles
    const totalSafeMiles = 12450 + loggedMiles;

    // 4. Recent Activity Ticker
    const recentActivity = memoryAnalytics
      .filter(e => e.eventType === 'search_route')
      .slice(-5)
      .reverse()
      .map(e => ({
        action: 'planned a trip',
        details: `to ${e.metadata.end.split(',')[0]}`,
        timestamp: e.timestamp
      }));

    res.json({
      activeUsers: Math.max(activeUsers, 3), // Min 3 for social proof demo
      topDestinations: topDestinations.length > 0 ? topDestinations : [{ name: "Los Angeles", count: 12 }, { name: "Las Vegas", count: 8 }],
      totalSafeMiles: Math.round(totalSafeMiles),
      recentActivity
    });

  } catch (error) {
    console.error('Community Stats Error:', error);
    res.status(500).json({ error: 'Failed to generate community stats' });
  }
});

// --- Smart Vehicle Recommendation Endpoint ---
app.get('/api/trip/rental-recommendations', (req, res) => {
  try {
    const { distance, weather_condition, origin, destination, passengers, luggage, terrain } = req.query;

    let showRecommendation = true;
    let reason = [];
    let recommendedVehicle = "Standard Sedan";
    let options = [];

    // Parse inputs
    const distVal = parseFloat((distance || "0").toString().replace(/,/g, '').split(' ')[0]);
    const passengerCount = parseInt(passengers || "1");
    const luggageCount = parseInt(luggage || "0");
    const terrainType = (terrain || "highway").toLowerCase(); // 'city', 'highway', 'mountain'
    const weather = (weather_condition || "").toLowerCase();

    // --- RULES ENGINE ---

    // 1. Determine Capacity Scale
    let needsLargeCapacity = false;
    let needsMediumCapacity = false;

    if (passengerCount >= 5 || (passengerCount >= 4 && luggageCount >= 3)) {
      needsLargeCapacity = true;
    } else if (passengerCount === 4 || luggageCount >= 3) {
      needsMediumCapacity = true;
    }

    // 2. Determine Environment Scale
    let needsAWD = false;
    if (weather.includes('snow') || weather.includes('ice') || weather.includes('blizzard') || terrainType === 'mountain') {
      needsAWD = true;
    }

    // 3. Selection Matrix
    if (needsLargeCapacity) {
      if (needsAWD) {
        recommendedVehicle = "Full-size SUV (4WD)";
        reason.push("Large 4WD vehicle required for passengers/cargo and terrain.");
      } else {
        recommendedVehicle = "Minivan or Full-size SUV";
        reason.push("High passenger/luggage capacity required.");
      }
    } else if (needsAWD) {
      recommendedVehicle = "AWD SUV / Jeep";
      reason.push("AWD/4WD strongly recommended for terrain/weather conditions.");
    } else if (needsMediumCapacity) {
      recommendedVehicle = "Mid-size SUV / Crossover";
      reason.push("Extra space needed for passengers/cargo.");
    } else if (terrainType === 'city' && passengerCount <= 2 && luggageCount <= 2 && distVal < 100) {
      recommendedVehicle = "Economy / Compact";
      reason.push("Compact size recommended for city navigation.");
    } else if (distVal > 300) {
      recommendedVehicle = "Full-size Sedan";
      reason.push("Comfort recommended for long-distance travel.");
    } else {
      recommendedVehicle = "Intermediate / Standard Car";
      reason.push("Best suited for your trip parameters.");
    }

    // Deduplicate and format reason
    const finalReason = reason.length > 0 ? reason.join(" ") : "Best suited for your trip parameters.";

    // --- MOCK DATA GENERATION ---
    const getLink = (term) => `https://www.kayak.com/cars?q=${encodeURIComponent(term)}`;

    if (recommendedVehicle.includes("Minivan") || (recommendedVehicle.includes("Full-size SUV") && !recommendedVehicle.includes("4WD"))) {
      options = [
        { name: "Chrysler Pacifica", features: "7 Seats • Spacious • Auto Sliding Doors", price: "$95/day", link: getLink("Minivan") },
        { name: "Chevrolet Tahoe", features: "7 Seats • Large Cargo • V8 Power", price: "$110/day", link: getLink("Full-size SUV") },
        { name: "Toyota Sienna", features: "8 Seats • Hybrid • Safety Sense", price: "$98/day", link: getLink("Minivan") }
      ];
    } else if (recommendedVehicle.includes("Full-size SUV (4WD)")) {
      options = [
        { name: "Chevrolet Tahoe 4WD", features: "7 Seats • 4WD • Heavy Duty", price: "$115/day", link: getLink("Chevrolet Tahoe 4WD") },
        { name: "Ford Expedition 4WD", features: "8 Seats • 4WD • EcoBoost", price: "$112/day", link: getLink("Ford Expedition 4WD") },
        { name: "GMC Yukon 4WD", features: "7 Seats • 4WD • Premium Interior", price: "$120/day", link: getLink("GMC Yukon 4WD") }
      ];
    } else if (recommendedVehicle.includes("AWD") || recommendedVehicle.includes("Jeep")) {
      options = [
        { name: "Jeep Grand Cherokee", features: "4WD • All-Terrain • High Clearance", price: "$98/day", link: getLink("Jeep Grand Cherokee") },
        { name: "Subaru Outback", features: "AWD • Roof Rails • Heated Seats", price: "$82/day", link: getLink("Subaru Outback") },
        { name: "Ford Explorer 4WD", features: "4WD • Terrain Management", price: "$95/day", link: getLink("Ford Explorer 4WD") }
      ];
    } else if (recommendedVehicle.includes("Mid-size SUV")) {
      options = [
        { name: "Toyota RAV4", features: "5 Seats • AWD Available • Fuel Efficient", price: "$75/day", link: getLink("Toyota RAV4") },
        { name: "Honda CR-V", features: "5 Seats • Spacious Boot • Sensing Suite", price: "$78/day", link: getLink("Honda CR-V") },
        { name: "Nissan Rogue", features: "5 Seats • ProPILOT Assist", price: "$72/day", link: getLink("Nissan Rogue") }
      ];
    } else if (recommendedVehicle.includes("Economy") || recommendedVehicle.includes("Compact")) {
      options = [
        { name: "Honda Civic", features: "High MPG • Compact • Apple CarPlay", price: "$45/day", link: getLink("Honda Civic") },
        { name: "Toyota Corolla", features: "Fuel Priority • Easy Parking", price: "$42/day", link: getLink("Toyota Corolla") },
        { name: "Hyundai Elantra", features: "Great Value • Smart Trunk", price: "$40/day", link: getLink("Hyundai Elantra") }
      ];
    } else {
      // Standard / Default
      options = [
        { name: "Toyota Camry", features: "Comfort • Smooth Ride • Spacious", price: "$55/day", link: getLink("Toyota Camry") },
        { name: "Nissan Altima", features: "Zero Gravity Seats • AWD Available", price: "$52/day", link: getLink("Nissan Altima") },
        { name: "Chevrolet Malibu", features: "Smooth Drive • WiFi Hotspot", price: "$50/day", link: getLink("Chevrolet Malibu") }
      ];
    }

    res.json({
      showRecommendation,
      reason: finalReason,
      recommendedVehicle,
      provider: "Kayak",
      options
    });

  } catch (error) {
    console.error('Rental Rec Error:', error);
    res.status(500).json({ error: 'Failed to generate rental recommendations' });
  }
});

app.listen(5001, () => {
  console.log(`Server running on port 5001`);
});
