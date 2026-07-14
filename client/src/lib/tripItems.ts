// Itinerary items for a saved trip (Supabase). RLS scopes everything to the owner.
import { supabase } from './supabase';

export type TripItemKind = 'stop' | 'hotel' | 'attraction' | 'restaurant' | 'note';

export interface TripItem {
    id: string;
    trip_id: string;
    kind: TripItemKind;
    title: string;
    detail: string | null;
    location: string | null;
    image_url: string | null;
    external_url: string | null;
    notes: string | null;
    position: number;
    created_at: string;
}

// What a card supplies when adding to a plan (trip_id/user_id/position filled in here).
export interface NewTripItem {
    kind: TripItemKind;
    title: string;
    detail?: string | null;
    location?: string | null;
    image_url?: string | null;
    external_url?: string | null;
    /** Distance along the route (mi); used to order the plan in travel order. */
    routeMiles?: number | null;
}

export async function listTripItems(tripId: string): Promise<TripItem[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('trip_items')
        .select('*')
        .eq('trip_id', tripId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []) as TripItem[];
}

export async function addTripItem(tripId: string, item: NewTripItem, position: number): Promise<TripItem | null> {
    if (!supabase) return null;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw new Error('Sign in to add to a plan.');

    const { data, error } = await supabase
        .from('trip_items')
        .insert({
            trip_id: tripId,
            user_id: uid,
            kind: item.kind,
            title: item.title,
            detail: item.detail ?? null,
            location: item.location ?? null,
            image_url: item.image_url ?? null,
            external_url: item.external_url ?? null,
            position,
        })
        .select()
        .single();
    if (error) throw error;
    return data as TripItem;
}

export async function updateTripItem(id: string, patch: Partial<Pick<TripItem, 'notes' | 'position' | 'title' | 'detail'>>): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from('trip_items').update(patch).eq('id', id);
    if (error) throw error;
}

export async function deleteTripItem(id: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from('trip_items').delete().eq('id', id);
    if (error) throw error;
}

/** Number of plan items per trip (for the current user), keyed by trip_id. */
export async function getPlanItemCounts(): Promise<Record<string, number>> {
    if (!supabase) return {};
    const { data, error } = await supabase.from('trip_items').select('trip_id');
    if (error) { console.error('[plan] counts failed:', error); return {}; }
    const counts: Record<string, number> = {};
    for (const row of data || []) counts[row.trip_id] = (counts[row.trip_id] || 0) + 1;
    return counts;
}
