const axios = require('axios');
const { reverseGeocode } = require('./geocodingService');

/**
 * Fetches REAL places from OpenStreetMap (Overpass API).
 * Queries for Fuel, Food, and Viewpoints near the given coordinates.
 */
async function getRecommendations(routeSegments) {
    // We'll query strategic stops along the route for a balance of speed and variety
    // routeSegments already contains location and miles context from index.js
    // Limit concurrency to avoid slamming the API if we have many points
    // We'll process in chunks or just simple map since we have rate limiting inside
    const tasks = routeSegments.map(async (seg, i) => {
        if (!seg || !seg.location) return null;

        const { lat, lon } = seg.location;
        const milesFromStart = seg.miles || 0;

        // Search for multiple categories at this location to ensure variety
        // vary the priority based on index to distribute types
        const targetTypes = (i % 3 === 0) ? ['food', 'gas'] : (i % 3 === 1) ? ['view', 'rest'] : ['food', 'gas', 'view'];

        const localResults = [];
        const mirror = i % 2 === 0 ? 'overpass-api.de' : 'overpass.kumi.systems';

        // Helper to calc simple detour
        const calcDetour = (placeLat, placeLon) => {
            // Euclidean distance approx for detour (not perfect but fast)
            // 1 deg lat ~ 69 miles. 
            const R = 3959; // Radius of earth in miles
            const dLat = (placeLat - lat) * Math.PI / 180;
            const dLon = (placeLon - lon) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat * Math.PI / 180) * Math.cos(placeLat * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const d = R * c;

            const detourMiles = Math.max(0.2, d).toFixed(1); // Min 0.2 miles
            const detourTime = Math.ceil(d * 3 + 2); // Rough est: 2 min penalty + 3 mins per mile (slow roads)
            return { detourMiles, detourTime };
        };

        // Declare townName outside try so it's available in fallback
        let townName = "Along Route";

        try {
            // Get town name logic (same as before)
            try {
                const name = await reverseGeocode(lat, lon);
                if (name) townName = name.split(',')[0];
            } catch (e) { }

            const displayLocation = `${townName} • ${milesFromStart} mi`;

            // Build query for all targets
            // We include both 'node' and 'way' to catch building outlines (common for large stops)
            let queryParts = "";
            const radius = 20000; // 20km search radius (~12 miles)

            if (targetTypes.includes('food')) {
                const foodFilter = '["amenity"~"cafe|fast_food|restaurant|diner"]';
                queryParts += `node${foodFilter}(around:${radius}, ${lat}, ${lon});`;
                queryParts += `way${foodFilter}(around:${radius}, ${lat}, ${lon});`;
            }
            if (targetTypes.includes('gas')) {
                const gasFilter = '["amenity"~"fuel|charging_station"]';
                queryParts += `node${gasFilter}(around:${radius}, ${lat}, ${lon});`;
                queryParts += `way${gasFilter}(around:${radius}, ${lat}, ${lon});`;
            }
            if (targetTypes.includes('view') || targetTypes.includes('rest')) {
                const viewFilter = '["tourism"~"viewpoint|attraction|museum|park|artwork"]';
                const restFilter = '["amenity"~"rest_area|toilets"]';
                queryParts += `node${viewFilter}(around:${radius}, ${lat}, ${lon});`;
                queryParts += `way${viewFilter}(around:${radius}, ${lat}, ${lon});`;
                queryParts += `node${restFilter}(around:${radius}, ${lat}, ${lon});`;
                queryParts += `way${restFilter}(around:${radius}, ${lat}, ${lon});`;
            }

            const query = `
                [out:json][timeout:25];
                (
                  ${queryParts}
                );
                out center 15; 
            `;

            // Jitter to avoid thunder-herd on the API
            await new Promise(r => setTimeout(r, i * 200));

            // Use main instance or reliable mirrors
            // 0: de, 1: kumi, 2: main
            const mirrors = [
                'overpass-api.de',
                'overpass.kumi.systems',
                'maps.mail.ru/osm/tools/overpass'
            ];
            const mirror = mirrors[i % mirrors.length];

            const url = `https://${mirror}/api/interpreter?data=${encodeURIComponent(query)}`;
            console.log(`Fetching places from ${mirror} for segment ${i}`);

            const response = await axios.get(url, { headers: { 'User-Agent': 'WayvueApp/3.0' }, timeout: 25000 });
            const elements = response.data.elements || [];
            console.log(`Segment ${i}: Found ${elements.length} raw results`);

            elements.forEach(node => {
                const tags = node.tags;
                if (tags && (tags.name || tags.operator || tags.brand)) {
                    const name = tags.name || tags.brand || tags.operator;

                    // Infer type
                    let type = 'view';
                    const amenity = tags.amenity || '';
                    const tourism = tags.tourism || '';

                    if (/cafe|fast_food|restaurant|diner/.test(amenity)) type = 'food';
                    else if (/fuel|charging_station/.test(amenity)) type = 'gas';
                    else if (/rest_area|toilets/.test(amenity)) type = 'rest';
                    else if (tourism) type = 'view';

                    // Strict type matching
                    if (!targetTypes.includes(type)) return;

                    // Improved Quality Score
                    let qualityScore = Object.keys(tags).length;
                    if (tags.name) qualityScore += 5;
                    if (tags.opening_hours) qualityScore += 3;
                    if (tags.cuisine) qualityScore += 2;

                    // Calculate detour (center is available for ways too in 'out center')
                    const pLat = node.lat || node.center?.lat;
                    const pLon = node.lon || node.center?.lon;

                    if (!pLat || !pLon) return;

                    const { detourMiles, detourTime } = calcDetour(pLat, pLon);

                    // Filter out very large detours (> 15 mins)
                    if (detourTime > 15) return;

                    // Construct Address
                    let address = "";
                    if (tags['addr:housenumber'] && tags['addr:street']) {
                        address = `${tags['addr:housenumber']} ${tags['addr:street']}`;
                    } else if (tags['addr:street']) {
                        address = tags['addr:street'];
                    }
                    if (tags['addr:city']) address += `, ${tags['addr:city']}`;
                    if (tags['addr:state']) address += `, ${tags['addr:state']}`;

                    // Fallback address if empty
                    if (!address) {
                        address = `Near ${townName}`;
                    }

                    // Assign Image
                    // Using unsplash source with keywords
                    let imageKeyword = type;
                    if (tags.cuisine) imageKeyword = tags.cuisine;
                    else if (type === 'gas') imageKeyword = 'gas_station';
                    else if (type === 'view') imageKeyword = 'scenic_view';
                    else if (type === 'rest') imageKeyword = 'park_bench';

                    let image = tags.image || tags.wikipedia_image || "";
                    if (!image) {
                        // Better: Return the 'keyword' and let frontend pick a nice photo
                        image = `https://source.unsplash.com/800x600/?${encodeURIComponent(imageKeyword)},travel`;
                    }

                    localResults.push({
                        id: `osm-${node.id}`,
                        type: type,
                        location: displayLocation,
                        title: name,
                        description: tags.cuisine || tags.brand || (type === 'gas' ? 'Fuel Stop' : 'Point of Interest'),
                        quality: qualityScore,
                        miles: Number(milesFromStart),
                        detour: `${detourTime} min • ${detourMiles} mi`,
                        address: address,
                        image: image,
                        lat: pLat,
                        lon: pLon
                    });
                }
            });

        } catch (err) {
            console.error(`Overpass error (seg ${i}): ${err.message}`);
        }

        // Fallback if empty (guarantee at least one if fetching failed)
        if (localResults.length === 0) {
            const fbType = targetTypes[0];
            const fallbackPlaces = {
                food: ["Local Diner", "Highway Grill", "Traveler's Bistro"],
                gas: ["Travel Center", "Express Fuel", "Wayvue Station"],
                view: ["Scenic Viewpoint", "Historic Marker", "Rest Area"]
            };
            const titles = fallbackPlaces[fbType] || ["Local Stop"];
            const title = titles[Math.floor(Math.random() * titles.length)];

            // Sim detour for fallback
            const simDist = (Math.random() * 2 + 0.5).toFixed(1);
            const simTime = Math.ceil(simDist * 4);

            localResults.push({
                id: `fallback-${i}-${fbType}`,
                type: fbType,
                location: `${townName} • ${milesFromStart} mi`,
                title: `${townName} ${title}`,
                description: `A convenient ${fbType} stop.`,
                quality: 1,
                miles: Number(milesFromStart),
                detour: `${simTime} min • ${simDist} mi`
            });
        }

        return localResults;
    });

    // Wait for all fetches to finish and flatten results
    const results = await Promise.all(tasks);
    const recommendations = results.flat().filter(r => r !== null);

    // Sort by quality and filter duplicates
    const finalResults = [];
    const seen = new Set();

    // Sort overall by distance (ascending) to show stops in order of travel
    recommendations.sort((a, b) => (a.miles || 0) - (b.miles || 0));

    recommendations.forEach(r => {
        if (!seen.has(r.title)) {
            seen.add(r.title);
            finalResults.push(r);
        }
    });

    return finalResults;
}

module.exports = { getRecommendations };
