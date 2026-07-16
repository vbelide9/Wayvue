// Shared trip checklist (Supabase). A collaborative to-do list per trip — any member can add
// items and check them off; RLS scopes it to participants (is_trip_member). `completed_by` /
// `completed_at` record who ticked each one. Mirrors tripTracks.ts / tripExpenses.ts.
import { supabase } from './supabase';

export interface ChecklistItem {
    id: string;
    trip_id: string;
    created_by: string;
    title: string;
    done: boolean;
    completed_by: string | null;
    completed_at: string | null;
    position: number;
    created_at: string;
}

export async function listChecklist(tripId: string): Promise<ChecklistItem[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('trip_checklist_items')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []) as ChecklistItem[];
}

export async function addChecklistItem(tripId: string, title: string): Promise<ChecklistItem | null> {
    if (!supabase) return null;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw new Error('Sign in to add a checklist item.');
    const { data, error } = await supabase
        .from('trip_checklist_items')
        .insert({ trip_id: tripId, created_by: uid, title: title.trim() })
        .select()
        .single();
    if (error) throw error;
    return data as ChecklistItem;
}

/** Toggle done. Stamps completed_by/at with the current user when checking, clears when unchecking. */
export async function setChecklistDone(id: string, done: boolean): Promise<ChecklistItem | null> {
    if (!supabase) return null;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    const { data, error } = await supabase
        .from('trip_checklist_items')
        .update({
            done,
            completed_by: done ? uid : null,
            completed_at: done ? new Date().toISOString() : null,
        })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data as ChecklistItem;
}

export async function removeChecklistItem(id: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from('trip_checklist_items').delete().eq('id', id);
    if (error) throw error;
}
