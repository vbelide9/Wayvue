const { getRouteFromOSRM } = require('./routeService');
const { sampleRoute } = require('../utils/geometry');
const { getWeatherForPoints, getWeather } = require('./weatherService');
const RealCameraService = require('./realCameraService');
const { reverseGeocode } = require('./geocodingService');
const { getRecommendations } = require('./placesService');
const { generateTripAnalysis, calculateTripScore } = require('./aiService');

/**
 * Processes a single leg of a trip (e.g. Outbound or Return).
 * @param {Object} startLoc - { lat, lon, display_name }
 * @param {Object} endLoc - { lat, lon, display_name }
 * @param {string} departureDate - YYYY-MM-DD
 * @param {string} departureTime - HH:MM
 * @param {boolean} isScenic - Whether to request an alternative "scenic" route
 * @returns {Promise<Object>} Enriched route data
 */
const processLeg = async (startLoc, endLoc, departureDate, departureTime, isScenic = false) => {
    // 1. Calculate Base Time
    let baseDepTime = Date.now();
    if (departureDate) {
        const datePart = departureDate;
        const timePart = departureTime || "12:00";
        baseDepTime = new Date(`${datePart}T${timePart}`).getTime();
        if (isNaN(baseDepTime)) baseDepTime = Date.now();
    }

    // 2. Route (OSRM)
    // Pass 'isScenic' as the 'alternatives' flag
    const routeData = await getRouteFromOSRM(
        startLoc.lon, startLoc.lat,
        endLoc.lon, endLoc.lat,
        isScenic
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

    const [weatherData, roadConditions, recommendations] = await Promise.all([
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
                if (i === 0) city = startLoc.display_name.split(',')[0];
                else if (i === weatherResults.length - 1) city = endLoc.display_name.split(',')[0];
                else {
                    // Try to get real name
                    try {
                        const realName = await reverseGeocode(w.lat, w.lng);
                        if (realName) city = realName; // Keep full name (City, State)
                    } catch (e) {
                        console.warn(`Failed to geocode point ${i}: ${e.message}`);
                    }
                    console.log(`[DEBUG] Point ${i} (${w.lat}, ${w.lng}) -> ${city}`);
                }

                return {
                    ...w.weather,
                    location: city,
                    lat: w.lat,
                    lng: w.lng,
                    distanceFromStart: distMiles,
                    eta: `ETA ${eta}`,
                    gasPrice: (2.90 + Math.random() * 0.7).toFixed(2)
                };
            });

            const finalResults = await Promise.all(finalResultsPromise);

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
            let samplePoints = [0.1, 0.5, 0.9];
            if (totalDistanceMiles > 100) samplePoints = [0.1, 0.3, 0.5, 0.7, 0.9];

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

    // D. AI Analysis
    const fuelCostStr = `$${(routeData.distance / 1609.34 * 0.15).toFixed(0)}`;
    const evCostStr = `$${(routeData.distance / 1609.34 * 0.10).toFixed(0)}`;
    const uniqueCities = [...new Set(weatherData.map(w => w.location).filter(l => l && !l.includes("Mile")))];
    const cityList = uniqueCities.length > 2 ? [uniqueCities[0], uniqueCities[Math.floor(uniqueCities.length / 2)], uniqueCities[uniqueCities.length - 1]] : uniqueCities;

    const temps = weatherData.map(w => w.temperature).filter(t => !isNaN(t));
    const minTemp = temps.length ? Math.round((Math.min(...temps) * 9 / 5) + 32) : 0;
    const maxTemp = temps.length ? Math.round((Math.max(...temps) * 9 / 5) + 32) : 0;

    const baselineSpeed = 50 + (Math.random() * 2 - 1);
    const baseDurationMins = (routeData.distance * 0.000621371) / baselineSpeed * 60;
    const trafficDelayMins = Math.max(0, Math.round((routeData.duration / 60) - baseDurationMins));

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

    const aiContext = {
        fuelCost: fuelCostStr, evCost: evCostStr, cities: cityList,
        minTemp, maxTemp, trafficDelay: trafficDelayMins, maxWind, precipChance,
        recommendations: distinctStops, roadConditions, departureDate, departureTime
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
        metrics: { distance: distanceVal, time: durationVal, fuel: fuelCostStr, ev: evCostStr },
        weather: weatherData,
        roadConditions,
        aiAnalysis,
        tripScore: safetyScore,
        departureInsights,
        recommendations
    };
};

module.exports = { processLeg };
