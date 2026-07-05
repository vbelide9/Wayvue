const axios = require('axios');

/**
 * Incident Service — TomTom Traffic Incident Details API (v5)
 * Reports accidents, road closures, construction, and jams along a route.
 *
 * Uses the same key as the traffic flow service: TOMTOM_API_KEY.
 * Free tier shares the TomTom quota. If unset, returns [] (graceful, never throws).
 */

const INCIDENTS_URL = 'https://api.tomtom.com/traffic/services/5/incidentDetails';

// Cache: { cacheKey: { data, timestamp } }
const incidentCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes (incidents change often)

// TomTom iconCategory → our normalized type
// https://developer.tomtom.com/traffic-api/documentation/traffic-incidents/incident-details
function mapCategory(iconCategory) {
    switch (iconCategory) {
        case 1: return 'accident';
        case 6: return 'jam';
        case 7: return 'closure';   // Lane closed
        case 8: return 'closure';   // Road closed
        case 9: return 'construction'; // Road works
        case 5:                      // Ice
        case 2:                      // Fog
        case 4:                      // Rain
        case 10:                     // Wind
        case 11:                     // Flooding
        case 14: return 'hazard';    // Broken down vehicle
        default: return 'hazard';
    }
}

// TomTom caps a single incidentDetails bbox at 10,000 km². Keep tiles well under that.
const MAX_TILE_AREA_KM2 = 8000;
const MAX_TILES = 12; // Bound API calls on very long routes

function bboxAreaKm2(b) {
    const latKm = (b.maxLat - b.minLat) * 111;
    const midLat = (b.maxLat + b.minLat) / 2;
    const lonKm = (b.maxLon - b.minLon) * 111 * Math.cos(midLat * Math.PI / 180);
    return Math.max(0, latKm) * Math.max(0, lonKm);
}

/**
 * Greedily split the route into corridor tiles, each under the TomTom area cap.
 * @param {Array<[number, number]>} coords - [lng, lat] pairs
 * @returns {Array<{minLon,minLat,maxLon,maxLat}>}
 */
function buildTiles(coords) {
    const tiles = [];
    let cur = null;
    for (const [lng, lat] of coords) {
        if (!cur) { cur = { minLon: lng, maxLon: lng, minLat: lat, maxLat: lat }; continue; }
        const test = {
            minLon: Math.min(cur.minLon, lng), maxLon: Math.max(cur.maxLon, lng),
            minLat: Math.min(cur.minLat, lat), maxLat: Math.max(cur.maxLat, lat)
        };
        if (bboxAreaKm2(test) > MAX_TILE_AREA_KM2) {
            tiles.push(cur);
            cur = { minLon: lng, maxLon: lng, minLat: lat, maxLat: lat };
        } else {
            cur = test;
        }
    }
    if (cur) tiles.push(cur);

    // Small pad so incidents just off the sampled line are caught (kept under the cap)
    const pad = 0.02;
    let padded = tiles.map(b => ({
        minLon: b.minLon - pad, minLat: b.minLat - pad,
        maxLon: b.maxLon + pad, maxLat: b.maxLat + pad
    }));

    // Bound the number of tiles on very long routes
    if (padded.length > MAX_TILES) {
        const step = padded.length / MAX_TILES;
        const sampled = [];
        for (let i = 0; i < MAX_TILES; i++) sampled.push(padded[Math.floor(i * step)]);
        padded = sampled;
    }
    return padded;
}

function bboxToString(b) {
    return `${b.minLon.toFixed(4)},${b.minLat.toFixed(4)},${b.maxLon.toFixed(4)},${b.maxLat.toFixed(4)}`;
}

// Keep incidents essentially on the route line (km). Corridor tiles are wide and
// TomTom reports many minor side-road closures, so this must be tight.
const ON_ROUTE_THRESHOLD_KM = 0.5;
const MAX_RESULTS = 15;

function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Keep the route dense enough that nearest-vertex distance ≈ distance-to-line,
// so a tight on-route threshold doesn't wrongly reject incidents between sparse vertices.
function downsampleRoute(coords) {
    const target = 2500;
    if (coords.length <= target) return coords;
    const step = Math.ceil(coords.length / target);
    const out = [];
    for (let i = 0; i < coords.length; i += step) out.push(coords[i]);
    return out;
}

function minDistanceToRouteKm(lat, lng, routePts) {
    let min = Infinity;
    for (const [rlng, rlat] of routePts) {
        const d = haversineKm(lat, lng, rlat, rlng);
        if (d < min) { min = d; if (min < 0.3) break; }
    }
    return min;
}

/**
 * Query a single bbox tile for incidents.
 */
async function fetchTile(apiKey, bboxStr) {
    const fields = encodeURIComponent(
        '{incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description,code,iconCategory},startTime,endTime,from,to,delay,roadNumbers}}}'
    );
    const url = `${INCIDENTS_URL}?key=${apiKey}&bbox=${bboxStr}&fields=${fields}&language=en-GB&timeValidityFilter=present`;
    const response = await axios.get(url, { timeout: 6000 });
    return response.data?.incidents || [];
}

/**
 * Fetch traffic incidents along the route (tiled to respect TomTom's bbox area cap).
 * @param {Array<[number, number]>} routeCoordinates - GeoJSON [lng, lat] pairs
 * @returns {Promise<Array<{ id, type, severity, description, location, from, to }>>}
 */
async function getIncidentsAlongRoute(routeCoordinates) {
    const apiKey = process.env.TOMTOM_API_KEY;
    if (!apiKey || !routeCoordinates || routeCoordinates.length < 2) {
        return [];
    }

    const tiles = buildTiles(routeCoordinates);
    const cacheKey = tiles.map(bboxToString).join('|');
    const cached = incidentCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
        return cached.data;
    }

    const seen = new Set();
    const incidents = [];
    const routePts = downsampleRoute(routeCoordinates);

    for (let t = 0; t < tiles.length; t++) {
        try {
            const raw = await fetchTile(apiKey, bboxToString(tiles[t]));
            for (const inc of raw) {
                const props = inc.properties || {};
                const geom = inc.geometry || {};

                // Geometry may be a Point ([lng,lat]) or LineString ([[lng,lat],...])
                let coord = null;
                if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
                    coord = geom.coordinates;
                } else if (Array.isArray(geom.coordinates) && geom.coordinates.length > 0) {
                    const mid = geom.coordinates[Math.floor(geom.coordinates.length / 2)];
                    coord = Array.isArray(mid[0]) ? mid[0] : mid;
                }
                if (!coord) continue;

                // Dedupe across overlapping tiles (rounded location + category)
                const dedupeKey = `${coord[0].toFixed(3)},${coord[1].toFixed(3)}:${props.iconCategory}`;
                if (seen.has(dedupeKey)) continue;
                seen.add(dedupeKey);

                // Only keep incidents actually on/near the route line
                if (minDistanceToRouteKm(coord[1], coord[0], routePts) > ON_ROUTE_THRESHOLD_KM) continue;

                const primaryEvent = (props.events && props.events[0]) || {};
                const type = mapCategory(props.iconCategory);
                const description = primaryEvent.description
                    || (props.from && props.to ? `${type} between ${props.from} and ${props.to}` : `Reported ${type}`);

                incidents.push({
                    id: `tomtom-${dedupeKey}-${props.startTime || ''}`,
                    type,
                    severity: props.magnitudeOfDelay ?? 0, // 0 unknown, 1 minor, 2 moderate, 3 major
                    description,
                    delay: props.delay ?? null,
                    location: { lat: coord[1], lng: coord[0] },
                    from: props.from || null,
                    to: props.to || null,
                    roads: props.roadNumbers || []
                });
            }
        } catch (error) {
            if (error.response?.status === 403) {
                console.error('[Incidents] TomTom API key invalid or quota exceeded');
                break; // No point retrying other tiles
            }
            console.error(`[Incidents] Tile ${t} error: ${error.message}`);
        }

        if (t < tiles.length - 1) await new Promise(r => setTimeout(r, 100));
    }

    // Prioritize the most impactful incidents (closures/accidents first, then severity)
    const TYPE_PRIORITY = { closure: 3, accident: 3, construction: 2, jam: 1, hazard: 0 };
    incidents.sort((a, b) => {
        const tp = (TYPE_PRIORITY[b.type] || 0) - (TYPE_PRIORITY[a.type] || 0);
        if (tp !== 0) return tp;
        return (b.severity || 0) - (a.severity || 0);
    });
    const trimmed = incidents.slice(0, MAX_RESULTS);

    incidentCache.set(cacheKey, { data: trimmed, timestamp: Date.now() });
    if (incidentCache.size > 200) {
        incidentCache.delete(incidentCache.keys().next().value);
    }

    console.log(`[Incidents] TomTom: ${incidents.length} on-route incidents across ${tiles.length} tiles, returning top ${trimmed.length}`);
    return trimmed;
}

module.exports = { getIncidentsAlongRoute };
