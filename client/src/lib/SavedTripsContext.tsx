// Lets the account menu (anywhere in the tree) open the "My Trips" page without
// prop-drilling. App wires `open` to navigate to the saved-trips view.
import { createContext, useContext, type ReactNode } from 'react';

const SavedTripsContext = createContext<{ open: () => void }>({ open: () => {} });

export const useSavedTrips = () => useContext(SavedTripsContext);

export function SavedTripsProvider({ open, children }: { open: () => void; children: ReactNode }) {
    return (
        <SavedTripsContext.Provider value={{ open }}>
            {children}
        </SavedTripsContext.Provider>
    );
}
