// Per-route cache for place recommendations, backed by Supabase.
//
// Why: recommendations are fetched live from Overpass (OSM), which is flaky — the same
// route returns different places each search, so a rated stop may never reappear. Caching
// the first successful result per route makes the set stable and shared across users.
//
// All functions no-op safely when the admin client isn't configured.
const { supabaseAdmin } = require('./supabaseAdmin');

const round = (n) => Number(n).toFixed(3); // ~110m — coarse enough to match the same named route

/**
 * Stable key for a leg's recommendations. Same start/end/preference/waypoints →
 * same sampled points → same key. Waypoints are included in order (they change the route).
 */
function buildRouteKey(startLoc, endLoc, isScenic, waypoints = []) {
    const wp = (waypoints || [])
        .filter((w) => w && w.lat != null && (w.lon != null || w.lng != null))
        .map((w) => `${round(w.lat)},${round(w.lon != null ? w.lon : w.lng)}`)
        .join(';');
    const pref = isScenic ? 'scenic' : 'fastest';
    return `${round(startLoc.lat)},${round(startLoc.lon)}>${round(endLoc.lat)},${round(endLoc.lon)}|${pref}|wp:${wp}`;
}

/** Returns the cached recommendation array for a route, or null on miss/disabled/error. */
async function getCachedRecommendations(routeKey) {
    if (!supabaseAdmin) return null;
    try {
        const { data, error } = await supabaseAdmin
            .from('route_recommendations')
            .select('recommendations')
            .eq('route_key', routeKey)
            .maybeSingle();
        if (error) throw error;
        return data ? data.recommendations : null;
    } catch (e) {
        console.warn(`[route-cache] read failed: ${e.message}`);
        return null;
    }
}

/** Stores (or refreshes) the recommendations for a route. Best-effort; never throws. */
async function saveCachedRecommendations(routeKey, recommendations) {
    if (!supabaseAdmin || !Array.isArray(recommendations) || recommendations.length === 0) return;
    try {
        const { error } = await supabaseAdmin
            .from('route_recommendations')
            .upsert(
                { route_key: routeKey, recommendations, updated_at: new Date().toISOString() },
                { onConflict: 'route_key' },
            );
        if (error) throw error;
    } catch (e) {
        console.warn(`[route-cache] write failed: ${e.message}`);
    }
}

module.exports = { buildRouteKey, getCachedRecommendations, saveCachedRecommendations };
