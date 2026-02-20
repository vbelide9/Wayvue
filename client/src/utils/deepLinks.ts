
export interface DeepLinkParams {
    origin: string;
    destination: string;
    pickupDate: string; // YYYY-MM-DD
    dropoffDate: string; // YYYY-MM-DD
    pickupTime?: string; // HH:MM
    dropoffTime?: string; // HH:MM
}

/**
 * Generates a deep link for Kayak Car Rentals
 * Format: https://www.kayak.com/cars/<Origin>-<Dest>/<StartDate>/<EndDate>?sort=price_a
 */
/**
 * Helper to round time to next 30 min interval and generic format
 * Returns { hour: number, minute: number, str: "HH:MM", kayakAttr: "-HHh" }
 * e.g. 15:28 -> 16:00 (Safe buffer) -> str="16:00", kayakAttr="-16h"
 */
const processTime = (dateStr: string, timeStr?: string) => {
    // Default to 10:00 AM if no time
    let h = 10, m = 0;

    if (timeStr) {
        const parts = timeStr.split(':').map(Number);
        if (parts.length >= 2) {
            h = parts[0];
            m = parts[1];
        }
    }

    // Is date today?
    const now = new Date();
    // const tripDate = new Date(dateStr + "T00:00:00"); // Local date roughly
    // Simple check: if dateStr == today's YYYY-MM-DD
    const todayStr = now.toISOString().split('T')[0];
    const isToday = dateStr === todayStr;

    if (isToday) {
        // If today, ensure time is in future + buffer (e.g. 2 hours) to avoid "past" errors
        const currentH = now.getHours();
        // const currentM = now.getMinutes();

        // If selected time is passed or close, bump it
        if (h < currentH + 2) {
            h = currentH + 2;
            m = 0;
        }
    }

    // Round to nearest 30 min usually good for APIs
    // Expedia e.g. 10:00, 10:30.
    if (m < 15) m = 0;
    else if (m < 45) m = 30;
    else {
        m = 0;
        h += 1;
    }

    if (h > 23) h = 23; // Cap at end of day

    const hh = h.toString().padStart(2, '0');
    const mm = m.toString().padStart(2, '0');

    // 12 Hour Format for Expedia (e.g. 10:30AM)
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    const time12 = `${h12}:${mm}${ampm}`;

    return {
        str: `${hh}:${mm}`, // 24h
        str12: time12,      // 12h for Expedia
        kayakAttr: `-${h}h` // For Kayak (e.g. -15h)
    };
};

export const getKayakLink = (params: DeepLinkParams): string => {
    try {
        const { origin, destination, pickupDate, dropoffDate, pickupTime, dropoffTime } = params;

        const pTime = processTime(pickupDate, pickupTime);
        const dTime = processTime(dropoffDate, dropoffTime);

        // Kayak Date Format in URL: YYYY-MM-DD-HHh
        // e.g. 2026-02-10-15h
        const pDateStr = `${pickupDate}${pTime.kayakAttr}`;
        const dDateStr = `${dropoffDate}${dTime.kayakAttr}`;

        const isOneWay = origin.toLowerCase().trim() !== destination.toLowerCase().trim();
        // Decode logic similar: /cars/Origin-Dest/Date-Time/Date-Time
        // Note: Kayak often ignores minutes in URL path, hour is key.

        const routePart = isOneWay
            ? `${encodeURIComponent(origin)}-${encodeURIComponent(destination)}`
            : `${encodeURIComponent(origin)}`;

        return `https://www.kayak.com/cars/${routePart}/${pDateStr}/${dDateStr}?sort=price_a`;
    } catch (e) {
        console.error("Error generating Kayak link", e);
        return "https://www.kayak.com/cars";
    }
};

/**
 * Generates a deep link for Expedia Car Rentals
 * Format: https://www.expedia.com/Car-Rental-Search?d1=<Date>&d2=<Date>&pickuplocation=<Location>
 */
export const getExpediaLink = (_params: DeepLinkParams): string => {
    // Expedia Deep Links are currently blocked/deprecated by their system (returning "Wrong Turn" errors).
    // Disabling for now to prevent broken UX.
    return "";
    /*
    try {
        const { origin, destination, pickupDate, dropoffDate, pickupTime, dropoffTime } = params;

        const url = new URL("https://www.expedia.com/Car-Rental-Search");
        url.searchParams.append("d1", pickupDate);
        url.searchParams.append("d2", dropoffDate);
        
        // Expedia City Search uses 'locn' usually, or 'pickuplocation' for airport codes.
        // Try 'locn' for generic queries.
        url.searchParams.append("locn", origin);

        // Expedia supports dropoff location for one-way
        if (origin.toLowerCase().trim() !== destination.toLowerCase().trim()) {
            url.searchParams.append("dropofflocn", destination);
        }

        // Access times if available (Expedia uses time=HH:MM)
        const pTime = processTime(pickupDate, pickupTime);
        const dTime = processTime(dropoffDate, dropoffTime);
        
        url.searchParams.append("time1", pTime.str12);
        url.searchParams.append("time2", dTime.str12);

        return url.toString();
    } catch (e) {
        console.error("Error generating Expedia link", e);
        return "https://www.expedia.com/Car-Rental-Search";
    }
    */
};

/**
 * Helper to determine which provider to use or return all
 */
export const generateRentalLinks = (params: DeepLinkParams) => {
    return {
        kayak: getKayakLink(params),
        expedia: getExpediaLink(params)
    };
};
