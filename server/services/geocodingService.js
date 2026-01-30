const axios = require('axios');

/**
 * Geocodes a query string to coordinates using ArcGIS World Geocoding Service.
 * @param {string} query - e.g. "San Francisco, CA"
 * @returns {Promise<{lat: string, lon: string, display_name: string} | null>}
 */
const geocode = async (query) => {
    try {
        const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&SingleLine=${encodeURIComponent(query)}&maxLocations=1`;

        const response = await axios.get(url, { timeout: 3000 });

        if (response.data && response.data.candidates && response.data.candidates.length > 0) {
            const candidate = response.data.candidates[0];
            console.log(`Geocoding success for "${query}":`, candidate.address);
            return {
                lat: candidate.location.y,
                lon: candidate.location.x,
                display_name: candidate.address
            };
        }
        console.warn(`Geocoding returned no results for "${query}"`);
        return null;
    } catch (error) {
        console.error(`Geocoding failed for "${query}":`, error.message);
        return null;
    }
};

/**
 * Reverse geocodes coordinates to an address/location name.
 * @param {number} lat 
 * @param {number} lon 
 * @returns {Promise<string | null>}
 */
const reverseGeocode = async (lat, lon) => {
    try {
        const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?f=json&location=${lon},${lat}&distance=1000`;
        const response = await axios.get(url, { timeout: 5000 });

        if (response.data && response.data.address) {
            const addr = response.data.address;
            // Prefer City, State. Fallback to Neighborhood or full address
            if (addr.City && addr.RegionAbbr) {
                return `${addr.City}, ${addr.RegionAbbr}`;
            }
            return addr.Match_addr || "Unknown Location";
        }
        return null;
    } catch (error) {
        console.error(`Reverse geocoding failed for ${lat},${lon}:`, error.message);
        return null;
    }
};

module.exports = { geocode, reverseGeocode };
