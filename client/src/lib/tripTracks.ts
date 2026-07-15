// Collaborative trip playlist (Supabase). Any trip member can add/remove tracks — RLS
// scopes it to participants (is_trip_member). Tracks are found via Spotify catalog search
// (server proxy); the list itself lives in public.trip_tracks. Mirrors tripItems.ts.
import { supabase } from './supabase';

/** A track from Spotify search (what the composer adds). */
export interface SpotifyTrack {
    spotifyId: string;
    uri: string | null;
    name: string;
    artists: string;
    album: string;
    imageUrl: string | null;
    previewUrl: string | null;
    externalUrl: string | null;
    durationMs: number;
}

/** A saved playlist row. */
export interface TripTrack {
    id: string;
    trip_id: string;
    added_by: string;
    spotify_id: string;
    uri: string | null;
    name: string;
    artists: string | null;
    album: string | null;
    image_url: string | null;
    preview_url: string | null;
    external_url: string | null;
    duration_ms: number | null;
    position: number;
    created_at: string;
}

/** Search the Spotify catalog (server proxy holds the app credentials). */
export async function searchSpotify(query: string): Promise<{ configured: boolean; tracks: SpotifyTrack[] }> {
    const q = query.trim();
    if (!q) return { configured: true, tracks: [] };
    try {
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) return { configured: false, tracks: [] };
        return await res.json();
    } catch {
        return { configured: false, tracks: [] };
    }
}

export async function listTracks(tripId: string): Promise<TripTrack[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('trip_tracks')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []) as TripTrack[];
}

export async function addTrack(tripId: string, t: SpotifyTrack): Promise<TripTrack | null> {
    if (!supabase) return null;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw new Error('Sign in to add music.');
    const { data, error } = await supabase
        .from('trip_tracks')
        .insert({
            trip_id: tripId, added_by: uid, spotify_id: t.spotifyId, uri: t.uri, name: t.name,
            artists: t.artists, album: t.album, image_url: t.imageUrl, preview_url: t.previewUrl,
            external_url: t.externalUrl, duration_ms: t.durationMs,
        })
        .select()
        .single();
    if (error) throw error;
    return data as TripTrack;
}

export async function removeTrack(id: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from('trip_tracks').delete().eq('id', id);
    if (error) throw error;
}

/** "1h 23m" from a list of tracks. */
export function totalDuration(tracks: TripTrack[]): string {
    const ms = tracks.reduce((s, t) => s + (t.duration_ms || 0), 0);
    const min = Math.round(ms / 60000);
    const h = Math.floor(min / 60);
    return h > 0 ? `${h}h ${min % 60}m` : `${min}m`;
}
