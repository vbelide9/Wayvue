// Lets the account menu (anywhere in the tree) open the "My Trips" modal without
// prop-drilling, while the load handler stays in App (it owns trip state).
import { createContext, useContext, useState, type ReactNode } from 'react';
import { SavedTripsModal } from '@/components/SavedTripsModal';
import { type SavedTrip } from '@/lib/trips';

const SavedTripsContext = createContext<{ open: () => void }>({ open: () => {} });

export const useSavedTrips = () => useContext(SavedTripsContext);

export function SavedTripsProvider({ onLoad, children }: { onLoad: (trip: SavedTrip) => void; children: ReactNode }) {
    const [open, setOpen] = useState(false);
    return (
        <SavedTripsContext.Provider value={{ open: () => setOpen(true) }}>
            {children}
            <SavedTripsModal
                open={open}
                onClose={() => setOpen(false)}
                onLoad={(trip) => { setOpen(false); onLoad(trip); }}
            />
        </SavedTripsContext.Provider>
    );
}
