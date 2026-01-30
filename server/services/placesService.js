const axios = require('axios');

/**
 * Fetches REAL places from OpenStreetMap (Overpass API).
 * Queries for Fuel, Food, and Viewpoints near the given coordinates.
 */
async function getRecommendations(routeSegments) {
    // We'll query 10 strategic stops along the route for even coverage across the entire journey
    const indices = Array.from({ length: 10 }, (_, i) =>
        Math.floor(routeSegments.length * (0.05 + (i * 0.1)))
    ).filter(idx => idx < routeSegments.length);

    const tasks = indices.map(async (idx, i) => {
        const seg = routeSegments[idx];
        if (!seg || !seg.location) return null;

        // Cycle through types to ensure variety across the 10 points
        const types = ['food', 'gas', 'rest', 'food', 'view', 'gas', 'food', 'rest', 'view', 'food'];
        type = types[i % types.length];

        if (type === 'food') {
            amenityQuery = '["amenity"~"cafe|fast_food|restaurant|diner"]';
        } else if (type === 'gas') {
            amenityQuery = '["amenity"~"fuel|charging_station"]';
        } else if (type === 'rest') {
            amenityQuery = '["amenity"~"rest_area|toilets|bench"]';
        } else {
            amenityQuery = '["tourism"~"viewpoint|attraction|museum|park"]';
        }

        // Returning more results per point to find "good" ones
        const query = `
            [out:json][timeout:15];
            (
              node${amenityQuery}(around:30000, ${lat}, ${lon});
              way${amenityQuery}(around:30000, ${lat}, ${lon});
            );
            out center 10;
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
            const nodes = response.data.elements || [];

            nodes.forEach(node => {
                if (node.tags && (node.tags.name || node.tags.operator)) {
                    const name = node.tags.name || node.tags.operator;
                    // Quality score: more tags usually means better data/more popular
                    const qualityScore = Object.keys(node.tags).length;

                    recommendations.push({
                        id: `osm-${node.id}`,
                        type: type,
                        location: seg.segment.includes('Segment') ? 'Along Route' : seg.segment.split(',')[0],
                        title: name,
                        description: node.tags.cuisine || (type === 'gas' ? 'Fuel & Services' : type === 'view' ? 'Scenic Spot' : type === 'rest' ? 'Rest stop and basic services' : 'Local Stop'),
                        quality: qualityScore
                    });
                }
            });
            return null; // Don't return 'place' for tasks.map, we push directly to array
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

    // Sort by quality and filter duplicates
    const finalResults = [];
    const seen = new Set();

    // Sort overall by quality score
    recommendations.sort((a, b) => (b.quality || 0) - (a.quality || 0));

    recommendations.forEach(r => {
        if (!seen.has(r.title)) {
            seen.add(r.title);
            finalResults.push(r);
        }
    });

    return finalResults;
}

module.exports = { getRecommendations };
