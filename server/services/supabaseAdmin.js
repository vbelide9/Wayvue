// Server-side Supabase client using the SERVICE ROLE key.
//
// This key bypasses Row-Level Security, so it must NEVER reach the browser — it lives
// only in server/.env. Used for server-owned data like the route recommendation cache.
//
// Null when unconfigured, so callers degrade gracefully (e.g. caching just turns off and
// the app falls back to live fetching).
const { createClient } = require('@supabase/supabase-js');
// Node < 22 has no native WebSocket; supabase-js's realtime client needs one at
// construction even though we only ever use the REST API. Provide `ws` so createClient
// doesn't throw. (We never open a socket.)
const ws = require('ws');

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseAdmin = null;
if (url && serviceKey) {
    try {
        supabaseAdmin = createClient(url, serviceKey, {
            auth: { persistSession: false },
            realtime: { transport: ws },
        });
    } catch (e) {
        // Never let a client-init failure break the API — just disable the cache.
        console.error(`[supabase] admin client init failed — route cache disabled: ${e.message}`);
        supabaseAdmin = null;
    }
} else {
    console.log('[supabase] admin client not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) — route cache disabled');
}

module.exports = { supabaseAdmin };
