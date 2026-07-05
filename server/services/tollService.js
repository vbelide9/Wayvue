const axios = require('axios');
const polyline = require('@mapbox/polyline');
const { extractState } = require('./gasPriceService');

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
const STATE_TOLL_PER_MILE = {
    NY: 0.065, NJ: 0.120, PA: 0.055, IL: 0.050, IN: 0.045, OH: 0.045,
    MA: 0.040, MD: 0.030, DE: 0.150, FL: 0.060, OK: 0.050, KS: 0.045,
    WV: 0.050, ME: 0.035, NH: 0.020, CO: 0.020, CA: 0.010, TX: 0.030,
    VA: 0.020, NC: 0.010, GA: 0.008, MN: 0.005, WA: 0.010, RI: 0.015,
    CT: 0.005, MI: 0.005
};
const DEFAULT_TOLL_PER_MILE = 0.004; // Mostly-free states

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

    return getHeuristicToll(distanceMiles, regionHints);
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
                display: total > 0 ? `$${total.toFixed(2)}` : '$0',
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
function getHeuristicToll(distanceMiles, regionHints) {
    // Detect unique states from the location hints
    const states = [];
    for (const hint of regionHints || []) {
        const st = safeExtractState(hint);
        if (st && !states.includes(st)) states.push(st);
    }

    // No usable state info — apply a conservative national blended rate
    if (states.length === 0) {
        const total = Math.round(distanceMiles * 0.02 * 100) / 100;
        return {
            total,
            currency: 'USD',
            display: total > 0 ? `$${total.toFixed(2)}` : '$0',
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
        display: total > 0 ? `$${total.toFixed(2)}` : '$0',
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
