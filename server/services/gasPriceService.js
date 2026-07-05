const axios = require('axios');

/**
 * Gas Price Service — US Energy Information Administration (EIA) API v2
 * Provides real weekly gasoline prices by state and PADD region.
 * 
 * Registration (free, no credit card): https://www.eia.gov/opendata/
 * Add your key to .env: EIA_API_KEY=your_key_here
 * 
 * EIA duoarea codes:
 *   State-level: "S" + state abbr (e.g., "SNY" = New York, "SCA" = California)
 *   PADD regions: R1X (New England), R1Y (Central Atlantic), R1Z (Lower Atlantic),
 *                 R10 (PADD 1), R20 (Midwest), R30 (Gulf Coast), 
 *                 R40 (Rocky Mountain), R50 (West Coast)
 *   National: NUS
 */

// ====================================================================
// STATE → EIA duoarea codes
// First try state-specific ("S" + abbr), fallback to PADD region
// EIA only publishes state-level data for select states.
// ====================================================================

// States that have EIA state-level data (duoarea = "S" + state abbr)
const EIA_STATE_CODES = new Set([
    'CA', 'CO', 'FL', 'MA', 'MN', 'NY', 'OH', 'TX', 'WA'
]);

// All states → PADD region mapping (used when state-level data unavailable)
const STATE_TO_PADD = {
    // PADD 1A — New England → R1X
    CT: 'R1X', ME: 'R1X', MA: 'R1X', NH: 'R1X', RI: 'R1X', VT: 'R1X',
    // PADD 1B — Central Atlantic → R1Y
    DE: 'R1Y', DC: 'R1Y', MD: 'R1Y', NJ: 'R1Y', NY: 'R1Y', PA: 'R1Y',
    // PADD 1C — Lower Atlantic → R1Z
    FL: 'R1Z', GA: 'R1Z', NC: 'R1Z', SC: 'R1Z', VA: 'R1Z', WV: 'R1Z',
    // PADD 2 — Midwest → R20
    IL: 'R20', IN: 'R20', IA: 'R20', KS: 'R20', KY: 'R20', MI: 'R20',
    MN: 'R20', MO: 'R20', NE: 'R20', ND: 'R20', OH: 'R20', OK: 'R20',
    SD: 'R20', TN: 'R20', WI: 'R20',
    // PADD 3 — Gulf Coast → R30
    AL: 'R30', AR: 'R30', LA: 'R30', MS: 'R30', NM: 'R30', TX: 'R30',
    // PADD 4 — Rocky Mountain → R40
    CO: 'R40', ID: 'R40', MT: 'R40', UT: 'R40', WY: 'R40',
    // PADD 5 — West Coast → R50
    AK: 'R50', AZ: 'R50', CA: 'R50', HI: 'R50', NV: 'R50', OR: 'R50', WA: 'R50'
};

// Published national/regional averages as ultimate fallback
const FALLBACK_PRICES = {
    'R1X':  3.91,  // New England (PADD 1A)
    'R1Y':  4.02,  // Central Atlantic (PADD 1B)
    'R1Z':  3.88,  // Lower Atlantic (PADD 1C)
    'R20':  3.80,  // Midwest (PADD 2)
    'R30':  3.69,  // Gulf Coast (PADD 3)
    'R40':  4.05,  // Rocky Mountain (PADD 4)
    'R50':  5.47,  // West Coast (PADD 5)
    'NUS':  4.13   // National average
};

// Cache: { lookupCode: { price, timestamp, period } }
const priceCache = new Map();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours (EIA updates weekly)

/**
 * Extract state abbreviation from a location string.
 * Handles formats like "Dallas, TX", "Austin, Texas", "New York, NY, USA"
 */
function extractState(locationStr) {
    if (!locationStr) return null;
    
    // Full state name → abbreviation mapping
    const STATE_NAMES = {
        'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
        'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
        'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
        'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
        'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
        'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
        'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
        'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
        'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
        'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
        'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
        'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
        'wisconsin': 'WI', 'wyoming': 'WY', 'district of columbia': 'DC'
    };

    // Try 2-letter abbreviation first (e.g., "Dallas, TX")
    const abbrMatch = locationStr.match(/\b([A-Z]{2})\b/);
    if (abbrMatch && STATE_TO_PADD[abbrMatch[1]]) {
        return abbrMatch[1];
    }

    // Try full state name
    const lower = locationStr.toLowerCase();
    for (const [name, abbr] of Object.entries(STATE_NAMES)) {
        if (lower.includes(name)) {
            return abbr;
        }
    }

    return null;
}

/**
 * Get the best EIA duoarea code for a state.
 * Prefers state-specific code if available, otherwise PADD region.
 */
function getEIACode(state) {
    if (!state) return 'NUS';
    
    // Try state-level first (more accurate)
    if (EIA_STATE_CODES.has(state)) {
        return `S${state}`;
    }
    
    // Fallback to PADD region
    return STATE_TO_PADD[state] || 'NUS';
}

/**
 * Fetch real gas price from EIA API.
 * @param {string} lookupCode - EIA duoarea code (e.g., "SNY", "R1Y", "NUS")
 * @returns {Promise<number|null>} Price per gallon in USD, or null
 */
async function fetchFromEIA(lookupCode) {
    const apiKey = process.env.EIA_API_KEY;
    if (!apiKey) return null;

    try {
        const url = `https://api.eia.gov/v2/petroleum/pri/gnd/data/?api_key=${apiKey}&frequency=weekly&data[0]=value&facets[product][]=EPM0&facets[duoarea][]=${lookupCode}&sort[0][column]=period&sort[0][direction]=desc&length=1`;

        const response = await axios.get(url, { timeout: 5000 });

        if (response.data?.response?.data?.length > 0) {
            const record = response.data.response.data[0];
            const price = parseFloat(record.value);
            if (!isNaN(price) && price > 0) {
                console.log(`[GasPrice] EIA: ${lookupCode} (${record['area-name']}) = $${price.toFixed(3)}/gal (week of ${record.period})`);
                return price;
            }
        }

        return null;
    } catch (error) {
        console.error(`[GasPrice] EIA API error for ${lookupCode}: ${error.message}`);
        return null;
    }
}

/**
 * Get real gas price for a state (or location string).
 * Tries: state-level → PADD region → national → hardcoded fallback.
 * @param {string} locationOrState - "TX", "Dallas, TX", or "Texas"
 * @returns {Promise<number>} Price per gallon in USD
 */
async function getGasPrice(locationOrState) {
    const state = locationOrState.length === 2 
        ? locationOrState.toUpperCase() 
        : extractState(locationOrState);
    
    const primaryCode = getEIACode(state);
    const paddCode = state ? STATE_TO_PADD[state] : null;

    // Check cache
    const cached = priceCache.get(primaryCode);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
        return cached.price;
    }

    // No API key → immediate fallback
    const apiKey = process.env.EIA_API_KEY;
    if (!apiKey) {
        console.log(`[GasPrice] No EIA_API_KEY. Using fallback for ${primaryCode}`);
        return FALLBACK_PRICES[paddCode] || FALLBACK_PRICES['NUS'];
    }

    // Try state-level first
    let price = await fetchFromEIA(primaryCode);

    // If state-level failed and we used a state code, try PADD region
    if (!price && primaryCode.startsWith('S') && paddCode) {
        console.log(`[GasPrice] State ${primaryCode} unavailable, trying PADD ${paddCode}`);
        price = await fetchFromEIA(paddCode);
    }

    // If PADD also failed, try national
    if (!price && primaryCode !== 'NUS') {
        console.log(`[GasPrice] PADD ${paddCode || primaryCode} unavailable, trying national`);
        price = await fetchFromEIA('NUS');
    }

    // If all API calls failed, use hardcoded fallback
    if (!price) {
        price = FALLBACK_PRICES[paddCode] || FALLBACK_PRICES['NUS'];
        console.log(`[GasPrice] All EIA attempts failed. Using hardcoded fallback: $${price}`);
    }

    // Cache the result
    priceCache.set(primaryCode, { price, timestamp: Date.now() });

    // Keep cache manageable
    if (priceCache.size > 100) {
        const firstKey = priceCache.keys().next().value;
        priceCache.delete(firstKey);
    }

    return price;
}

/**
 * Get gas price for a coordinate pair (reverse geocodes to state first).
 * @param {string} locationName - Already resolved location name from reverseGeocode (e.g., "Dallas, TX")
 * @returns {Promise<number>}
 */
async function getGasPriceForLocation(locationName) {
    return getGasPrice(locationName);
}

/**
 * Calculate fuel costs using real gas price.
 * @param {number} distanceMiles 
 * @param {number} gasPricePerGallon 
 * @returns {{ gas: string, ev: string, gasRaw: number, evRaw: number }}
 */
function calculateFuelCosts(distanceMiles, gasPricePerGallon) {
    const AVG_MPG = 25;              // Average US passenger car fuel economy
    const EV_MILES_PER_KWH = 3.5;   // Average EV efficiency
    const ELECTRICITY_RATE = 0.16;    // US avg residential electricity rate ($/kWh)

    const gasGallons = distanceMiles / AVG_MPG;
    const gasCost = gasGallons * gasPricePerGallon;

    const evKwh = distanceMiles / EV_MILES_PER_KWH;
    const evCost = evKwh * ELECTRICITY_RATE;

    return {
        gas: `$${Math.round(gasCost)}`,
        ev: `$${Math.round(evCost)}`,
        gasRaw: gasCost,
        evRaw: evCost,
        gasPricePerGallon: gasPricePerGallon
    };
}

module.exports = { getGasPrice, getGasPriceForLocation, calculateFuelCosts, extractState };
