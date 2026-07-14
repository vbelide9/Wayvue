// "Save trip" pill for the trip header. Signed-out → starts sign-in; signed-in →
// saves the current trip and briefly confirms. Renders nothing if Supabase is off.
import { useState } from 'react';
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { saveTrip, type SaveTripInput } from '@/lib/trips';

export function SaveTripButton({ trip }: { trip: SaveTripInput | null }) {
    const { enabled, user, signInWithGoogle } = useAuth();
    const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');

    if (!enabled || !trip) return null;

    const onClick = async () => {
        if (!user) { await signInWithGoogle(); return; } // redirects; user clicks again on return
        if (state === 'saving') return;
        setState('saving');
        try {
            await saveTrip(trip);
            setState('saved');
            setTimeout(() => setState('idle'), 2500);
        } catch (e) {
            console.error('[trips] save failed:', e);
            setState('idle');
        }
    };

    return (
        <button
            onClick={onClick}
            title={user ? 'Save this trip' : 'Sign in to save this trip'}
            aria-label="Save trip"
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs font-bold bg-secondary/50 border border-border/50 text-foreground hover:bg-secondary hover:border-primary/40 transition-colors shrink-0"
        >
            {state === 'saving'
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : state === 'saved'
                    ? <BookmarkCheck className="w-3.5 h-3.5 text-emerald-600" />
                    : <Bookmark className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{state === 'saved' ? 'Saved' : 'Save'}</span>
        </button>
    );
}
