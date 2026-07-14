// Group trip planning data layer (Supabase). Members, invite links, and voting on the
// shared trip. RLS scopes everything to trip participants; see supabase/schema.sql §10.
// All no-op / throw-on-signed-out, mirroring trips.ts / tripItems.ts.
import { supabase } from './supabase';

export interface TripMember {
    userId: string;
    role: 'owner' | 'member';
    name: string;
    avatar: string | null;
    joinedAt: string;
}

export type RouteChoice = 'fastest' | 'scenic';

/** Per-item vote tally: total up/down and the current user's own vote (-1 | 0 | 1). */
export interface ItemVote {
    up: number;
    down: number;
    mine: -1 | 0 | 1;
}

async function currentUserId(): Promise<string> {
    const { data } = await supabase!.auth.getUser();
    const uid = data.user?.id;
    if (!uid) throw new Error('Sign in to continue.');
    return uid;
}

// ── Invites ──────────────────────────────────────────────────────────────────

/** Build the shareable join URL for a trip's invite token. */
export function inviteLink(token: string): string {
    return `${window.location.origin}/?join=${token}`;
}

/** Read a trip's invite token (every trip has one). */
export async function getInviteToken(tripId: string): Promise<string | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.from('trips').select('invite_token').eq('id', tripId).maybeSingle();
    if (error) { console.error('[group] invite token failed:', error); return null; }
    return data?.invite_token ?? null;
}

/** Join a trip by its invite token (RPC runs as definer). Returns the trip id. */
export async function joinTrip(token: string): Promise<string | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('join_trip', { _token: token });
    if (error) throw error;
    return (data as string) ?? null;
}

// ── Members ──────────────────────────────────────────────────────────────────

/** Trip roster, owner first, joined with author profiles (name + avatar). */
export async function listMembers(tripId: string): Promise<TripMember[]> {
    if (!supabase) return [];
    const { data: members, error } = await supabase
        .from('trip_members')
        .select('user_id, role, joined_at')
        .eq('trip_id', tripId);
    if (error || !members || members.length === 0) {
        if (error) console.error('[group] members failed:', error);
        return [];
    }
    // trip_members.user_id and profiles.id both reference auth.users → join client-side.
    const userIds = [...new Set(members.map(m => m.user_id))];
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);
    const pmap = new Map((profiles || []).map(p => [p.id, p]));
    return members
        .map(m => ({
            userId: m.user_id,
            role: m.role as 'owner' | 'member',
            joinedAt: m.joined_at,
            name: pmap.get(m.user_id)?.display_name || 'Traveler',
            avatar: pmap.get(m.user_id)?.avatar_url || null,
        }))
        .sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : a.joinedAt.localeCompare(b.joinedAt)));
}

/** Owner removes a member (or a member removes themselves). */
export async function removeMember(tripId: string, userId: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from('trip_members').delete().eq('trip_id', tripId).eq('user_id', userId);
    if (error) throw error;
}

/** Leave a trip you joined (removes your own membership). */
export async function leaveTrip(tripId: string): Promise<void> {
    const uid = await currentUserId();
    await removeMember(tripId, uid);
}

// ── Route-preference vote ────────────────────────────────────────────────────

export interface RouteVotes {
    fastest: number;
    scenic: number;
    mine: RouteChoice | null;
    /** Raw per-user votes, so the UI can show who voted for which option. */
    votes: { userId: string; choice: RouteChoice }[];
}

/** All members' route votes for a trip: counts, your choice, and per-user breakdown. */
export async function getRouteVotes(tripId: string): Promise<RouteVotes> {
    const empty: RouteVotes = { fastest: 0, scenic: 0, mine: null, votes: [] };
    if (!supabase) return empty;
    const { data, error } = await supabase.from('trip_votes').select('user_id, choice').eq('trip_id', tripId);
    if (error) { console.error('[group] route votes failed:', error); return empty; }
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    let fastest = 0, scenic = 0, mine: RouteChoice | null = null;
    const votes: { userId: string; choice: RouteChoice }[] = [];
    for (const v of data || []) {
        if (v.choice === 'fastest') fastest++;
        else if (v.choice === 'scenic') scenic++;
        if (v.user_id === uid) mine = v.choice as RouteChoice;
        votes.push({ userId: v.user_id, choice: v.choice as RouteChoice });
    }
    return { fastest, scenic, mine, votes };
}

/** Cast (or change) your route-preference vote. */
export async function castRouteVote(tripId: string, choice: RouteChoice): Promise<void> {
    if (!supabase) return;
    const uid = await currentUserId();
    const { error } = await supabase
        .from('trip_votes')
        .upsert({ trip_id: tripId, user_id: uid, choice }, { onConflict: 'trip_id,user_id' });
    if (error) throw error;
}

// ── Candidate-stop votes ─────────────────────────────────────────────────────

/** Tally of up/down votes per itinerary item for a trip, keyed by trip_item_id. */
export async function getItemVotes(tripId: string): Promise<Record<string, ItemVote>> {
    if (!supabase) return {};
    const { data, error } = await supabase
        .from('trip_item_votes')
        .select('trip_item_id, user_id, value')
        .eq('trip_id', tripId);
    if (error) { console.error('[group] item votes failed:', error); return {}; }
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    const out: Record<string, ItemVote> = {};
    for (const v of data || []) {
        const t = (out[v.trip_item_id] ||= { up: 0, down: 0, mine: 0 });
        if (v.value === 1) t.up++;
        else if (v.value === -1) t.down++;
        if (v.user_id === uid) t.mine = v.value as -1 | 1;
    }
    return out;
}

/** Raw per-user item votes for a trip (for attributing likes/dislikes in the activity feed). */
export async function getItemVoteRows(tripId: string): Promise<{ tripItemId: string; userId: string; value: number }[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.from('trip_item_votes').select('trip_item_id, user_id, value').eq('trip_id', tripId);
    if (error) { console.error('[group] item vote rows failed:', error); return []; }
    return (data || []).map(v => ({ tripItemId: v.trip_item_id, userId: v.user_id, value: v.value }));
}

/**
 * Cast an up (1) or down (-1) vote on an item. Sending the value you already hold clears
 * it (toggle off); a different value replaces it.
 */
export async function castItemVote(tripItemId: string, tripId: string, value: 1 | -1, current: -1 | 0 | 1): Promise<void> {
    if (!supabase) return;
    const uid = await currentUserId();
    if (current === value) {
        const { error } = await supabase.from('trip_item_votes').delete().eq('trip_item_id', tripItemId).eq('user_id', uid);
        if (error) throw error;
        return;
    }
    const { error } = await supabase
        .from('trip_item_votes')
        .upsert({ trip_item_id: tripItemId, trip_id: tripId, user_id: uid, value }, { onConflict: 'trip_item_id,user_id' });
    if (error) throw error;
}
