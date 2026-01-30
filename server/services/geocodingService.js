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
 * Uses retries and smarter field extraction for better coverage.
 * @param {number} lat 
 * @param {number} lon 
 * @param {boolean} fullAddress - If true, returns the detailed address (Match_addr)
 * @returns {Promise<string | null>}
 */
const reverseGeocode = async (lat, lon, fullAddress = false, retries = 1) => {
    for (let i = 0; i <= retries; i++) {
        try {
            // Jittered delay to be nice to API
            await new Promise(r => setTimeout(r, Math.random() * 800));

            const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?f=json&location=${lon},${lat}&distance=10000`;
            const response = await axios.get(url, { timeout: 6000 });

            if (response.data && response.data.address) {
                const addr = response.data.address;

                if (fullAddress && addr.Match_addr) {
                    return addr.Match_addr;
                }

                // 1. City, StateAbbr (Ideal)
                if (addr.City && addr.RegionAbbr) {
                    return `${addr.City}, ${addr.RegionAbbr}`;
                }

                // 2. City, StateFull
                if (addr.City && addr.Region) {
                    return `${addr.City}, ${addr.Region}`;
                }

                // 3. Subregion (County), StateAbbr
                if (addr.Subregion && addr.RegionAbbr) {
                    return `${addr.Subregion}, ${addr.RegionAbbr}`;
                }

                // 4. Any matchable address string
                if (addr.Match_addr) {
                    return addr.Match_addr;
                }
            }
            return null;
        } catch (error) {
            if (i === retries) {
                console.error(`Reverse geocoding failed for ${lat},${lon} after ${retries} retries:`, error.message);
                return null;
            }
            // Simple backoff
            await new Promise(r => setTimeout(r, 500));
        }
    }
    return null;
};

module.exports = { geocode, reverseGeocode };
