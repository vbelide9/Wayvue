// Viator (TripAdvisor) activities integration — PLACEHOLDER.
//
// Purpose: surface bookable things-to-do near the trip destination (jet ski, parasailing,
// tours, Cedar Point, ...) with affiliate "Book on Viator" links.
//
// Status: scaffolding only. Requires a Viator Partner API key (Basic / Affiliate access)
// in VIATOR_API_KEY. Until that's set — and the response mapping is wired + tested against
// the real API — this returns no activities and the UI shows a "coming soon" state. The
// app is completely unaffected when unconfigured.
//
// Phase 2 (once VIATOR_API_KEY is set), implement inside getActivities():
//   1. Resolve the destination name -> a Viator destinationId (GET /destinations, cached;
//      Viator organizes products by destination, not raw coordinates).
//   2. POST /products/search  { filtering: { destination }, sorting, pagination, currency }.
//   3. Map each product -> { code, title, image, rating, reviewCount, fromPrice, bookingUrl }.
//   Auth:  header 'exp-api-key: <VIATOR_API_KEY>', 'Accept: application/json;version=2.0'.
//   Base:  https://api.sandbox.viator.com/partner (sandbox) |
//          https://api.viator.com/partner (production).
//   The affiliate booking URL is what earns commission — surface it as the CTA.

const VIATOR_API_KEY = process.env.VIATOR_API_KEY || null;

const hasViatorCredentials = Boolean(VIATOR_API_KEY);

/**
 * Activities near a destination.
 * @param {{ destination?: string, lat?: number, lng?: number }} params
 * @returns {Promise<{ configured: boolean, provider: string, activities: Array }>}
 */
async function getActivities({ destination } = {}) {
    // No key → not configured → empty (UI shows the "coming soon" placeholder).
    if (!hasViatorCredentials) {
        return { configured: false, provider: 'viator', activities: [] };
    }

    // TODO(phase-2): call Viator with VIATOR_API_KEY and map the response here. Returning
    // empty for now so a present-but-unwired key can't surface unverified data.
    return { configured: true, provider: 'viator', activities: [] };
}

module.exports = { getActivities, hasViatorCredentials };
