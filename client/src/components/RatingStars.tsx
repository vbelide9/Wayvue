// Star rating for a recommended place. Shows the public average and lets a signed-in
// user set/change their own rating; a signed-out click kicks off Google sign-in.
// Renders nothing when Supabase is disabled or the place isn't rateable.
import { useState } from 'react';
import { Star } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useRating, type RateablePlace } from '@/lib/useRating';
import { savePendingRating } from '@/lib/pendingRating';

interface RatingStarsProps {
    place: RateablePlace | null;
    /** "sm" for the compact card row, "md" for the details modal. */
    size?: 'sm' | 'md';
    className?: string;
}

export function RatingStars({ place, size = 'sm', className = '' }: RatingStarsProps) {
    const { enabled, user, signInWithGoogle } = useAuth();
    const { avg, count, myStars, saving, error, submit } = useRating(place);
    const [hover, setHover] = useState(0);

    if (!enabled || !place) return null;

    const star = size === 'md' ? 'w-5 h-5' : 'w-4 h-4';
    const active = hover || myStars || 0;

    const handleClick = async (n: number) => {
        if (saving) return;
        if (!user) {
            // Remember the pick so it survives the OAuth reload, then start sign-in.
            savePendingRating({ placeKey: place.placeKey, name: place.name, type: place.type, stars: n });
            await signInWithGoogle();
            return;
        }
        await submit(n);
    };

    // Stop clicks from bubbling to a parent card (which would open the details modal).
    return (
        <div
            className={`flex items-center gap-2 ${className}`}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex items-center" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                    <button
                        key={n}
                        type="button"
                        disabled={saving}
                        onMouseEnter={() => setHover(n)}
                        onClick={() => handleClick(n)}
                        aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
                        className="p-0.5 disabled:opacity-50 transition-transform hover:scale-110"
                    >
                        <Star
                            className={`${star} transition-colors ${n <= active ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}`}
                        />
                    </button>
                ))}
            </div>
            {error ? (
                <span className="text-xs text-destructive font-medium" title={error}>Couldn't save</span>
            ) : count > 0 && avg != null ? (
                <span className="text-xs text-muted-foreground font-medium">
                    {avg.toFixed(1)} ({count})
                </span>
            ) : (
                <span className="text-xs text-muted-foreground/70">
                    {saving ? 'Saving…' : user ? (myStars ? 'Your rating' : 'Rate this') : 'Sign in to rate'}
                </span>
            )}
        </div>
    );
}
