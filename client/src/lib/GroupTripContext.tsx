// Shared group state for the active trip: members, the route-preference vote, and per-stop
// votes — plus collaborator awareness. Centralised so the trip header and MyPlanTab read
// one source. It polls the trip while open and notifies the current user when a teammate
// adds a stop or joins, and keeps the itinerary in sync (via TripPlanContext.refreshItems).
// No-ops when Supabase is off, signed out, or no trip is open.
import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useTripPlan } from './TripPlanContext';
import { useNotify } from './Notifications';
import { listTripItems, type TripItem } from './tripItems';
import {
    listMembers, getRouteVotes, getItemVotes, castRouteVote, castItemVote,
    removeMember, leaveTrip, getInviteToken, inviteLink,
    type TripMember, type ItemVote, type RouteChoice, type RouteVotes,
} from './groupTrips';

const EMPTY_VOTES: RouteVotes = { fastest: 0, scenic: 0, mine: null, votes: [] };
const POLL_MS = 10000;

interface GroupTripValue {
    members: TripMember[];
    /** True once more than one person is on the trip (i.e. it's actually shared). */
    isGroup: boolean;
    myRole: 'owner' | 'member' | null;
    isOwner: boolean;
    routeVotes: RouteVotes;
    itemVotes: Record<string, ItemVote>;
    /** Look up who added something / who voted → their name + avatar. */
    memberById: (userId: string) => TripMember | undefined;
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

export function GroupTripProvider({ tripId, children }: { tripId: string | null; children: ReactNode }) {
    const { user } = useAuth();
    const { refreshItems } = useTripPlan();
    const notify = useNotify();
    const [members, setMembers] = useState<TripMember[]>([]);
    const [routeVotes, setRouteVotes] = useState<RouteVotes>(EMPTY_VOTES);
    const [itemVotes, setItemVotes] = useState<Record<string, ItemVote>>({});

    // Snapshot of the last-seen items + members, to diff for collaborator notifications.
    const seen = useRef<{ itemIds: Set<string>; memberIds: Set<string>; primed: boolean }>({
        itemIds: new Set(), memberIds: new Set(), primed: false,
    });

    const memberById = useCallback((id: string) => members.find(m => m.userId === id), [members]);

    // Core fetch. `announce` controls whether teammate changes raise toasts (off on the
    // very first load / trip switch, on for background polls).
    const load = useCallback(async (announce: boolean) => {
        if (!tripId || !user) {
            setMembers([]); setRouteVotes(EMPTY_VOTES); setItemVotes({});
            seen.current = { itemIds: new Set(), memberIds: new Set(), primed: false };
            return;
        }
        const [m, rv, iv, items] = await Promise.all([
            listMembers(tripId), getRouteVotes(tripId), getItemVotes(tripId), listTripItems(tripId),
        ]);
        setMembers(m); setRouteVotes(rv); setItemVotes(iv);

        const prev = seen.current;
        const itemIds = new Set(items.map(i => i.id));
        const memberIds = new Set(m.map(x => x.userId));
        const nameOf = (uid: string) => m.find(x => x.userId === uid)?.name || 'A teammate';
        const avatarOf = (uid: string) => m.find(x => x.userId === uid)?.avatar ?? null;

        if (announce && prev.primed) {
            // New stops added by someone else.
            for (const it of items as TripItem[]) {
                if (!prev.itemIds.has(it.id) && it.user_id !== user.id) {
                    notify(`${nameOf(it.user_id)} added a stop`, { detail: it.title, avatar: avatarOf(it.user_id) });
                }
            }
            // New members who joined.
            for (const mem of m) {
                if (!prev.memberIds.has(mem.userId) && mem.userId !== user.id) {
                    notify(`${mem.name} joined the trip`, { avatar: mem.avatar });
                }
            }
            // A teammate changed the itinerary → pull it into the editable plan.
            const added = [...itemIds].some(id => !prev.itemIds.has(id));
            const removed = [...prev.itemIds].some(id => !itemIds.has(id));
            if (added || removed) refreshItems();
        }
        seen.current = { itemIds, memberIds, primed: true };
    }, [tripId, user, notify, refreshItems]);

    // Initial load / reset on trip or user change (no toasts for the baseline).
    useEffect(() => { load(false); }, [load]);

    // Background poll for collaborator activity while a trip is open.
    useEffect(() => {
        if (!tripId || !user) return;
        const t = setInterval(() => load(true), POLL_MS);
        return () => clearInterval(t);
    }, [tripId, user, load]);

    const myRole = members.find(m => m.userId === user?.id)?.role ?? null;

    const getInvite = useCallback(async () => {
        if (!tripId) return null;
        const token = await getInviteToken(tripId);
        return token ? inviteLink(token) : null;
    }, [tripId]);

    const voteRoute = useCallback(async (choice: RouteChoice) => {
        if (!tripId) return;
        await castRouteVote(tripId, choice);
        setRouteVotes(await getRouteVotes(tripId));
    }, [tripId]);

    const voteItem = useCallback(async (tripItemId: string, value: 1 | -1) => {
        if (!tripId) return;
        const current = itemVotes[tripItemId]?.mine ?? 0;
        await castItemVote(tripItemId, tripId, value, current);
        setItemVotes(await getItemVotes(tripId));
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
            routeVotes, itemVotes, memberById, refresh: () => load(false),
            getInvite, voteRoute, voteItem, kick, leave,
        }}>
            {children}
        </Ctx.Provider>
    );
}
