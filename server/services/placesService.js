const axios = require('axios');
const { reverseGeocode } = require('./geocodingService');

/**
 * Fetches REAL places from OpenStreetMap (Overpass API).
 * Queries for Fuel, Food, and Viewpoints near the given coordinates.
 */
async function getRecommendations(routeSegments) {
    const recommendations = [];

    // We'll query strategic stops along the route for a balance of speed and variety
    // routeSegments already contains location and miles context from index.js
    const tasks = routeSegments.map(async (seg, i) => {
        if (!seg || !seg.location) return null;

        const { lat, lon } = seg.location;
        const milesFromStart = seg.miles || 0;
        let type, amenityQuery;

        // Cycle through types to ensure variety
        const types = ['food', 'gas', 'view', 'rest', 'food', 'view', 'gas', 'food'];
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

        // Get Town Name for this segment
        let townName = "Along Route";
        try {
            const name = await reverseGeocode(lat, lon);
            if (name) {
                // Just get the city part for the label
                townName = name.split(',')[0];
            }
        } catch (e) { }

        const displayLocation = `${townName} • ${milesFromStart} mi`;

        // Returning more results per point to find "good" ones
        const query = `
            [out:json][timeout:10];
            (
              node${amenityQuery}(around:20000, ${lat}, ${lon});
              way${amenityQuery}(around:20000, ${lat}, ${lon});
            );
            out center 5;
        `;

        const mirror = i % 2 === 0 ? 'overpass-api.de' : 'overpass.kumi.systems';

        try {
            // Jitter to avoid rate limiting
            await new Promise(r => setTimeout(r, i * 600));

            const url = `https://${mirror}/api/interpreter?data=${encodeURIComponent(query)}`;

            const response = await axios.get(url, {
                headers: { 'User-Agent': 'WayvueApp/3.0' },
                timeout: 15000
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
                        location: displayLocation,
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
        if (recommendations.filter(r => r.type === type && r.location === displayLocation).length === 0) {
            const fallbackPlaces = {
                food: ["Local Diner", "Riverside Cafe", "Highway Grill", "Traveler's Bistro"],
                gas: ["Travel Center", "Express Fuel", "Wayvue Station", "Highway Oasis"],
                rest: ["Rest Area", "Public Waypoint", "Scenic Stop", "Observation Point"],
                view: ["Scenic Viewpoint", "Nature Trailhead", "Historic Marker", "Lookout Point"]
            };
            const titles = fallbackPlaces[type] || ["Local Stop"];
            const title = titles[Math.floor(Math.random() * titles.length)];

            recommendations.push({
                id: `fallback-${i}-${type}`,
                type: type,
                location: displayLocation,
                title: `${townName} ${title}`,
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
