import { MapPin, Fuel, Camera, Utensils, X, ChevronRight, Filter, Coffee, Landmark, TreePine, Info } from "lucide-react";
import { useState, useMemo } from "react";

interface Place {
    id: string;
    type: string;
    location: string;
    title: string;
    description: string;
    detour?: string;
    address?: string;
    image?: string;
}

interface PlacesRecommendationsProps {
    places: Place[] | null;
}

// Add import at the top (assumed existing imports)
import { getPlaceDetails } from "../services/api";

export function PlacesRecommendations({ places }: PlacesRecommendationsProps) {
    const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
    const [activeCategory, setActiveCategory] = useState<string>("all");
    const [loadingAddress, setLoadingAddress] = useState(false);
    const [detailAddress, setDetailAddress] = useState<string | null>(null);

    // Effect to reset and fetch detailed address on selection
    const handleSelectPlace = async (place: Place) => {
        setSelectedPlace(place);
        setDetailAddress(null);

        // If address is approximate (starts with "Near "), try to fetch real one
        if (place.address?.startsWith("Near ") && (place as any).lat && (place as any).lon) {
            setLoadingAddress(true);
            try {
                const data = await getPlaceDetails((place as any).lat, (place as any).lon);
                if (data.address) {
                    setDetailAddress(data.address);
                }
            } catch (e) {
                console.error("Failed to fetch address details");
            } finally {
                setLoadingAddress(false);
            }
        }
    };

    // ... categories ...

    // ... filteredPlaces ...

    // ... getIcon ...

    return (
        <div className="flex flex-col gap-3 h-full">
            {/* ... Header & Filter ... */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Same content as original upto line 72 */}
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <MapPin className="w-3 h-3 text-primary" /> Suggested Stops
                </h3>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-all border ${activeCategory === cat.id
                                ? "bg-primary border-primary text-primary-foreground shadow-sm"
                                : "bg-card/30 border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                                }`}
                        >
                            {cat.icon}
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Results List */}
            <div className="flex-1 flex gap-4 overflow-x-auto pb-2 scrollbar-none mask-fade-right min-h-[110px] items-center">
                {filteredPlaces.length > 0 ? (
                    filteredPlaces.map((place) => (
                        <div
                            key={place.id}
                            onClick={() => handleSelectPlace(place)}
                            className="flex-shrink-0 min-w-[320px] max-w-[450px] flex-1 bg-card/40 backdrop-blur-md border border-border/50 rounded-xl p-4 hover:bg-card/80 hover:border-primary/50 transition-all cursor-pointer group relative overflow-hidden flex items-center gap-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                        >
                            {/* ... Card Content (unchanged mainly except onClick now calls handleSelectPlace) ... */}
                            {/* Icon Box */}
                            <div className="w-10 h-10 rounded-lg bg-secondary/50 group-hover:bg-primary/20 flex items-center justify-center transition-colors shadow-inner">
                                {getIcon(place.type, "w-5 h-5")}
                            </div>

                            {/* Text Content */}
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-sm text-foreground leading-tight group-hover:text-primary transition-colors truncate">
                                    {place.title}
                                </h4>
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1 truncate font-medium">
                                    <span>{place.location}</span>
                                    {place.detour && (
                                        <>
                                            <span className="w-1 h-1 rounded-full bg-border" />
                                            <span className="text-orange-400 font-bold flex items-center gap-0.5">
                                                +{place.detour}
                                            </span>
                                        </>
                                    )}
                                </div>
                                <div className="mt-1.5 flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                                        <Info className="w-3 h-3" /> View Details
                                    </span>
                                </div>
                            </div>

                            {/* Hover Chevron */}
                            <div className="absolute right-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                <ChevronRight className="w-5 h-5 text-primary" />
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-center opacity-50 bg-secondary/5 rounded-xl border border-dashed border-border min-h-[100px]">
                        <Filter className="w-6 h-6 mb-1 text-muted-foreground" />
                        <p className="text-[10px] font-medium">No results found for this category</p>
                    </div>
                )}
            </div>

            {/* Details Modal */}
            {selectedPlace && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-in fade-in duration-300" onClick={() => setSelectedPlace(null)}>
                    <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="h-48 bg-gray-900 relative flex items-end justify-start group overflow-hidden">
                            {selectedPlace.image ? (
                                <img
                                    src={selectedPlace.image}
                                    alt={selectedPlace.title}
                                    className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                    }}
                                />
                            ) : null}

                            {/* Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />

                            {/* Fallback Icon Gradient (shown if no image or error) */}
                            <div className={`absolute inset-0 bg-gradient-to-br from-primary/30 via-secondary/20 to-card ${selectedPlace.image ? 'hidden' : 'block'}`} />

                            <button
                                onClick={() => setSelectedPlace(null)}
                                className="absolute top-3 right-3 p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 hover:bg-black/60 text-white transition-all z-20"
                            >
                                <X className="w-4 h-4" />
                            </button>

                            <div className="relative z-10 p-6 w-full">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-[10px] px-2 py-0.5 bg-primary text-primary-foreground rounded-full font-bold uppercase tracking-widest shadow-sm">
                                        {selectedPlace.type}
                                    </span>
                                </div>
                                <h3 className="font-bold text-2xl text-white tracking-tight leading-none shadow-black/50 drop-shadow-md">
                                    {selectedPlace.title}
                                </h3>
                            </div>
                        </div>

                        <div className="p-6 pt-4">
                            <div className="flex flex-col gap-3 mb-6">
                                <div className="flex items-start gap-2 text-muted-foreground">
                                    <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                                    <div className="flex flex-col">
                                        <span className={`text-sm font-medium text-foreground ${loadingAddress ? 'animate-pulse' : ''}`}>
                                            {detailAddress || selectedPlace.address || selectedPlace.location}
                                        </span>
                                        {/* Context if needed */}
                                        {!detailAddress && selectedPlace.address && selectedPlace.location !== selectedPlace.address && (
                                            <span className="text-xs opacity-70">Near {selectedPlace.location.split('•')[0]}</span>
                                        )}
                                    </div>
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
