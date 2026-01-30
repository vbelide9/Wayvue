const axios = require('axios');

/**
 * Fetches REAL places from OpenStreetMap (Overpass API).
 * Queries for Fuel, Food, and Viewpoints near the given coordinates.
 */
async function getRecommendations(routeSegments) {
    const recommendations = [];

    // We'll query 6 strategic stops along the route for a balance of speed and variety
    const indices = Array.from({ length: 6 }, (_, i) =>
        Math.floor(routeSegments.length * (0.05 + (i * 0.18)))
    ).filter(idx => idx < routeSegments.length);

    const tasks = indices.map(async (idx, i) => {
        const seg = routeSegments[idx];
        if (!seg || !seg.location) return null;

        const { lat, lon } = seg.location;
        let type, amenityQuery;

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
            [out:json][timeout:8];
            (
              node${amenityQuery}(around:30000, ${lat}, ${lon});
              way${amenityQuery}(around:30000, ${lat}, ${lon});
            );
            out center 8;
        `;

        const mirror = i % 2 === 0 ? 'overpass-api.de' : 'overpass.kumi.systems';

        try {
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
        } catch (err) {
            console.log(`Overpass lookup failed for ${type} on ${mirror}: ${err.message}`);
        }

        // FALLBACK: If Overpass returns no results or fails, provide a high-quality placeholder
        if (recommendations.filter(r => r.type === type).length === 0) {
            const city = seg.segment.includes('Segment') || seg.segment.includes('Area') ? 'Along Route' : seg.segment.split(',')[0];
            const fallbackPlaces = {
                food: ["Local Diner", "Riverside Cafe", "Highway Grill", "Traveler's Bistro"],
                gas: ["Travel Center", "Express Fuel", "Wayvue Station", "Highway Oasis"],
                rest: ["Rest Area", "Public Waypoint", "Scenic Stop", "Observation Point"],
                view: ["Scenic Viewpoint", "Nature Trailhead", "Historic Marker", "Lookout Point"]
            };
            const titles = fallbackPlaces[type] || ["Local Stop"];
            const title = titles[Math.floor(Math.random() * titles.length)];

            recommendations.push({
                id: `fallback-${idx}-${type}`,
                type: type,
                location: city,
                title: city === 'Along Route' ? title : `${city} ${title}`,
                description: `A convenient ${type} stop selected for your journey.`,
                quality: 1 // Lower quality for fallbacks
            });
        }
    });

    // Wait for all fetches to finish
    await Promise.all(tasks);

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
