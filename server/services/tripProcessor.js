const { getRouteFromOSRM } = require('./routeService');
const { sampleRoute, buildDistanceIndex } = require('../utils/geometry');
const { getWeatherForPoints, getWeather } = require('./weatherService');
const RealCameraService = require('./realCameraService');
const { reverseGeocode } = require('./geocodingService');
const { getRecommendations } = require('./placesService');
const { buildRouteKey, getCachedRecommendations, saveCachedRecommendations } = require('./recommendationCache');
const { generateTripAnalysis, calculateTripScore } = require('./aiService');
const { getGasPriceForLocation, calculateFuelCosts } = require('./gasPriceService');
const { getRouteTrafficDelay } = require('./trafficService');
const { getTollEstimate } = require('./tollService');
const { getIncidentsAlongRoute } = require('./incidentService');

/**
 * Human-readable city from a geocoder display name, skipping a leading street-address
 * segment. e.g. "1063 Olivia Dr, Oakdale, PA, 15071" -> "Oakdale"; "Buffalo, NY" -> "Buffalo".
 */
const cityFromDisplay = (displayName) => {
    if (!displayName) return displayName;
    const parts = displayName.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) return displayName;
    const looksLikeStreet = parts.length > 1 && (
        /^\d/.test(parts[0]) ||
        /\b(st|ave|dr|rd|blvd|ln|ct|way|hwy|pkwy|pike|street|avenue|drive|road|court|lane)\b/i.test(parts[0])
    );
    return looksLikeStreet ? parts[1] : parts[0];
};

// Full US state name -> 2-letter abbreviation, used to normalize whatever the
// geocoder hands back ("Pennsylvania" or "PA") to a compact display abbreviation.
const US_STATES = {
    alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
    colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
    hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
    kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
    massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO',
    montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
    'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH',
    oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
    'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
    virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
    'district of columbia': 'DC',
};
const US_ABBRS = new Set(Object.values(US_STATES));

/**
 * Extract a US state abbreviation from a geocoder display name.
 * e.g. "Oakdale, PA" -> "PA"; "Buffalo, New York" -> "NY";
 * "1063 Olivia Dr, Oakdale, PA, 15071" -> "PA". Returns null when none is found.
 */
const stateFromDisplay = (displayName) => {
    if (!displayName) return null;
    const parts = displayName.split(',').map(s => s.trim()).filter(Boolean);
    // Scan from the end (state sits near the end, before ZIP/country).
    for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        const lower = p.toLowerCase();
        if (US_STATES[lower]) return US_STATES[lower];
        // Match a bare or embedded 2-letter abbreviation ("PA" or "PA 15071").
        const m = p.toUpperCase().match(/\b([A-Z]{2})\b/);
        if (m && US_ABBRS.has(m[1])) return m[1];
    }
    return null;
};

/**
 * Processes a single leg of a trip (e.g. Outbound or Return).
 * @param {Object} startLoc - { lat, lon, display_name }
 * @param {Object} endLoc - { lat, lon, display_name }
 * @param {string} departureDate - YYYY-MM-DD
 * @param {string} departureTime - HH:MM
 * @param {boolean} isScenic - Whether to request an alternative "scenic" route
 * @param {Array} waypoints - Ordered intermediate stops
 * @param {Object|null} prefetchedRoute - Pre-selected { geometry, duration, distance }.
 *   When provided (from a shared candidate set), the leg is enriched against this exact
 *   geometry instead of making its own OSRM call — this is what keeps fastest ≤ scenic.
 * @returns {Promise<Object>} Enriched route data
 */
const processLeg = async (startLoc, endLoc, departureDate, departureTime, isScenic = false, waypoints = [], prefetchedRoute = null) => {
    // 1. Calculate Base Time
    let baseDepTime = Date.now();
    if (departureDate) {
        const datePart = departureDate;
        const timePart = departureTime || "12:00";
        baseDepTime = new Date(`${datePart}T${timePart}`).getTime();
        if (isNaN(baseDepTime)) baseDepTime = Date.now();
    }

    // 2. Route (OSRM)
    // Prefer a route pre-selected from the shared candidate set (guarantees fastest ≤ scenic).
    // Fall back to a direct OSRM call only if none was supplied (e.g. candidate fetch failed).
    const routeData = prefetchedRoute && prefetchedRoute.geometry
        ? prefetchedRoute
        : await getRouteFromOSRM(
            startLoc.lon, startLoc.lat,
            endLoc.lon, endLoc.lat,
            isScenic,
            'fastest',
            waypoints
        );

    // 3. Sample
    // 3. Sample
    const fullCoordinates = routeData.geometry.coordinates;
    const totalDistanceMiles = routeData.distance * 0.000621371;

    // Dynamic Sampling - Optimized for Speed
    // Reduce target points to minimize API calls (Weather + Geocode)
    const TARGET_POINTS = 12; // Reduced from 25
    let intervalMiles = totalDistanceMiles / TARGET_POINTS;
    if (intervalMiles < 10) intervalMiles = 10; // Increased min interval from 5 to 10 miles

    const sampledPoints = sampleRoute(fullCoordinates, intervalMiles);
    // 4. Enrichments
    // Pre-calc values
    const distanceVal = (routeData.distance / 1609.34).toFixed(1) + " miles";
    const minutes = Math.round(routeData.duration / 60);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const durationVal = hours > 0 ? `${hours} hr ${mins} min` : `${mins} min`;

    const [weatherData, roadConditions, recommendations, incidents] = await Promise.all([
        // A. Weather
        (async () => {
            const totalDurationSeconds = routeData.duration || 0;
            const pointsForWeather = sampledPoints.map(([lng, lat], i) => {
                const progress = i / Math.max(1, sampledPoints.length - 1);
                const timeOffsetSeconds = progress * totalDurationSeconds;
                const pointEtaDate = new Date(baseDepTime + (timeOffsetSeconds * 1000));
                return {
                    lat,
                    lng,
                    dateStr: pointEtaDate.toISOString().split('T')[0],
                    targetHour: pointEtaDate.getHours()
                };
            });

            // Parallelize weather fetching more aggressively if provider allows, 
            // OR use the existing batched approach but with fewer points (already done via TARGET_POINTS)
            const rawWeatherResults = await getWeatherForPoints(pointsForWeather, departureDate);

            // Gap Filling (Simple Neighbor approach)
            const weatherResults = rawWeatherResults.map((item, idx, arr) => {
                if (item.weather && item.weather.temperature !== undefined) return item;
                let left = idx - 1, right = idx + 1, replacement = null;
                while (left >= 0 || right < arr.length) {
                    if (left >= 0 && arr[left].weather) { replacement = arr[left]; break; }
                    if (right < arr.length && arr[right].weather) { replacement = arr[right]; break; }
                    left--; right++;
                }
                if (!replacement) return { ...item, weather: { temperature: 20, weathercode: 0, windSpeed: 5, humidity: 50, precipitationProbability: 0, description: "Estimated" } };
                return { ...item, weather: replacement.weather };
            });

            // Process in chunks - Optimized: Skip Reverse Geocoding for intermediate points to save time
            // Only reverse geocode Start, End, and maybe 1-2 mid points if really needed.
            // For now, we will use "Mile X" for speed.

            // 2024-FIX: Actually fetch real names for major points
            // We can do this in parallel since we have a cache
            const finalResultsPromise = weatherResults.map(async (w, i) => {
                const progress = i / Math.max(1, weatherResults.length - 1);
                const distMiles = Math.round(progress * Number(totalDistanceMiles));

                const timeOffsetSeconds = progress * totalDurationSeconds;
                const etaDate = new Date(baseDepTime + (timeOffsetSeconds * 1000));
                const eta = etaDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

                let city = `Mile ${distMiles}`;
                let fullLocationForGas = city; // Full name with state for gas price lookup
                if (i === 0) {
                    city = cityFromDisplay(startLoc.display_name);
                    fullLocationForGas = startLoc.display_name;
                }
                else if (i === weatherResults.length - 1) {
                    city = cityFromDisplay(endLoc.display_name);
                    fullLocationForGas = endLoc.display_name;
                }
                else {
                    // Try to get real name
                    try {
                        const realName = await reverseGeocode(w.lat, w.lng);
                        if (realName) {
                            city = cityFromDisplay(realName);  // Display: just city
                            fullLocationForGas = realName;      // Gas lookup: "City, State"
                        }
                    } catch (e) {
                        console.warn(`Failed to geocode point ${i}: ${e.message}`);
                    }
                    console.log(`[DEBUG] Point ${i} (${w.lat}, ${w.lng}) -> ${city}`);
                }

                // Fetch real gas price for this location's state
                let gasPrice = null;
                try {
                    gasPrice = await getGasPriceForLocation(fullLocationForGas);
                } catch (e) {
                    console.warn(`[GasPrice] Failed for ${city}: ${e.message}`);
                }

                return {
                    ...w.weather,
                    location: city,
                    state: stateFromDisplay(fullLocationForGas),
                    lat: w.lat,
                    lng: w.lng,
                    distanceFromStart: distMiles,
                    eta: `ETA ${eta}`,
                    gasPrice: gasPrice ? gasPrice.toFixed(2) : null
                };
            });

            const finalResults = await Promise.all(finalResultsPromise);
            console.log(`[TripProcessor] Weather data returned: ${finalResults.length} points with coords:`, finalResults.map(r => `${r.location}(${r.lat?.toFixed(3)},${r.lng?.toFixed(3)})`).join(' | '));
            return finalResults;
        })(),

        // B. Road Conditions
        (async () => {
            const roadIndices = [0, Math.floor(fullCoordinates.length * 0.33), Math.floor(fullCoordinates.length * 0.66), fullCoordinates.length - 1];
            const uniqueIndices = [...new Set(roadIndices)];

            return Promise.all(uniqueIndices.map(async (idx, i) => {
                const [lng, lat] = fullCoordinates[idx];
                let locationName = i === 0 ? "Start Area" : i === uniqueIndices.length - 1 ? "Destination Area" : `Segment ${i + 1}`;

                // FIX: Use real location names for road segments
                try {
                    const realName = await reverseGeocode(lat, lng);
                    if (realName) locationName = realName;
                } catch (e) {
                    console.warn(`Road segment geocode failed: ${e.message}`);
                }

                const progress = idx / Math.max(1, fullCoordinates.length - 1);
                const timeOffsetSeconds = progress * (routeData.duration || 0);
                const etaDate = new Date(baseDepTime + (timeOffsetSeconds * 1000));
                const w = await getWeather(lat, lng, departureDate, etaDate.getHours()); // Ensure this is cached/fast 
                const code = w?.weathercode || 0;

                let status = "good", desc = "Clear roads, normal traffic flow";
                if ([71, 73, 75, 85, 86].includes(code)) { status = "poor"; desc = "Snow/Ice detected."; }
                else if ([51, 61, 63, 80, 81, 95, 96, 99].includes(code)) { status = "moderate"; desc = "Wet roads."; }
                else if ([45, 48].includes(code)) { status = "moderate"; desc = "Foggy conditions."; }

                let cameraObj = null;
                try { cameraObj = await RealCameraService.getCamerasNY(lat, lng); } catch (e) { }
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
                    status, description: desc,
                    distance: `${((idx / fullCoordinates.length) * totalDistanceMiles).toFixed(0)} mi`,
                    location: { lat, lon: lng },
                    camera: cameraObj
                };
            }));
        })(),

        // C. Places
        (async () => {
            // Serve a stable, cached set per route when available — Overpass is flaky, so
            // re-fetching live returns a different mix every time (breaks ratings, which
            // need the same stop to reappear). Cache the first good result and reuse it.
            const routeKey = buildRouteKey(startLoc, endLoc, isScenic, waypoints);
            const cached = await getCachedRecommendations(routeKey);
            if (cached) return cached;

            // Distance index over the full route — used both to place search points
            // evenly by DISTANCE and to give each stop its true mileage from the start.
            const distanceIndex = buildDistanceIndex(fullCoordinates);
            const totalMiles = distanceIndex.length ? distanceIndex[distanceIndex.length - 1].cumMiles : totalDistanceMiles;

            // Search points ANCHORED near the start, then spaced by a capped interval, so
            // the early miles are always covered (a fraction-based spread put the first
            // point at total/(n+1) — ~127mi on a 1400mi route, leaving the start empty).
            const MAX_POINTS = 14;
            const spacing = Math.max(50, totalMiles / MAX_POINTS); // cap the count via spacing
            const firstAt = Math.min(30, totalMiles * 0.4);        // early coverage, even on long routes
            const targetList = [];
            for (let m = firstAt; m < totalMiles - 8 && targetList.length < MAX_POINTS; m += spacing) {
                targetList.push(m);
            }
            if (targetList.length === 0) targetList.push(totalMiles / 2);

            const contextPoints = targetList.map(targetMiles => {
                let best = distanceIndex[0];
                let bestD = Infinity;
                for (const e of distanceIndex) {
                    const dd = Math.abs(e.cumMiles - targetMiles);
                    if (dd < bestD) { bestD = dd; best = e; }
                }
                return {
                    segment: `${Math.round(targetMiles)} mi`,
                    location: { lat: best.lat, lon: best.lon },
                    miles: Math.round(targetMiles),
                };
            });
            const fresh = await getRecommendations(contextPoints, distanceIndex);
            await saveCachedRecommendations(routeKey, fresh);
            return fresh;
        })(),

        // D. Traffic Incidents (accidents, closures, construction, jams)
        (async () => {
            try {
                return await getIncidentsAlongRoute(fullCoordinates);
            } catch (e) {
                console.warn(`[Incidents] Failed: ${e.message}`);
                return [];
            }
        })()
    ]);

    // D. AI Analysis
    // Calculate real fuel costs using actual gas prices from the route
    const gasPrices = weatherData.map(w => w.gasPrice).filter(p => p && !isNaN(parseFloat(p)));
    const avgGasPrice = gasPrices.length > 0 
        ? gasPrices.reduce((sum, p) => sum + parseFloat(p), 0) / gasPrices.length 
        : 3.20; // National avg fallback
    
    const fuelCosts = calculateFuelCosts(totalDistanceMiles, avgGasPrice);
    const fuelCostStr = fuelCosts.gas;
    const evCostStr = fuelCosts.ev;

    const uniqueCities = [...new Set(weatherData.map(w => w.location).filter(l => l && !l.includes("Mile")))];
    const cityList = uniqueCities.length > 2 ? [uniqueCities[0], uniqueCities[Math.floor(uniqueCities.length / 2)], uniqueCities[uniqueCities.length - 1]] : uniqueCities;

    const temps = weatherData.map(w => w.temperature).filter(t => !isNaN(t));
    const minTemp = temps.length ? Math.round((Math.min(...temps) * 9 / 5) + 32) : 0;
    const maxTemp = temps.length ? Math.round((Math.max(...temps) * 9 / 5) + 32) : 0;

    // Get REAL traffic delay from TomTom (or fallback to heuristic)
    const trafficResult = await getRouteTrafficDelay(fullCoordinates, routeData.duration, routeData.distance);
    const trafficDelayMins = trafficResult.delayMinutes;
    console.log(`[TripProcessor] Traffic: ${trafficResult.isRealData ? 'TomTom' : 'Heuristic'} delay=${trafficDelayMins}min, level=${trafficResult.congestionLevel}`);

    // Estimate toll costs (TollGuru if configured, else state-based heuristic)
    // Build region hints from reverse-geocoded road segments + endpoints for state detection.
    const tollRegionHints = [
        startLoc.display_name,
        ...roadConditions.map(rc => rc.segment),
        endLoc.display_name
    ].filter(Boolean);
    const tollResult = await getTollEstimate(fullCoordinates, routeData.distance, tollRegionHints);
    console.log(`[TripProcessor] Tolls: ${tollResult.source} total=${tollResult.display} (estimated=${tollResult.isEstimated})`);

    const maxWindKm = Math.max(...weatherData.map(w => w.windSpeed || 0), 0);
    const maxWind = Math.round(maxWindKm * 0.621371);
    const precipCount = weatherData.filter(w => [51, 61, 63, 80, 81, 95, 96, 99, 71, 73, 75, 85, 86].includes(w.weather?.weather_code)).length;
    const precipChance = Math.round((precipCount / Math.max(1, weatherData.length)) * 100);

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

    // Summarize incidents for AI context + scoring
    const incidentCounts = incidents.reduce((acc, inc) => {
        acc[inc.type] = (acc[inc.type] || 0) + 1;
        return acc;
    }, {});

    const aiContext = {
        fuelCost: fuelCostStr, evCost: evCostStr, cities: cityList,
        minTemp, maxTemp, trafficDelay: trafficDelayMins, maxWind, precipChance,
        recommendations: distinctStops, roadConditions, departureDate, departureTime,
        tollCost: tollResult.total, tollDisplay: tollResult.display, tollEstimated: tollResult.isEstimated,
        incidents, incidentCounts,
        durationMinutes: minutes, distanceMiles: Number(totalDistanceMiles)
    };

    const aiAnalysis = generateTripAnalysis(startLoc.display_name, endLoc.display_name, weatherData, distanceVal, durationVal, roadConditions, aiContext);
    const safetyScore = calculateTripScore(aiContext);

    // E. Smart Departure (Only for Outbound usually, but we can compute for all)
    const departureInsights = [];
    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = !departureDate || departureDate === todayStr;

    if (isToday) {
        try {
            const now = new Date();
            const offsets = [1, 2, 3];
            const startLat = startLoc.lat, startLng = startLoc.lon;

            const results = await Promise.all(offsets.map(async (offset) => {
                const futureTime = new Date(now.getTime() + offset * 60 * 60 * 1000);
                const hour = futureTime.getHours();
                const dateStr = futureTime.toISOString().split('T')[0];
                const w = await getWeather(startLat, startLng, dateStr, hour, 'UTC');

                if (w) {
                    let estimatedDelay = trafficDelayMins;
                    let trafficLabel = "Normal";
                    // Heuristics
                    if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19)) { estimatedDelay += 15; trafficLabel = "Heavy"; }
                    else if (hour >= 22 || hour <= 5) { estimatedDelay = 0; trafficLabel = "Clear"; }
                    else { estimatedDelay += 5; trafficLabel = estimatedDelay > 10 ? "Busy" : "Normal"; }

                    const futureContext = { ...aiContext, trafficDelay: estimatedDelay, precipChance: w.precipitationProbability || 0, maxWind: w.windSpeed || 0, minTemp: w.temperature, roadConditions };
                    const scoreObj = calculateTripScore(futureContext);
                    return {
                        offsetHours: offset,
                        time: futureTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
                        ts: futureTime.getTime(),
                        score: scoreObj.score, label: scoreObj.label,
                        precip: w.precipitationProbability || 0, temp: w.temperature, trafficLabel
                    };
                }
                return null;
            }));
            departureInsights.push(...results.filter(r => r !== null));
        } catch (e) {
            console.log("Departure insights error", e.message);
        }
    }

    return {
        route: routeData.geometry,
        metrics: {
            distance: distanceVal,
            time: durationVal,
            fuel: fuelCostStr,
            ev: evCostStr,
            gasPricePerGallon: `$${avgGasPrice.toFixed(2)}/gal`,
            trafficSource: trafficResult.isRealData ? 'TomTom' : 'estimated',
            tollCost: tollResult.display,
            tollEstimated: tollResult.isEstimated
        },
        weather: weatherData,
        roadConditions,
        aiAnalysis,
        tripScore: safetyScore,
        departureInsights,
        recommendations,
        traffic: {
            delayMinutes: trafficDelayMins,
            congestionLevel: trafficResult.congestionLevel,
            segments: trafficResult.segments,
            isRealData: trafficResult.isRealData
        },
        incidents,
        tolls: {
            total: tollResult.total,
            currency: tollResult.currency,
            display: tollResult.display,
            breakdown: tollResult.breakdown,
            isEstimated: tollResult.isEstimated,
            source: tollResult.source
        }
    };
};

module.exports = { processLeg };
