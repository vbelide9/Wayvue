const axios = require('axios');
const { reverseGeocode } = require('./geocodingService');
const { mileageAt } = require('../utils/geometry');

/**
 * Fetches REAL places from OpenStreetMap (Overpass API).
 * Queries for Fuel, Food, and Viewpoints near the given coordinates.
 *
 * @param {Array} routeSegments - sample points to search around
 * @param {Array<{lat,lon,cumMiles}>} [distanceIndex] - route distance index; when
 *   provided, each stop gets its true along-route mileage (not the sample point's).
 */
async function getRecommendations(routeSegments, distanceIndex = null) {
    const recommendations = [];

    // We'll query strategic stops along the route for a balance of speed and variety
    // routeSegments already contains location and miles context from index.js
    const tasks = routeSegments.map(async (seg, i) => {
        if (!seg || !seg.location) return null;

        const { lat, lon } = seg.location;
        const milesFromStart = seg.miles || 0;

        // Define queries for all types we support
        const queries = {
            food: '["amenity"~"cafe|fast_food|restaurant|diner"]',
            gas: '["amenity"~"fuel"]',
            charging: '["amenity"~"charging_station"]',
            rest: '["highway"~"rest_area"]',
            rest_amenity: '["amenity"~"rest_area|toilets"]',
            view: '["tourism"~"viewpoint|attraction|museum|park|theme_park"]',
            historic: '["historic"~"memorial|monument|castle|ruins"]'
        };

        // Get Town Name for this segment (default reference)
        let defaultTownName = "Along Route";
        try {
            const name = await reverseGeocode(lat, lon);
            if (name) {
                // Just get the city part for the label
                defaultTownName = name.split(',')[0];
            }
        } catch (e) { }

        // Optimized Query:
        // switch back to 'node' only for speed.
        // Block 1: Common (Food/Gas) - 5km radius (Fast)
        // Block 2: Sparse (Charge/Rest/View) - 15km radius (Broad)

        const commonAmenity = "cafe|fast_food|restaurant|diner|fuel";
        const sparseAmenity = "charging_station|rest_area"; // Removed toilets
        const tourismRegex = "viewpoint|museum|park|theme_park"; // Removed attraction
        const lodgingRegex = "hotel|motel|guest_house|hostel"; // Overnight stays
        const historicRegex = "memorial|monument|castle|ruins";
        // Rest stops: `rest_area` (basic pull-offs) AND `services` (motorway service
        // plazas). Both are usually mapped as WAYS/areas, not nodes, so query both.
        const highwayRegex = "rest_area|services";

        const query = `
            [out:json][timeout:25];
            (
              node["amenity"~"${commonAmenity}"](around:8000, ${lat}, ${lon});
            );
            out center 60;
            (
              node["amenity"~"${sparseAmenity}"](around:15000, ${lat}, ${lon});
              node["highway"~"${highwayRegex}"](around:15000, ${lat}, ${lon});
              node["tourism"~"${tourismRegex}"](around:15000, ${lat}, ${lon});
              node["tourism"~"${lodgingRegex}"](around:15000, ${lat}, ${lon});
              node["historic"~"${historicRegex}"](around:15000, ${lat}, ${lon});
            );
            out center 100;
        `;

        // Try one mirror, then fall back to the other. overpass-api.de frequently 429s
        // under our request volume (which used to leave whole stretches of the route with
        // no stops); maps.mail.ru is more lenient. Rotating which is primary spreads load,
        // and the fallback fills the gap when a mirror fails for a given search point.
        const mirrors = i % 2 === 0
            ? ['overpass-api.de', 'maps.mail.ru/osm/tools/overpass']
            : ['maps.mail.ru/osm/tools/overpass', 'overpass-api.de'];

        try {
            // Stagger requests to avoid rate limiting (kept small since there are now
            // more search points along the route).
            await new Promise(r => setTimeout(r, i * 350));

            // Rest stops (rest_area / motorway service plazas) are almost always mapped as
            // WAYS in OSM, which are too heavy to bundle into the main query on public
            // mirrors. Fetch them SEPARATELY, best-effort, with a short timeout so a slow or
            // failed way query never blocks the core node stops. Runs in parallel below.
            const wayQuery = `[out:json][timeout:12];(way["highway"~"rest_area|services"](around:15000,${lat},${lon}););out center 20;`;
            const fetchWays = axios
                // Use the OTHER mirror so the way query doesn't contend with the main node
                // query (which tries mirrors[0] first) for this segment.
                .get(`https://${mirrors[mirrors.length - 1]}/api/interpreter?data=${encodeURIComponent(wayQuery)}`, {
                    headers: { 'User-Agent': 'WayvueApp/3.0' }, timeout: 14000,
                })
                .then(r => r.data.elements || [])
                .catch(() => []); // best-effort — no rest ways this segment if it fails

            let nodes = null;
            for (let m = 0; m < mirrors.length; m++) {
                const mirror = mirrors[m];
                try {
                    const url = `https://${mirror}/api/interpreter?data=${encodeURIComponent(query)}`;
                    const response = await axios.get(url, {
                        headers: { 'User-Agent': 'WayvueApp/3.0' },
                        timeout: 25000 // heavier around+regex query on public mirrors can take ~20s
                    });
                    nodes = response.data.elements || [];
                    break;
                } catch (err) {
                    console.log(`Overpass failed on ${mirror} (seg ${i} @${milesFromStart}mi): ${err.message}`);
                    if (m < mirrors.length - 1) await new Promise(r => setTimeout(r, 600)); // brief backoff before fallback
                }
            }
            const restWays = await fetchWays;
            if (!nodes) nodes = [];
            if (restWays.length) nodes = nodes.concat(restWays);
            if (nodes.length === 0) return; // nothing from either query for this point

            const segmentCandidates = [];

            // Helper to determine type from tags
            const determineType = (tags) => {
                if (tags.amenity) {
                    if (['cafe', 'fast_food', 'restaurant', 'diner'].some(v => tags.amenity.includes(v))) return 'food';
                    if (tags.amenity.includes('fuel')) return 'gas';
                    if (tags.amenity.includes('charging_station')) return 'charging';
                    if (['rest_area', 'toilets'].some(v => tags.amenity.includes(v))) return 'rest';
                }
                if (tags.highway && (tags.highway.includes('rest_area') || tags.highway.includes('services'))) return 'rest';
                if (tags.tourism && ['hotel', 'motel', 'guest_house', 'hostel'].some(v => tags.tourism.includes(v))) return 'lodging';
                if (tags.tourism) return 'view';
                if (tags.historic) return 'view';
                return 'view'; // default
            };

            nodes.forEach(node => {
                if (node.tags) {
                    const type = determineType(node.tags);
                    // Rest areas / service points are frequently unnamed in OSM but still
                    // useful, so give them a sensible fallback instead of dropping them.
                    let name = node.tags.name || node.tags.operator;
                    if (!name && type === 'rest') name = defaultTownName ? `Rest Area · ${defaultTownName}` : 'Rest Area';
                    if (!name) return;

                    // Quality score: more tags usually means better data/more popular
                    const qualityScore = Object.keys(node.tags).length;

                    // True along-route mileage for THIS stop (nodes carry lat/lon; ways
                    // return a `center`). Falls back to the sample point's mileage.
                    const poiLat = node.lat != null ? node.lat : (node.center && node.center.lat);
                    const poiLon = node.lon != null ? node.lon : (node.center && node.center.lon);
                    const stopMiles = (distanceIndex && poiLat != null && poiLon != null)
                        ? Math.round(mileageAt(distanceIndex, poiLat, poiLon))
                        : Number(milesFromStart);

                    // `location` is finalized after per-stop city resolution below — we
                    // prefer the stop's own OSM addr:city, then a reverse-geocode of its
                    // own coordinates, and only fall back to the search area's town.
                    segmentCandidates.push({
                        id: `osm-${node.id}`,
                        type: type,
                        title: name,
                        description: node.tags.cuisine || (type === 'gas' ? 'Fuel & Services' : type === 'charging' ? 'EV Charging Station' : type === 'view' ? 'Scenic Spot' : type === 'rest' ? 'Rest Area' : type === 'lodging' ? 'Hotel & Lodging' : 'Local Stop'),
                        quality: qualityScore,
                        miles: stopMiles,
                        _lat: poiLat,
                        _lon: poiLon,
                        _city: node.tags['addr:city'] || null,
                        _fallbackTown: defaultTownName
                    });
                }
            });

            // Sort by quality (descending)
            segmentCandidates.sort((a, b) => b.quality - a.quality);

            // Take top results PER CATEGORY to ensure variety while surfacing as many
            // real stops as possible.
            const categoryCounts = { food: 0, gas: 0, charging: 0, view: 0, rest: 0, lodging: 0 };
            segmentCandidates.forEach(cand => {
                const limit = ['food', 'gas', 'lodging'].includes(cand.type) ? 8 : 5;
                if (categoryCounts[cand.type] < limit) {
                    recommendations.push(cand);
                    categoryCounts[cand.type]++;
                }
            });
        } catch (err) {
            console.log(`Places lookup failed (seg ${i} @${milesFromStart}mi): ${err.message}`);
        }

        // No fake fallback stops: if a segment returns nothing (timeout/empty), it simply
        // contributes no stops. Better to show fewer real places than invented ones.
    });

    // Wait for all fetches to finish
    await Promise.all(tasks);

    // Sort by quality and filter duplicates
    const finalResults = [];
    const seen = new Set();

    // Sort overall by distance (ascending) to show stops in order of travel
    recommendations.sort((a, b) => (a.miles || 0) - (b.miles || 0));

    recommendations.forEach(r => {
        // Filter out very similar titles
        if (!seen.has(r.title)) {
            seen.add(r.title);
            finalResults.push(r);
        }
    });

    // Resolve each stop's OWN town when OSM didn't tag one. Reverse-geocoding is
    // deduped to ~1km cells (many stops share a town) and bounded in concurrency.
    // This runs once per route since the whole result set is cached downstream.
    const needCity = finalResults.filter(r => !r._city && r._lat != null && r._lon != null);
    const cellCity = new Map();
    const cells = [...new Set(needCity.map(r => `${r._lat.toFixed(2)},${r._lon.toFixed(2)}`))];
    const CONCURRENCY = 8;
    for (let i = 0; i < cells.length; i += CONCURRENCY) {
        const batch = cells.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(async cell => {
            const [cLat, cLon] = cell.split(',').map(Number);
            const name = await reverseGeocode(cLat, cLon); // "City, ST" | null
            cellCity.set(cell, name ? name.split(',')[0] : null);
        }));
    }

    finalResults.forEach(r => {
        let city = r._city;
        if (!city && r._lat != null && r._lon != null) {
            city = cellCity.get(`${r._lat.toFixed(2)},${r._lon.toFixed(2)}`);
        }
        city = city || r._fallbackTown || 'Along Route';
        r.location = `${city} • ${r.miles} mi`;
        delete r._lat; delete r._lon; delete r._city; delete r._fallbackTown;
    });

    return finalResults;
}

module.exports = { getRecommendations };
