import { MapPin, Fuel, Camera, Utensils, X, ChevronRight, ChevronDown, Filter, TreePine, Info, Zap, Star, Navigation, Share2 } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { RatingStars } from "@/components/RatingStars";
import { PlaceReviews } from "@/components/PlaceReviews";
import { AddToPlanButton } from "@/components/AddToPlanButton";
import { getRatingStats, type RateablePlace } from "@/lib/useRating";
import { useFeed } from "@/lib/FeedContext";
import { type NewTripItem, type TripItemKind } from "@/lib/tripItems";

interface Place {
    id: string;
    type: string;
    location: string;
    title: string;
    description: string;
    miles?: number; // distance from start (route order)
}

// Only real OSM points of interest are rateable — generic "fallback-*" stops aren't
// actual businesses, so they never get a place_key.
const toRateable = (p: Place): RateablePlace | null =>
    p.id.startsWith("osm-") ? { placeKey: p.id, name: p.title, type: p.type } : null;

// Map a stop to a plan item (dining → restaurant, scenic → attraction, else stop).
const toPlanItem = (p: Place): NewTripItem => {
    const kind: TripItemKind = p.type === 'food' ? 'restaurant' : p.type === 'view' ? 'attraction' : 'stop';
    return { kind, title: p.title, detail: p.description, location: p.location, routeMiles: p.miles };
};

interface PlacesRecommendationsProps {
    places: Place[] | null;
}

// How many stops to show before the "Show more" toggle.
const PREVIEW_COUNT = 8;

export function PlacesRecommendations({ places }: PlacesRecommendationsProps) {
    const { openFeed } = useFeed();
    const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
    const [activeCategory, setActiveCategory] = useState<string>("all");
    const [showAll, setShowAll] = useState(false);
    const [sortMode, setSortMode] = useState<'route' | 'rated'>('route');
    const [stats, setStats] = useState<Record<string, { avg: number; count: number }>>({});

    // Community aggregates for the rateable (OSM) stops — powers the "Top rated" sort.
    useEffect(() => {
        const keys = (places || []).map(p => p.id).filter(id => id.startsWith('osm-'));
        if (keys.length === 0) { setStats({}); return; }
        let cancelled = false;
        getRatingStats(keys).then(s => { if (!cancelled) setStats(s); });
        return () => { cancelled = true; };
    }, [places]);

    const categories = [
        { id: "all", label: "All Stops", icon: <MapPin className="w-3.5 h-3.5" /> },
        { id: "food", label: "Dining", icon: <Utensils className="w-3.5 h-3.5" /> },
        { id: "gas", label: "Fuel", icon: <Fuel className="w-3.5 h-3.5" /> },
        { id: "charging", label: "Charging", icon: <Zap className="w-3.5 h-3.5" /> },
        { id: "view", label: "Scenic", icon: <Camera className="w-3.5 h-3.5" /> },
        { id: "rest", label: "Rest Areas", icon: <TreePine className="w-3.5 h-3.5" /> },
    ];

    const filteredPlaces = useMemo(() => {
        if (!places) return [];
        const byCategory = activeCategory === "all" ? places : places.filter(p => p.type === activeCategory);
        if (sortMode === 'route') return byCategory;
        // Top rated: highest community average first (then most reviews); unrated last.
        return [...byCategory].sort((a, b) => {
            const sa = stats[a.id], sb = stats[b.id];
            const ra = sa ? sa.avg : -1, rb = sb ? sb.avg : -1;
            if (rb !== ra) return rb - ra;
            return (sb?.count || 0) - (sa?.count || 0);
        });
    }, [places, activeCategory, sortMode, stats]);

    // Cap the initial view; the rest reveal behind "Show more".
    const visiblePlaces = showAll ? filteredPlaces : filteredPlaces.slice(0, PREVIEW_COUNT);
    const hiddenCount = filteredPlaces.length - visiblePlaces.length;

    // Show an empty state (not a hidden section) when there are genuinely no stops.
    if (!places || !Array.isArray(places)) return null;

    const getIcon = (type: string, className = "w-4 h-4") => {
        switch (type) {
            case 'food': return <Utensils className={`${className} text-orange-500`} />;
            case 'gas': return <Fuel className={`${className} text-blue-500`} />;
            case 'charging': return <Zap className={`${className} text-yellow-500`} />;
            case 'view': return <Camera className={`${className} text-purple-500`} />;
            case 'rest': return <TreePine className={`${className} text-emerald-500`} />;
            default: return <MapPin className={`${className} text-primary`} />;
        }
    };

    return (
        <div className="flex flex-col h-full bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-soft relative overflow-hidden group/container">
            {/* Ambient background glow */}
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none opacity-50 group-hover/container:opacity-80 transition-opacity duration-1000" />

            {/* Header & Filters */}
            <div className="flex flex-col gap-5 py-2 shrink-0 border-b border-border pb-6 mb-4 relative z-10">
                <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-3 px-1">
                    <div className="p-1.5 bg-primary/20 rounded-lg border border-primary/30">
                        <MapPin className="w-4 h-4 text-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                    </div>
                    Suggested Stops
                </h3>

                {/* Category Filter Chips — wraps onto multiple lines so every category
                    stays visible at once, instead of hiding behind an undiscoverable
                    horizontal scroll in the narrow docked panel. */}
                <div className="flex flex-wrap items-center gap-2 px-1">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => { setActiveCategory(cat.id); setShowAll(false); }}
                            className={`
                                relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-300 overflow-hidden outline-none
                                ${activeCategory === cat.id
                                    ? "text-primary shadow-[0_0_20px_rgba(59,130,246,0.2)]"
                                    : "bg-secondary/50 border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                                }
                            `}
                        >
                            {activeCategory === cat.id && (
                                <motion.div
                                    layoutId="placesFilterBgPremium"
                                    className="absolute inset-0 bg-primary/15 border border-primary/30 rounded-full shadow-[inset_0_0_10px_rgba(59,130,246,0.2)]"
                                    transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
                                    initial={false}
                                />
                            )}
                            <span className={`relative z-10 flex items-center gap-2 ${activeCategory === cat.id ? 'drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]' : ''}`}>
                                {cat.icon}
                                <span className="tracking-wide">{cat.label}</span>
                            </span>
                        </button>
                    ))}
                </div>

                {/* Sort: route order vs community rating */}
                <div className="flex items-center gap-1 px-1 -mt-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mr-1">Sort</span>
                    <div className="flex items-center bg-secondary/40 rounded-full p-1 border border-border">
                        <button
                            onClick={() => { setSortMode('route'); setShowAll(false); }}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${sortMode === 'route' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <Navigation className="w-3 h-3" /> Route
                        </button>
                        <button
                            onClick={() => { setSortMode('rated'); setShowAll(false); }}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${sortMode === 'rated' ? 'bg-card shadow-sm text-amber-600' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <Star className={`w-3 h-3 ${sortMode === 'rated' ? 'fill-amber-400 text-amber-400' : ''}`} /> Top rated
                        </button>
                    </div>
                </div>
            </div>

            {/* Results List */}
            <div className="flex-1 flex flex-col gap-3 min-h-[100px] overflow-visible pb-4">
                <AnimatePresence mode="popLayout">
                    {filteredPlaces.length > 0 ? (
                        visiblePlaces.map((place, i) => {
                            // Determine Category Color
                            let bgClass = "bg-secondary";
                            let ringClass = "hover:shadow-primary/20";
                            switch (place.type) {
                                case 'food': bgClass = "bg-orange-500/10"; ringClass = "hover:shadow-orange-500/20 hover:border-orange-500/50"; break;
                                case 'gas': bgClass = "bg-blue-500/10"; ringClass = "hover:shadow-blue-500/20 hover:border-blue-500/50"; break;
                                case 'charging': bgClass = "bg-yellow-500/10"; ringClass = "hover:shadow-yellow-500/20 hover:border-yellow-500/50"; break;
                                case 'view': bgClass = "bg-purple-500/10"; ringClass = "hover:shadow-purple-500/20 hover:border-purple-500/50"; break;
                                case 'rest': bgClass = "bg-emerald-500/10"; ringClass = "hover:shadow-emerald-500/20 hover:border-emerald-500/50"; break;
                                default: bgClass = "bg-primary/10"; ringClass = "hover:shadow-primary/20 hover:border-primary/50"; break;
                            }

                            return (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -15 }}
                                    transition={{ duration: 0.8, delay: i * 0.05, ease: [0.76, 0, 0.24, 1] }}
                                    key={place.id}
                                    onClick={() => setSelectedPlace(place)}
                                    className={`w-full bg-secondary/50 backdrop-blur-3xl border border-border rounded-2xl p-5 transition-all duration-300 cursor-pointer group relative overflow-hidden flex items-start gap-4 shadow-sm hover:bg-secondary hover:border-primary/40 hover:-translate-y-1 ${ringClass}`}
                                >
                                    {/* Subtle hover glow background */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                                    {/* Icon Box */}
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${bgClass} border border-border shadow-none group-hover:scale-110 transition-transform duration-500 relative z-10`}>
                                        {getIcon(place.type, "w-6 h-6 drop-shadow-md")}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 pr-8 relative z-10">
                                        <h4 className="font-bold text-lg text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-2 mb-2 tracking-tight">
                                            {place.title}
                                        </h4>
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-medium bg-secondary/70 w-fit px-3 py-1.5 rounded-full border border-border">
                                            <span className="text-foreground/80">{place.location}</span>
                                        </div>

                                        {/* Community rating — real OSM stops only */}
                                        {toRateable(place) && (
                                            <div className="mt-3">
                                                <RatingStars place={toRateable(place)} />
                                            </div>
                                        )}

                                        <div className="mt-3">
                                            <AddToPlanButton item={toPlanItem(place)} />
                                        </div>

                                        {/* Action Link */}
                                        <div className="mt-4 flex items-center gap-1.5 text-[10px] text-primary font-bold uppercase tracking-widest opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                            <Info className="w-3.5 h-3.5" />
                                            <span className="underline decoration-2 underline-offset-4">View Details</span>
                                        </div>
                                    </div>

                                    {/* Premium Arrow Hint */}
                                    <div className="absolute right-5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-4 group-hover:translate-x-0 z-10">
                                        <div className="p-2.5 bg-primary/10 backdrop-blur-md rounded-full border border-primary/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                                            <ChevronRight className="w-4 h-4 text-primary" />
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="w-full h-40 flex flex-col items-center justify-center text-center opacity-70 bg-secondary/10 rounded-2xl border border-dashed border-border mt-4"
                        >
                            <Filter className="w-8 h-8 mb-3 text-muted-foreground" />
                            <p className="text-sm font-medium text-muted-foreground">
                                {activeCategory === "all"
                                    ? "No stops found along this route"
                                    : "No stops found in this category"}
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Show more / less toggle */}
                {filteredPlaces.length > PREVIEW_COUNT && (
                    <button
                        onClick={() => setShowAll(v => !v)}
                        className="mt-1 flex items-center justify-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors py-2"
                    >
                        {showAll ? "Show less" : `Show ${hiddenCount} more`}
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAll ? "rotate-180" : ""}`} />
                    </button>
                )}
            </div>

            {/* Details Modal — portaled to <body> so it isn't clipped by the insights
                panel's `overflow-hidden` / transformed ancestors (which would otherwise
                trap this fixed overlay and render it invisibly). */}
            {createPortal(
            <AnimatePresence>
                {selectedPlace && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
                        onClick={() => setSelectedPlace(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.95, y: 20, opacity: 0 }}
                            className="bg-card/90 backdrop-blur-2xl border border-border rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-sm w-full max-h-[90vh] overflow-y-auto"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="h-40 bg-gradient-to-br from-primary/20 via-background to-background flex items-center justify-center relative border-b border-border/50">
                                <div className="absolute inset-0 opacity-20 blur-3xl rounded-full bg-primary animate-pulse" />
                                {getIcon(selectedPlace.type, "w-16 h-16 relative z-10 drop-shadow-2xl")}
                                <button
                                    onClick={() => setSelectedPlace(null)}
                                    className="absolute top-4 right-4 p-2 rounded-full bg-black/40 hover:bg-black/60 text-foreground transition-all backdrop-blur-xl border border-border"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="p-8">
                                <div className="flex flex-col gap-2 mb-6">
                                    <h3 className="font-black text-2xl text-foreground tracking-tight">{selectedPlace.title}</h3>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-[10px] px-3 py-1 bg-secondary text-secondary-foreground rounded-full font-bold uppercase tracking-wider border border-border/50">
                                            {selectedPlace.type}
                                        </span>
                                        <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                                            <MapPin className="w-3.5 h-3.5" /> {selectedPlace.location}
                                        </span>
                                    </div>
                                </div>

                                <p className="text-sm text-foreground/80 leading-relaxed mb-6 bg-secondary/60 p-5 rounded-2xl border border-border shadow-inner">
                                    {selectedPlace.description}
                                </p>

                                <button className="w-full py-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-bold shadow-orange-glow flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                                    <MapPin className="w-4 h-4" /> Add Stop to Route
                                </button>
                                <div className="mt-3 flex items-center justify-center gap-3">
                                    <AddToPlanButton item={toPlanItem(selectedPlace)} />
                                    <button
                                        onClick={() => openFeed({ placeKey: toRateable(selectedPlace)?.placeKey, placeName: selectedPlace.title, body: '' })}
                                        className="flex items-center gap-1.5 h-9 px-4 rounded-full bg-secondary/60 border border-border text-xs font-bold text-foreground hover:border-primary/40 transition-colors"
                                    >
                                        <Share2 className="w-3.5 h-3.5" /> Share
                                    </button>
                                </div>

                                {/* Community ratings + reviews — real OSM stops only */}
                                {toRateable(selectedPlace) && (
                                    <div className="mt-8 pt-6 border-t border-border">
                                        <PlaceReviews place={toRateable(selectedPlace)!} />
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>,
            document.body,
            )}
        </div>
    );
}
