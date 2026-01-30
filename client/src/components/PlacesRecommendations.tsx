import { MapPin, Fuel, Camera, Utensils, X, ChevronRight, Filter, Coffee, Landmark, TreePine, Info } from "lucide-react";
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
            case 'view': return <Camera className={`${className} text-purple-500`} />;
            case 'rest': return <TreePine className={`${className} text-emerald-500`} />;
            default: return <MapPin className={`${className} text-primary`} />;
        }
    };

    return (
        <div className="mt-2 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <MapPin className="w-3 h-3" /> Road Trip Planner
                </h3>

                {/* Category Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-all border ${activeCategory === cat.id
                                    ? "bg-primary border-primary text-primary-foreground shadow-sm"
                                    : "bg-card/50 border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                                }`}
                        >
                            {cat.icon}
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Results List */}
            <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-none mask-fade-right">
                {filteredPlaces.length > 0 ? (
                    filteredPlaces.map((place) => (
                        <div
                            key={place.id}
                            onClick={() => setSelectedPlace(place)}
                            className="flex-shrink-0 w-64 bg-card/40 backdrop-blur-sm border border-border/50 rounded-xl p-3 hover:bg-card hover:border-primary/30 transition-all cursor-pointer group relative overflow-hidden flex items-start gap-3 shadow-sm hover:shadow-md"
                        >
                            <div className="p-2 rounded-lg bg-secondary/50 group-hover:bg-primary/10 transition-colors">
                                {getIcon(place.type)}
                            </div>
                            <div className="flex-1 min-w-0 pr-4">
                                <h4 className="font-semibold text-[13px] text-foreground leading-tight group-hover:text-primary transition-colors">{place.title}</h4>
                                <p className="text-[10px] text-muted-foreground mt-0.5">{place.location}</p>
                                <div className="mt-2 flex items-center gap-1 text-[9px] text-primary font-medium uppercase tracking-tighter opacity-80 group-hover:opacity-100 transition-opacity">
                                    <Info className="w-2.5 h-2.5" /> Details
                                </div>
                            </div>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0">
                                <ChevronRight className="w-4 h-4 text-primary" />
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="w-full py-8 flex flex-col items-center justify-center text-center opacity-50 bg-secondary/10 rounded-xl border border-dashed border-border">
                        <Filter className="w-8 h-8 mb-2 text-muted-foreground" />
                        <p className="text-xs font-medium">No {activeCategory} stops found in this area</p>
                    </div>
                )}
            </div>

            {/* Details Modal */}
            {selectedPlace && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-in fade-in duration-300" onClick={() => setSelectedPlace(null)}>
                    <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="h-32 bg-gradient-to-br from-primary/30 via-secondary/20 to-card flex items-center justify-center relative">
                            <div className="absolute inset-0 opacity-10 blur-3xl rounded-full bg-primary animate-pulse" />
                            {getIcon(selectedPlace.type, "w-12 h-12 relative z-10 drop-shadow-lg")}
                            <button
                                onClick={() => setSelectedPlace(null)}
                                className="absolute top-3 right-3 p-1.5 rounded-full bg-background/50 backdrop-blur-md border border-border hover:bg-background/80 text-foreground transition-all"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="flex flex-col gap-1 mb-4">
                                <h3 className="font-bold text-xl text-foreground tracking-tight">{selectedPlace.title}</h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full font-bold uppercase tracking-widest border border-primary/20">
                                        {selectedPlace.type}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                                        <MapPin className="w-2.5 h-2.5" /> {selectedPlace.location}
                                    </span>
                                </div>
                            </div>

                            <p className="text-sm text-muted-foreground/90 leading-relaxed mb-8 bg-secondary/20 p-4 rounded-xl border border-border/50">
                                {selectedPlace.description}
                            </p>

                            <button className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.98]">
                                <Coffee className="w-4 h-4" /> Add to Road Trip
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
