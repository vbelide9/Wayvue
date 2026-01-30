const polyline = require('@mapbox/polyline');

/**
 * Decodes an encoded polyline string into an array of [lat, lng] coordinates.
 * @param {string} encoded 
 * @returns {Array<[number, number]>}
 */
const decodePolyline = (encoded) => {
    return polyline.decode(encoded);
};

/**
 * Calculates distance between two coordinates in miles.
 */
const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3959; // Radius of Earth in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

/**
 * Samples a route every N miles.
 * @param {Array<[number, number]>} coordinates - Array of [lng, lat] (GeoJSON)
 * @param {number} intervalMiles 
 */
const sampleRoute = (coordinates, intervalMiles = 15) => {
    if (!coordinates || coordinates.length === 0) return [];

    const sampled = [];
    let accumulatedDist = 0;

    // Always include start
    sampled.push(coordinates[0]);

    for (let i = 1; i < coordinates.length; i++) {
        // Input is GeoJSON [lng, lat]
        const [lon1, lat1] = coordinates[i - 1];
        const [lon2, lat2] = coordinates[i];

        // getDistance expects lat, lon
        const dist = getDistance(lat1, lon1, lat2, lon2);

        accumulatedDist += dist;

        if (accumulatedDist >= intervalMiles) {
            sampled.push(coordinates[i]);
            accumulatedDist -= intervalMiles; // Carry over remainder for accuracy
        }
    }

    // Always include end if not close to last sample
    const lastSample = sampled[sampled.length - 1];
    const lastCoord = coordinates[coordinates.length - 1];

    if (getDistance(
        lastSample[1], lastSample[0],
        lastCoord[1], lastCoord[0]
    ) > (intervalMiles * 0.5)) { // Only add end if > 50% of interval away
        sampled.push(coordinates[coordinates.length - 1]);
    }

    return sampled;
};

module.exports = { decodePolyline, sampleRoute };
