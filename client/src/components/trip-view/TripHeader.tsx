import { CombinedDateTimePicker } from '../../components/CustomDateTimePicker';
import { ChevronLeft, Navigation, Clock, AlertTriangle, ArrowRight, Search, X, Fuel, Zap, RefreshCw, Camera, ChevronDown, Check, CircleDollarSign, Info, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useRef, useEffect } from 'react';
import { LocationInput } from '../LocationInput';
import { WayvueBrand } from '../WayvueBrand';
import { WaypointsEditor, type Waypoint } from '../WaypointsEditor';
import { AccountMenu } from '../AccountMenu';
import { SaveTripButton } from '../SaveTripButton';
import { GroupMembersBar } from '../GroupMembersBar';

export interface TripAlert {
    id: string;
    label: string;        // e.g. "Accident", "Construction", "Moderate road conditions"
    description: string;
    severity: 'high' | 'medium';
    place?: string;       // location: road number + town, e.g. "I-95 · Richmond, VA"
    miles?: number;       // distance from the start
}

interface TripHeaderProps {
    start: string;
    destination: string;
    metrics: {
        distance: string;
        time: string;
        fuel: string;
        ev: string;
        tollCost?: string;
        tollEstimated?: boolean;
    };
    tripScore?: {
        score: number;
        label: string;
    };
    alertCount: number;
    alerts?: TripAlert[];
    unit: 'C' | 'F';
    onUnitChange: (unit: 'C' | 'F') => void;
    onBack: () => void;
    onHome?: () => void;
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
    onExportPdf?: () => void;
    waypoints?: Waypoint[];
    onWaypointsChange?: (waypoints: Waypoint[]) => void;
    /** Re-route immediately when a stop is added (picked) or removed. */
    onWaypointsCommit?: (waypoints: Waypoint[]) => void;
}

export function TripHeader({ start, destination, metrics, alertCount, alerts = [], unit, onUnitChange, onBack, onHome, onSearch, isRoundTrip, routePreference, activeLeg, onLegChange, depDate, depTime, rawReturnDate, rawReturnTime, onSetRoundTrip, onExportPdf, waypoints = [], onWaypointsChange, onWaypointsCommit }: TripHeaderProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editStart, setEditStart] = useState(start);
    const [editDest, setEditDest] = useState(destination);

    // Alerts popover (top-bar "N Alerts" pill)
    const [showAlerts, setShowAlerts] = useState(false);
    const alertsRef = useRef<HTMLDivElement>(null);

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

    // Close the alerts popover on outside click / Escape.
    useEffect(() => {
        if (!showAlerts) return;
        const onDown = (e: MouseEvent) => {
            if (alertsRef.current && !alertsRef.current.contains(e.target as Node)) setShowAlerts(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowAlerts(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [showAlerts]);

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
        // Single call carrying the preference override. This lets App.tsx take the
        // instant-switch path (reusing cached variants) instead of a full re-fetch.
        // A prior stray onSearch() with all-undefined args used to trigger a spurious
        // full reload, which briefly dropped tripData.variants and made the alternate
        // route line disappear on every switch.
        onSearch(undefined, undefined, undefined, undefined, undefined, undefined, localRoundTrip, pref);
    };

    return (
        <div className="flex flex-col md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch md:items-center justify-between px-4 py-3 bg-card/80 backdrop-blur-xl border border-border rounded-3xl shadow-soft z-50 relative gap-3 md:gap-4 mx-4" ref={containerRef}>

            {/* Left: Back, Brand & Route */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0 justify-start">
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Back to trip planning"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                    onClick={onBack}
                >
                    <ChevronLeft className="w-5 h-5" />
                </Button>

                {/* Brand mark — filled disc for contrast; logo only since the toolbar is dense.
                    Clicking it returns to the home/landing page (distinct from the back chevron). */}
                <div className="hidden sm:block shrink-0">
                    <WayvueBrand size="sm" markOnly filled onClick={onHome ?? onBack} />
                </div>

                <div className="flex flex-col min-w-0 relative group">
                    <button
                        onClick={() => setIsEditing(!isEditing)}
                        className="flex items-center gap-2 h-9 text-sm font-bold text-secondary-foreground bg-secondary hover:bg-secondary/90 px-4 rounded-full transition-all shadow-sm shrink-0"
                    >
                        {/* Fixed truncation caps so flex shrink can't crush the names to a letter */}
                        <span className="truncate max-w-[110px] lg:max-w-[150px]">{start}</span>
                        <span className="text-secondary-foreground/70 shrink-0">to</span>
                        <span className="truncate max-w-[110px] lg:max-w-[150px]">{destination}</span>
                        <Search className="w-4 h-4 text-secondary-foreground ml-2 shrink-0" />
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

                                {/* Multi-Stop Waypoints */}
                                {onWaypointsChange && (
                                    <div className="pt-2 border-t border-border/50">
                                        <WaypointsEditor waypoints={waypoints} onWaypointsChange={onWaypointsChange} onCommit={(wps) => { onWaypointsCommit?.(wps); setIsEditing(false); }} />
                                    </div>
                                )}

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
                            className={`h-9 px-3.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 whitespace-nowrap min-w-fit ${localRoundTrip
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/20'
                                : 'bg-secondary/30 border-border/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
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

                    {/* Date/Time Picker - Always visible, context aware (compact inline) */}
                    <div className="flex items-center gap-2">
                        <CombinedDateTimePicker
                            compact
                            label={isReturnContext ? "Return" : "Leave"}
                            dateValue={activeDate}
                            onDateChange={handleDateChange}
                            timeValue={activeTime}
                            onTimeChange={handleTimeChange}
                            minDate={new Date().toISOString().split('T')[0]}
                            maxDate={new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
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

                    <div className="flex items-center bg-secondary/30 rounded-full p-1 border border-border/50 h-9">
                        <button
                            onClick={() => togglePreference('fastest')}
                            title="Fastest Route"
                            aria-label="Fastest route"
                            aria-pressed={localPreference === 'fastest'}
                            className={`h-full px-3 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${localPreference === 'fastest' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <Zap className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => togglePreference('scenic')}
                            title="Scenic Route"
                            aria-label="Scenic route"
                            aria-pressed={localPreference === 'scenic'}
                            className={`h-full px-3 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${localPreference === 'scenic' ? 'bg-emerald-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <Camera className="w-3.5 h-3.5" />
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

            {/* Right: Metrics & Actions — one aligned row of equal-height pills */}
            <div className="flex flex-wrap items-center justify-start md:justify-end gap-2 min-w-0">

                {/* Metrics pill — stays on one line (sm+); wraps internally only on phones */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1 h-auto sm:h-9 px-4 py-2 sm:py-0 bg-secondary/50 rounded-2xl sm:rounded-full border border-border/50 shrink-0">
                    <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="text-xs font-bold whitespace-nowrap">{metrics.time}</span>
                    </div>
                    <div className="w-px h-3.5 bg-border shrink-0" />
                    <div className="flex items-center gap-1.5">
                        <Navigation className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs font-semibold text-foreground whitespace-nowrap">{metrics.distance}</span>
                    </div>

                    {/* Fuel Price */}
                    {metrics.fuel && metrics.fuel !== "0 gal" && (
                        <>
                            <div className="hidden sm:block w-px h-3.5 bg-border shrink-0" />
                            <div className="flex items-center gap-1.5">
                                <Fuel className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                                <span className="text-xs font-semibold text-foreground whitespace-nowrap">{metrics.fuel}</span>
                            </div>
                        </>
                    )}

                    {/* EV Price */}
                    {metrics.ev && metrics.ev !== "$0" && (
                        <>
                            <div className="hidden sm:block w-px h-3.5 bg-border shrink-0" />
                            <div className="flex items-center gap-1.5">
                                <Zap className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                                <span className="text-xs font-semibold text-foreground whitespace-nowrap">{metrics.ev}</span>
                            </div>
                        </>
                    )}

                    {/* Toll Cost */}
                    {metrics.tollCost && metrics.tollCost !== "$0" && (
                        <>
                            <div className="hidden sm:block w-px h-3.5 bg-border shrink-0" />
                            <div className="flex items-center gap-1.5">
                                <CircleDollarSign className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span className="text-xs font-semibold text-foreground whitespace-nowrap">
                                    {metrics.tollCost}{metrics.tollEstimated ? ' est.' : ''}
                                </span>
                                {metrics.tollEstimated && (
                                    <span className="relative group/toll inline-flex">
                                        <Info
                                            className="w-3 h-3 text-muted-foreground/60 cursor-help outline-none"
                                            tabIndex={0}
                                            aria-label="How tolls are estimated"
                                        />
                                        <span
                                            role="tooltip"
                                            className="pointer-events-none absolute top-full right-0 mt-2 w-56 opacity-0 group-hover/toll:opacity-100 group-focus-within/toll:opacity-100 transition-opacity duration-200 bg-black/90 text-white text-[10px] leading-relaxed rounded-lg p-2.5 border border-white/10 shadow-xl z-[100] normal-case font-normal tracking-normal"
                                        >
                                            Estimated from typical toll rates for the states your route passes through. Add a toll-pricing API key for exact, live tolls.
                                        </span>
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Alerts — click to see the list */}
                {alertCount > 0 && (
                    <div className="relative shrink-0" ref={alertsRef}>
                        <button
                            onClick={() => setShowAlerts(v => !v)}
                            aria-haspopup="dialog"
                            aria-expanded={showAlerts}
                            title="View road alerts"
                            className="flex items-center gap-1.5 h-9 px-3.5 bg-amber-500/10 text-amber-600 rounded-full border border-amber-500/25 hover:bg-amber-500/20 transition-colors"
                        >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span className="text-xs font-bold whitespace-nowrap">{alertCount} Alerts</span>
                            <ChevronDown className={`w-3 h-3 transition-transform ${showAlerts ? 'rotate-180' : ''}`} />
                        </button>

                        {showAlerts && (
                            <div
                                role="dialog"
                                aria-label="Road alerts"
                                className="absolute top-full right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-card border border-border shadow-2xl rounded-2xl z-[100] animate-in fade-in zoom-in-95 duration-200 overflow-hidden"
                            >
                                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/40">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                                        <span className="text-sm font-bold text-foreground">Road Alerts ({alertCount})</span>
                                    </div>
                                    <button onClick={() => setShowAlerts(false)} aria-label="Close" className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="max-h-[320px] overflow-y-auto custom-scrollbar divide-y divide-border" data-lenis-prevent>
                                    {alerts.length > 0 ? alerts.map((a) => (
                                        <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                                            <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${a.severity === 'high' ? 'bg-red-500' : 'bg-amber-500'}`} />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-baseline justify-between gap-2">
                                                    <span className="text-xs font-bold text-foreground">{a.label}</span>
                                                    {a.miles != null && (
                                                        <span className="text-[10px] font-semibold text-amber-600 whitespace-nowrap shrink-0">{a.miles} mi</span>
                                                    )}
                                                </div>
                                                {a.place && (
                                                    <p className="text-xs font-medium text-foreground/80 mt-0.5 leading-snug">{a.place}</p>
                                                )}
                                                {a.description && a.description.toLowerCase() !== 'closed' && (
                                                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{a.description}</p>
                                                )}
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                                            No detailed alerts available. Open the Road conditions panel for more.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="hidden lg:block h-5 w-px bg-border/60 mx-0.5 shrink-0" />

                {/* Group members + invite */}
                <GroupMembersBar />

                {/* Save trip */}
                <SaveTripButton />

                {/* Export itinerary PDF */}
                {onExportPdf && (
                    <button
                        onClick={onExportPdf}
                        title="Download itinerary as PDF"
                        aria-label="Download itinerary as PDF"
                        className="flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs font-bold bg-secondary/50 border border-border/50 text-foreground hover:bg-secondary hover:border-primary/40 transition-colors shrink-0"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">PDF</span>
                    </button>
                )}

                {/* Unit Toggle */}
                <div className="flex items-center h-9 bg-secondary/40 rounded-full p-1 border border-border/50 shrink-0">
                    <button
                        onClick={() => onUnitChange('C')}
                        className={`text-xs font-bold px-3 h-full rounded-full transition-all min-w-[34px] ${unit === 'C' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        °C
                    </button>
                    <button
                        onClick={() => onUnitChange('F')}
                        className={`text-xs font-bold px-3 h-full rounded-full transition-all min-w-[34px] ${unit === 'F' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        °F
                    </button>
                </div>

                {/* Account (sign in / profile menu) */}
                <AccountMenu />
            </div>
        </div>
    );
}
