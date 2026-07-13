// Browser Supabase client — powers Wayvue's community features (ratings, and later
// group trips / social feed).
//
// The client is created ONLY when both env vars are present, so the app runs
// unchanged when Supabase isn't configured (e.g. local dev without keys): every
// community feature checks `isSupabaseEnabled` / `supabase != null` and quietly
// no-ops. See supabase/README.md for setup.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseEnabled
    ? createClient(url!, anonKey!, {
        auth: {
            // SPA defaults: persist the session and pick it back up from the URL
            // hash after an OAuth redirect returns to the app.
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
    })
    : null;
