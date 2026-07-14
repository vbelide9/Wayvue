// "Save trip" pill for the trip header. Signed-out → starts sign-in; signed-in → saves
// the current trip and shows "Saved". Uses the trip-plan context (no props needed).
import { useState } from 'react';
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useTripPlan } from '@/lib/TripPlanContext';

export function SaveTripButton() {
    const { signInWithGoogle } = useAuth();
    const { enabled, hasTrip, tripId, signedIn, saveCurrentTrip } = useTripPlan();
    const [saving, setSaving] = useState(false);

    if (!enabled || !hasTrip) return null;
    const saved = !!tripId;

    const onClick = async () => {
        if (saved || saving) return;
        if (!signedIn) { await signInWithGoogle(); return; } // redirects; user clicks again on return
        setSaving(true);
        try { await saveCurrentTrip(); }
        catch (e) { console.error('[trips] save failed:', e); }
        finally { setSaving(false); }
    };

    return (
        <button
            onClick={onClick}
            title={saved ? 'Trip saved' : signedIn ? 'Save this trip' : 'Sign in to save this trip'}
            aria-label="Save trip"
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs font-bold bg-secondary/50 border border-border/50 text-foreground hover:bg-secondary hover:border-primary/40 transition-colors shrink-0"
        >
            {saving
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : saved
                    ? <BookmarkCheck className="w-3.5 h-3.5 text-emerald-600" />
                    : <Bookmark className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{saved ? 'Saved' : 'Save'}</span>
        </button>
    );
}
