// Full-page list of the user's saved trips (replaces the old modal). Each card opens
// the trip's results; delete removes it. This is the entry point to a trip's plan.
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, MapPin, Navigation, Clock, Trash2, Bookmark, Calendar, ClipboardList } from 'lucide-react';
import { WayvueBrand } from './WayvueBrand';
import { AccountMenu } from './AccountMenu';
import { listTrips, deleteTrip, type SavedTrip } from '@/lib/trips';
import { getPlanItemCounts } from '@/lib/tripItems';
import { shortPlace } from '@/lib/placeFormat';
import { useAuth } from '@/lib/AuthContext';

function formatDepart(date?: string | null): string {
    if (!date) return '';
    const m = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return date;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (isNaN(d.getTime())) return date;
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

interface SavedTripsPageProps {
    onOpen: (trip: SavedTrip) => void;
    onBack: () => void;
}

export function SavedTripsPage({ onOpen, onBack }: SavedTripsPageProps) {
    const [trips, setTrips] = useState<SavedTrip[]>([]);
    const [planCounts, setPlanCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const { user } = useAuth();

    // Refetch when the signed-in user resolves — on a refresh straight to this page the
    // session isn't ready on first mount, so the RLS-scoped list would come back empty.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const [data, counts] = await Promise.all([listTrips(), getPlanItemCounts()]);
                if (!cancelled) { setTrips(data); setPlanCounts(counts); }
            } catch (e) {
                console.error('[trips] list failed:', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [user]);

    const requestDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setConfirmDeleteId(id);
    };

    const doDelete = async (id: string) => {
        setDeletingId(id);
        try {
            await deleteTrip(id);
            setTrips(ts => ts.filter(t => t.id !== id));
            setConfirmDeleteId(null);
        } catch (err) {
            console.error('[trips] delete failed:', err);
        } finally {
            setDeletingId(null);
        }
    };

    const confirmTrip = trips.find(t => t.id === confirmDeleteId) || null;

    return (
        <main className="relative min-h-screen text-foreground">
            {/* Road-trip backdrop (fixed so it stays put while scrolling), heavily faded
                behind a warm gradient so the trip list stays crisp. */}
            <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-background">
                <img
                    src="/sequence/ezgif-frame-030.jpg"
                    alt=""
                    className="w-full h-full object-cover opacity-[0.16]"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(232,106,42,0.08),transparent_55%)]" />
            </div>

            <nav className="flex justify-between items-center px-6 md:px-12 py-6">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} aria-label="Back" className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <WayvueBrand size="md" tagline onClick={onBack} />
                </div>
                <AccountMenu />
            </nav>

            <div className="max-w-3xl mx-auto px-6 md:px-12 pb-20">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/20">
                        <Bookmark className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-display font-bold tracking-tight">My Trips</h1>
                        <p className="text-sm text-muted-foreground">{trips.length} saved trip{trips.length !== 1 ? 's' : ''}</p>
                    </div>
                </div>

                {loading && (
                    <div className="flex justify-center py-24"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
                )}

                {!loading && trips.length === 0 && (
                    <div className="text-center py-24 px-4 bg-secondary/20 rounded-3xl border border-dashed border-border">
                        <Bookmark className="w-10 h-10 mx-auto mb-4 text-muted-foreground/50" />
                        <p className="text-base font-bold text-foreground">No saved trips yet</p>
                        <p className="text-sm text-muted-foreground mt-1">Plan a trip and tap <span className="font-semibold text-foreground">Save</span> to keep it here.</p>
                    </div>
                )}

                {!loading && trips.length > 0 && (
                    <div className="flex flex-col gap-3">
                        {trips.map(trip => {
                            const stops = (trip.waypoints || []).map(w => shortPlace(w?.name)).filter(Boolean);
                            const stopCount = (trip.waypoints || []).filter(w => w?.name?.trim()).length;
                            return (
                                <button
                                    key={trip.id}
                                    onClick={() => onOpen(trip)}
                                    className="group text-left w-full bg-card hover:bg-secondary/40 border border-border rounded-2xl p-5 transition-colors shadow-soft hover:border-primary/30 flex items-center gap-4"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 font-bold text-base text-foreground">
                                            <span className="truncate">{shortPlace(trip.start_label)}</span>
                                            <span className="text-muted-foreground shrink-0">→</span>
                                            <span className="truncate">{shortPlace(trip.destination_label)}</span>
                                        </div>
                                        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                                            {formatDepart(trip.departure_date) && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDepart(trip.departure_date)}</span>}
                                            {trip.distance && <span className="flex items-center gap-1"><Navigation className="w-3 h-3" />{trip.distance}</span>}
                                            {trip.duration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{trip.duration}</span>}
                                            {stopCount > 0 && <span className="flex items-center gap-1 text-primary font-semibold"><MapPin className="w-3 h-3" />{stopCount} stop{stopCount > 1 ? 's' : ''}</span>}
                                            {planCounts[trip.id] > 0 && <span className="flex items-center gap-1 text-primary font-semibold" title="Items saved to this trip's My Plan itinerary (stops, food, hotels, activities)"><ClipboardList className="w-3 h-3" />{planCounts[trip.id]} in itinerary</span>}
                                            {trip.is_round_trip && <span className="text-emerald-600 font-semibold">Round trip</span>}
                                        </div>
                                        {stops.length > 0 && (
                                            <div className="flex items-start gap-1.5 mt-2 text-xs text-muted-foreground">
                                                <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
                                                <span className="line-clamp-1"><span className="font-semibold text-foreground/70">via </span>{stops.join(' → ')}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            onClick={(e) => requestDelete(e, trip.id)}
                                            aria-label="Delete trip"
                                            className="p-2 rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            {deletingId === trip.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                        </span>
                                        <ChevronRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Delete confirmation */}
            {confirmTrip && (
                <div
                    className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
                    onClick={() => deletingId ? null : setConfirmDeleteId(null)}
                >
                    <div
                        className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="w-6 h-6 text-destructive" />
                        </div>
                        <h3 className="text-lg font-bold text-center text-foreground">Delete this trip?</h3>
                        <p className="text-sm text-muted-foreground text-center mt-1.5 leading-snug">
                            <span className="font-semibold text-foreground">{shortPlace(confirmTrip.start_label)} → {shortPlace(confirmTrip.destination_label)}</span>
                            {planCounts[confirmTrip.id] > 0 ? ` and its ${planCounts[confirmTrip.id]} itinerary item${planCounts[confirmTrip.id] > 1 ? 's' : ''}` : ''} will be removed. This can't be undone.
                        </p>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setConfirmDeleteId(null)}
                                disabled={!!deletingId}
                                className="flex-1 h-10 rounded-xl border border-border font-bold text-sm text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => doDelete(confirmTrip.id)}
                                disabled={!!deletingId}
                                className="flex-1 h-10 rounded-xl bg-destructive text-white font-bold text-sm hover:bg-destructive/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                            >
                                {deletingId === confirmTrip.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
