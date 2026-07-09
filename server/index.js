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

// ── AI Trip Planner chat ──
const { runChatTurn } = require('./services/aiChatService');
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, tripContext } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }
    const result = await runChatTurn(messages, tripContext || {});
    res.json(result);
  } catch (err) {
    console.error('[chat] error:', err.message);
    res.status(err.status || 500).json({ error: err.message || 'Chat failed' });
  }
});

const logDebug = require('./fileLogger');

app.post('/api/route', async (req, res) => {
  try {
    const { start, end, startCoords, endCoords, departureDate, departureTime, roundTrip, preference, returnDate, returnTime, waypoints } = req.body;

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

    // Geocode any intermediate waypoints that lack coordinates.
    // Waypoints without a resolvable location are skipped (route still works).
    let wpCoords = [];
    if (Array.isArray(waypoints) && waypoints.length > 0) {
      wpCoords = await Promise.all(waypoints.map(async (wp) => {
        if (!wp) return null;
        if (wp.lat && (wp.lng || wp.lon)) {
          return { lat: wp.lat, lon: wp.lng !== undefined ? wp.lng : wp.lon, display_name: wp.name || 'Stop' };
        }
        if (wp.name) {
          try {
            const c = await geocode(wp.name);
            if (c) return { lat: c.lat, lon: c.lon, display_name: wp.name };
          } catch (e) {
            logDebug(`[WARN] Waypoint geocode failed: ${wp.name}`);
          }
        }
        return null;
      }));
      wpCoords = wpCoords.filter(Boolean);
      logDebug(`[PROCESS] ${wpCoords.length} waypoint(s) resolved`);
    }

    // 2. Process Routes (Parallel: Fastest & Scenic)
    // We compute both to allow instant switching on frontend
    const { processLeg } = require('./services/tripProcessor');

    // Define helper to get both variants for a leg
    // Define helper to get both variants for a leg
    const getLegVariants = async (s, d, date, time, legWaypoints = []) => {
      const results = await Promise.allSettled([
        processLeg(s, d, date, time, false, legWaypoints),
        processLeg(s, d, date, time, true, legWaypoints)
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
    const outboundVariants = await getLegVariants(sCoords, dCoords, departureDate, departureTime, wpCoords);

    // Return (if applicable) — waypoints traversed in reverse order on the way back
    let returnVariants = null;
    if (roundTrip) {
      logDebug(`[PROCESS] Calculating return leg variants...`);
      try {
        const returnWaypoints = [...wpCoords].reverse();
        returnVariants = await getLegVariants(dCoords, sCoords, returnDate || departureDate, returnTime || departureTime, returnWaypoints);
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

// --- Fast Route Preview (Phase 1 of streaming) ---
// Returns just the route geometry + basic metrics for the primary preference so the
// client can render the map in ~2-3s while /api/route enriches the rest in the background.
app.post('/api/route/preview', async (req, res) => {
  try {
    const { start, end, startCoords, endCoords, preference, waypoints } = req.body;
    const { getRouteFromOSRM } = require('./services/routeService');

    if (!start || !end) {
      return res.status(400).json({ error: 'Start and End locations are required' });
    }

    // Geocode endpoints (reuse client-provided coords when available)
    let sCoords, dCoords;
    if (startCoords && startCoords.lat && startCoords.lng) {
      sCoords = { lat: startCoords.lat, lon: startCoords.lng };
    } else {
      sCoords = await geocode(start);
    }
    if (endCoords && endCoords.lat && endCoords.lng) {
      dCoords = { lat: endCoords.lat, lon: endCoords.lng };
    } else {
      dCoords = await geocode(end);
    }
    if (!sCoords || !dCoords) {
      return res.status(422).json({ error: 'Could not resolve locations.' });
    }

    // Geocode any waypoints lacking coordinates (so phase 2 can reuse them)
    let wpCoords = [];
    if (Array.isArray(waypoints) && waypoints.length > 0) {
      wpCoords = await Promise.all(waypoints.map(async (wp) => {
        if (!wp) return null;
        if (wp.lat && (wp.lng || wp.lon)) {
          return { lat: wp.lat, lon: wp.lng !== undefined ? wp.lng : wp.lon, name: wp.name || 'Stop' };
        }
        if (wp.name) {
          try { const c = await geocode(wp.name); if (c) return { lat: c.lat, lon: c.lon, name: wp.name }; } catch (e) { }
        }
        return null;
      }));
      wpCoords = wpCoords.filter(Boolean);
    }

    // OSRM route for the requested preference (outbound only, no enrichment)
    const isScenic = preference === 'scenic';
    const routeData = await getRouteFromOSRM(
      sCoords.lon, sCoords.lat, dCoords.lon, dCoords.lat, isScenic, 'fastest', wpCoords
    );

    const distanceVal = (routeData.distance / 1609.34).toFixed(1) + " miles";
    const minutes = Math.round(routeData.duration / 60);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const durationVal = hours > 0 ? `${hours} hr ${mins} min` : `${mins} min`;

    res.json({
      route: routeData.geometry,
      metrics: { distance: distanceVal, time: durationVal },
      startCoords: { lat: sCoords.lat, lng: sCoords.lon },
      endCoords: { lat: dCoords.lat, lng: dCoords.lon },
      waypointCoords: wpCoords.map(w => ({ lat: w.lat, lng: w.lon, name: w.name }))
    });
  } catch (error) {
    console.error('Route preview error:', error.message);
    res.status(500).json({ error: 'Failed to generate route preview' });
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

    // 3. Accumulated Miles (from real 'trip_generated' events only — no fabricated base)
    const loggedMiles = memoryAnalytics
      .filter(e => e.eventType === 'trip_generated' && e.metadata.distance)
      .reduce((acc, curr) => acc + (parseFloat(curr.metadata.distance) || 0), 0);

    const totalSafeMiles = Math.round(loggedMiles);

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

    // Return only real, measured data. Empty/zero when nothing has been logged yet;
    // the client hides sections that have no data rather than showing placeholders.
    res.json({
      activeUsers,
      topDestinations,
      totalSafeMiles,
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

    // --- MARKET-RATE PRICING ENGINE ---
    // Base rates sourced from AAA, Kayak, and industry published averages (2024-2025)
    // Adjusted by: trip distance (long-haul premium), terrain, and seasonal factors
    const getLink = (term) => `https://www.kayak.com/cars?q=${encodeURIComponent(term)}`;

    // Base daily rates by vehicle class (national averages from published data)
    const BASE_RATES = {
      economy:    { low: 35, high: 55 },    // Economy/Compact
      standard:   { low: 45, high: 72 },    // Intermediate/Standard
      fullSedan:  { low: 55, high: 85 },    // Full-size Sedan
      midSUV:     { low: 60, high: 95 },    // Mid-size SUV/Crossover
      awdSUV:     { low: 75, high: 115 },   // AWD SUV / Jeep
      fullSUV:    { low: 85, high: 140 },   // Full-size SUV
      fullSUV4WD: { low: 100, high: 160 },  // Full-size SUV 4WD
      minivan:    { low: 80, high: 130 }    // Minivan
    };

    // Adjustments
    let distanceMultiplier = 1.0;
    if (distVal > 500) distanceMultiplier = 1.08;       // Long trips → slight premium (insurance/wear)
    else if (distVal > 300) distanceMultiplier = 1.04;
    else if (distVal < 50) distanceMultiplier = 0.95;    // Short trips → slight discount

    let terrainMultiplier = 1.0;
    if (terrainType === 'mountain') terrainMultiplier = 1.10;  // Mountain terrain → AWD premium
    else if (terrainType === 'city') terrainMultiplier = 0.95; // City → slightly cheaper

    const calcPrice = (rateCategory) => {
      const base = BASE_RATES[rateCategory];
      const low = Math.round(base.low * distanceMultiplier * terrainMultiplier);
      const high = Math.round(base.high * distanceMultiplier * terrainMultiplier);
      const mid = Math.round((low + high) / 2);
      return { display: `$${low}-${high}/day`, avg: `$${mid}/day`, low, high };
    };

    if (recommendedVehicle.includes("Minivan") || (recommendedVehicle.includes("Full-size SUV") && !recommendedVehicle.includes("4WD"))) {
      const minivanRate = calcPrice('minivan');
      const fullSUVRate = calcPrice('fullSUV');
      options = [
        { name: "Chrysler Pacifica", features: "7 Seats • Spacious • Auto Sliding Doors", price: minivanRate.display, avgPrice: minivanRate.avg, link: getLink("Minivan") },
        { name: "Chevrolet Tahoe", features: "7 Seats • Large Cargo • V8 Power", price: fullSUVRate.display, avgPrice: fullSUVRate.avg, link: getLink("Full-size SUV") },
        { name: "Toyota Sienna", features: "8 Seats • Hybrid • Safety Sense", price: minivanRate.display, avgPrice: minivanRate.avg, link: getLink("Minivan") }
      ];
    } else if (recommendedVehicle.includes("Full-size SUV (4WD)")) {
      const rate = calcPrice('fullSUV4WD');
      options = [
        { name: "Chevrolet Tahoe 4WD", features: "7 Seats • 4WD • Heavy Duty", price: rate.display, avgPrice: rate.avg, link: getLink("Chevrolet Tahoe 4WD") },
        { name: "Ford Expedition 4WD", features: "8 Seats • 4WD • EcoBoost", price: rate.display, avgPrice: rate.avg, link: getLink("Ford Expedition 4WD") },
        { name: "GMC Yukon 4WD", features: "7 Seats • 4WD • Premium Interior", price: rate.display, avgPrice: rate.avg, link: getLink("GMC Yukon 4WD") }
      ];
    } else if (recommendedVehicle.includes("AWD") || recommendedVehicle.includes("Jeep")) {
      const rate = calcPrice('awdSUV');
      options = [
        { name: "Jeep Grand Cherokee", features: "4WD • All-Terrain • High Clearance", price: rate.display, avgPrice: rate.avg, link: getLink("Jeep Grand Cherokee") },
        { name: "Subaru Outback", features: "AWD • Roof Rails • Heated Seats", price: rate.display, avgPrice: rate.avg, link: getLink("Subaru Outback") },
        { name: "Ford Explorer 4WD", features: "4WD • Terrain Management", price: rate.display, avgPrice: rate.avg, link: getLink("Ford Explorer 4WD") }
      ];
    } else if (recommendedVehicle.includes("Mid-size SUV")) {
      const rate = calcPrice('midSUV');
      options = [
        { name: "Toyota RAV4", features: "5 Seats • AWD Available • Fuel Efficient", price: rate.display, avgPrice: rate.avg, link: getLink("Toyota RAV4") },
        { name: "Honda CR-V", features: "5 Seats • Spacious Boot • Sensing Suite", price: rate.display, avgPrice: rate.avg, link: getLink("Honda CR-V") },
        { name: "Nissan Rogue", features: "5 Seats • ProPILOT Assist", price: rate.display, avgPrice: rate.avg, link: getLink("Nissan Rogue") }
      ];
    } else if (recommendedVehicle.includes("Economy") || recommendedVehicle.includes("Compact")) {
      const rate = calcPrice('economy');
      options = [
        { name: "Honda Civic", features: "High MPG • Compact • Apple CarPlay", price: rate.display, avgPrice: rate.avg, link: getLink("Honda Civic") },
        { name: "Toyota Corolla", features: "Fuel Priority • Easy Parking", price: rate.display, avgPrice: rate.avg, link: getLink("Toyota Corolla") },
        { name: "Hyundai Elantra", features: "Great Value • Smart Trunk", price: rate.display, avgPrice: rate.avg, link: getLink("Hyundai Elantra") }
      ];
    } else if (recommendedVehicle.includes("Full-size Sedan")) {
      const rate = calcPrice('fullSedan');
      options = [
        { name: "Toyota Camry", features: "Comfort • Smooth Ride • Spacious", price: rate.display, avgPrice: rate.avg, link: getLink("Toyota Camry") },
        { name: "Nissan Altima", features: "Zero Gravity Seats • AWD Available", price: rate.display, avgPrice: rate.avg, link: getLink("Nissan Altima") },
        { name: "Chevrolet Malibu", features: "Smooth Drive • WiFi Hotspot", price: rate.display, avgPrice: rate.avg, link: getLink("Chevrolet Malibu") }
      ];
    } else {
      // Standard / Intermediate
      const rate = calcPrice('standard');
      options = [
        { name: "Toyota Camry", features: "Comfort • Smooth Ride • Spacious", price: rate.display, avgPrice: rate.avg, link: getLink("Toyota Camry") },
        { name: "Nissan Altima", features: "Zero Gravity Seats • AWD Available", price: rate.display, avgPrice: rate.avg, link: getLink("Nissan Altima") },
        { name: "Chevrolet Malibu", features: "Smooth Drive • WiFi Hotspot", price: rate.display, avgPrice: rate.avg, link: getLink("Chevrolet Malibu") }
      ];
    }

    // Wayvue shows only accurate data. There is no free/self-service live car-rental
    // pricing API (real rates require a paid partner e.g. CarTrawler/Priceline), so we
    // do NOT surface fabricated rental prices — only the vehicle match + real Kayak links.
    const optionsNoPrice = options.map(({ price, avgPrice, ...rest }) => rest);

    res.json({
      showRecommendation,
      reason: finalReason,
      recommendedVehicle,
      provider: "Kayak",
      priceSource: null,
      isLive: false,
      livePricingAvailable: false,
      options: optionsNoPrice
    });

  } catch (error) {
    console.error('Rental Rec Error:', error);
    res.status(500).json({ error: 'Failed to generate rental recommendations' });
  }
});

// --- Smart Hotel / Lodging Recommendation Endpoint ---
app.get('/api/trip/hotel-recommendations', async (req, res) => {
  try {
    const { distance, nights, budget, guests, origin, destination, checkIn, checkOut, lat, lng } = req.query;
    const { getLiveHotelOffers, hasAmadeusCredentials } = require('./services/hotelPricingService');

    // Parse inputs
    const distVal = parseFloat((distance || "0").toString().replace(/,/g, '').split(' ')[0]);
    const nightCount = Math.max(1, parseInt(nights || "1"));
    const guestCount = Math.max(1, parseInt(guests || "2"));
    const budgetPref = (budget || "").toString().toLowerCase(); // 'economy' | 'standard' | 'premium'

    // --- TIER SELECTION ---
    // Respect explicit budget preference; otherwise derive from trip profile.
    let recommendedTier;
    let reason = [];

    if (budgetPref === 'economy' || budgetPref === 'standard' || budgetPref === 'premium') {
      recommendedTier = budgetPref.charAt(0).toUpperCase() + budgetPref.slice(1);
      reason.push(`Matching your ${recommendedTier.toLowerCase()} budget preference.`);
    } else if (distVal > 400 || nightCount >= 3) {
      recommendedTier = 'Premium';
      reason.push("Longer journeys benefit from a comfortable, well-rested stay.");
    } else if (distVal > 150) {
      recommendedTier = 'Standard';
      reason.push("A reliable mid-scale stay balances comfort and value for this trip.");
    } else {
      recommendedTier = 'Economy';
      reason.push("A budget-friendly stay is well-suited for a shorter trip.");
    }

    if (guestCount >= 3) {
      reason.push("Rooms selected accommodate your group size.");
    }

    const finalReason = reason.join(" ");

    // Resolve check-in / check-out dates
    const today = new Date().toISOString().split('T')[0];
    const ci = (checkIn && /^\d{4}-\d{2}-\d{2}$/.test(checkIn)) ? checkIn : today;
    let co = (checkOut && /^\d{4}-\d{2}-\d{2}$/.test(checkOut)) ? checkOut : null;
    if (!co || co <= ci) {
      const d = new Date(ci); d.setDate(d.getDate() + nightCount);
      co = d.toISOString().split('T')[0];
    }

    // --- LIVE PRICING via Amadeus (real rates only) ---
    let liveOptions = null;
    if (hasAmadeusCredentials()) {
      let dLat = parseFloat(lat), dLng = parseFloat(lng);
      if (isNaN(dLat) || isNaN(dLng)) {
        try {
          const c = await geocode(destination || origin || "");
          if (c) { dLat = c.lat; dLng = c.lon; }
        } catch (e) { /* geocode failed → no live pricing */ }
      }
      if (!isNaN(dLat) && !isNaN(dLng)) {
        liveOptions = await getLiveHotelOffers({ lat: dLat, lng: dLng, checkIn: ci, checkOut: co, adults: guestCount });
      }
    }

    if (liveOptions && liveOptions.length > 0) {
      return res.json({
        showRecommendation: true,
        reason: finalReason,
        recommendedTier,
        nights: nightCount,
        provider: "Amadeus",
        priceSource: "Live rates (Amadeus)",
        isLive: true,
        options: liveOptions
      });
    }

    // --- NO LIVE PRICING: representative options WITHOUT prices (never fabricated) ---
    const destCity = (destination || origin || "").toString().split(',')[0].trim();
    const getLink = (label) => {
      const q = encodeURIComponent(`${label} ${destCity}`.trim());
      return `https://www.booking.com/searchresults.html?ss=${q}&checkin=${ci}&checkout=${co}&group_adults=${guestCount}&no_rooms=1`;
    };

    let options;
    if (recommendedTier === 'Premium') {
      options = [
        { name: "Marriott / Westin", features: "Full-service • Pool & Gym • Premium Bedding", link: getLink("Marriott") },
        { name: "Hilton / DoubleTree", features: "On-site Dining • Room Service • Business Center", link: getLink("Hilton") },
        { name: "Hyatt Place", features: "Spacious Suites • Free Breakfast • 24h Desk", link: getLink("Hyatt") }
      ];
    } else if (recommendedTier === 'Standard') {
      options = [
        { name: "Courtyard by Marriott", features: "Free WiFi • Fitness Center • Free Parking", link: getLink("Courtyard by Marriott") },
        { name: "Hampton Inn", features: "Free Hot Breakfast • Clean Rooms • Pool", link: getLink("Hampton Inn") },
        { name: "Holiday Inn Express", features: "Free Breakfast • Pet Friendly • Free Parking", link: getLink("Holiday Inn Express") }
      ];
    } else {
      options = [
        { name: "La Quinta Inn", features: "Free Breakfast • Pet Friendly • Free Parking", link: getLink("La Quinta") },
        { name: "Super 8 / Motel 6", features: "Budget Rate • Free Parking • 24h Check-in", link: getLink("Super 8") },
        { name: "Days Inn", features: "Free WiFi • Free Breakfast • Easy Highway Access", link: getLink("Days Inn") }
      ];
    }

    res.json({
      showRecommendation: true,
      reason: finalReason,
      recommendedTier,
      nights: nightCount,
      provider: "Booking.com",
      priceSource: null,       // No fabricated pricing — live rates require Amadeus config
      isLive: false,
      livePricingAvailable: hasAmadeusCredentials(),
      options                  // name + features + real booking link, no price fields
    });

  } catch (error) {
    console.error('Hotel Rec Error:', error);
    res.status(500).json({ error: 'Failed to generate hotel recommendations' });
  }
});

app.listen(5001, () => {
  console.log(`Server running on port 5001`);
});
