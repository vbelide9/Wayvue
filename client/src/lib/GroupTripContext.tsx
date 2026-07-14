// Shared group state for the active trip: members, votes, and a collaborator ACTIVITY
// FEED. It polls the open trip and diffs snapshots to detect what teammates did — stops
// added/removed, likes/dislikes, route votes, members joining — surfacing them as an
// unread-counted notification list (shown on My Plan) plus toasts for the big events.
// It also keeps the itinerary in sync (TripPlanContext.refreshItems). No-ops when Supabase
// is off, signed out, or no trip is open.
import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useTripPlan } from './TripPlanContext';
import { useNotify } from './Notifications';
import { listTripItems } from './tripItems';
import {
    listMembers, getRouteVotes, getItemVotes, getItemVoteRows, castRouteVote, castItemVote,
    removeMember, leaveTrip, getInviteToken, inviteLink,
    type TripMember, type ItemVote, type RouteChoice, type RouteVotes,
} from './groupTrips';

const EMPTY_VOTES: RouteVotes = { fastest: 0, scenic: 0, mine: null, votes: [] };
const POLL_MS = 10000;
const MAX_FEED = 40;

// "added a note" / "an attraction" / "a stop" — the right noun for each itinerary kind.
const ITEM_NOUN: Record<string, string> = {
    note: 'a note', hotel: 'a hotel', restaurant: 'a place to eat', attraction: 'an attraction', stop: 'a stop',
};
const nounOf = (kind: string) => ITEM_NOUN[kind] || 'an item';

export interface GroupNotification {
    id: number;
    message: string;
    detail?: string;
    avatar?: string | null;
    ts: number;
    read: boolean;
}

interface GroupTripValue {
    members: TripMember[];
    isGroup: boolean;
    myRole: 'owner' | 'member' | null;
    isOwner: boolean;
    routeVotes: RouteVotes;
    itemVotes: Record<string, ItemVote>;
    memberById: (userId: string) => TripMember | undefined;
    /** Collaborator activity feed (newest first) + unread badge count. */
    notifications: GroupNotification[];
    unreadCount: number;
    /** Mark every activity item read (they drop out of the feed). */
    markNotificationsRead: () => void;
    /** Mark a single activity item read (dismiss it). */
    markNotificationRead: (id: number) => void;
    refresh: () => void;
    getInvite: () => Promise<string | null>;
    voteRoute: (choice: RouteChoice) => Promise<void>;
    voteItem: (tripItemId: string, value: 1 | -1) => Promise<void>;
    kick: (userId: string) => Promise<void>;
    leave: () => Promise<void>;
}

const Ctx = createContext<GroupTripValue | undefined>(undefined);

export const useGroupTrip = () => {
    const c = useContext(Ctx);
    if (!c) throw new Error('useGroupTrip must be used within a GroupTripProvider');
    return c;
};

interface Snapshot {
    itemTitle: Map<string, string>;
    itemKind: Map<string, string>;
    itemAuthor: Map<string, string>;
    routeVote: Map<string, RouteChoice>;   // userId -> choice
    itemVote: Map<string, number>;          // `${itemId}:${userId}` -> value
    memberIds: Set<string>;
    primed: boolean;
}
const emptySnapshot = (): Snapshot => ({
    itemTitle: new Map(), itemKind: new Map(), itemAuthor: new Map(), routeVote: new Map(), itemVote: new Map(),
    memberIds: new Set(), primed: false,
});

export function GroupTripProvider({ tripId, children }: { tripId: string | null; children: ReactNode }) {
    const { user } = useAuth();
    const { refreshItems, selfRemovedIds } = useTripPlan();
    const toast = useNotify();
    const [members, setMembers] = useState<TripMember[]>([]);
    const [routeVotes, setRouteVotes] = useState<RouteVotes>(EMPTY_VOTES);
    const [itemVotes, setItemVotes] = useState<Record<string, ItemVote>>({});
    const [notifications, setNotifications] = useState<GroupNotification[]>([]);

    const seen = useRef<Snapshot>(emptySnapshot());
    const nextNotifId = useRef(1);

    const memberById = useCallback((id: string) => members.find(m => m.userId === id), [members]);
    const markNotificationsRead = useCallback(() => setNotifications(ns => ns.some(n => !n.read) ? ns.map(n => ({ ...n, read: true })) : ns), []);
    const markNotificationRead = useCallback((id: number) => setNotifications(ns => ns.map(n => (n.id === id ? { ...n, read: true } : n))), []);

    const load = useCallback(async (announce: boolean) => {
        if (!tripId || !user) {
            setMembers([]); setRouteVotes(EMPTY_VOTES); setItemVotes({}); setNotifications([]);
            seen.current = emptySnapshot();
            return;
        }
        const [m, rv, iv, items, voteRows] = await Promise.all([
            listMembers(tripId), getRouteVotes(tripId), getItemVotes(tripId),
            listTripItems(tripId), getItemVoteRows(tripId),
        ]);
        setMembers(m); setRouteVotes(rv); setItemVotes(iv);

        const prev = seen.current;
        const nameOf = (uid: string) => m.find(x => x.userId === uid)?.name || 'A teammate';
        const avatarOf = (uid: string) => m.find(x => x.userId === uid)?.avatar ?? null;

        // Build the new snapshot.
        const next: Snapshot = {
            itemTitle: new Map(items.map(i => [i.id, i.title])),
            itemKind: new Map(items.map(i => [i.id, i.kind])),
            itemAuthor: new Map(items.map(i => [i.id, i.user_id])),
            routeVote: new Map(rv.votes.map(v => [v.userId, v.choice])),
            itemVote: new Map(voteRows.map(v => [`${v.tripItemId}:${v.userId}`, v.value])),
            memberIds: new Set(m.map(x => x.userId)),
            primed: true,
        };

        if (announce && prev.primed) {
            const events: { message: string; detail?: string; avatar?: string | null; toast?: boolean }[] = [];

            // Itinerary items added by someone else (kind-aware: stop / note / hotel / …).
            for (const it of items) {
                if (!prev.itemTitle.has(it.id) && it.user_id !== user.id) {
                    events.push({ message: `${nameOf(it.user_id)} added ${nounOf(it.kind)}`, detail: it.title, avatar: avatarOf(it.user_id), toast: true });
                }
            }
            // Items removed (skip the user's own deletions — no "removed_by" to attribute).
            for (const [id, title] of prev.itemTitle) {
                if (!next.itemTitle.has(id)) {
                    if (selfRemovedIds.current.has(id)) { selfRemovedIds.current.delete(id); continue; }
                    const noun = nounOf(prev.itemKind.get(id) || 'stop');
                    events.push({ message: `${noun.charAt(0).toUpperCase()}${noun.slice(1)} was removed`, detail: title });
                }
            }
            // Route votes cast / changed by others.
            for (const [uid, choice] of next.routeVote) {
                if (uid !== user.id && prev.routeVote.get(uid) !== choice) {
                    events.push({ message: `${nameOf(uid)} voted for the ${choice} route`, avatar: avatarOf(uid) });
                }
            }
            // Likes / dislikes on stops by others.
            for (const [key, value] of next.itemVote) {
                if (prev.itemVote.get(key) === value) continue;
                const [itemId, uid] = key.split(':');
                if (uid === user.id) continue;
                const title = next.itemTitle.get(itemId) || 'a stop';
                events.push({ message: `${nameOf(uid)} ${value > 0 ? 'liked' : 'disliked'} ${title}`, avatar: avatarOf(uid) });
            }
            // New members.
            for (const mem of m) {
                if (!prev.memberIds.has(mem.userId) && mem.userId !== user.id) {
                    events.push({ message: `${mem.name} joined the trip`, avatar: mem.avatar, toast: true });
                }
            }

            if (events.length) {
                const now = Date.now();
                const newNotifs = events.map(e => ({ id: nextNotifId.current++, message: e.message, detail: e.detail, avatar: e.avatar, ts: now, read: false }));
                setNotifications(ns => [...newNotifs.reverse(), ...ns].slice(0, MAX_FEED));
                for (const e of events) if (e.toast) toast(e.message, { detail: e.detail, avatar: e.avatar });
            }

            // Pull teammates' item changes into the editable plan.
            const itemsChanged = items.length !== prev.itemTitle.size
                || items.some(i => !prev.itemTitle.has(i.id));
            if (itemsChanged || [...prev.itemTitle.keys()].some(id => !next.itemTitle.has(id))) refreshItems();
        }
        seen.current = next;
    }, [tripId, user, toast, refreshItems, selfRemovedIds]);

    // Always call the latest `load` from the effects below WITHOUT letting the effects
    // re-run on every `load` identity change. The Supabase `user` object churns (e.g.
    // onAuthStateChange fires when the tab regains focus), which would otherwise reset the
    // baseline — silently absorbing a teammate's new stop every time you switch windows.
    const loadRef = useRef(load);
    loadRef.current = load;
    const uid = user?.id ?? null;

    // Baseline (no toasts/feed) — only on an actual trip or user change, keyed on the
    // stable user id so focus-triggered auth events don't re-baseline.
    useEffect(() => { loadRef.current(false); }, [tripId, uid]);

    // Stable background poll for collaborator activity (interval never churns). Also poll
    // immediately when the tab regains focus — background tabs throttle timers, so this is
    // what surfaces a teammate's change the moment you switch back to check.
    useEffect(() => {
        if (!tripId || !uid) return;
        const t = setInterval(() => loadRef.current(true), POLL_MS);
        const onVisible = () => { if (document.visibilityState === 'visible') loadRef.current(true); };
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', onVisible);
        return () => {
            clearInterval(t);
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('focus', onVisible);
        };
    }, [tripId, uid]);

    const myRole = members.find(m => m.userId === user?.id)?.role ?? null;
    const unreadCount = notifications.reduce((n, x) => n + (x.read ? 0 : 1), 0);

    const getInvite = useCallback(async () => {
        if (!tripId) return null;
        const token = await getInviteToken(tripId);
        return token ? inviteLink(token) : null;
    }, [tripId]);

    const voteRoute = useCallback(async (choice: RouteChoice) => {
        if (!tripId) return;
        await castRouteVote(tripId, choice);
        const rv = await getRouteVotes(tripId);
        setRouteVotes(rv);
        seen.current.routeVote = new Map(rv.votes.map(v => [v.userId, v.choice])); // don't self-notify
    }, [tripId]);

    const voteItem = useCallback(async (tripItemId: string, value: 1 | -1) => {
        if (!tripId) return;
        const current = itemVotes[tripItemId]?.mine ?? 0;
        await castItemVote(tripItemId, tripId, value, current);
        setItemVotes(await getItemVotes(tripId));
        const rows = await getItemVoteRows(tripId);
        seen.current.itemVote = new Map(rows.map(v => [`${v.tripItemId}:${v.userId}`, v.value])); // don't self-notify
    }, [tripId, itemVotes]);

    const kick = useCallback(async (userId: string) => {
        if (!tripId) return;
        await removeMember(tripId, userId);
        await load(false);
    }, [tripId, load]);

    const leave = useCallback(async () => {
        if (!tripId) return;
        await leaveTrip(tripId);
        await load(false);
    }, [tripId, load]);

    return (
        <Ctx.Provider value={{
            members, isGroup: members.length > 1, myRole, isOwner: myRole === 'owner',
            routeVotes, itemVotes, memberById, notifications, unreadCount,
            markNotificationsRead, markNotificationRead,
            refresh: () => load(false), getInvite, voteRoute, voteItem, kick, leave,
        }}>
            {children}
        </Ctx.Provider>
    );
}
