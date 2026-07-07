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
import { ThreeGlobeBackground } from '../ThreeGlobeBackground';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';

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
    map: (activeTab: string) => React.ReactNode;
}

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

    // Reset scroll to top on mount
    useEffect(() => { window.scrollTo({ top: 0 }); }, []);

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
        <div className="min-h-screen overflow-x-hidden bg-[#08090C] text-foreground font-sans relative">
            {isLoading && <LoadingScreen title="Updating your journey" />}

            <div className={`relative ${isLoading ? 'opacity-20 pointer-events-none filter blur-sm transition-all duration-300' : ''}`}>

                {/* 1. Header toolbar */}
                <div className="relative pt-8 pb-4 w-full">
                    <ThreeGlobeBackground />
                    <div className="absolute inset-0 pointer-events-none z-[1]">
                        <div className="absolute top-[15%] left-[10%] w-[500px] h-[500px] rounded-full bg-[#3B7BFF]/[0.08] blur-[150px]" />
                        <div className="absolute top-[30%] right-[15%] w-[400px] h-[400px] rounded-full bg-[#22D3EE]/[0.06] blur-[130px]" />
                    </div>
                    <div className="w-full relative z-20">
                        <TripHeader
                            start={start}
                            destination={destination}
                            metrics={metrics}
                            tripScore={tripScore}
                            alertCount={alertCount}
                            unit={unit}
                            onUnitChange={onUnitChange}
                            onBack={onBack}
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
                </div>

                {/* 2. Answer-first verdict */}
                <div className="relative z-10">
                    <VerdictBar tripScore={tripScore} aiAnalysis={aiAnalysis} metrics={metrics} alertCount={alertCount} isEnriching={isEnriching} />
                </div>

                {/* 3. Tabs */}
                <div className="sticky top-4 z-[500] pointer-events-none w-full flex justify-center mb-6">
                    <div className="pointer-events-auto shadow-2xl rounded-full">
                        <TopCategoryNav activeSection={activeTab} onNavigate={setActiveTab} badges={{ road: alertCount }} />
                    </div>
                </div>

                {isEnriching && (
                    <div className="w-full flex justify-center mb-6 px-4" role="status" aria-live="polite">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#3B7BFF]/15 border border-[#3B7BFF]/30 text-[#E7ECF5] text-xs font-medium backdrop-blur-md">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Gathering live weather, traffic &amp; insights…
                        </div>
                    </div>
                )}

                {/* 4. Master-detail: persistent map + single active panel */}
                <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 pb-20 relative z-10 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-8 lg:items-start">

                    {/* Map — the spatial anchor, sticky on desktop, reacts to active tab */}
                    <div className="mb-6 lg:mb-0 lg:sticky lg:top-24 h-[40vh] lg:h-[calc(100vh-8rem)]">
                        <div className="w-full h-full glass-surface overflow-hidden">
                            {map(activeTab)}
                        </div>
                    </div>

                    {/* Active panel */}
                    <div className="lg:min-h-[calc(100vh-8rem)]">
                        <div className="mb-5">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-1 h-8 rounded-full bg-gradient-to-b from-[#3B7BFF] to-[#22D3EE]/40" />
                                <h2 className="text-2xl md:text-3xl font-display font-medium text-foreground">{active.title}</h2>
                            </div>
                            <p className="text-muted-foreground ml-[19px]">{active.subtitle}</p>
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
            </div>
        </div>
    );
}
