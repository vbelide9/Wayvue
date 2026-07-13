import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TripHeader } from './TripHeader';
import { VerdictBar } from './VerdictBar';
import { type RoadCondition } from '@/components/RoadConditionCard';
import { LoadingScreen } from '@/components/LoadingScreen';
import { OverviewTab } from './tabs/OverviewTab';
import { ForecastTab } from './tabs/ForecastTab';
import { StopsTab } from './tabs/StopsTab';
import { RoadTab } from './tabs/RoadTab';
import { RentalTab } from './tabs/RentalTab';
import { StayTab } from './tabs/StayTab';
import { TopCategoryNav } from '../TopCategoryNav';
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
    map: (activeTab: string, rightInset: number) => React.ReactNode;
}

// Width of the docked insights panel on desktop (px). The map reserves this much
// on its right edge so the route never hides behind the panel.
const PANEL_WIDTH = 440;

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
}: TripViewLayoutProps) {
    const [activeTab, setActiveTab] = useState('overview');
    // Insights panel — open by default, collapsible to reveal the full-screen map.
    const [panelOpen, setPanelOpen] = useState(true);
    // Only reserve map space / offset the toolbar when the panel docks (sm+); on
    // small screens the panel is a full-width overlay instead.
    const [isDocked, setIsDocked] = useState(false);

    // Reset scroll to top on mount
    useEffect(() => { window.scrollTo({ top: 0 }); }, []);

    // Track whether the viewport is wide enough for the panel to dock beside the map.
    useEffect(() => {
        const mq = window.matchMedia('(min-width: 640px)');
        const update = () => setIsDocked(mq.matches);
        update();
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, []);

    const mapRightInset = panelOpen && isDocked ? PANEL_WIDTH : 0;

    const alertCount = roadConditions.filter(c => c.status !== 'good').length + (incidents?.length || 0);

    const TABS: { id: string; title: string; subtitle: string }[] = [
        { id: 'overview', title: 'Overview', subtitle: 'AI journey confidence and insights' },
        { id: 'weather', title: 'Weather forecast', subtitle: 'Local forecasts along your route' },
        { id: 'stops', title: 'Stops', subtitle: 'Dining, fuel, and rest stops along the way' },
        { id: 'road', title: 'Road conditions', subtitle: 'Live alerts and driving logistics' },
        { id: 'rentals', title: 'Rental vehicles', subtitle: 'Smart vehicle matches for your trip' },
        { id: 'stay', title: 'Hotels', subtitle: 'Overnight stays matched to your route' },
    ];
    const active = TABS.find(t => t.id === activeTab) || TABS[0];

    const renderPanel = () => {
        switch (activeTab) {
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

                {/* Floating toolbar over the map; stops short of the docked panel */}
                <div
                    className="absolute top-0 left-0 z-30 pt-3 transition-[right] duration-300 ease-out"
                    style={{ right: panelOpen && isDocked ? PANEL_WIDTH : 0 }}
                >
                    <TripHeader
                        start={start}
                        destination={destination}
                        metrics={metrics}
                        tripScore={tripScore}
                        alertCount={alertCount}
                        unit={unit}
                        onUnitChange={onUnitChange}
                        onBack={onBack}
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

                {/* Docked insights panel — collapsible */}
                <aside
                    className={`absolute top-0 right-0 h-full z-40 w-full sm:w-[440px] transition-transform duration-300 ease-out ${panelOpen ? 'translate-x-0' : 'translate-x-full'}`}
                    aria-hidden={!panelOpen}
                >
                    <div className="relative h-full flex flex-col bg-card/95 backdrop-blur-2xl border-l border-border shadow-2xl">

                        {/* Collapse handle on the panel's leading edge */}
                        <button
                            onClick={() => setPanelOpen(false)}
                            aria-label="Collapse insights panel"
                            className="absolute -left-3.5 top-24 z-10 w-7 h-11 flex items-center justify-center rounded-l-xl bg-card border border-r-0 border-border shadow-soft text-muted-foreground hover:text-foreground transition-colors"
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

                        {/* Tabs */}
                        <div className="shrink-0 px-2 pb-2">
                            <TopCategoryNav activeSection={activeTab} onNavigate={setActiveTab} badges={{ road: alertCount }} />
                        </div>

                        {/* Scrollable active panel */}
                        <div className="flex-1 overflow-y-auto px-3 pb-6">
                            <div className="mb-4 mt-1">
                                <div className="flex items-center gap-2.5 mb-1">
                                    <div className="w-1 h-6 rounded-full bg-gradient-to-b from-primary to-amber-400/50" />
                                    <h2 className="text-xl font-display font-medium text-foreground">{active.title}</h2>
                                </div>
                                <p className="text-muted-foreground text-sm ml-[15px]">{active.subtitle}</p>
                            </div>
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeTab}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.22, ease: [0.76, 0, 0.24, 1] }}
                                    className="glass-surface overflow-hidden"
                                >
                                    {renderPanel()}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
