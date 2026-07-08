const axios = require('axios');

const OSRM_API = 'http://router.project-osrm.org/route/v1/driving';

/**
 * Fetches route from OSRM.
 * @param {string} start - "lat,lng" or "lng,lat" ? OSRM expects "lng,lat"
 * @param {string} end - "lng,lat"
 */
const getRouteFromOSRM = async (startLng, startLat, endLng, endLat, alternatives = false, preference = 'fastest', waypoints = []) => {
    try {
        // Build the ordered coordinate path: start → waypoints → end.
        // OSRM accepts semicolon-separated "lng,lat" pairs; via-waypoints route through each stop.
        const coordList = [[startLng, startLat]];
        for (const wp of (waypoints || [])) {
            const wLng = wp.lon !== undefined ? wp.lon : wp.lng;
            const wLat = wp.lat;
            if (wLng !== undefined && wLat !== undefined) coordList.push([wLng, wLat]);
        }
        coordList.push([endLng, endLat]);
        const coordPath = coordList.map(c => `${c[0]},${c[1]}`).join(';');

        // OSRM only returns alternatives for simple 2-point routes; disable when via-waypoints exist.
        const useAlternatives = alternatives && coordList.length === 2;
        const url = `${OSRM_API}/${coordPath}?overview=full&geometries=geojson${useAlternatives ? '&alternatives=true' : ''}`;
        const response = await axios.get(url);

        if (response.data.code !== 'Ok') {
            throw new Error('OSRM Route failed');
        }

        // If 'scenic' requested (alternatives=true), pick the alternative route (Index 1) often distinct.
        // If 'fastest', default to Index 0.
        let route = response.data.routes[0];

        if (preference === 'scenic' && response.data.routes.length > 1) {
            console.log(`[OSRM] Scenic requested. Found ${response.data.routes.length} routes. Selecting alternative.`);
            route = response.data.routes[1]; // Use the second route as "Scenic"
        } else if (alternatives && response.data.routes.length > 1) {
            // Existing logic for Round Trip "Scenic Return" which defaults to alternatives=true
            console.log(`[OSRM] Alternatives requested. Found ${response.data.routes.length} routes. Selecting alternative.`);
            route = response.data.routes[1];
        }

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
