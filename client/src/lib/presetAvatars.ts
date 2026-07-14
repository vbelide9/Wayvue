// Preset avatars — clean, modern marks on gradient circles, generated as SVG data URIs
// (no network / storage). Two families: travel line-icons (mountain, compass, route,
// sunrise, map pin) and Apple-style person silhouettes.

function circleSvg(from: string, to: string, inner: string): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">`
        + `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">`
        + `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>`
        + `<clipPath id="c"><rect width="96" height="96" rx="48"/></clipPath></defs>`
        + `<g clip-path="url(#c)"><rect width="96" height="96" fill="url(#g)"/>${inner}</g></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// A 24×24 lucide-style icon, centered + scaled into the 96 circle as a white line mark.
function icon(paths: string): string {
    return `<g transform="translate(25 25) scale(1.9)" fill="none" stroke="#fff" stroke-width="2" `
        + `stroke-linecap="round" stroke-linejoin="round">${paths}</g>`;
}

// Apple-style user silhouette: head + rounded shoulders, filled white.
const PERSON = '<circle cx="48" cy="41" r="16" fill="#fff"/>'
    + '<path d="M16 96 v-6 a32 30 0 0 1 64 0 v6 Z" fill="#fff"/>';

export const PRESET_AVATARS: { id: string; url: string }[] = [
    // Travel line-icons
    { id: 'mountain', url: circleSvg('#F59E0B', '#E8622A', icon('<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>')) },
    { id: 'compass', url: circleSvg('#38BDF8', '#3B82F6', icon('<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>')) },
    { id: 'route', url: circleSvg('#10B981', '#0D9488', icon('<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>')) },
    { id: 'sunrise', url: circleSvg('#FB923C', '#F43F5E', icon('<path d="M12 2v8"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m8 6 4-4 4 4"/><path d="M16 18a4 4 0 0 0-8 0"/>')) },
    { id: 'pin', url: circleSvg('#E879F9', '#A855F7', icon('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>')) },
    // Apple-style person silhouettes
    { id: 'user-slate', url: circleSvg('#94A3B8', '#475569', PERSON) },
    { id: 'user-amber', url: circleSvg('#F59E0B', '#E8622A', PERSON) },
    { id: 'user-indigo', url: circleSvg('#818CF8', '#6366F1', PERSON) },
];
