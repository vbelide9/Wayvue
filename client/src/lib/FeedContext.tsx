// Lets anywhere in the tree open the community feed (optionally with the composer
// prefilled — e.g. "Share this stop") without prop-drilling. App wires `openFeed` to
// navigate to the feed view and stash the prefill. Mirrors SavedTripsContext.
import { createContext, useContext, type ReactNode } from 'react';

export interface FeedPrefill {
    body?: string;
    placeKey?: string;
    placeName?: string;
    tripId?: string;
}

const FeedContext = createContext<{ openFeed: (prefill?: FeedPrefill) => void }>({ openFeed: () => {} });

export const useFeed = () => useContext(FeedContext);

export function FeedProvider({ openFeed, children }: { openFeed: (prefill?: FeedPrefill) => void; children: ReactNode }) {
    return <FeedContext.Provider value={{ openFeed }}>{children}</FeedContext.Provider>;
}
