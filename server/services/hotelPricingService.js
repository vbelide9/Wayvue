const axios = require('axios');

/**
 * Hotel Pricing Service — Amadeus Self-Service Hotel Search API.
 * Returns REAL hotel offers with live prices near a destination.
 *
 * Requires AMADEUS_API_KEY + AMADEUS_API_SECRET (free self-service account:
 * https://developers.amadeus.com/). Set AMADEUS_ENV=production for live data
 * (default 'test' uses Amadeus's test environment with cached sample data).
 *
 * If credentials are missing or a call fails, returns null so the caller can
 * fall back to showing hotel options WITHOUT prices (never fabricated numbers).
 */

const ENV = process.env.AMADEUS_ENV === 'production' ? 'production' : 'test';
const BASE_URL = ENV === 'production' ? 'https://api.amadeus.com' : 'https://test.api.amadeus.com';

// Cached OAuth token: { token, expiresAt }
let tokenCache = null;

function hasCredentials() {
    return !!(process.env.AMADEUS_API_KEY && process.env.AMADEUS_API_SECRET);
}

/**
 * Obtain (and cache) an Amadeus OAuth2 bearer token via client_credentials.
 */
async function getAccessToken() {
    if (tokenCache && Date.now() < tokenCache.expiresAt - 30000) {
        return tokenCache.token;
    }
    const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.AMADEUS_API_KEY,
        client_secret: process.env.AMADEUS_API_SECRET
    });
    const res = await axios.post(`${BASE_URL}/v1/security/oauth2/token`, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 8000
    });
    const token = res.data.access_token;
    const expiresIn = (res.data.expires_in || 1799) * 1000;
    tokenCache = { token, expiresAt: Date.now() + expiresIn };
    return token;
}

/**
 * Fetch real hotel offers near a coordinate for a given stay.
 * @param {{ lat:number, lng:number, checkIn:string, checkOut:string, adults:number, radiusKm?:number }} opts
 * @returns {Promise<Array<{ name, features, price, avgPrice, total, link, rating }>|null>}
 *   null when credentials are missing or the lookup fails (caller hides prices).
 */
async function getLiveHotelOffers({ lat, lng, checkIn, checkOut, adults = 2, radiusKm = 20 }) {
    if (!hasCredentials() || lat == null || lng == null) return null;

    try {
        const token = await getAccessToken();
        const authHeader = { headers: { Authorization: `Bearer ${token}` }, timeout: 9000 };

        // 1. Find hotels near the destination coordinate
        const listUrl = `${BASE_URL}/v1/reference-data/locations/hotels/by-geocode` +
            `?latitude=${lat}&longitude=${lng}&radius=${radiusKm}&radiusUnit=KM&hotelSource=ALL`;
        const listRes = await axios.get(listUrl, authHeader);
        const hotels = (listRes.data?.data || []).slice(0, 20);
        if (hotels.length === 0) return [];

        const hotelIds = hotels.map(h => h.hotelId).filter(Boolean).slice(0, 20).join(',');

        // 2. Fetch live offers/prices for those hotels
        const nights = nightsBetween(checkIn, checkOut);
        const offersUrl = `${BASE_URL}/v3/shopping/hotel-offers` +
            `?hotelIds=${hotelIds}&adults=${adults}&checkInDate=${checkIn}&checkOutDate=${checkOut}` +
            `&roomQuantity=1&bestRateOnly=true&currency=USD`;
        const offersRes = await axios.get(offersUrl, authHeader);
        const data = offersRes.data?.data || [];

        const options = data
            .filter(d => d.available && d.offers && d.offers.length > 0)
            .map(d => {
                const offer = d.offers[0];
                const currency = offer.price?.currency || 'USD';
                const totalNum = parseFloat(offer.price?.total);
                if (isNaN(totalNum)) return null;
                const perNight = nights > 0 ? Math.round(totalNum / nights) : Math.round(totalNum);
                const sym = currency === 'USD' ? '$' : `${currency} `;
                const beds = offer.room?.typeEstimated?.beds;
                const bedType = offer.room?.typeEstimated?.bedType;
                const board = offer.boardType ? offer.boardType.replace(/_/g, ' ').toLowerCase() : null;
                const features = [
                    d.hotel?.rating ? `${d.hotel.rating}-star` : null,
                    beds ? `${beds} ${bedType ? bedType.toLowerCase() : 'bed'}${beds > 1 ? 's' : ''}` : null,
                    board
                ].filter(Boolean).join(' • ') || 'Live rate';
                return {
                    name: titleCase(d.hotel?.name || 'Hotel'),
                    features,
                    avgPrice: `${sym}${perNight}/night`,
                    total: `${sym}${Math.round(totalNum)} total`,
                    price: null, // No fabricated range — live single rate only
                    rating: d.hotel?.rating || null,
                    link: bookingSearchLink(d.hotel?.name, checkIn, checkOut, adults)
                };
            })
            .filter(Boolean)
            .sort((a, b) => parseInt(a.avgPrice.replace(/\D/g, '')) - parseInt(b.avgPrice.replace(/\D/g, '')))
            .slice(0, 6);

        return options;
    } catch (error) {
        const status = error.response?.status;
        console.error(`[HotelPricing] Amadeus error${status ? ' ' + status : ''}: ${error.message}`);
        return null;
    }
}

function nightsBetween(checkIn, checkOut) {
    try {
        const a = new Date(checkIn), b = new Date(checkOut);
        const d = Math.round((b - a) / 86400000);
        return d > 0 ? d : 1;
    } catch {
        return 1;
    }
}

function titleCase(s) {
    return String(s).toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function bookingSearchLink(name, checkIn, checkOut, adults) {
    const q = encodeURIComponent(name || 'hotel');
    return `https://www.booking.com/searchresults.html?ss=${q}&checkin=${checkIn}&checkout=${checkOut}&group_adults=${adults}&no_rooms=1`;
}

module.exports = { getLiveHotelOffers, hasAmadeusCredentials: hasCredentials };
