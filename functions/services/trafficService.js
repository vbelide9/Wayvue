const axios = require('axios');

/**
 * Traffic Service — TomTom Traffic Flow API
 * Provides real-time traffic speed and delay data for road segments.
 * 
 * Registration (free, no credit card): https://developer.tomtom.com/
 * Free tier: 2,500 requests/day
 * Add your key to .env: TOMTOM_API_KEY=your_key_here
 */

const TOMTOM_BASE = 'https://api.tomtom.com/traffic/services/4/flowSegmentData';

// Cache: { cacheKey: { data, timestamp } }
const trafficCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch traffic flow data for a single point.
 * @param {number} lat 
 * @param {number} lng 
 * @returns {Promise<{ currentSpeed: number, freeFlowSpeed: number, currentTravelTime: number, freeFlowTravelTime: number, confidence: number } | null>}
 */
async function getTrafficFlow(lat, lng) {
    const apiKey = process.env.TOMTOM_API_KEY;
    if (!apiKey) return null;

    // Round coords to 4 decimals for cache key (~11m precision)
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const cached = trafficCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
        return cached.data;
    }

    try {
        // style=absolute returns speeds in km/h, zoom=10 is good for highway segments
        const url = `${TOMTOM_BASE}/absolute/10/json?key=${apiKey}&point=${lat},${lng}&unit=mph&thickness=1`;
        
        const response = await axios.get(url, { timeout: 5000 });
        
        if (response.data?.flowSegmentData) {
            const data = {
                currentSpeed: response.data.flowSegmentData.currentSpeed,
                freeFlowSpeed: response.data.flowSegmentData.freeFlowSpeed,
                currentTravelTime: response.data.flowSegmentData.currentTravelTime,
                freeFlowTravelTime: response.data.flowSegmentData.freeFlowTravelTime,
                confidence: response.data.flowSegmentData.confidence || 0,
                roadClosure: response.data.flowSegmentData.roadClosure || false
            };

            // Cache result
            trafficCache.set(cacheKey, { data, timestamp: Date.now() });
            
            // Keep cache manageable
            if (trafficCache.size > 500) {
                const firstKey = trafficCache.keys().next().value;
                trafficCache.delete(firstKey);
            }

            return data;
        }
        return null;

    } catch (error) {
        if (error.response?.status === 403) {
            console.error('[Traffic] TomTom API key invalid or quota exceeded');
        } else {
            console.error(`[Traffic] TomTom API error at ${lat},${lng}: ${error.message}`);
        }
        return null;
    }
}

/**
 * Calculate real traffic delay for an entire route by sampling multiple points.
 * @param {Array<[number, number]>} routeCoordinates - GeoJSON coordinates [lng, lat]
 * @param {number} routeDurationSeconds - OSRM-reported duration
 * @param {number} routeDistanceMeters - OSRM-reported distance
 * @returns {Promise<{ delayMinutes: number, segments: Array, congestionLevel: string, isRealData: boolean }>}
 */
async function getRouteTrafficDelay(routeCoordinates, routeDurationSeconds, routeDistanceMeters) {
    const apiKey = process.env.TOMTOM_API_KEY;
    
    if (!apiKey || !routeCoordinates || routeCoordinates.length < 2) {
        // Fallback to heuristic
        return getHeuristicDelay(routeDurationSeconds, routeDistanceMeters);
    }

    // Sample 5 evenly-spaced points along the route
    const SAMPLE_COUNT = 5;
    const sampleIndices = [];
    for (let i = 0; i < SAMPLE_COUNT; i++) {
        const idx = Math.floor((i / (SAMPLE_COUNT - 1)) * (routeCoordinates.length - 1));
        sampleIndices.push(idx);
    }

    // Deduplicate
    const uniqueIndices = [...new Set(sampleIndices)];

    // Fetch traffic data for each sample point (with small delays to be nice)
    const results = [];
    for (let i = 0; i < uniqueIndices.length; i++) {
        const [lng, lat] = routeCoordinates[uniqueIndices[i]];
        
        try {
            const flow = await getTrafficFlow(lat, lng);
            if (flow) {
                results.push({
                    index: uniqueIndices[i],
                    progress: uniqueIndices[i] / routeCoordinates.length,
                    ...flow
                });
            }
        } catch (e) {
            // Skip this point
        }

        // Small delay between requests to stay under rate limits
        if (i < uniqueIndices.length - 1) {
            await new Promise(r => setTimeout(r, 100));
        }
    }

    // If we got no results, fall back to heuristic
    if (results.length === 0) {
        console.log('[Traffic] No TomTom results. Falling back to heuristic.');
        return getHeuristicDelay(routeDurationSeconds, routeDistanceMeters);
    }

    // Calculate aggregate delay
    // Method: Average the congestion ratio across all sampled segments
    // congestionRatio = currentSpeed / freeFlowSpeed (1.0 = no congestion, 0.5 = half speed)
    let totalCongestionRatio = 0;
    let weightedSegments = 0;
    let hasRoadClosure = false;

    const segmentDetails = results.map(r => {
        const ratio = r.freeFlowSpeed > 0 ? r.currentSpeed / r.freeFlowSpeed : 1;
        totalCongestionRatio += ratio;
        weightedSegments++;
        if (r.roadClosure) hasRoadClosure = true;

        return {
            progress: Math.round(r.progress * 100) + '%',
            currentSpeed: Math.round(r.currentSpeed),
            freeFlowSpeed: Math.round(r.freeFlowSpeed),
            congestionRatio: ratio.toFixed(2),
            confidence: r.confidence
        };
    });

    const avgCongestionRatio = weightedSegments > 0 ? totalCongestionRatio / weightedSegments : 1;
    
    // Estimated delay: If traffic is at 80% of free flow, the delay is 25% of the original duration
    // delay = duration * (1/congestionRatio - 1)
    const estimatedDelaySeconds = avgCongestionRatio > 0 
        ? routeDurationSeconds * ((1 / avgCongestionRatio) - 1)
        : 0;
    
    const delayMinutes = Math.max(0, Math.round(estimatedDelaySeconds / 60));

    // Determine congestion level
    let congestionLevel = 'clear';
    if (hasRoadClosure) congestionLevel = 'closure';
    else if (avgCongestionRatio < 0.5) congestionLevel = 'heavy';
    else if (avgCongestionRatio < 0.7) congestionLevel = 'moderate';
    else if (avgCongestionRatio < 0.9) congestionLevel = 'light';

    console.log(`[Traffic] TomTom: ${results.length} segments sampled. Avg ratio: ${avgCongestionRatio.toFixed(2)}, Delay: ${delayMinutes} min, Level: ${congestionLevel}`);

    return {
        delayMinutes,
        segments: segmentDetails,
        congestionLevel,
        avgCongestionRatio: avgCongestionRatio.toFixed(2),
        isRealData: true
    };
}

/**
 * Fallback heuristic when TomTom API is unavailable.
 * Uses OSRM duration vs baseline free-flow speed estimate.
 */
function getHeuristicDelay(routeDurationSeconds, routeDistanceMeters) {
    const distanceMiles = routeDistanceMeters * 0.000621371;
    const baselineSpeed = 55; // mph — conservative free-flow estimate
    const freeFlowDurationMinutes = (distanceMiles / baselineSpeed) * 60;
    const actualDurationMinutes = routeDurationSeconds / 60;
    
    const delayMinutes = Math.max(0, Math.round(actualDurationMinutes - freeFlowDurationMinutes));

    let congestionLevel = 'clear';
    if (delayMinutes > 45) congestionLevel = 'heavy';
    else if (delayMinutes > 20) congestionLevel = 'moderate';
    else if (delayMinutes > 5) congestionLevel = 'light';

    console.log(`[Traffic] Heuristic fallback: delay=${delayMinutes} min, level=${congestionLevel}`);

    return {
        delayMinutes,
        segments: [],
        congestionLevel,
        avgCongestionRatio: null,
        isRealData: false
    };
}

module.exports = { getTrafficFlow, getRouteTrafficDelay };
