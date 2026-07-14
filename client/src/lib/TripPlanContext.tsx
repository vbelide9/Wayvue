// The active trip's editable plan: which saved trip is open, its itinerary items, and
// the operations to build it (save, add-to-plan, reorder, notes, remove). Centralised
// so the header's Save button and the recommendation cards' "Add to plan" can share it
// without prop-drilling. All no-ops / prompts when Supabase is off or the user's out.
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { saveTrip, type SaveTripInput, type SavedTrip } from './trips';
import {
    listTripItems, addTripItem, deleteTripItem, updateTripItem,
    type TripItem, type NewTripItem,
} from './tripItems';

interface TripPlanValue {
    enabled: boolean;
    signedIn: boolean;
    /** A trip is loaded/planned (there's something to save). */
    hasTrip: boolean;
    /** The saved trip's id, or null if the current trip hasn't been saved yet. */
    tripId: string | null;
    items: TripItem[];
    busy: boolean;
    /** Save the current trip; sets tripId. Returns the row (or null). */
    saveCurrentTrip: () => Promise<SavedTrip | null>;
    /** Add an item to the plan (saving the trip first if needed; prompts sign-in if out). */
    addToPlan: (item: NewTripItem) => Promise<void>;
    removeItem: (id: string) => Promise<void>;
    updateNotes: (id: string, notes: string) => Promise<void>;
    moveItem: (id: string, dir: -1 | 1) => Promise<void>;
}

const Ctx = createContext<TripPlanValue | undefined>(undefined);

export const useTripPlan = () => {
    const c = useContext(Ctx);
    if (!c) throw new Error('useTripPlan must be used within a TripPlanProvider');
    return c;
};

export function TripPlanProvider({ tripId, saveTripData, onTripIdChange, children }: {
    tripId: string | null;
    saveTripData: SaveTripInput | null;
    onTripIdChange: (id: string | null) => void;
    children: ReactNode;
}) {
    const { enabled, user, signInWithGoogle } = useAuth();
    const [items, setItems] = useState<TripItem[]>([]);
    const [busy, setBusy] = useState(false);

    // Load the plan whenever the active saved trip (or the user) changes.
    useEffect(() => {
        if (!tripId) { setItems([]); return; }
        let cancelled = false;
        (async () => {
            try {
                const data = await listTripItems(tripId);
                if (!cancelled) setItems(data);
            } catch (e) {
                console.error('[plan] list failed:', e);
            }
        })();
        return () => { cancelled = true; };
    }, [tripId, user]);

    const saveCurrentTrip = useCallback(async (): Promise<SavedTrip | null> => {
        if (!saveTripData) return null;
        const saved = await saveTrip(saveTripData);
        if (saved) onTripIdChange(saved.id);
        return saved;
    }, [saveTripData, onTripIdChange]);

    const addToPlan = useCallback(async (item: NewTripItem) => {
        if (!user) { await signInWithGoogle(); return; } // redirects; user clicks again on return
        setBusy(true);
        try {
            const id = tripId ?? (await saveCurrentTrip())?.id ?? null;
            if (!id) return;
            // Order by route position: stops sort by their mileage from the start; items
            // without a mile (hotels/activities at the destination, notes) append after.
            const position = item.routeMiles != null ? Math.round(item.routeMiles) : 100000 + items.length;
            const created = await addTripItem(id, item, position);
            if (created) setItems(prev => [...prev, created].sort((a, b) => a.position - b.position));
        } catch (e) {
            console.error('[plan] add failed:', e);
        } finally {
            setBusy(false);
        }
    }, [user, signInWithGoogle, tripId, saveCurrentTrip, items.length]);

    const removeItem = useCallback(async (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id));
        try { await deleteTripItem(id); } catch (e) { console.error('[plan] delete failed:', e); }
    }, []);

    const updateNotes = useCallback(async (id: string, notes: string) => {
        setItems(prev => prev.map(i => (i.id === id ? { ...i, notes } : i)));
        try { await updateTripItem(id, { notes }); } catch (e) { console.error('[plan] notes failed:', e); }
    }, []);

    const moveItem = useCallback(async (id: string, dir: -1 | 1) => {
        const idx = items.findIndex(i => i.id === id);
        const target = idx + dir;
        if (idx < 0 || target < 0 || target >= items.length) return;
        const next = [...items];
        [next[idx], next[target]] = [next[target], next[idx]];
        const reindexed = next.map((it, i) => ({ ...it, position: i }));
        setItems(reindexed);
        try {
            await updateTripItem(reindexed[idx].id, { position: idx });
            await updateTripItem(reindexed[target].id, { position: target });
        } catch (e) {
            console.error('[plan] reorder failed:', e);
        }
    }, [items]);

    return (
        <Ctx.Provider value={{
            enabled, signedIn: !!user, hasTrip: !!saveTripData, tripId, items, busy,
            saveCurrentTrip, addToPlan, removeItem, updateNotes, moveItem,
        }}>
            {children}
        </Ctx.Provider>
    );
}
