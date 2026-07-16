// Booking partners for the hotel & rental cards — turns the existing search deep links into
// AFFILIATE links so completed bookings earn commission. Same graceful, env-gated pattern as
// the rest of the app: links always work; they only carry affiliate tracking once the
// relevant ID is set.
//
//   • Booking.com — native affiliate: append `aid` (+ label). Set VITE_BOOKING_AFFILIATE_ID.
//   • Expedia / Vrbo — Expedia Group; commission runs through a network (Impact/Partnerize),
//     which wraps the destination URL in a tracking link. `wrapExpedia` is the seam — fill it
//     in with your publisher ID once you're approved. Until then the plain search link is used.
//   • Kayak — meta-search; left as a plain deep link.
//   • (Airbnb has no affiliate program since 2021 — use Vrbo, or a Stay22 wrapper, instead.)
import {
    getBookingLink, getKayakHotelLink, getKayakLink, getExpediaLink,
    type HotelLinkParams, type DeepLinkParams,
} from '@/utils/deepLinks';

const BOOKING_AID = (import.meta.env.VITE_BOOKING_AFFILIATE_ID as string | undefined) || '';
const EXPEDIA_ID = (import.meta.env.VITE_EXPEDIA_AFFILIATE_ID as string | undefined) || '';

/** True once any booking-partner affiliate ID is configured (drives the disclosure copy). */
export const hasBookingAffiliate = Boolean(BOOKING_AID || EXPEDIA_ID);

export interface BookingLink {
    id: string;
    name: string;
    url: string;
}

// Booking.com's own affiliate model: an `aid` (+ free-text `label` for reporting).
function withBookingAid(url: string): string {
    if (!BOOKING_AID) return url;
    try {
        const u = new URL(url);
        u.searchParams.set('aid', BOOKING_AID);
        u.searchParams.set('label', 'wayvue');
        return u.toString();
    } catch { return url; }
}

// Expedia Group commission is earned via an affiliate network deep link. PLACEHOLDER: once
// approved (Impact/Partnerize), wrap `dest` in your tracking URL using EXPEDIA_ID. Until then
// the plain link is returned — the button still works, it just doesn't earn.
function wrapExpedia(dest: string): string {
    if (!EXPEDIA_ID) return dest;
    // TODO: return `https://<network-domain>/...?url=${encodeURIComponent(dest)}&pubid=${EXPEDIA_ID}`;
    return dest;
}

const enc = (s: string) => encodeURIComponent(s || '');

/** Affiliate-aware booking links for a hotel search, best-converting partner first. */
export function hotelPartners(p: HotelLinkParams): BookingLink[] {
    const city = enc(p.city);
    const dates = `${p.checkIn ? `&startDate=${p.checkIn}` : ''}${p.checkOut ? `&endDate=${p.checkOut}` : ''}`;
    const adults = p.guests && p.guests > 0 ? p.guests : 2;
    return [
        { id: 'booking', name: 'Booking.com', url: withBookingAid(getBookingLink(p)) },
        { id: 'expedia', name: 'Expedia', url: wrapExpedia(`https://www.expedia.com/Hotel-Search?destination=${city}${dates}&adults=${adults}`) },
        { id: 'vrbo', name: 'Vrbo', url: wrapExpedia(`https://www.vrbo.com/search?destination=${city}${dates}`) },
        { id: 'kayak', name: 'Kayak', url: getKayakHotelLink(p) },
    ];
}

/** Affiliate-aware booking links for a car-rental search. */
export function rentalPartners(p: DeepLinkParams): BookingLink[] {
    return [
        { id: 'expedia', name: 'Expedia', url: wrapExpedia(getExpediaLink(p)) },
        { id: 'kayak', name: 'Kayak', url: getKayakLink(p) },
        { id: 'booking', name: 'Booking.com', url: withBookingAid(`https://cars.booking.com/search-results?ss=${enc(p.destination)}`) },
    ];
}
