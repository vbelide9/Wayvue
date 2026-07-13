const axios = require('axios');

const OSRM_API = 'http://router.project-osrm.org/route/v1/driving';

/**
 * Fetches all candidate routes for a leg in a SINGLE OSRM call and returns them
 * sorted ascending by duration.
 *
 * Deriving both "fastest" and "scenic" from the same response is what guarantees
 * that fastest.duration <= scenic.duration. (Two independent OSRM calls — one per
 * variant — could come back inconsistent because the public demo cluster is
 * non-deterministic, which is how "scenic" used to end up *faster* than "fastest".)
 *
 * @returns {Promise<Array<{geometry, duration, distance}>>} candidates, [0] = fastest
 */
const getRouteCandidates = async (startLng, startLat, endLng, endLat, waypoints = []) => {
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

    // OSRM only returns alternatives for simple 2-point routes; with via-waypoints
    // there is a single candidate (fastest == scenic, no alternate line shown).
    const useAlternatives = coordList.length === 2;
    const url = `${OSRM_API}/${coordPath}?overview=full&geometries=geojson${useAlternatives ? '&alternatives=3' : ''}`;
    const response = await axios.get(url);

    if (response.data.code !== 'Ok') {
        throw new Error('OSRM Route failed');
    }

    const candidates = response.data.routes.map(r => ({
        geometry: r.geometry, // GeoJSON
        duration: r.duration,
        distance: r.distance
    }));

    // Sort by duration so index 0 is always the objectively fastest route.
    candidates.sort((a, b) => a.duration - b.duration);
    return candidates;
};

/**
 * Convenience wrapper used by the lightweight /route/preview endpoint.
 * Returns a single route for the requested preference, derived from the same
 * deterministic candidate set as the full trip (fastest = [0], scenic = [1]).
 */
const getRouteFromOSRM = async (startLng, startLat, endLng, endLat, alternatives = false, preference = 'fastest', waypoints = []) => {
    try {
        const candidates = await getRouteCandidates(startLng, startLat, endLng, endLat, waypoints);

        // "scenic" (or a legacy alternatives request) → best distinct alternative if one exists.
        const wantAlternative = preference === 'scenic' || alternatives;
        const route = (wantAlternative && candidates.length > 1) ? candidates[1] : candidates[0];

        return {
            geometry: route.geometry,
            duration: route.duration,
            distance: route.distance
        };
    } catch (error) {
        console.error('OSRM API Error:', error.message);
        throw error;
    }
};

module.exports = { getRouteFromOSRM, getRouteCandidates };
