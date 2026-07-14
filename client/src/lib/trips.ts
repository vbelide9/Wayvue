// Saved-trips data layer (Supabase). RLS scopes everything to the signed-in owner.
import { supabase } from './supabase';
import { type Waypoint } from '@/components/WaypointsEditor';

export interface SavedTrip {
    id: string;
    title: string | null;
    start_label: string;
    destination_label: string;
    start_coords: { lat: number; lng: number } | null;
    dest_coords: { lat: number; lng: number } | null;
    waypoints: Waypoint[];
    departure_date: string | null;
    departure_time: string | null;
    return_date: string | null;
    return_time: string | null;
    is_round_trip: boolean;
    preference: 'fastest' | 'scenic' | null;
    distance: string | null;
    duration: string | null;
    created_at: string;
}

// Fields needed to save a trip (everything except server-managed columns).
export type SaveTripInput = Omit<SavedTrip, 'id' | 'created_at'>;

export async function saveTrip(input: SaveTripInput): Promise<SavedTrip | null> {
    if (!supabase) return null;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw new Error('Sign in to save trips.');

    // Generate the id client-side and insert WITHOUT a returning select. An
    // `insert().select()` fails here: the AFTER-INSERT trigger that adds the owner to
    // trip_members (for group planning) isn't visible to that same statement's RLS SELECT,
    // so the RETURNING row is rejected (42501). We already have all the data, so we build
    // the row locally instead of reading it back.
    const id = crypto.randomUUID();
    const { error } = await supabase
        .from('trips')
        .insert({ id, ...input, user_id: uid });
    if (error) throw error;
    return { id, created_at: new Date().toISOString(), ...input } as SavedTrip;
}

export async function getTripById(id: string): Promise<SavedTrip | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.from('trips').select('*').eq('id', id).maybeSingle();
    if (error) { console.error('[trips] getById failed:', error); return null; }
    return data as SavedTrip | null;
}

export async function listTrips(): Promise<SavedTrip[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('trips')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as SavedTrip[];
}

export async function deleteTrip(id: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from('trips').delete().eq('id', id);
    if (error) throw error;
}
