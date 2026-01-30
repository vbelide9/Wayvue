const axios = require('axios');

/**
 * Geocodes a query string to coordinates using OpenStreetMap Nominatim.
 * @param {string} query - e.g. "San Francisco, CA"
 * @returns {Promise<{lat: string, lon: string, display_name: string} | null>}
 */
const geocode = async (query) => {
    try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
        // Nominatim requires a User-Agent
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Wayvue-App/1.0'
            }
        });

        if (response.data && response.data.length > 0) {
            console.log(`Geocoding success for "${query}":`, response.data[0].display_name);
            return response.data[0];
        }
        console.warn(`Geocoding returned no results for "${query}"`);
        return null;
    } catch (error) {
        console.error(`Geocoding failed for "${query}":`, error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        }
        return null;
    }
};

module.exports = { geocode };
