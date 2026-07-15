// "Pack for this trip" — recommends trip-relevant gear with affiliate links, tailored to
// the route's weather, drive length, season, and whether it looks outdoorsy.
//
// MVP uses Amazon Associates search links (broadest catalog, works with just a tag — no
// Product Advertising API approval needed). Each product carries its own search query, so a
// specific category can later point at a higher-commission merchant (REI/YETI/etc.) without
// touching the UI. Affiliate tag from VITE_AMAZON_ASSOCIATE_TAG — links still work (no
// commission) when it's unset, so the feature degrades gracefully.
import {
    type LucideIcon, Umbrella, Sun, Snowflake, Smartphone, BatteryCharging, Camera,
    Droplets, Wind, Tent, Flashlight, Package, ShoppingBag, GlassWater, Cookie, Shield,
} from 'lucide-react';

export interface PackContext {
    precipChance: number;   // 0–100, max along the route
    maxTempC: number;
    minTempC: number;
    durationHours: number;
    month: number;          // 0–11
    outdoorsy: boolean;     // route/stops mention camping, parks, trails, lakes…
}

export interface PackProduct {
    id: string;
    title: string;
    blurb: string;          // why it's suggested for THIS trip
    query: string;          // Amazon search terms
    category: string;
    icon: LucideIcon;
    priority: number;
    show: (c: PackContext) => boolean;
}

const AMAZON_TAG = (import.meta.env.VITE_AMAZON_ASSOCIATE_TAG as string | undefined) || '';

/** Amazon Associates search link (commission when a tag is configured). */
export function amazonLink(query: string): string {
    const base = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
    return AMAZON_TAG ? `${base}&tag=${encodeURIComponent(AMAZON_TAG)}` : base;
}

/** Whether an affiliate tag is set (drives the disclosure copy). */
export const hasAffiliateTag = Boolean(AMAZON_TAG);

const isSummer = (m: number) => m >= 4 && m <= 8;   // May–Sep
const isWinter = (m: number) => m === 11 || m <= 1; // Dec–Feb

const PRODUCTS: PackProduct[] = [
    // Road-trip essentials (always).
    { id: 'phone-mount', title: 'Magnetic phone mount', blurb: 'Hands-free navigation the whole drive.', query: 'magnetic car phone mount', category: 'Essentials', icon: Smartphone, priority: 1, show: () => true },
    { id: 'car-charger', title: 'USB-C car charger + power bank', blurb: 'Keep phones charged for maps & music.', query: 'usb c car charger power bank', category: 'Essentials', icon: BatteryCharging, priority: 1, show: () => true },
    { id: 'dash-cam', title: 'Dash cam', blurb: 'Records the road — handy for incidents & insurance.', query: 'dash cam front rear', category: 'Essentials', icon: Camera, priority: 1, show: () => true },
    { id: 'first-aid', title: 'Compact first-aid kit', blurb: 'A basic safety essential for any road trip.', query: 'car first aid kit', category: 'Essentials', icon: Shield, priority: 2, show: () => true },
    { id: 'water-bottle', title: 'Insulated water bottle', blurb: 'Stay hydrated on long stretches between stops.', query: 'insulated water bottle', category: 'Essentials', icon: GlassWater, priority: 2, show: () => true },

    // Rain / wet forecast.
    { id: 'rain-jacket', title: 'Packable rain jacket', blurb: 'Rain is in the forecast for your route.', query: 'packable rain jacket', category: 'Rain', icon: Umbrella, priority: 2, show: c => c.precipChance >= 40 },
    { id: 'microfiber-towel', title: 'Quick-dry towel', blurb: 'Wet stops are likely — a fast-dry towel helps.', query: 'microfiber quick dry towel', category: 'Rain', icon: Droplets, priority: 3, show: c => c.precipChance >= 40 },

    // Heat / summer.
    { id: 'sunshade', title: 'Windshield sunshade', blurb: 'Warm weather ahead — keep the cabin cool at stops.', query: 'windshield sun shade', category: 'Heat', icon: Sun, priority: 2, show: c => c.maxTempC >= 28 || isSummer(c.month) },
    { id: 'car-cooler', title: '12V car cooler', blurb: 'Cold drinks and snacks on a warm-weather drive.', query: '12v car cooler', category: 'Heat', icon: ShoppingBag, priority: 3, show: c => c.maxTempC >= 28 || isSummer(c.month) },
    { id: 'sunscreen', title: 'Travel sunscreen', blurb: 'Long hours of sun through the windshield.', query: 'travel sunscreen spf 50', category: 'Heat', icon: Sun, priority: 4, show: c => c.maxTempC >= 28 || isSummer(c.month) },

    // Cold / winter.
    { id: 'emergency-blanket', title: 'Emergency thermal blanket', blurb: 'Cold temps on your route — a smart safety add.', query: 'car emergency thermal blanket', category: 'Cold', icon: Snowflake, priority: 2, show: c => c.minTempC <= 2 || isWinter(c.month) },
    { id: 'ice-scraper', title: 'Ice scraper + snow brush', blurb: 'Freezing conditions expected along the way.', query: 'ice scraper snow brush', category: 'Cold', icon: Wind, priority: 3, show: c => c.minTempC <= 2 || isWinter(c.month) },

    // Long drives.
    { id: 'neck-pillow', title: 'Memory-foam travel pillow', blurb: 'A long drive — passengers will thank you.', query: 'memory foam travel neck pillow', category: 'Long drive', icon: Package, priority: 3, show: c => c.durationHours >= 5 },
    { id: 'snack-box', title: 'Road-trip snack box', blurb: 'Long haul — snacks mean fewer stops.', query: 'road trip snack variety box', category: 'Long drive', icon: Cookie, priority: 3, show: c => c.durationHours >= 5 },

    // Outdoorsy routes.
    { id: 'headlamp', title: 'LED headlamp', blurb: 'Your route looks outdoorsy — light for camp & repairs.', query: 'rechargeable led headlamp', category: 'Outdoors', icon: Flashlight, priority: 4, show: c => c.outdoorsy },
    { id: 'camp-chairs', title: 'Folding camp chairs', blurb: 'Great for parks, campsites, and scenic stops.', query: 'folding camping chair', category: 'Outdoors', icon: Tent, priority: 4, show: c => c.outdoorsy },
];

/** The tailored list for a trip, most-relevant first. */
export function recommendProducts(ctx: PackContext): PackProduct[] {
    return PRODUCTS.filter(p => p.show(ctx)).sort((a, b) => a.priority - b.priority);
}

const OUTDOOR_RE = /camp|national\s*park|state\s*park|forest|campground|trail|lake|mountain|glacier|canyon|park\b/i;

/** Derive the pack context from what the trip view already has. */
export function buildPackContext(input: {
    weatherData?: any[];
    durationText?: string;
    depDate?: string;
    placeNames?: string[];
}): PackContext {
    const temps = (input.weatherData || []).map(w => w?.weather?.temperature).filter((t: any) => Number.isFinite(t)) as number[];
    const precip = (input.weatherData || []).map(w => w?.weather?.precipitationProbability || 0);
    const maxTempC = temps.length ? Math.max(...temps) : 20;
    const minTempC = temps.length ? Math.min(...temps) : 12;
    const precipChance = precip.length ? Math.max(...precip) : 0;

    let durationHours = 0;
    const dt = input.durationText || '';
    const h = dt.match(/(\d+)\s*hr/); const m = dt.match(/(\d+)\s*min/);
    durationHours = (h ? parseInt(h[1], 10) : 0) + (m ? parseInt(m[1], 10) : 0) / 60;

    const month = input.depDate ? (new Date(input.depDate).getMonth() || new Date().getMonth()) : new Date().getMonth();
    const outdoorsy = (input.placeNames || []).some(n => n && OUTDOOR_RE.test(n));

    return { precipChance, maxTempC, minTempC, durationHours, month, outdoorsy };
}
