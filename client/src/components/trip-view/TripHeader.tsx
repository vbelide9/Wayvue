import { ChevronLeft, Navigation, Clock, Shield, ShieldCheck, ShieldAlert, AlertTriangle, ArrowRight, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useRef, useEffect } from 'react';
import { LocationInput } from '../LocationInput';

interface TripHeaderProps {
    start: string;
    destination: string;
    metrics: {
        distance: string;
        time: string;
        fuel: string;
        ev: string;
    };
    tripScore?: {
        score: number;
        label: string;
    };
    alertCount: number;
    unit: 'C' | 'F';
    onUnitChange: (unit: 'C' | 'F') => void;
    onBack: () => void;
    onSearch: (start: string, end: string, startCoords?: any, endCoords?: any) => void;
}

export function TripHeader({ start, destination, metrics, tripScore, alertCount, unit, onUnitChange, onBack, onSearch }: TripHeaderProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editStart, setEditStart] = useState(start);
    const [editDest, setEditDest] = useState(destination);
    const [editStartCoords, setEditStartCoords] = useState<{ lat: number, lng: number } | undefined>(undefined);
    const [editDestCoords, setEditDestCoords] = useState<{ lat: number, lng: number } | undefined>(undefined);
    const containerRef = useRef<HTMLDivElement>(null);

    // Sync props to state when not editing
    useEffect(() => {
        if (!isEditing) {
            setEditStart(start);
            setEditDest(destination);
        }
    }, [start, destination, isEditing]);

    const handleSearch = () => {
        onSearch(editStart, editDest, editStartCoords, editDestCoords);
        setIsEditing(false);
    };

    return (
        <div className="flex items-center justify-between px-4 py-3 bg-card/80 backdrop-blur-md border-b border-border z-50 relative" ref={containerRef}>

            {/* Left: Back & Route */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                    onClick={onBack}
                >
                    <ChevronLeft className="w-5 h-5" />
                </Button>

                <div className="flex flex-col min-w-0 relative group">
                    <button
                        onClick={() => setIsEditing(!isEditing)}
                        className="flex items-center gap-2 text-sm font-bold text-secondary-foreground bg-secondary hover:bg-secondary/90 px-4 py-2 rounded-full transition-all shadow-sm"
                    >
                        <span className="truncate max-w-[120px] sm:max-w-none">{start}</span>
                        <span className="text-secondary-foreground/70">to</span>
                        <span className="truncate max-w-[120px] sm:max-w-none">{destination}</span>
                        <Search className="w-4 h-4 text-secondary-foreground ml-2" />
                    </button>

                    {/* Search Overlay Popover */}
                    {isEditing && (
                        <div className="absolute top-full left-0 mt-2 w-[320px] sm:w-[400px] bg-card border border-border shadow-2xl rounded-xl p-4 z-[100] animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Edit Route</h3>
                                <button onClick={() => setIsEditing(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-secondary">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-3">
                                    <LocationInput
                                        label="Start"
                                        placeholder="Start Location"
                                        value={editStart}
                                        onChange={setEditStart}
                                        onSelect={(coords) => setEditStartCoords({ lat: coords.lat, lng: coords.lng })}
                                        icon="start"
                                        variant="minimal"
                                    />
                                    <div className="flex justify-center -my-1 relative z-10">
                                        <div className="bg-card border border-border rounded-full p-1">
                                            <ArrowRight className="w-3 h-3 text-muted-foreground rotate-90" />
                                        </div>
                                    </div>
                                    <LocationInput
                                        label="Destination"
                                        placeholder="Destination"
                                        value={editDest}
                                        onChange={setEditDest}
                                        onSelect={(coords) => setEditDestCoords({ lat: coords.lat, lng: coords.lng })}
                                        icon="destination"
                                        variant="minimal"
                                    />
                                </div>

                                <Button className="w-full font-bold" onClick={handleSearch}>
                                    Update Route
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Metrics Chips & Actions */}
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-none pl-4 shrink-0">

                {/* Metric: Time & Distance */}
                <div className="flex items-center gap-3 px-3 py-1.5 bg-secondary/50 rounded-full border border-border/50">
                    <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-xs font-bold">{metrics.time}</span>
                    </div>
                    <div className="w-px h-3 bg-border" />
                    <div className="flex items-center gap-1.5">
                        <Navigation className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-foreground">{metrics.distance}</span>
                    </div>
                </div>

                {/* Metric: Score */}
                {tripScore && (
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/50 ${tripScore.score >= 80 ? 'bg-green-500/10 text-green-600' :
                        tripScore.score >= 60 ? 'bg-yellow-500/10 text-yellow-600' :
                            'bg-red-500/10 text-red-600'
                        }`}>
                        {tripScore.score >= 80 ? <ShieldCheck className="w-3.5 h-3.5" /> :
                            tripScore.score >= 60 ? <Shield className="w-3.5 h-3.5" /> :
                                <ShieldAlert className="w-3.5 h-3.5" />}
                        <span className="text-xs font-bold">{tripScore.score}% Safe</span>
                    </div>
                )}

                {/* Metric: Alerts (Only if exists) */}
                {alertCount > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-500 rounded-full border border-amber-500/20">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold">{alertCount}</span>
                    </div>
                )}

                <div className="h-6 w-px bg-border/50 mx-1" />

                {/* Unit Toggle */}
                <div className="flex items-center bg-secondary/30 rounded-lg p-0.5 border border-border/50">
                    <button
                        onClick={() => onUnitChange('C')}
                        className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all ${unit === 'C' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        °C
                    </button>
                    <button
                        onClick={() => onUnitChange('F')}
                        className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all ${unit === 'F' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        °F
                    </button>
                </div>
            </div>
        </div>
    );
}
