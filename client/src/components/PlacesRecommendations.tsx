import { MapPin, Fuel, Camera, Utensils, X, ChevronRight, Filter, TreePine, Info, Zap } from "lucide-react";
import { useState, useMemo } from "react";

interface Place {
    id: string;
    type: string;
    location: string;
    title: string;
    description: string;
}

interface PlacesRecommendationsProps {
    places: Place[] | null;
}

export function PlacesRecommendations({ places }: PlacesRecommendationsProps) {
    const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
    const [activeCategory, setActiveCategory] = useState<string>("all");

    const categories = [
        { id: "all", label: "All Stops", icon: <MapPin className="w-3 h-3" /> },
        { id: "food", label: "Dining", icon: <Utensils className="w-3 h-3" /> },
        { id: "gas", label: "Fuel", icon: <Fuel className="w-3 h-3" /> },
        { id: "charging", label: "Charging", icon: <Zap className="w-3 h-3" /> },
        { id: "view", label: "Scenic", icon: <Camera className="w-3 h-3" /> },
        { id: "rest", label: "Rest Areas", icon: <TreePine className="w-3 h-3" /> },
    ];

    const filteredPlaces = useMemo(() => {
        if (!places) return [];
        if (activeCategory === "all") return places;
        return places.filter(p => p.type === activeCategory);
    }, [places, activeCategory]);

    if (!places || !Array.isArray(places) || places.length === 0) return null;

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
        <div className="flex flex-col h-full">
            {/* Header & Filters */}
            <div className="flex flex-col gap-3 py-2 shrink-0">
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 px-1">
                    <MapPin className="w-3 h-3 text-primary" /> SUGGESTED STOPS
                </h3>

                {/* Category Filter Chips - Horizontal Scroll */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none px-1 -mx-1 snap-x">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`
                                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all flex-none snap-start border
                                ${activeCategory === cat.id
                                    ? "bg-primary border-primary text-white shadow-md shadow-primary/20"
                                    : "bg-transparent border-white/10 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                                }
                            `}
                        >
                            {cat.icon}
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Results List */}
            <div className="flex-1 flex flex-col gap-2 min-h-[100px] overflow-visible pb-4">
                {filteredPlaces.length > 0 ? (
                    filteredPlaces.map((place) => {
                        // Determine Category Color
                        let bgClass = "bg-secondary";
                        switch (place.type) {
                            case 'food': bgClass = "bg-orange-500/10"; break;
                            case 'gas': bgClass = "bg-blue-500/10"; break;
                            case 'charging': bgClass = "bg-yellow-500/10"; break;
                            case 'view': bgClass = "bg-purple-500/10"; break;
                            case 'rest': bgClass = "bg-emerald-500/10"; break;
                            default: bgClass = "bg-primary/10"; break;
                        }

                        return (
                            <div
                                key={place.id}
                                onClick={() => setSelectedPlace(place)}
                                className="w-full bg-card/60 backdrop-blur-md border border-white/5 rounded-xl p-3 hover:bg-card hover:border-white/10 transition-all cursor-pointer group relative overflow-hidden flex items-start gap-4 shadow-sm"
                            >
                                {/* Icon Box */}
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${bgClass} border border-white/5 shadow-inner`}>
                                    {getIcon(place.type, "w-5 h-5")}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0 pr-6">
                                    <h4 className="font-bold text-sm text-foreground leading-tight group-hover:text-primary transition-colors truncate mb-1">
                                        {place.title}
                                    </h4>
                                    <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1.5">
                                        <span className="text-foreground/80">{place.location}</span>
                                        <span className="w-1 h-1 rounded-full bg-border" />
                                        <span>37 mi</span>
                                    </p>

                                    {/* Action Link */}
                                    <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-primary font-bold uppercase tracking-wide opacity-80 group-hover:opacity-100 transition-opacity">
                                        <Info className="w-3 h-3" />
                                        <span className="group-hover:underline decoration-2 underline-offset-2">Connection Details</span>
                                    </div>
                                </div>

                                {/* Chevron Hint */}
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 transition-all -translate-x-2 group-hover:translate-x-0">
                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="w-full h-40 flex flex-col items-center justify-center text-center opacity-50 bg-secondary/5 rounded-xl border border-dashed border-border mt-4">
                        <Filter className="w-6 h-6 mb-2 text-muted-foreground" />
                        <p className="text-xs font-medium text-muted-foreground">No stops found in this category</p>
                    </div>
                )}
            </div>

            {/* Details Modal */}
            {selectedPlace && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setSelectedPlace(null)}>
                    <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="h-32 bg-gradient-to-br from-primary/20 via-background to-background flex items-center justify-center relative border-b border-border">
                            <div className="absolute inset-0 opacity-20 blur-3xl rounded-full bg-primary animate-pulse" />
                            {getIcon(selectedPlace.type, "w-12 h-12 relative z-10 drop-shadow-md")}
                            <button
                                onClick={() => setSelectedPlace(null)}
                                className="absolute top-3 right-3 p-1.5 rounded-full bg-black/20 hover:bg-black/40 text-foreground transition-all backdrop-blur-md"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="flex flex-col gap-1.5 mb-6">
                                <h3 className="font-bold text-xl text-foreground tracking-tight">{selectedPlace.title}</h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] px-2 py-0.5 bg-secondary text-secondary-foreground rounded-full font-bold uppercase tracking-wider border border-border">
                                        {selectedPlace.type}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                                        <MapPin className="w-3 h-3" /> {selectedPlace.location}
                                    </span>
                                </div>
                            </div>

                            <p className="text-sm text-muted-foreground leading-relaxed mb-8 bg-secondary/20 p-4 rounded-xl border border-border/50">
                                {selectedPlace.description}
                            </p>

                            <button className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.98]">
                                <MapPin className="w-4 h-4" /> Add Stop to Route
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
