const axios = require('axios');
const polyline = require('@mapbox/polyline');
const { extractState } = require('./gasPriceService');
const { reverseGeocode } = require('./geocodingService');

/**
 * Toll Service — estimates toll costs for a driving route.
 *
 * Two modes:
 *   1. TollGuru API (if TOLLGURU_API_KEY is set) — real toll pricing from the route polyline.
 *      Register (free tier): https://tollguru.com/  →  add TOLLGURU_API_KEY to .env
 *   2. Heuristic fallback (no key required) — estimates tolls from the states traversed using
 *      published per-state toll-density rates. Clearly flagged with isEstimated: true.
 *
 * Never throws — always returns a usable object.
 */

const TOLLGURU_URL = 'https://apis.tollguru.com/toll/v2/complete-polyline-from-mapping-service';

// Cache: { cacheKey: { data, timestamp } }
const tollCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour (toll rates change rarely)

/**
 * Blended per-mile toll estimate for travel through a given US state.
 * Represents (fraction of miles tolled) × (average toll rate) for that state's
 * major corridors. Toll-heavy states (NY Thruway, NJ Turnpike, PA Turnpike, IL, etc.)
 * rate higher; mostly-free states rate near zero.
 */
// Recalibrated (2026): rate ≈ (typical fraction of the state's interstate miles that are
// tolled) × (avg toll rate). Toll-heavy corridors (NY Thruway, NJ TP, DE, IL) stay higher;
// pass-through Southern/Western states where interstates are largely free drop near zero.
// Tuned so long low-toll routes (e.g. PGH→Tampa via I-75) land near real-world ~$10-15.
const STATE_TOLL_PER_MILE = {
    NY: 0.060, NJ: 0.060, DE: 0.100, IL: 0.035, PA: 0.030, OH: 0.025, IN: 0.025,
    MA: 0.030, MD: 0.020, FL: 0.025, OK: 0.030, KS: 0.025, WV: 0.030, ME: 0.025,
    NH: 0.015, CO: 0.012, RI: 0.012, CA: 0.008, WA: 0.008, TX: 0.020,
    VA: 0.005, NC: 0.004, SC: 0.003, GA: 0.004, MN: 0.004, CT: 0.004, MI: 0.004,
    TN: 0.003, KY: 0.004, AL: 0.002, MS: 0.002
};
const DEFAULT_TOLL_PER_MILE = 0.003; // Mostly-free states

/**
 * Estimate tolls for a route.
 * @param {Array<[number, number]>} routeCoordinates - GeoJSON [lng, lat] pairs
 * @param {number} routeDistanceMeters - OSRM-reported distance
 * @param {string[]} [regionHints] - Location strings (e.g. "Buffalo, NY, USA") used to
 *   detect traversed states for the heuristic.
 * @returns {Promise<{ total: number, currency: string, display: string,
 *   breakdown: Array, isEstimated: boolean, source: string }>}
 */
async function getTollEstimate(routeCoordinates, routeDistanceMeters, regionHints = []) {
    const distanceMiles = (routeDistanceMeters || 0) * 0.000621371;

    // Try TollGuru first if configured
    const apiKey = process.env.TOLLGURU_API_KEY;
    if (apiKey && routeCoordinates && routeCoordinates.length >= 2) {
        const real = await getTollGuruEstimate(apiKey, routeCoordinates);
        if (real) return real;
        console.log('[Toll] TollGuru unavailable — using heuristic fallback.');
    }

    return await getHeuristicToll(distanceMiles, regionHints, routeCoordinates);
}

/**
 * Detect every state the route passes through by reverse-geocoding evenly-spaced points
 * along the geometry (cached), combined with any caller-provided hints. Complete coverage
 * is what keeps the even-mileage split honest — missing states over-weight the ones found.
 */
async function detectStates(regionHints, routeCoordinates) {
    const states = [];
    const add = (st) => { if (st && !states.includes(st)) states.push(st); };

    for (const hint of regionHints || []) add(safeExtractState(hint));

    if (Array.isArray(routeCoordinates) && routeCoordinates.length >= 2) {
        const SAMPLES = 8;
        const idxs = [];
        for (let i = 0; i <= SAMPLES; i++) {
            idxs.push(Math.floor((i / SAMPLES) * (routeCoordinates.length - 1)));
        }
        const results = await Promise.allSettled(idxs.map(idx => {
            const [lng, lat] = routeCoordinates[idx];
            return reverseGeocode(lat, lng);
        }));
        for (const r of results) {
            if (r.status === 'fulfilled' && r.value) add(safeExtractState(r.value));
        }
    }
    return states;
}

/**
 * Real toll pricing via TollGuru (encodes the route geometry to a Google polyline).
 */
async function getTollGuruEstimate(apiKey, routeCoordinates) {
    try {
        // @mapbox/polyline encodes [lat, lng]; our coords are [lng, lat]
        const latLng = routeCoordinates.map(([lng, lat]) => [lat, lng]);
        const encoded = polyline.encode(latLng);

        const cacheKey = `tg:${encoded.length}:${encoded.slice(0, 24)}`;
        const cached = tollCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) return cached.data;

        const response = await axios.post(
            TOLLGURU_URL,
            { source: 'here', polyline: encoded, vehicleType: '2AxlesAuto' },
            { headers: { 'content-type': 'application/json', 'x-api-key': apiKey }, timeout: 8000 }
        );

        const route = response.data?.routes?.[0];
        const costs = route?.costs;
        if (costs) {
            const total = Math.round((costs.tag ?? costs.cash ?? 0) * 100) / 100;
            const data = {
                total,
                currency: response.data?.summary?.currency || 'USD',
                display: total > 0 ? `$${Math.round(total)}` : '$0',
                breakdown: (route.tolls || []).map(t => ({
                    name: t.name || t.road || 'Toll',
                    state: t.state || '',
                    cost: t.tagCost ?? t.cashCost ?? 0
                })),
                isEstimated: false,
                source: 'TollGuru'
            };
            tollCache.set(cacheKey, { data, timestamp: Date.now() });
            if (tollCache.size > 200) tollCache.delete(tollCache.keys().next().value);
            return data;
        }
        return null;
    } catch (error) {
        console.error(`[Toll] TollGuru API error: ${error.message}`);
        return null;
    }
}

/**
 * Heuristic toll estimate: distribute route mileage across the detected states and
 * apply each state's blended per-mile toll rate.
 */
async function getHeuristicToll(distanceMiles, regionHints, routeCoordinates) {
    // Detect every state the route crosses (hints + reverse-geocoded route samples)
    const states = await detectStates(regionHints, routeCoordinates);

    // No usable state info — apply a conservative national blended rate
    if (states.length === 0) {
        const total = Math.round(distanceMiles * 0.008 * 100) / 100;
        return {
            total,
            currency: 'USD',
            display: total > 0 ? `$${Math.round(total)}` : '$0',
            breakdown: [],
            isEstimated: true,
            source: 'heuristic'
        };
    }

    const milesPerState = distanceMiles / states.length;
    let total = 0;
    const breakdown = states.map(st => {
        const rate = STATE_TOLL_PER_MILE[st] ?? DEFAULT_TOLL_PER_MILE;
        const cost = Math.round(milesPerState * rate * 100) / 100;
        total += cost;
        return { name: `${st} corridors`, state: st, cost };
    });

    total = Math.round(total * 100) / 100;
    return {
        total,
        currency: 'USD',
        display: total > 0 ? `$${Math.round(total)}` : '$0',
        breakdown,
        isEstimated: true,
        source: 'heuristic'
    };
}

function safeExtractState(locationStr) {
    try {
        return extractState(locationStr);
    } catch (e) {
        return null;
    }
}

module.exports = { getTollEstimate };
