// "My Trips" — lists the signed-in user's saved trips; load one back into the planner
// or delete it.
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, MapPin, Navigation, Clock, Trash2, Bookmark, Calendar } from 'lucide-react';
import { listTrips, deleteTrip, type SavedTrip } from '@/lib/trips';

interface SavedTripsModalProps {
    open: boolean;
    onClose: () => void;
    onLoad: (trip: SavedTrip) => void;
}

// Condense a full label to a readable "City, ST". Handles typed addresses
// ("1080 Olivia Dr, Oakdale, PA, 15071") and geocoded names ("Chicago, Cook
// County, Illinois, USA") — keeping the city (first meaningful part) + a state.
function shortPlace(name?: string | null): string {
    if (!name) return '';
    const withoutCountry = name.replace(/,?\s*(USA|United States)\.?$/i, '').trim();
    let parts = withoutCountry.split(',').map(p => p.trim()).filter(Boolean);
    parts = parts.filter(p => !/^\d{5}(-\d{4})?$/.test(p)); // drop bare ZIP
    if (parts.length === 0) return name;
    // Drop a leading street-address part so the city becomes first.
    if (parts.length >= 2 && (/^\d/.test(parts[0]) || /\b(Dr|St|Ave|Rd|Blvd|Ln|Way|Ct|Hwy|Pkwy|Ter|Pl)\.?$/i.test(parts[0]))) {
        parts.shift();
    }
    const city = parts[0];
    const rest = parts.slice(1);
    const state = rest.find(p => /^[A-Z]{2}$/.test(p)) || rest[rest.length - 1];
    return state && state !== city ? `${city}, ${state}` : city;
}

// "2026-07-20" → "Mon, Jul 20" (parsed as a local date to avoid TZ off-by-one).
function formatDepart(date?: string | null): string {
    if (!date) return '';
    const m = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return date;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (isNaN(d.getTime())) return date;
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function SavedTripsModal({ open, onClose, onLoad }: SavedTripsModalProps) {
    const [trips, setTrips] = useState<SavedTrip[]>([]);
    const [loading, setLoading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const data = await listTrips();
                if (!cancelled) setTrips(data);
            } catch (e) {
                console.error('[trips] list failed:', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [open]);

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setDeletingId(id);
        try {
            await deleteTrip(id);
            setTrips(ts => ts.filter(t => t.id !== id));
        } catch (err) {
            console.error('[trips] delete failed:', err);
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.96, y: 16, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.96, y: 16, opacity: 0 }}
                        onClick={e => e.stopPropagation()}
                        className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
                    >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-secondary/40">
                            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                <Bookmark className="w-4 h-4 text-primary" /> My Trips
                            </h3>
                            <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="overflow-y-auto custom-scrollbar p-3 flex flex-col gap-2" data-lenis-prevent>
                            {loading && (
                                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                            )}

                            {!loading && trips.length === 0 && (
                                <div className="text-center py-12 px-4 text-sm text-muted-foreground">
                                    No saved trips yet. Plan a trip and tap <span className="font-semibold text-foreground">Save</span> to keep it here.
                                </div>
                            )}

                            {!loading && trips.map(trip => (
                                <button
                                    key={trip.id}
                                    onClick={() => onLoad(trip)}
                                    className="group text-left w-full bg-secondary/40 hover:bg-secondary border border-border rounded-2xl p-4 transition-colors relative"
                                >
                                    <div className="flex items-center gap-2 font-bold text-sm text-foreground pr-8">
                                        <span className="truncate">{shortPlace(trip.start_label)}</span>
                                        <span className="text-muted-foreground shrink-0">→</span>
                                        <span className="truncate">{shortPlace(trip.destination_label)}</span>
                                    </div>
                                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                                        {formatDepart(trip.departure_date) && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDepart(trip.departure_date)}</span>}
                                        {trip.distance && <span className="flex items-center gap-1"><Navigation className="w-3 h-3" />{trip.distance}</span>}
                                        {trip.duration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{trip.duration}</span>}
                                        {(() => {
                                            const n = (trip.waypoints || []).filter(w => w?.name?.trim()).length;
                                            return n > 0 ? (
                                                <span className="flex items-center gap-1 text-primary font-semibold">
                                                    <MapPin className="w-3 h-3" />{n} stop{n > 1 ? 's' : ''}
                                                </span>
                                            ) : null;
                                        })()}
                                        {trip.is_round_trip && <span className="text-emerald-600 font-semibold">Round trip</span>}
                                    </div>
                                    {(() => {
                                        const stops = (trip.waypoints || []).map(w => shortPlace(w?.name)).filter(Boolean);
                                        if (stops.length === 0) return null;
                                        return (
                                            <div className="flex items-start gap-1.5 mt-1.5 text-xs text-muted-foreground pr-6">
                                                <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
                                                <span className="line-clamp-2">
                                                    <span className="font-semibold text-foreground/70">via </span>
                                                    {stops.join(' → ')}
                                                </span>
                                            </div>
                                        );
                                    })()}
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={(e) => handleDelete(e, trip.id)}
                                        aria-label="Delete trip"
                                        className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        {deletingId === trip.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
