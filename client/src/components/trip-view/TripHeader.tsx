import { CombinedDateTimePicker } from '../../components/CustomDateTimePicker';
import { ChevronLeft, Navigation, Clock, AlertTriangle, ArrowRight, Search, X, Fuel, Zap, RefreshCw, Camera, ChevronDown, Check } from 'lucide-react';
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
    onSearch: (
        start?: string,
        end?: string,
        depDate?: string,
        depTime?: string,
        startCoords?: any,
        endCoords?: any,
        roundTrip?: boolean,
        preference?: 'fastest' | 'scenic',
        returnDate?: string,
        returnTime?: string
    ) => void;

    // New Props for Toggles
    isRoundTrip?: boolean;
    routePreference?: 'fastest' | 'scenic';
    returnDate?: string; // Display for Return Date
    depDate?: string;    // Dep Date ISO
    depTime?: string;    // Dep Time
    rawReturnDate?: string; // Return Date ISO
    rawReturnTime?: string;
    activeLeg?: 'outbound' | 'return';
    onLegChange?: (leg: 'outbound' | 'return') => void;
    onSetRoundTrip?: (isRoundTrip: boolean) => void;
}

export function TripHeader({ start, destination, metrics, alertCount, unit, onUnitChange, onBack, onSearch, isRoundTrip, routePreference, activeLeg, onLegChange, depDate, depTime, rawReturnDate, rawReturnTime, onSetRoundTrip }: TripHeaderProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editStart, setEditStart] = useState(start);
    const [editDest, setEditDest] = useState(destination);

    // Ref for the header container
    const containerRef = useRef<HTMLDivElement>(null);

    // Coordinates
    const [editStartCoords, setEditStartCoords] = useState<{ lat: number, lng: number } | undefined>(undefined);
    const [editDestCoords, setEditDestCoords] = useState<{ lat: number, lng: number } | undefined>(undefined);

    // --- Date/Time Editing State (Context Aware) ---
    // We need separate state for Departure and Return editing to preserve inputs when switching tabs

    // Departure Editing State
    const [editDepDate, setEditDepDate] = useState(depDate || new Date().toISOString().split('T')[0]);
    const [editDepTime, setEditDepTime] = useState(depTime || '09:00');

    // Return Editing State
    const [editReturnDate, setEditReturnDate] = useState<string>(rawReturnDate || (() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })());
    const [editReturnTime, setEditReturnTime] = useState(rawReturnTime || '10:00');

    // Effect: Sync props to state when props change (e.g. initial load or external update)
    useEffect(() => {
        if (depDate) setEditDepDate(depDate);
        if (depTime) setEditDepTime(depTime);
    }, [depDate, depTime]);

    useEffect(() => {
        if (rawReturnDate) setEditReturnDate(rawReturnDate);
        if (rawReturnTime) setEditReturnTime(rawReturnTime);
    }, [rawReturnDate, rawReturnTime]);

    // Local state for toggles when editing
    const [localRoundTrip, setLocalRoundTrip] = useState(isRoundTrip || false);
    const [localPreference, setLocalPreference] = useState(routePreference || 'fastest');
    const [showTripTypeMenu, setShowTripTypeMenu] = useState(false);


    // Determine which date set is currently "Active" for the DatePicker
    // If activeLeg is 'return', we edit Return Date.
    // If activeLeg is 'outbound' (or undefined), we edit Departure Date.
    const isReturnContext = activeLeg === 'return';

    const activeDate = isReturnContext ? editReturnDate : editDepDate;
    const activeTime = isReturnContext ? editReturnTime : editDepTime;

    const handleDateChange = (newDate: string) => {
        if (isReturnContext) {
            setEditReturnDate(newDate);
            // Don't auto-search for return date. Wait for manual update or time.
            // Actually, wait for manual update to be safe as per user request.
        } else {
            setEditDepDate(newDate);
            onSearch(editStart, editDest, newDate, editDepTime, editStartCoords, editDestCoords, localRoundTrip, localPreference, editReturnDate, editReturnTime);
        }
    };

    const handleTimeChange = (newTime: string) => {
        if (isReturnContext) {
            setEditReturnTime(newTime);
            // Don't auto-search for return time either.
        } else {
            setEditDepTime(newTime);
            onSearch(editStart, editDest, editDepDate, newTime, editStartCoords, editDestCoords, localRoundTrip, localPreference, editReturnDate, editReturnTime);
        }
    };

    const handleSearch = (overrideRoundTrip?: boolean, overridePref?: 'fastest' | 'scenic') => {
        // Use overrides if provided, otherwise current local state
        const rt = overrideRoundTrip !== undefined ? overrideRoundTrip : localRoundTrip;
        const pref = overridePref || localPreference;

        onSearch(
            editStart,
            editDest,
            editDepDate,
            editDepTime,
            editStartCoords,
            editDestCoords,
            rt,
            pref,
            editReturnDate,
            editReturnTime
        );
        setIsEditing(false);
    };


    const togglePreference = (pref: 'fastest' | 'scenic') => {
        if (pref === localPreference) return;
        setLocalPreference(pref);
        // Pass undefined for start/dest to signal "use current trip context" for instant switching
        onSearch(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
        // Actually, logic for instant switch in App.tsx relies on preference override.
        // We can pass just the override preference.
        onSearch(undefined, undefined, undefined, undefined, undefined, undefined, localRoundTrip, pref);
    };

    return (
        <div className="flex flex-col md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch md:items-center justify-between px-4 py-3 bg-card/80 backdrop-blur-md border-b border-border z-50 relative gap-3 md:gap-4" ref={containerRef}>

            {/* Left: Back & Route */}
            <div className="flex items-center gap-3 min-w-0 justify-start">
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
                        <span className="truncate max-w-[100px] sm:max-w-none">{start}</span>
                        <span className="text-secondary-foreground/70">to</span>
                        <span className="truncate max-w-[100px] sm:max-w-none">{destination}</span>
                        <Search className="w-4 h-4 text-secondary-foreground ml-2" />
                    </button>

                    {/* Search Overlay Popover */}
                    {isEditing && (
                        <div className="absolute top-full left-0 mt-2 w-[320px] sm:w-[400px] bg-card border border-border shadow-2xl rounded-xl p-4 z-[100] animate-in fade-in zoom-in-95 duration-200 text-left">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Edit Route</h3>
                                <button onClick={() => setIsEditing(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-secondary">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Quick Toggles in Edit Menu too */}
                            <div className="flex gap-2 mb-4">
                                <button
                                    onClick={() => setLocalRoundTrip(!localRoundTrip)}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${localRoundTrip ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-600' : 'bg-secondary/30 border-transparent text-muted-foreground'}`}
                                >
                                    {localRoundTrip ? 'Round Trip' : 'One Way'}
                                </button>
                                <div className="flex bg-secondary/30 rounded-lg p-1 border border-transparent">
                                    <button
                                        onClick={() => {
                                            setLocalPreference('fastest');
                                            // Trigger search immediately for preference toggle
                                            onSearch(editStart, editDest, undefined, undefined, editStartCoords, editDestCoords, localRoundTrip, 'fastest');
                                        }}
                                        className={`px-3 rounded-md text-xs font-bold transition-all ${localPreference === 'fastest' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
                                    >Fast</button>
                                    <button
                                        onClick={() => {
                                            setLocalPreference('scenic');
                                            // Trigger search immediately for preference toggle
                                            onSearch(editStart, editDest, undefined, undefined, editStartCoords, editDestCoords, localRoundTrip, 'scenic');
                                        }}
                                        className={`px-3 rounded-md text-xs font-bold transition-all ${localPreference === 'scenic' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
                                    >Scenic</button>
                                </div>
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

                                {/* Return Date Picker (Conditional) */}
                                {localRoundTrip && (
                                    <div className="pt-2 border-t border-border/50">
                                        <CombinedDateTimePicker
                                            label="Return Date"
                                            dateValue={editReturnDate}
                                            onDateChange={setEditReturnDate}
                                            timeValue={editReturnTime}
                                            onTimeChange={setEditReturnTime}
                                            minDate={new Date().toISOString().split('T')[0]} // Ideally min date is departure date
                                            maxDate={new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                                        />
                                    </div>
                                )}

                                <Button className="w-full font-bold" onClick={() => handleSearch()}>
                                    Update Route
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Result View Quick Toggles (Desktop) */}
                <div className="hidden lg:flex items-center gap-2 ml-4">
                    <div className="relative">
                        <button
                            onClick={() => setShowTripTypeMenu(!showTripTypeMenu)}
                            title="Select Trip Type"
                            className={`h-8 px-3 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 whitespace-nowrap min-w-fit ${localRoundTrip
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/20'
                                : 'bg-secondary/30 border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground'
                                }`}
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>{localRoundTrip ? 'Round Trip' : 'One Way'}</span>
                            <ChevronDown className={`w-3 h-3 transition-transform ${showTripTypeMenu ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown Menu */}
                        {showTripTypeMenu && (
                            <div className="absolute top-full left-0 mt-2 w-40 bg-card border border-border shadow-xl rounded-xl p-1 z-[60] animate-in fade-in zoom-in-95 duration-200">
                                <button
                                    onClick={() => {
                                        setLocalRoundTrip(false);
                                        setShowTripTypeMenu(false);
                                        // Trigger search for One Way
                                        onSearch(editStart, editDest, editDepDate, editDepTime, editStartCoords, editDestCoords, false, localPreference, editReturnDate, editReturnTime);
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between mb-1 transition-colors ${!localRoundTrip ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/50'}`}
                                >
                                    <span>One Way</span>
                                    {!localRoundTrip && <Check className="w-3 h-3 text-primary" />}
                                </button>
                                <button
                                    onClick={() => {
                                        setLocalRoundTrip(true);
                                        setShowTripTypeMenu(false);
                                        // Defer Search: Use onSetRoundTrip if available
                                        if (onSetRoundTrip) {
                                            onSetRoundTrip(true);
                                        } else {
                                            onSearch(editStart, editDest, editDepDate, editDepTime, editStartCoords, editDestCoords, true, localPreference, editReturnDate, editReturnTime);
                                        }
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between transition-colors ${localRoundTrip ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/50'}`}
                                >
                                    <span>Round Trip</span>
                                    {localRoundTrip && <Check className="w-3 h-3 text-emerald-500" />}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Date/Time Picker - Always visible, context aware */}
                    <div className="h-8 flex items-center gap-2">
                        <CombinedDateTimePicker
                            label={isReturnContext ? "Return" : "Leave"}
                            dateValue={activeDate}
                            onDateChange={handleDateChange}
                            timeValue={activeTime}
                            onTimeChange={handleTimeChange}
                            minDate={new Date().toISOString().split('T')[0]}
                            maxDate={new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                            className="scale-90 origin-left"
                        />
                        {/* Manual Update Button for Return Leg Changes */}
                        {isReturnContext && (editReturnDate !== rawReturnDate || editReturnTime !== rawReturnTime || /* Initial State Check: If rawReturnDate is undefined (one-way), but we are in return context, we need to show update */ (!rawReturnDate && isRoundTrip)) && (
                            <Button
                                size="sm"
                                className="h-8 px-3 ml-0 animate-in fade-in zoom-in slide-in-from-left-2 duration-300 bg-amber-500 hover:bg-amber-600 text-white shadow-sm whitespace-nowrap font-bold text-xs"
                                onClick={() => handleSearch()}
                            >
                                <RefreshCw className="w-3 h-3 mr-1.5" />
                                Update Path
                            </Button>
                        )}
                    </div>

                    <div className="flex items-center bg-secondary/30 rounded-lg p-0.5 border border-transparent h-8">
                        <button
                            onClick={() => togglePreference('fastest')}
                            title="Fastest Route"
                            className={`h-full px-2.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${localPreference === 'fastest' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <Zap className="w-3 h-3" />
                        </button>
                        <button
                            onClick={() => togglePreference('scenic')}
                            title="Scenic Route"
                            className={`h-full px-2.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${localPreference === 'scenic' ? 'bg-emerald-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <Camera className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Center: Leg Toggles (Start / Return) - Only for Round Trip */}
            {/* Positioned in the middle Grid Cell on Desktop */}
            <div className="hidden md:flex justify-center items-center relative z-10 pointer-events-auto">
                {isRoundTrip && onLegChange && (
                    <div className="flex bg-secondary/30 rounded-lg p-1 border border-border/50 shadow-sm">
                        <button
                            onClick={() => onLegChange('outbound')}
                            className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all cursor-pointer whitespace-nowrap ${activeLeg === 'outbound' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Start Trip
                        </button>
                        <button
                            onClick={() => onLegChange('return')}
                            className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all cursor-pointer whitespace-nowrap ${activeLeg === 'return' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Return Trip
                        </button>
                    </div>
                )}
            </div>

            {/* Right: Metrics Chips & Actions */}
            <div className="flex items-center justify-end min-w-0">
                {/* Scrollable Container with Fade Mask */}
                <div className="relative flex justify-end min-w-0 mask-linear-fade">
                    <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1 pl-4 pr-1">

                        {/* Metric: Time, Distance, Fuel, EV */}
                        <div className="flex items-center gap-3 px-3 py-2 bg-secondary/50 rounded-full border border-border/50 shrink-0">
                            <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-blue-500" />
                                <span className="text-xs font-bold whitespace-nowrap">{metrics.time}</span>
                            </div>
                            <div className="w-px h-3 bg-border" />
                            <div className="flex items-center gap-1.5">
                                <Navigation className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-xs font-medium text-foreground whitespace-nowrap">{metrics.distance}</span>
                            </div>

                            {/* Fuel Price */}
                            {metrics.fuel && metrics.fuel !== "0 gal" && (
                                <>
                                    <div className="w-px h-3 bg-border" />
                                    <div className="flex items-center gap-1.5">
                                        <Fuel className="w-3.5 h-3.5 text-orange-500" />
                                        <span className="text-xs font-medium text-foreground whitespace-nowrap">{metrics.fuel}</span>
                                    </div>
                                </>
                            )}

                            {/* EV Price */}
                            {metrics.ev && metrics.ev !== "$0" && (
                                <>
                                    <div className="w-px h-3 bg-border" />
                                    <div className="flex items-center gap-1.5">
                                        <Zap className="w-3.5 h-3.5 text-yellow-500" />
                                        <span className="text-xs font-medium text-foreground whitespace-nowrap">{metrics.ev}</span>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Metric: Alerts */}
                        {alertCount > 0 && (
                            <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/10 text-amber-500 rounded-full border border-amber-500/20 shrink-0">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span className="text-xs font-bold whitespace-nowrap">{alertCount} Alerts</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="hidden lg:block h-6 w-px bg-border/50 mx-2 shrink-0" />

                {/* Unit Toggle - Larger Touch Targets */}
                <div className="flex items-center bg-secondary/30 rounded-lg p-1 border border-border/50 shrink-0">
                    <button
                        onClick={() => onUnitChange('C')}
                        className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all min-w-[32px] ${unit === 'C' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        °C
                    </button>
                    <button
                        onClick={() => onUnitChange('F')}
                        className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all min-w-[32px] ${unit === 'F' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        °F
                    </button>
                </div>
            </div>
        </div>
    );
}
