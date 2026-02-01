const axios = require('axios');

const OSRM_API = 'http://router.project-osrm.org/route/v1/driving';

/**
 * Fetches route from OSRM.
 * @param {string} start - "lat,lng" or "lng,lat" ? OSRM expects "lng,lat"
 * @param {string} end - "lng,lat"
 */
const getRouteFromOSRM = async (startLng, startLat, endLng, endLat) => {
    try {
        const url = `${OSRM_API}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
        const response = await axios.get(url);

        if (response.data.code !== 'Ok') {
            throw new Error('OSRM Route failed');
        }

        const route = response.data.routes[0];
        return {
            geometry: route.geometry, // GeoJSON
            duration: route.duration,
            distance: route.distance
        };
    } catch (error) {
        console.error('OSRM API Error:', error.message);
        throw error;
    }
};

module.exports = { getRouteFromOSRM };
