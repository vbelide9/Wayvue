// "Pack for this trip" — trip-tailored gear grouped into sub-categories, each shoppable at
// MULTIPLE stores. Recommendations adapt to the route's weather, drive length, season, and
// how outdoorsy it looks.
//
// Merchants: Amazon works today (tag-aware — commission when VITE_AMAZON_ASSOCIATE_TAG is
// set, plain search otherwise). Specialty stores (REI, YETI, Backcountry, Osprey, Cotopaxi,
// Travelpro, American Tourister) render as real store-search links NOW; each has an
// `affiliate` hook that's a PLACEHOLDER — wire the affiliate network (AvantLink / ShareASale
// / Impact) + your publisher ID there to start earning on those clicks. The networks aren't
// storefronts, so they're recorded as the `network` field, not shown as buttons.
import {
    type LucideIcon, Umbrella, Sun, Snowflake, Smartphone, BatteryCharging, Camera,
    Droplets, Wind, Tent, Flashlight, Package, ShoppingBag, GlassWater, Cookie, Shield, Backpack, Luggage,
} from 'lucide-react';

const AMAZON_TAG = (import.meta.env.VITE_AMAZON_ASSOCIATE_TAG as string | undefined) || '';
export const hasAffiliateTag = Boolean(AMAZON_TAG);

export type MerchantId =
    | 'amazon' | 'rei' | 'backcountry' | 'yeti' | 'osprey' | 'cotopaxi' | 'travelpro' | 'americantourister';

interface Merchant {
    id: MerchantId;
    name: string;
    focus: string;                          // what it's best for
    network: string;                        // how to enable commission
    search: (q: string) => string;          // plain store search URL (works today)
    affiliate?: (url: string) => string;    // wrap for commission — PLACEHOLDER for all but Amazon
}

// The merchant registry. To monetize a specialty store: sign up on its network, then set its
// `affiliate` to wrap `url` with your deep-link (e.g. AvantLink/ShareASale/Impact tracking URL).
export const MERCHANTS: Record<MerchantId, Merchant> = {
    amazon: {
        id: 'amazon', name: 'Amazon', focus: 'everything', network: 'Amazon Associates',
        search: q => `https://www.amazon.com/s?k=${encodeURIComponent(q)}`,
        affiliate: AMAZON_TAG ? url => `${url}&tag=${encodeURIComponent(AMAZON_TAG)}` : undefined,
    },
    rei: {
        id: 'rei', name: 'REI', focus: 'outdoor & camping (5%)', network: 'AvantLink',
        search: q => `https://www.rei.com/search?q=${encodeURIComponent(q)}`,
        affiliate: undefined, // TODO: AvantLink deep link + VITE_AVANTLINK_ID
    },
    backcountry: {
        id: 'backcountry', name: 'Backcountry', focus: 'outdoor gear (8–10%)', network: 'AvantLink',
        search: q => `https://www.backcountry.com/search?q=${encodeURIComponent(q)}`,
        affiliate: undefined, // TODO
    },
    yeti: {
        id: 'yeti', name: 'YETI', focus: 'coolers & drinkware (7%)', network: 'Impact',
        search: q => `https://www.yeti.com/search?q=${encodeURIComponent(q)}`,
        affiliate: undefined, // TODO: Impact + VITE_IMPACT_ID
    },
    osprey: {
        id: 'osprey', name: 'Osprey', focus: 'backpacks (8%)', network: 'AvantLink',
        search: q => `https://www.osprey.com/us/en/search?q=${encodeURIComponent(q)}`,
        affiliate: undefined, // TODO
    },
    cotopaxi: {
        id: 'cotopaxi', name: 'Cotopaxi', focus: 'packs & apparel', network: 'ShareASale',
        search: q => `https://www.cotopaxi.com/search?q=${encodeURIComponent(q)}`,
        affiliate: undefined, // TODO: ShareASale + VITE_SHAREASALE_ID
    },
    travelpro: {
        id: 'travelpro', name: 'Travelpro', focus: 'luggage (8–10%)', network: 'Impact',
        search: q => `https://www.travelpro.com/search?q=${encodeURIComponent(q)}`,
        affiliate: undefined, // TODO
    },
    americantourister: {
        id: 'americantourister', name: 'American Tourister', focus: 'luggage (8%)', network: 'Impact',
        search: q => `https://www.americantourister.com/search?q=${encodeURIComponent(q)}`,
        affiliate: undefined, // TODO
    },
};

/** Build a shop link for a merchant + query (affiliate-wrapped when that store is wired up). */
export function storeLink(id: MerchantId, query: string): string {
    const m = MERCHANTS[id];
    const url = m.search(query);
    return m.affiliate ? m.affiliate(url) : url;
}

export type PackGroup = 'Essentials' | 'Weather' | 'Comfort' | 'Outdoors';

export interface PackContext {
    precipChance: number;   // 0–100, max along the route
    maxTempC: number;
    minTempC: number;
    durationHours: number;
    month: number;          // 0–11
    outdoorsy: boolean;
}

export interface PackItem {
    id: string;
    title: string;          // the sub-category ("Cooler", "Rain jacket")
    blurb: string;          // why it's suggested for THIS trip
    query: string;
    group: PackGroup;
    icon: LucideIcon;
    merchants: MerchantId[];
    priority: number;
    show: (c: PackContext) => boolean;
}

const isSummer = (m: number) => m >= 4 && m <= 8;   // May–Sep
const isWinter = (m: number) => m === 11 || m <= 1; // Dec–Feb
const hot = (c: PackContext) => c.maxTempC >= 28 || isSummer(c.month);
const cold = (c: PackContext) => c.minTempC <= 2 || isWinter(c.month);
const wet = (c: PackContext) => c.precipChance >= 40;
const long = (c: PackContext) => c.durationHours >= 5;

const ITEMS: PackItem[] = [
    // Essentials (always).
    { id: 'phone-mount', title: 'Phone mount', blurb: 'Hands-free navigation the whole drive.', query: 'magnetic car phone mount', group: 'Essentials', icon: Smartphone, merchants: ['amazon'], priority: 1, show: () => true },
    { id: 'car-charger', title: 'Car charger + power bank', blurb: 'Keep phones charged for maps & music.', query: 'usb c car charger power bank', group: 'Essentials', icon: BatteryCharging, merchants: ['amazon'], priority: 1, show: () => true },
    { id: 'dash-cam', title: 'Dash cam', blurb: 'Records the road — handy for incidents & insurance.', query: 'dash cam front rear', group: 'Essentials', icon: Camera, merchants: ['amazon'], priority: 2, show: () => true },
    { id: 'first-aid', title: 'First-aid kit', blurb: 'A basic safety essential for any road trip.', query: 'car first aid kit', group: 'Essentials', icon: Shield, merchants: ['amazon', 'rei'], priority: 2, show: () => true },
    { id: 'water-bottle', title: 'Insulated water bottle', blurb: 'Stay hydrated between stops.', query: 'insulated water bottle', group: 'Essentials', icon: GlassWater, merchants: ['amazon', 'yeti', 'rei'], priority: 3, show: () => true },

    // Weather.
    { id: 'rain-jacket', title: 'Rain jacket', blurb: 'Rain is in the forecast for your route.', query: 'packable rain jacket', group: 'Weather', icon: Umbrella, merchants: ['amazon', 'rei', 'backcountry', 'cotopaxi'], priority: 1, show: wet },
    { id: 'quick-dry-towel', title: 'Quick-dry towel', blurb: 'Wet stops are likely — a fast-dry towel helps.', query: 'microfiber quick dry towel', group: 'Weather', icon: Droplets, merchants: ['amazon', 'rei'], priority: 3, show: wet },
    { id: 'sunshade', title: 'Windshield sunshade', blurb: 'Warm weather ahead — keep the cabin cool at stops.', query: 'windshield sun shade', group: 'Weather', icon: Sun, merchants: ['amazon'], priority: 1, show: hot },
    { id: 'cooler', title: 'Cooler', blurb: 'Cold drinks & snacks on a warm-weather drive.', query: '12v car cooler', group: 'Weather', icon: ShoppingBag, merchants: ['amazon', 'yeti'], priority: 2, show: hot },
    { id: 'sunscreen', title: 'Sunscreen', blurb: 'Long hours of sun through the windshield.', query: 'travel sunscreen spf 50', group: 'Weather', icon: Sun, merchants: ['amazon', 'rei'], priority: 3, show: hot },
    { id: 'emergency-blanket', title: 'Emergency blanket', blurb: 'Cold temps on your route — a smart safety add.', query: 'car emergency thermal blanket', group: 'Weather', icon: Snowflake, merchants: ['amazon', 'rei'], priority: 1, show: cold },
    { id: 'ice-scraper', title: 'Ice scraper', blurb: 'Freezing conditions expected along the way.', query: 'ice scraper snow brush', group: 'Weather', icon: Wind, merchants: ['amazon'], priority: 2, show: cold },

    // Comfort (long drives + overnight).
    { id: 'neck-pillow', title: 'Travel pillow', blurb: 'A long drive — passengers will thank you.', query: 'memory foam travel neck pillow', group: 'Comfort', icon: Package, merchants: ['amazon'], priority: 2, show: long },
    { id: 'snacks', title: 'Road-trip snacks', blurb: 'Long haul — snacks mean fewer stops.', query: 'road trip snack variety box', group: 'Comfort', icon: Cookie, merchants: ['amazon'], priority: 3, show: long },
    { id: 'luggage', title: 'Packing cubes & bag', blurb: 'Multi-day trip — pack it neatly.', query: 'packing cubes weekender bag', group: 'Comfort', icon: Luggage, merchants: ['amazon', 'travelpro', 'americantourister'], priority: 3, show: c => c.durationHours >= 6 },

    // Outdoors.
    { id: 'daypack', title: 'Daypack', blurb: 'Your route looks outdoorsy — a pack for the trails.', query: 'hiking daypack 20l', group: 'Outdoors', icon: Backpack, merchants: ['amazon', 'osprey', 'cotopaxi', 'rei'], priority: 1, show: c => c.outdoorsy },
    { id: 'headlamp', title: 'Headlamp', blurb: 'Light for camp, trails, and roadside repairs.', query: 'rechargeable led headlamp', group: 'Outdoors', icon: Flashlight, merchants: ['amazon', 'rei', 'backcountry'], priority: 2, show: c => c.outdoorsy },
    { id: 'camp-chairs', title: 'Camp chairs', blurb: 'For parks, campsites, and scenic stops.', query: 'folding camping chair', group: 'Outdoors', icon: Tent, merchants: ['amazon', 'rei', 'backcountry'], priority: 3, show: c => c.outdoorsy },
];

export const GROUP_ORDER: PackGroup[] = ['Essentials', 'Weather', 'Comfort', 'Outdoors'];

/** Tailored items for a trip, grouped by sub-category (most-relevant first within each). */
export function recommendGrouped(ctx: PackContext): { group: PackGroup; items: PackItem[] }[] {
    const shown = ITEMS.filter(p => p.show(ctx)).sort((a, b) => a.priority - b.priority);
    return GROUP_ORDER
        .map(group => ({ group, items: shown.filter(i => i.group === group) }))
        .filter(g => g.items.length > 0);
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

    const dt = input.durationText || '';
    const h = dt.match(/(\d+)\s*hr/); const m = dt.match(/(\d+)\s*min/);
    const durationHours = (h ? parseInt(h[1], 10) : 0) + (m ? parseInt(m[1], 10) : 0) / 60;

    const month = input.depDate ? new Date(input.depDate).getMonth() : new Date().getMonth();
    const outdoorsy = (input.placeNames || []).some(n => n && OUTDOOR_RE.test(n));

    return { precipChance, maxTempC, minTempC, durationHours, month, outdoorsy };
}
