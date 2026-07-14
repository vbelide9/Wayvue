// Shared group state for the active trip: members, the route-preference vote, and
// per-stop votes. Centralised (like TripPlanContext) so the trip header's members bar and
// MyPlanTab's vote pills read one source. MVP refetches after each action; live Realtime
// sync is a follow-on. No-ops when Supabase is off, signed out, or no trip is open.
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import {
    listMembers, getRouteVotes, getItemVotes, castRouteVote, castItemVote,
    removeMember, leaveTrip, getInviteToken, inviteLink,
    type TripMember, type ItemVote, type RouteChoice,
} from './groupTrips';

interface GroupTripValue {
    members: TripMember[];
    /** True once more than one person is on the trip (i.e. it's actually shared). */
    isGroup: boolean;
    myRole: 'owner' | 'member' | null;
    isOwner: boolean;
    routeVotes: { fastest: number; scenic: number; mine: RouteChoice | null };
    itemVotes: Record<string, ItemVote>;
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
    const [members, setMembers] = useState<TripMember[]>([]);
    const [routeVotes, setRouteVotes] = useState<{ fastest: number; scenic: number; mine: RouteChoice | null }>({ fastest: 0, scenic: 0, mine: null });
    const [itemVotes, setItemVotes] = useState<Record<string, ItemVote>>({});

    const load = useCallback(async () => {
        if (!tripId || !user) {
            setMembers([]);
            setRouteVotes({ fastest: 0, scenic: 0, mine: null });
            setItemVotes({});
            return;
        }
        const [m, rv, iv] = await Promise.all([
            listMembers(tripId), getRouteVotes(tripId), getItemVotes(tripId),
        ]);
        setMembers(m);
        setRouteVotes(rv);
        setItemVotes(iv);
    }, [tripId, user]);

    useEffect(() => { load(); }, [load]);

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
        await load();
    }, [tripId, load]);

    const leave = useCallback(async () => {
        if (!tripId) return;
        await leaveTrip(tripId);
        await load();
    }, [tripId, load]);

    return (
        <Ctx.Provider value={{
            members, isGroup: members.length > 1, myRole, isOwner: myRole === 'owner',
            routeVotes, itemVotes, refresh: load, getInvite, voteRoute, voteItem, kick, leave,
        }}>
            {children}
        </Ctx.Provider>
    );
}
