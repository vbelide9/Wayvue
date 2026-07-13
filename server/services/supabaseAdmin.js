// Server-side Supabase client using the SERVICE ROLE key.
//
// This key bypasses Row-Level Security, so it must NEVER reach the browser — it lives
// only in server/.env. Used for server-owned data like the route recommendation cache.
//
// Null when unconfigured, so callers degrade gracefully (e.g. caching just turns off and
// the app falls back to live fetching).
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = url && serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false } })
    : null;

if (!supabaseAdmin) {
    console.log('[supabase] admin client not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) — route cache disabled');
}

module.exports = { supabaseAdmin };
