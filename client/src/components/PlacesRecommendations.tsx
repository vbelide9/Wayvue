import { MapPin, Fuel, Camera, Utensils, X, ChevronRight } from "lucide-react";
import { useState } from "react";

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

    if (!places || !Array.isArray(places) || places.length === 0) return null;

    // Ensure exactly 3 items if possible, or take what we have
    const displayPlaces = places.slice(0, 3);

    const getIcon = (type: string, className = "w-4 h-4") => {
        switch (type) {
            case 'food': return <Utensils className={`${className} text-orange-500`} />;
            case 'gas': return <Fuel className={`${className} text-blue-500`} />;
            case 'view': return <Camera className={`${className} text-purple-500`} />;
            default: return <MapPin className={`${className} text-primary`} />;
        }
    };

    return (
        <div className="mt-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    Suggested Stops
                </span>
                <span className="text-[10px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">
                    {places.length} found
                </span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {displayPlaces.map((place) => (
                    <div
                        key={place.id}
                        onClick={() => setSelectedPlace(place)}
                        className="bg-card border border-border rounded-lg p-3 hover:bg-white/5 transition-colors cursor-pointer group flex md:flex-col lg:flex-row gap-3 items-center md:items-start lg:items-center relative overflow-hidden"
                    >
                        <div className="p-2 rounded-full bg-secondary/30 group-hover:bg-primary/10 transition-colors">
                            {getIcon(place.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-xs text-foreground truncate">{place.title}</h4>
                            <p className="text-[10px] text-muted-foreground truncate">{place.type.toUpperCase()} • {place.location}</p>
                        </div>
                        <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity absolute right-2" />
                    </div>
                ))}
            </div>

            {/* Details Modal/Drawer */}
            {selectedPlace && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setSelectedPlace(null)}>
                    <div className="bg-card border border-border rounded-xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="h-24 bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                            {getIcon(selectedPlace.type, "w-10 h-10")}
                        </div>
                        <div className="p-5">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-lg text-foreground">{selectedPlace.title}</h3>
                                <button onClick={() => setSelectedPlace(null)} className="text-muted-foreground hover:text-foreground">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <span className="inline-block text-[10px] font-mono uppercase tracking-wider bg-secondary px-2 py-1 rounded text-muted-foreground mb-4">
                                {selectedPlace.type} STOP • {selectedPlace.location}
                            </span>
                            <p className="text-sm text-foreground/80 leading-relaxed mb-6">
                                {selectedPlace.description}
                            </p>
                            <button className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                                Navigate Here
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
