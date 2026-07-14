// Ratings + reviews against Supabase.
//
// - useRating(place): the public aggregate + the current user's own star/review, and a
//   submit() that upserts them.
// - getRatingStats(keys): batch aggregates for ranking a list of places.
// - getReviews(key): a place's reviews joined with author profiles (name + avatar).
// All no-op when Supabase is disabled.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';

export interface RateablePlace {
    /** Canonical, stable key — e.g. an OSM stop id "osm-123456" or "hotel:name:city". */
    placeKey: string;
    name: string;
    type?: string;
}

export interface Review {
    id: string;
    stars: number;
    review: string | null;
    created_at: string;
    author: { name: string; avatar: string | null };
}

/** Batch community aggregates for a set of places (for "Top rated" ranking). */
export async function getRatingStats(placeKeys: string[]): Promise<Record<string, { avg: number; count: number }>> {
    if (!supabase || placeKeys.length === 0) return {};
    const { data, error } = await supabase
        .from('place_rating_stats')
        .select('place_key, avg_stars, rating_count')
        .in('place_key', placeKeys);
    if (error) { console.error('[rating] stats failed:', error); return {}; }
    const out: Record<string, { avg: number; count: number }> = {};
    for (const r of data || []) out[r.place_key] = { avg: Number(r.avg_stars), count: Number(r.rating_count) };
    return out;
}

/** A place's reviews, newest first, joined with author name/avatar. */
export async function getReviews(placeKey: string): Promise<Review[]> {
    if (!supabase) return [];
    const { data: ratings, error } = await supabase
        .from('ratings')
        .select('id, stars, review, created_at, user_id')
        .eq('place_key', placeKey)
        .order('created_at', { ascending: false });
    if (error || !ratings || ratings.length === 0) return [];

    // ratings.user_id and profiles.id both reference auth.users, so join client-side.
    const userIds = [...new Set(ratings.map(r => r.user_id))];
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);
    const pmap = new Map((profiles || []).map(p => [p.id, p]));

    return ratings.map(r => ({
        id: r.id,
        stars: r.stars,
        review: r.review,
        created_at: r.created_at,
        author: {
            name: pmap.get(r.user_id)?.display_name || 'Traveler',
            avatar: pmap.get(r.user_id)?.avatar_url || null,
        },
    }));
}

export function useRating(place: RateablePlace | null) {
    const { user } = useAuth();
    const [avg, setAvg] = useState<number | null>(null);
    const [count, setCount] = useState(0);
    const [myStars, setMyStars] = useState<number | null>(null);
    const [myReview, setMyReview] = useState<string | null>(null);
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
                .select('stars, review')
                .eq('place_key', key)
                .eq('user_id', user.id)
                .maybeSingle();
            setMyStars(mine?.stars ?? null);
            setMyReview(mine?.review ?? null);
        } else {
            setMyStars(null);
            setMyReview(null);
        }
    }, [key, user]);

    useEffect(() => { load(); }, [load]);

    // Upserts the user's rating. `review === undefined` leaves any existing review
    // untouched (upsert only sets the columns it's given).
    // Returns true on success so callers can confirm/refresh without racing state.
    const submit = useCallback(async (stars: number, review?: string): Promise<boolean> => {
        if (!supabase || !place || !user) return false;
        setSaving(true);
        setError(null);
        try {
            // Ensure the place row exists (for the rating's FK). We only ever need it to
            // exist — never to update its metadata — so ignore conflicts. This maps to
            // ON CONFLICT DO NOTHING, which needs only INSERT (places has no UPDATE policy;
            // a DO UPDATE would be rejected by RLS once the row already exists).
            const { error: placeErr } = await supabase
                .from('places')
                .upsert(
                    { place_key: place.placeKey, name: place.name, type: place.type ?? null },
                    { onConflict: 'place_key', ignoreDuplicates: true },
                );
            if (placeErr) throw placeErr;

            const payload: Record<string, unknown> = { place_key: place.placeKey, user_id: user.id, stars };
            if (review !== undefined) payload.review = review.trim() || null;

            const { error: ratingErr } = await supabase
                .from('ratings')
                .upsert(payload, { onConflict: 'place_key,user_id' });
            if (ratingErr) throw ratingErr;

            await load();
            return true;
        } catch (e) {
            console.error('[rating] save failed:', e);
            setError(e instanceof Error ? e.message : 'Could not save rating');
            return false;
        } finally {
            setSaving(false);
        }
    }, [place, user, load]);

    return { avg, count, myStars, myReview, saving, error, submit };
}
