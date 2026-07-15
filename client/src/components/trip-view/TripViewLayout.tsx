import { useEffect, useState } from 'react';
import { TripHeader, type TripAlert } from './TripHeader';
import { VerdictBar } from './VerdictBar';
import { type RoadCondition } from '@/components/RoadConditionCard';
import { LoadingScreen } from '@/components/LoadingScreen';
import { OverviewTab } from './tabs/OverviewTab';
import { ForecastTab } from './tabs/ForecastTab';
import { StopsTab } from './tabs/StopsTab';
import { RoadTab } from './tabs/RoadTab';
import { RentalTab } from './tabs/RentalTab';
import { StayTab } from './tabs/StayTab';
import { ActivitiesTab } from './tabs/ActivitiesTab';
import { PackTab } from './tabs/PackTab';
import { MyPlanTab } from './tabs/MyPlanTab';
import { InsightsAccordion } from './InsightsAccordion';
import { useGroupTrip } from '@/lib/GroupTripContext';
import { type Waypoint } from '@/components/WaypointsEditor';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

interface TripViewLayoutProps {
    isLoading?: boolean;
    isEnriching?: boolean;
    start: string;
    destination: string;
    metrics: { distance: string; time: string; fuel: string; ev: string; tollCost?: string; tollEstimated?: boolean; };
    tripScore?: { score: number; label: string; };
    roadConditions: RoadCondition[];
    incidents?: any[];
    weatherData: any[];
    aiAnalysis: any;
    recommendations: any[];
    unit: 'C' | 'F';
    onBack: () => void;
    onHome?: () => void;
    onUnitChange: (unit: 'C' | 'F') => void;
    onExportPdf?: () => void;
    onSearch: (start?: string, end?: string, depDate?: string, depTime?: string, startCoords?: any, endCoords?: any, roundTrip?: boolean, preference?: 'fastest' | 'scenic', returnDate?: string, returnTime?: string) => void;
    onSegmentSelect: (lat: number, lng: number) => void;
    depDate?: string;
    depTime?: string;
    activeLeg?: 'outbound' | 'return';
    hasReturn?: boolean;
    routePreference?: 'fastest' | 'scenic';
    returnDate?: string;
    rawReturnDate?: string;
    rawReturnTime?: string;
    onLegChange?: (leg: 'outbound' | 'return') => void;
    onSetRoundTrip?: (isRoundTrip: boolean) => void;
    isRoundTrip?: boolean;
    waypoints?: Waypoint[];
    onWaypointsChange?: (waypoints: Waypoint[]) => void;
    map: (activeTab: string, rightInset: number) => React.ReactNode;
}

// Docked insights panel width (px). The map reserves this much on its right edge so
// the route never hides behind the panel. The width is user-resizable within these
// bounds and persisted to localStorage.
const DEFAULT_PANEL_WIDTH = 440;
const MIN_PANEL_WIDTH = 340;
const MAX_PANEL_WIDTH = 720;
const PANEL_WIDTH_KEY = 'wayvue.insightsPanelWidth';

// Streaming placeholders shown while phase-2 enrichment is in flight
function CardSkeleton({ rows = 3 }: { rows?: number }) {
    const widths = ['w-11/12', 'w-4/5', 'w-3/4', 'w-5/6'];
    return (
        <div className="p-6 md:p-8 space-y-4">
            <Skeleton className="h-8 w-1/3" />
            {Array.from({ length: rows }).map((_, i) => (
                <Skeleton key={i} className={`h-4 ${widths[i % widths.length]}`} />
            ))}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 rounded-2xl" />
                ))}
            </div>
        </div>
    );
}

export function TripViewLayout({
    isLoading,
    isEnriching,
    start,
    destination,
    metrics,
    tripScore,
    roadConditions,
    incidents,
    weatherData,
    aiAnalysis,
    recommendations,
    unit,
    onUnitChange,
    onBack,
    onHome,
    onExportPdf,
    onSearch,
    onSegmentSelect,
    map,
    activeLeg,
    routePreference,
    onLegChange,
    returnDate,
    depDate,
    depTime,
    rawReturnTime,
    onSetRoundTrip,
    isRoundTrip,
    rawReturnDate,
    waypoints,
    onWaypointsChange,
}: TripViewLayoutProps) {
    const [activeTab, setActiveTab] = useState('overview');
    // Unread collaborator-activity count → badge on the "My Plan" section header.
    const { unreadCount } = useGroupTrip();
    // Insights panel — open by default, collapsible to reveal the full-screen map.
    const [panelOpen, setPanelOpen] = useState(true);
    // Only reserve map space / offset the toolbar when the panel docks (sm+); on
    // small screens the panel is a full-width overlay instead.
    const [isDocked, setIsDocked] = useState(false);
    // User-resizable docked width (persisted). Drag the panel's left edge to change it.
    const [panelWidth, setPanelWidth] = useState<number>(() => {
        if (typeof window === 'undefined') return DEFAULT_PANEL_WIDTH;
        const saved = Number(window.localStorage.getItem(PANEL_WIDTH_KEY));
        return saved >= MIN_PANEL_WIDTH && saved <= MAX_PANEL_WIDTH ? saved : DEFAULT_PANEL_WIDTH;
    });
    const [isResizing, setIsResizing] = useState(false);

    // Reset scroll to top on mount
    useEffect(() => { window.scrollTo({ top: 0 }); }, []);

    // Drag-to-resize: while active, translate the pointer's X into a panel width
    // measured from the right edge, clamped to the allowed bounds.
    useEffect(() => {
        if (!isResizing) return;
        const onMove = (e: PointerEvent) => {
            const next = window.innerWidth - e.clientX;
            setPanelWidth(Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, next)));
        };
        const stop = () => setIsResizing(false);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', stop);
        window.addEventListener('pointercancel', stop);
        const prevCursor = document.body.style.cursor;
        const prevSelect = document.body.style.userSelect;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', stop);
            window.removeEventListener('pointercancel', stop);
            document.body.style.cursor = prevCursor;
            document.body.style.userSelect = prevSelect;
        };
    }, [isResizing]);

    // Persist the chosen width.
    useEffect(() => {
        window.localStorage.setItem(PANEL_WIDTH_KEY, String(panelWidth));
    }, [panelWidth]);

    // Track whether the viewport is wide enough for the panel to dock beside the map.
    useEffect(() => {
        const mq = window.matchMedia('(min-width: 640px)');
        const update = () => setIsDocked(mq.matches);
        update();
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, []);

    const mapRightInset = panelOpen && isDocked ? panelWidth : 0;

    const alertCount = roadConditions.filter(c => c.status !== 'good').length + (incidents?.length || 0);

    // Flattened alert list surfaced in the top-bar "Alerts" popover (incidents first,
    // then non-good road conditions). Kept in sync with alertCount above.
    const INCIDENT_LABELS: Record<string, string> = {
        accident: 'Accident', closure: 'Road Closure', construction: 'Construction',
        jam: 'Traffic Jam', hazard: 'Hazard',
    };
    const parseMiles = (s?: string) => {
        const n = parseInt((s || '').replace(/[^0-9]/g, ''), 10);
        return Number.isFinite(n) ? n : undefined;
    };
    const alerts: TripAlert[] = [
        ...(incidents || []).map((inc: any, idx: number) => ({
            id: inc.id || `inc-${idx}`,
            label: INCIDENT_LABELS[inc.type] || 'Traffic Alert',
            description: inc.description || '',
            severity: (['accident', 'closure'].includes(inc.type) ? 'high' : 'medium') as 'high' | 'medium',
            place: inc.place || undefined,
            miles: typeof inc.miles === 'number' ? inc.miles : undefined,
        })),
        ...roadConditions.filter(c => c.status !== 'good').map((c, idx) => ({
            id: `cond-${idx}-${c.segment}`,
            label: c.status === 'poor' ? 'Poor road conditions' : 'Moderate road conditions',
            description: c.description || '',
            severity: (c.status === 'poor' ? 'high' : 'medium') as 'high' | 'medium',
            place: c.segment || undefined,
            miles: parseMiles(c.distance),
        })),
    ]
        // Show alerts in travel order (nearest first).
        .sort((a, b) => (a.miles ?? Infinity) - (b.miles ?? Infinity));

    const TABS: { id: string; title: string; subtitle: string }[] = [
        { id: 'overview', title: 'Overview', subtitle: 'AI journey confidence and insights' },
        { id: 'plan', title: 'My Plan', subtitle: 'Your saved itinerary for this trip' },
        { id: 'weather', title: 'Weather forecast', subtitle: 'Local forecasts along your route' },
        { id: 'stops', title: 'Stops', subtitle: 'Dining, fuel, and rest stops along the way' },
        { id: 'road', title: 'Road conditions', subtitle: 'Live alerts and driving logistics' },
        { id: 'rentals', title: 'Rental vehicles', subtitle: 'Smart vehicle matches for your trip' },
        { id: 'stay', title: 'Hotels', subtitle: 'Overnight stays matched to your route' },
        { id: 'activities', title: 'Activities', subtitle: 'Things to do at your destination' },
        { id: 'pack', title: 'Pack for this trip', subtitle: 'Trip-tailored gear & essentials' },
    ];
    const renderPanel = (id: string) => {
        switch (id) {
            case 'plan':
                return <MyPlanTab start={start} destination={destination} waypoints={waypoints} />;
            case 'weather':
                return isEnriching && weatherData.length === 0
                    ? <CardSkeleton rows={2} />
                    : <ForecastTab weatherData={weatherData} unit={unit} />;
            case 'stops':
                return isEnriching && recommendations.length === 0
                    ? <CardSkeleton rows={2} />
                    : <StopsTab recommendations={recommendations} />;
            case 'road':
                return isEnriching && roadConditions.length === 0 && (!incidents || incidents.length === 0)
                    ? <CardSkeleton rows={2} />
                    : <RoadTab
                        roadConditions={roadConditions}
                        incidents={incidents}
                        onSegmentSelect={(condition) => { if (condition.location) onSegmentSelect(condition.location.lat, condition.location.lon); }}
                        onIncidentSelect={(incident) => { if (incident.location) onSegmentSelect(incident.location.lat, incident.location.lng); }}
                    />;
            case 'rentals':
                return <RentalTab
                    metrics={metrics}
                    weatherData={weatherData}
                    start={start}
                    destination={destination}
                    depDate={depDate}
                    returnDate={rawReturnDate || returnDate}
                    depTime={depTime}
                    returnTime={rawReturnTime}
                />;
            case 'stay':
                return <StayTab
                    metrics={metrics}
                    start={start}
                    destination={destination}
                    depDate={depDate}
                    returnDate={rawReturnDate || returnDate}
                />;
            case 'activities':
                return <ActivitiesTab destination={destination} />;
            case 'pack':
                return <PackTab weatherData={weatherData} durationText={metrics.time} depDate={depDate} destination={destination} waypoints={waypoints} />;
            case 'overview':
            default:
                return isEnriching && !aiAnalysis
                    ? <CardSkeleton rows={2} />
                    : <OverviewTab
                        tripScore={aiAnalysis?.tripScore?.score ?? aiAnalysis?.tripScore ?? 0}
                        aiAnalysis={aiAnalysis}
                        metrics={metrics}
                        alertCount={alertCount}
                    />;
        }
    };

    return (
        <div className="fixed inset-0 overflow-hidden bg-background text-foreground font-sans">
            {isLoading && <LoadingScreen title="Updating your journey" />}

            <div className={`h-full w-full relative ${isLoading ? 'opacity-20 pointer-events-none filter blur-sm transition-all duration-300' : ''}`}>

                {/* Full-screen map — the spatial anchor */}
                <div className="absolute inset-0 z-0">
                    {map(activeTab, mapRightInset)}
                </div>

                {/* Transparent capture layer during resize so the map canvas doesn't
                    eat pointer events or flash hover states while dragging. */}
                {isResizing && <div className="absolute inset-0 z-50 cursor-col-resize" />}

                {/* Floating toolbar over the map; stops short of the docked panel */}
                <div
                    className={`absolute top-0 left-0 z-30 pt-3 ${isResizing ? '' : 'transition-[right] duration-300 ease-out'}`}
                    style={{ right: panelOpen && isDocked ? panelWidth : 0 }}
                >
                    <TripHeader
                        start={start}
                        destination={destination}
                        metrics={metrics}
                        tripScore={tripScore}
                        alertCount={alertCount}
                        alerts={alerts}
                        unit={unit}
                        onUnitChange={onUnitChange}
                        onBack={onBack}
                        onHome={onHome}
                        onExportPdf={onExportPdf}
                        onSearch={onSearch}
                        isRoundTrip={isRoundTrip}
                        routePreference={routePreference}
                        returnDate={returnDate}
                        activeLeg={activeLeg}
                        onLegChange={onLegChange}
                        depDate={depDate}
                        depTime={depTime}
                        rawReturnTime={rawReturnTime}
                        onSetRoundTrip={onSetRoundTrip}
                        waypoints={waypoints}
                        onWaypointsChange={onWaypointsChange}
                    />
                </div>

                {/* Reopen tab shown when the panel is collapsed */}
                {!panelOpen && (
                    <button
                        onClick={() => setPanelOpen(true)}
                        aria-label="Show insights panel"
                        className="absolute top-1/2 right-0 -translate-y-1/2 z-40 flex items-center gap-1.5 pl-2.5 pr-3.5 py-3 rounded-l-2xl bg-card/95 backdrop-blur-xl border border-r-0 border-border shadow-soft-lg text-sm font-bold text-foreground hover:bg-card transition-colors animate-in slide-in-from-right-4 duration-300"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Insights
                    </button>
                )}

                {/* Docked insights panel — collapsible + drag-to-resize */}
                <aside
                    className={`absolute top-0 right-0 h-full z-40 w-full transition-transform duration-300 ease-out ${panelOpen ? 'translate-x-0' : 'translate-x-full'}`}
                    style={isDocked ? { width: panelWidth } : undefined}
                    aria-hidden={!panelOpen}
                >
                    <div className="relative h-full flex flex-col bg-card/95 backdrop-blur-2xl border-l border-border shadow-2xl">

                        {/* Resize handle on the panel's leading edge (docked only) */}
                        {isDocked && panelOpen && (
                            <div
                                role="separator"
                                aria-orientation="vertical"
                                aria-label="Resize insights panel"
                                onPointerDown={(e) => { e.preventDefault(); setIsResizing(true); }}
                                onDoubleClick={() => setPanelWidth(DEFAULT_PANEL_WIDTH)}
                                title="Drag to resize · double-click to reset"
                                className="group/resize absolute left-0 top-0 h-full w-3 -translate-x-1/2 z-20 cursor-col-resize"
                            >
                                <div className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-px transition-colors ${isResizing ? 'bg-primary w-0.5' : 'bg-transparent group-hover/resize:bg-primary/50'}`} />
                            </div>
                        )}

                        {/* Collapse handle on the panel's leading edge */}
                        <button
                            onClick={() => setPanelOpen(false)}
                            aria-label="Collapse insights panel"
                            className="absolute -left-3.5 top-24 z-30 w-7 h-11 flex items-center justify-center rounded-l-xl bg-card border border-r-0 border-border shadow-soft text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>

                        {/* Verdict + live-enrichment status */}
                        <div className="shrink-0 p-3 pt-4 space-y-2.5">
                            <VerdictBar compact tripScore={tripScore} aiAnalysis={aiAnalysis} metrics={metrics} alertCount={alertCount} isEnriching={isEnriching} />
                            {isEnriching && (
                                <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-medium" role="status" aria-live="polite">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                                    Gathering live weather, traffic &amp; insights…
                                </div>
                            )}
                        </div>

                        {/* Insights sections — stacked collapsible accordions, always visible
                            without horizontal scrolling. Overview is expanded by default;
                            data-lenis-prevent so Lenis smooth-scroll doesn't swallow wheel
                            events over this nested scroll area. */}
                        {/* pb-24 clears the fixed "Ask Wayvue AI" button (bottom-6, ~56px tall)
                            so it never covers the last card's content. */}
                        <div data-lenis-prevent className="flex-1 min-h-0 overflow-y-auto px-3 pb-24 pt-1">
                            <InsightsAccordion
                                categories={TABS}
                                activeId={activeTab}
                                onToggle={setActiveTab}
                                badges={{ road: alertCount, plan: unreadCount }}
                                badgeTone={{ plan: 'notify' }}
                                renderContent={renderPanel}
                            />
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
