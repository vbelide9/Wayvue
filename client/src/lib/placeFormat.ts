// Condense a full label to a readable "City, ST". Handles typed addresses
// ("1080 Olivia Dr, Oakdale, PA, 15071") and geocoded names ("Chicago, Cook
// County, Illinois, USA") — keeping the city (first meaningful part) + a state.
export function shortPlace(name?: string | null): string {
    if (!name) return '';
    const withoutCountry = name.replace(/,?\s*(USA|United States)\.?$/i, '').trim();
    let parts = withoutCountry.split(',').map(p => p.trim()).filter(Boolean);
    parts = parts.filter(p => !/^\d{5}(-\d{4})?$/.test(p)); // drop bare ZIP
    if (parts.length === 0) return name;
    // Drop a leading street-address part so the city becomes first.
    if (parts.length >= 2 && (/^\d/.test(parts[0]) || /\b(Dr|St|Ave|Rd|Blvd|Ln|Way|Ct|Hwy|Pkwy|Ter|Pl)\.?$/i.test(parts[0]))) {
        parts.shift();
    }
    const city = parts[0];
    const rest = parts.slice(1);
    const state = rest.find(p => /^[A-Z]{2}$/.test(p)) || rest[rest.length - 1];
    return state && state !== city ? `${city}, ${state}` : city;
}
