// Ratings + reviews for a place, shown in the details modal: the community average, a
// write-a-review box (stars + optional text), and the list of reviews with authors.
import { useEffect, useRef, useState } from 'react';
import { Star, Loader2, Check } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useRating, getReviews, type RateablePlace, type Review } from '@/lib/useRating';

function timeAgo(iso: string): string {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days < 1) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
}

function Avatar({ name, avatar }: { name: string; avatar: string | null }) {
    const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'T';
    return (
        <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center border border-border/60">
            {avatar ? <img src={avatar} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <span>{initials}</span>}
        </div>
    );
}

export function PlaceReviews({ place }: { place: RateablePlace }) {
    const { enabled, user, signInWithGoogle } = useAuth();
    const { avg, count, myStars, myReview, saving, error, submit } = useRating(place);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loadingReviews, setLoadingReviews] = useState(true);
    const [stars, setStars] = useState(0);
    const [hover, setHover] = useState(0);
    const [text, setText] = useState('');
    const [savedFlash, setSavedFlash] = useState(false);
    const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Seed the form from the user's existing rating/review.
    useEffect(() => { setStars(myStars || 0); setText(myReview || ''); }, [myStars, myReview]);
    useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

    const loadReviews = () => {
        setLoadingReviews(true);
        getReviews(place.placeKey).then(setReviews).catch(e => console.error('[reviews]', e)).finally(() => setLoadingReviews(false));
    };
    useEffect(() => { loadReviews(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [place.placeKey, user]);

    if (!enabled) return null;

    const post = async () => {
        if (!user) { await signInWithGoogle(); return; }
        if (!stars || saving) return;
        const ok = await submit(stars, text);
        if (!ok) return; // error is surfaced below
        loadReviews();
        setSavedFlash(true);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setSavedFlash(false), 2500);
    };

    const active = hover || stars;
    const withText = reviews.filter(r => r.review && r.review.trim());

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Reviews</span>
                {count > 0 && avg != null && (
                    <span className="flex items-center gap-1 text-xs font-bold text-foreground">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        {avg.toFixed(1)} <span className="text-muted-foreground font-medium">({count})</span>
                    </span>
                )}
            </div>

            {/* Write a review */}
            <div className="bg-gradient-to-br from-primary/5 to-transparent border border-border rounded-2xl p-4 shadow-inner">
                <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                        {myStars ? 'Your rating' : 'Rate this spot'}
                    </span>
                    <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
                        {[1, 2, 3, 4, 5].map(n => (
                            <button
                                key={n}
                                type="button"
                                disabled={saving}
                                onMouseEnter={() => setHover(n)}
                                onClick={() => { if (!user) { signInWithGoogle(); return; } setStars(n); }}
                                aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
                                className="p-0.5 disabled:opacity-50 hover:scale-110 transition-transform"
                            >
                                <Star className={`w-5 h-5 transition-colors ${n <= active ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
                            </button>
                        ))}
                    </div>
                </div>
                <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onFocus={() => { if (!user) signInWithGoogle(); }}
                    placeholder="Share a tip about this place (optional)…"
                    rows={2}
                    maxLength={2000}
                    className="w-full text-sm bg-background/80 border border-border rounded-xl px-3 py-2 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 resize-none transition-all placeholder:text-muted-foreground/60"
                />
                <div className="flex items-center gap-3 mt-3">
                    {error && <span className="text-[11px] font-semibold text-red-500">{error}</span>}
                    <button
                        onClick={post}
                        disabled={saving || savedFlash || (!!user && !stars)}
                        className={`ml-auto flex items-center gap-1.5 h-9 px-5 rounded-full text-xs font-bold shadow-sm transition-all active:scale-[0.97] disabled:opacity-70 disabled:active:scale-100 ${savedFlash ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20'}`}
                    >
                        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {savedFlash && <Check className="w-3.5 h-3.5" />}
                        {savedFlash ? 'Saved' : !user ? 'Sign in to review' : myStars ? 'Update review' : 'Post review'}
                    </button>
                </div>
            </div>

            {/* Reviews list */}
            {loadingReviews ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : withText.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">No written reviews yet — be the first to share a tip.</p>
            ) : (
                <div className="space-y-3">
                    {withText.map(r => (
                        <div key={r.id} className="flex items-start gap-2.5">
                            <Avatar name={r.author.name} avatar={r.author.avatar} />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-foreground truncate">{r.author.name}</span>
                                    <span className="flex items-center gap-0.5 shrink-0">
                                        {[1, 2, 3, 4, 5].map(n => <Star key={n} className={`w-2.5 h-2.5 ${n <= r.stars ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />)}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{timeAgo(r.created_at)}</span>
                                </div>
                                <p className="text-xs text-foreground/80 mt-0.5 leading-snug whitespace-pre-wrap">{r.review}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
