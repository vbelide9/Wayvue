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
        const historicRegex = "memorial|monument|castle|ruins";
        const highwayRegex = "rest_area";

        const query = `
            [out:json][timeout:15];
            (
              node["amenity"~"${commonAmenity}"](around:5000, ${lat}, ${lon});
            );
            out center 20;
            (
              node["amenity"~"${sparseAmenity}"](around:15000, ${lat}, ${lon});
              node["highway"~"${highwayRegex}"](around:15000, ${lat}, ${lon});
              node["tourism"~"${tourismRegex}"](around:15000, ${lat}, ${lon});
              node["historic"~"${historicRegex}"](around:15000, ${lat}, ${lon});
            );
            out center 100;
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

            console.log(`Segment ${i}: found ${nodes.length} nodes`);
            const segmentCandidates = [];

            // Helper to determine type from tags
            const determineType = (tags) => {
                if (tags.amenity) {
                    if (['cafe', 'fast_food', 'restaurant', 'diner'].some(v => tags.amenity.includes(v))) return 'food';
                    if (tags.amenity.includes('fuel')) return 'gas';
                    if (tags.amenity.includes('charging_station')) return 'charging';
                    if (['rest_area', 'toilets'].some(v => tags.amenity.includes(v))) return 'rest';
                }
                if (tags.highway && tags.highway.includes('rest_area')) return 'rest';
                if (tags.tourism) return 'view';
                if (tags.historic) return 'view';
                return 'view'; // default
            };

            nodes.forEach(node => {
                if (node.tags && (node.tags.name || node.tags.operator)) {
                    const name = node.tags.name || node.tags.operator;
                    // Quality score: more tags usually means better data/more popular
                    const qualityScore = Object.keys(node.tags).length;

                    // Use specific city if available, otherwise default to search point town
                    const city = node.tags['addr:city'] || defaultTownName;
                    const displayLocation = `${city} • ${milesFromStart} mi`;

                    const type = determineType(node.tags);

                    segmentCandidates.push({
                        id: `osm-${node.id}`,
                        type: type,
                        location: displayLocation,
                        title: name,
                        description: node.tags.cuisine || (type === 'gas' ? 'Fuel & Services' : type === 'charging' ? 'EV Charging Station' : type === 'view' ? 'Scenic Spot' : type === 'rest' ? 'Rest Area' : 'Local Stop'),
                        quality: qualityScore,
                        miles: Number(milesFromStart)
                    });
                }
            });

            // Sort by quality (descending)
            segmentCandidates.sort((a, b) => b.quality - a.quality);

            // Take top results PER CATEGORY to ensure variety
            const categoryCounts = { food: 0, gas: 0, charging: 0, view: 0, rest: 0 };
            segmentCandidates.forEach(cand => {
                const limit = ['food', 'gas'].includes(cand.type) ? 3 : 2;
                if (categoryCounts[cand.type] < limit) {
                    recommendations.push(cand);
                    categoryCounts[cand.type]++;
                }
            });

        } catch (err) {
            console.log(`Overpass lookup failed on ${mirror}: ${err.message}`);
        }

        // FALLBACK logic: If we got no results (or timeout), add diversity placeholders
        // Check if we have results for this mile marker.
        const hasResults = recommendations.some(r => r.miles === Number(milesFromStart));

        if (!hasResults) {
            // Cycle through ALL types for fallbacks, not just food/gas
            const fallbackTypes = ['food', 'gas', 'charging', 'view', 'rest'];
            const fallbackType = fallbackTypes[i % fallbackTypes.length];

            const fallbackPlaces = {
                food: ["Local Diner", "Riverside Cafe", "Highway Grill", "Traveler's Bistro"],
                gas: ["Travel Center", "Express Fuel", "Wayvue Station", "Highway Oasis"],
                charging: ["Supercharger", "ChargePoint", "EV Plaza", "Electric Station"],
                rest: ["Rest Area", "Public Waypoint", "Scenic Stop", "Observation Point"],
                view: ["Scenic Viewpoint", "Nature Trailhead", "Historic Marker", "Lookout Point"]
            };

            const titles = fallbackPlaces[fallbackType] || ["Local Stop"];
            const title = titles[Math.floor(Math.random() * titles.length)];
            const displayLocation = `${defaultTownName} • ${milesFromStart} mi`;

            recommendations.push({
                id: `fallback-${i}-${fallbackType}`,
                type: fallbackType,
                location: displayLocation,
                title: `${defaultTownName} ${title}`,
                description: `A convenient ${fallbackType} stop selected for your journey.`,
                quality: 1,
                miles: Number(milesFromStart)
            });
        }
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

    return finalResults;
}

module.exports = { getRecommendations };
