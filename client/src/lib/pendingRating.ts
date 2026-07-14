// Bridges a rating across the Google OAuth redirect.
//
// A signed-out star-click has to launch sign-in, which fully reloads the app — so the
// star the user picked would otherwise be lost. We stash it here before redirecting,
// then re-apply it once the session comes back (see AuthContext).
import { supabase } from './supabase';

const KEY = 'wayvue.pendingRating';

export interface PendingRating {
    placeKey: string;
    name: string;
    type?: string;
    stars: number;
}

export function savePendingRating(r: PendingRating) {
    try {
        localStorage.setItem(KEY, JSON.stringify(r));
    } catch {
        // localStorage unavailable (private mode, etc.) — the pre-login rating just
        // won't carry over; the user can click again once signed in.
    }
}

/** Apply and clear any pending rating for the now-signed-in user. Idempotent. */
export async function flushPendingRating(userId: string): Promise<PendingRating | null> {
    if (!supabase) return null;

    let raw: string | null = null;
    try {
        raw = localStorage.getItem(KEY);
    } catch {
        return null;
    }
    if (!raw) return null;

    let r: PendingRating;
    try {
        r = JSON.parse(raw);
    } catch {
        try { localStorage.removeItem(KEY); } catch { /* ignore */ }
        return null;
    }

    try {
        const { error: placeErr } = await supabase
            .from('places')
            .upsert({ place_key: r.placeKey, name: r.name, type: r.type ?? null }, { onConflict: 'place_key' });
        if (placeErr) throw placeErr;

        const { error: ratingErr } = await supabase
            .from('ratings')
            .upsert({ place_key: r.placeKey, user_id: userId, stars: r.stars }, { onConflict: 'place_key,user_id' });
        if (ratingErr) throw ratingErr;

        try { localStorage.removeItem(KEY); } catch { /* ignore */ }
        return r;
    } catch (e) {
        console.error('[rating] failed to apply pending rating after sign-in:', e);
        return null;
    }
}
