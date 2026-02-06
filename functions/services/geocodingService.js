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

const geoCache = new Map();

/**
 * Reverse geocodes coordinates to an address/location name.
 * Uses retries, smarter field extraction, and caching for better reliability.
 * @param {number} lat 
 * @param {number} lon 
 * @param {boolean} fullAddress - If true, returns the detailed address (Match_addr)
 * @returns {Promise<string | null>}
 */
const reverseGeocode = async (lat, lon, fullAddress = false, retries = 2) => {
    // 1. Check Cache (round to 4 decimals ~11m precision to increase hits)
    const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}${fullAddress ? '-full' : ''}`;
    if (geoCache.has(cacheKey)) {
        return geoCache.get(cacheKey);
    }

    for (let i = 0; i <= retries; i++) {
        try {
            // Jittered delay to be nice to API, increases with each retry
            const delay = (i * 1000) + Math.random() * 800;
            await new Promise(r => setTimeout(r, delay));

            const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?f=json&location=${lon},${lat}&distance=10000`;
            const response = await axios.get(url, { timeout: 8000 });

            if (response.data && response.data.address) {
                const addr = response.data.address;
                let result = null;

                if (fullAddress && addr.Match_addr) {
                    result = addr.Match_addr;
                } else if (addr.City && addr.RegionAbbr) {
                    result = `${addr.City}, ${addr.RegionAbbr}`;
                } else if (addr.City && addr.Region) {
                    result = `${addr.City}, ${addr.Region}`;
                } else if (addr.Subregion && addr.RegionAbbr) {
                    result = `${addr.Subregion}, ${addr.RegionAbbr}`;
                } else if (addr.Match_addr) {
                    result = addr.Match_addr;
                }

                if (result) {
                    // Populate cache
                    geoCache.set(cacheKey, result);
                    // Keep cache size manageable
                    if (geoCache.size > 1000) {
                        const firstKey = geoCache.keys().next().value;
                        geoCache.delete(firstKey);
                    }
                    return result;
                } else {
                    console.warn(`[GeoService] No suitable fields found for ${lat},${lon} in response:`, JSON.stringify(addr).substring(0, 100));
                }
            } else {
                console.warn(`[GeoService] Empty response for ${lat},${lon}`);
            }
            return null;
        } catch (error) {
            const isRateLimit = error.response && (error.response.status === 503 || error.response.status === 429);
            console.error(`[GeoService] Attempt ${i + 1} failed for ${lat},${lon}: ${error.message} (IsRateLimit: ${!!isRateLimit})`);
            if (i === retries) {
                if (!isRateLimit) {
                    console.error(`Reverse geocoding failed for ${lat},${lon} after ${retries} retries:`, error.message);
                }
                return null;
            }
            // If rate limited, wait longer
            if (isRateLimit) {
                await new Promise(r => setTimeout(r, 2000 * (i + 1)));
            }
        }
    }
    return null;
};

module.exports = { geocode, reverseGeocode };
