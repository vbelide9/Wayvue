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
    assigned_to: string | null;
    due_date: string | null;   // 'YYYY-MM-DD'
    position: number;
    created_at: string;
}

export interface NewChecklistItem {
    title: string;
    assignedTo?: string | null;
    dueDate?: string | null;
}

export async function listChecklist(tripId: string): Promise<ChecklistItem[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('trip_checklist_items')
        .select('*')
        .eq('trip_id', tripId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []) as ChecklistItem[];
}

export async function addChecklistItem(tripId: string, item: NewChecklistItem, position = 0): Promise<ChecklistItem | null> {
    if (!supabase) return null;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw new Error('Sign in to add a checklist item.');
    const { data, error } = await supabase
        .from('trip_checklist_items')
        .insert({
            trip_id: tripId, created_by: uid, title: item.title.trim(),
            assigned_to: item.assignedTo ?? null, due_date: item.dueDate ?? null, position,
        })
        .select()
        .single();
    if (error) throw error;
    return data as ChecklistItem;
}

/** Update an item's assignee and/or due date. */
export async function updateChecklistItem(id: string, patch: { assignedTo?: string | null; dueDate?: string | null; title?: string }): Promise<ChecklistItem | null> {
    if (!supabase) return null;
    const row: Record<string, any> = {};
    if ('assignedTo' in patch) row.assigned_to = patch.assignedTo ?? null;
    if ('dueDate' in patch) row.due_date = patch.dueDate ?? null;
    if ('title' in patch && patch.title != null) row.title = patch.title.trim();
    const { data, error } = await supabase.from('trip_checklist_items').update(row).eq('id', id).select().single();
    if (error) throw error;
    return data as ChecklistItem;
}

/** Persist a reordering: write each item's new position by array order. */
export async function reorderChecklist(items: { id: string }[]): Promise<void> {
    if (!supabase) return;
    await Promise.all(items.map((it, i) =>
        supabase!.from('trip_checklist_items').update({ position: i }).eq('id', it.id)
    ));
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

// ── Auto-seeded suggestions ─────────────────────────────────────────────────────
export interface ChecklistContext {
    destination?: string;
    placeNames?: string[];   // waypoint / stop names, used to detect camping etc.
    depDate?: string;        // 'YYYY-MM-DD' — used for season
}

/** Trip-tailored starter items. Always includes travel-doc basics, plus context-derived
 *  extras (camping, winter, beach, long-haul). Returns titles; the tab filters out any the
 *  user already added. Ties into the same signals the "Pack for this trip" tab uses. */
export function suggestedChecklistItems(ctx: ChecklistContext): string[] {
    const hay = [ctx.destination || '', ...(ctx.placeNames || [])].join(' ').toLowerCase();
    const has = (...words: string[]) => words.some(w => hay.includes(w));
    const month = ctx.depDate ? new Date(ctx.depDate).getMonth() : new Date().getMonth(); // 0–11
    const winter = month === 11 || month <= 1;
    const summer = month >= 5 && month <= 7;

    const out = ['Check driver’s license & insurance', 'Fill up / plan charging stops', 'Download offline maps', 'Pack a phone charger & cable'];
    if (has('camp', 'campground', 'national park', 'state park', 'forest')) out.push('Book the campsite', 'Pack tent & sleeping bags');
    if (has('beach', 'coast', 'ocean', 'lake', 'bay')) out.push('Pack swimwear & sunscreen');
    if (has('ski', 'mountain', 'summit', 'peak')) out.push('Pack layers & snow gear');
    if (winter) out.push('Check tires & antifreeze for winter');
    if (summer) out.push('Pack a cooler & extra water');
    out.push('Share the trip plan with everyone', 'Split who books what');
    return out;
}
