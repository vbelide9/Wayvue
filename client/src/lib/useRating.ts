// Read + write a rating for one place, against Supabase.
//
// Reads the public aggregate (place_rating_stats) and, if signed in, the current
// user's own rating. `submit` upserts the place row (FK target) then the rating,
// so re-rating updates in place. All no-ops when Supabase is disabled.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';

export interface RateablePlace {
    /** Canonical, stable key — the OSM stop id, e.g. "osm-123456". */
    placeKey: string;
    name: string;
    type?: string;
}

export function useRating(place: RateablePlace | null) {
    const { user } = useAuth();
    const [avg, setAvg] = useState<number | null>(null);
    const [count, setCount] = useState(0);
    const [myStars, setMyStars] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const key = place?.placeKey ?? null;

    const load = useCallback(async () => {
        if (!supabase || !key) return;

        // Public aggregate. PostgREST serializes numeric/bigint as strings, so coerce.
        const { data: stats } = await supabase
            .from('place_rating_stats')
            .select('avg_stars, rating_count')
            .eq('place_key', key)
            .maybeSingle();
        setAvg(stats?.avg_stars != null ? Number(stats.avg_stars) : null);
        setCount(stats?.rating_count != null ? Number(stats.rating_count) : 0);

        // The signed-in user's own rating (if any).
        if (user) {
            const { data: mine } = await supabase
                .from('ratings')
                .select('stars')
                .eq('place_key', key)
                .eq('user_id', user.id)
                .maybeSingle();
            setMyStars(mine?.stars ?? null);
        } else {
            setMyStars(null);
        }
    }, [key, user]);

    useEffect(() => { load(); }, [load]);

    const submit = useCallback(async (stars: number) => {
        if (!supabase || !place || !user) return;
        setSaving(true);
        setError(null);
        try {
            // Ensure the place exists before the rating (FK), then upsert the rating.
            const { error: placeErr } = await supabase
                .from('places')
                .upsert(
                    { place_key: place.placeKey, name: place.name, type: place.type ?? null },
                    { onConflict: 'place_key' },
                );
            if (placeErr) throw placeErr;

            const { error: ratingErr } = await supabase
                .from('ratings')
                .upsert(
                    { place_key: place.placeKey, user_id: user.id, stars },
                    { onConflict: 'place_key,user_id' },
                );
            if (ratingErr) throw ratingErr;

            await load();
        } catch (e) {
            // Surface instead of swallowing — a silent failure here is impossible to debug.
            console.error('[rating] save failed:', e);
            setError(e instanceof Error ? e.message : 'Could not save rating');
        } finally {
            setSaving(false);
        }
    }, [place, user, load]);

    return { avg, count, myStars, saving, error, submit };
}
