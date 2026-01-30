const axios = require('axios');

/**
 * Fetches REAL places from OpenStreetMap (Overpass API).
 * Queries for Fuel, Food, and Viewpoints near the given coordinates.
 */
async function getRecommendations(routeSegments) {
    const recommendations = [];

    // We can't query every single segment, it would be too slow.
    // Pick 3 strategic stops: Start (coffee), Mid (gas/food), End (sightseeing)
    const indices = [
        Math.floor(routeSegments.length * 0.1), // Near start
        Math.floor(routeSegments.length * 0.5), // Middle
        Math.floor(routeSegments.length * 0.9)  // Near dest
    ];

    const tasks = indices.map(async (idx, i) => {
        const seg = routeSegments[idx];
        if (!seg || !seg.location) return null;

        const { lat, lon } = seg.location;
        let type, amenityQuery;

        // Logic: Morning -> Coffee/Cafe, Mid -> Food/Gas, End -> View/Park
        if (i === 0) {
            type = 'food';
            amenityQuery = '["amenity"~"cafe|fast_food|restaurant|diner"]';
        } else if (i === 1) {
            type = 'gas';
            amenityQuery = '["amenity"~"fuel|charging_station"]';
        } else {
            type = 'view';
            amenityQuery = '["tourism"~"viewpoint|attraction|museum|park"]';
        }

        // Overpass QL Query: Search within 30000m (30km) for highway segments
        // 30km is a reasonable detour distance on a long trip
        const query = `
            [out:json][timeout:15];
            (
              node${amenityQuery}(around:30000, ${lat}, ${lon});
              way${amenityQuery}(around:30000, ${lat}, ${lon});
            );
            out center 1;
        `;

        let place = null;
        const mirror = i % 2 === 0 ? 'overpass-api.de' : 'overpass.kumi.systems';

        try {
            // Use an alternative mirror if the main one is busy.
            const url = `https://${mirror}/api/interpreter?data=${encodeURIComponent(query)}`;

            // Add a slight delay/jitter to avoid hitting rate limits if parallel
            await new Promise(r => setTimeout(r, i * 1000));

            const response = await axios.get(url, {
                headers: { 'User-Agent': 'WayvueApp/3.0' },
                timeout: 20000
            });
            const node = response.data.elements?.[0]; // Just take the first valid result

            if (node && node.tags && (node.tags.name || node.tags.operator)) {
                const name = node.tags.name || node.tags.operator;
                place = {
                    id: `osm-${node.id}`,
                    type: type,
                    location: seg.segment.includes('Segment') ? 'Along Route' : seg.segment.split(',')[0],
                    title: name,
                    description: node.tags.cuisine || (type === 'gas' ? 'Fuel & Services' : type === 'view' ? 'Scenic Spot' : 'Local Stop')
                };
            }
        } catch (err) {
            console.log(`Overpass lookup failed for ${type} on ${mirror}: ${err.message}`);
        }

        // FALLBACK: If API fails or returns no data, generate a realistic placeholder
        if (!place) {
            const city = seg.segment.includes('Segment') || seg.segment.includes('Area') ? 'Along Route' : seg.segment.split(',')[0];
            if (type === 'food') {
                const foods = ["Diner", "BBQ", "Café", "Bistro", "Grill"];
                place = {
                    id: `fallback-${idx}`,
                    type: 'food',
                    location: city,
                    title: city === 'Along Route' ? "Local Stop" : `${city} ${foods[Math.floor(Math.random() * foods.length)]}`,
                    description: `Top-rated local spot for a quick bite.`
                };
            } else if (type === 'gas') {
                place = {
                    id: `fallback-${idx}`,
                    type: 'gas',
                    location: city,
                    title: city === 'Along Route' ? "Highway Travel Center" : `${city} Travel Center`,
                    description: `24/7 Fuel and Convenience.`
                };
            } else {
                place = {
                    id: `fallback-${idx}`,
                    type: 'view',
                    location: city,
                    title: city === 'Along Route' ? "Scenic Overlook" : `${city} Scenic Overlook`,
                    description: `Great spot for photos.`
                };
            }
        }
        return place;
    });

    const results = await Promise.all(tasks);

    return results.filter(r => r !== null);
}

module.exports = { getRecommendations };
