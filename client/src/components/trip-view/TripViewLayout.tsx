import { useEffect, useState, useRef } from 'react';
import { TripHeader } from './TripHeader';
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
    map: React.ReactNode;
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
    const [activeSection, setActiveSection] = useState('');
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Scroll to the very top on mount so the map hero is visible first
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0 });
        }
        // Also reset window scroll in case the outer container is scrolled
        window.scrollTo({ top: 0 });
    }, []);

    // Provide scroll spy functionality
    useEffect(() => {
        const handleScroll = () => {
            if (!scrollContainerRef.current) return;
            const sections = ['overview', 'weather', 'stops', 'road', 'rentals', 'stay'];
            let current = ''; // empty when hero/map is visible

            for (const section of sections) {
                const element = document.getElementById(section);
                if (element) {
                    const rect = element.getBoundingClientRect();
                    // If the top of the section is near the top of the viewport
                    if (rect.top <= 300) {
                        current = section;
                    }
                }
            }
            setActiveSection(current);
        };

        const container = scrollContainerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll);
        }
        return () => {
            if (container) container.removeEventListener('scroll', handleScroll);
        };
    }, []);

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element && scrollContainerRef.current) {
            const containerTop = scrollContainerRef.current.getBoundingClientRect().top;
            const elementTop = element.getBoundingClientRect().top;
            const offset = elementTop - containerTop + scrollContainerRef.current.scrollTop - 100; // 100px fixed offset for floating nav

            scrollContainerRef.current.scrollTo({
                top: offset,
                behavior: 'smooth'
            });
            setActiveSection(id);
        }
    };

    const alertCount = roadConditions.filter(c => c.status !== 'good').length + (incidents?.length || 0);

    return (
        <div ref={scrollContainerRef} className={`min-h-screen overflow-y-auto overflow-x-hidden bg-[#0B1A0F] text-foreground font-sans relative scroll-smooth ${isLoading ? 'opacity-20 pointer-events-none filter blur-sm transition-all duration-300' : ''}`}>
            {isLoading && <LoadingScreen title="Updating your journey" />}

            {/* Main content */}
            <div className="relative">

                {/* 1. Header (slim) — the map is now the persistent anchor below */}
                <div className="relative pt-8 pb-4 w-full">
                    <ThreeGlobeBackground />

                    {/* Warm ambient glow overlays */}
                    <div className="absolute inset-0 pointer-events-none z-[1]">
                        <div className="absolute top-[15%] left-[10%] w-[500px] h-[500px] rounded-full bg-[#628141]/[0.08] blur-[150px]" />
                        <div className="absolute top-[30%] right-[15%] w-[400px] h-[400px] rounded-full bg-[#E67E22]/[0.06] blur-[130px]" />
                    </div>

                    {/* Header Controls */}
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

                {/* 2. Top-Center Floating Category Navigation */}
                <div className="sticky top-4 z-[500] pointer-events-none w-full flex justify-center mt-[-2rem] mb-8">
                    <div className="pointer-events-auto shadow-2xl rounded-full">
                        <TopCategoryNav activeSection={activeSection} onNavigate={scrollToSection} />
                    </div>
                </div>

                {/* Streaming indicator — map is live, richer intelligence still loading */}
                {isEnriching && (
                    <div className="w-full flex justify-center mb-8 px-4" role="status" aria-live="polite">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#628141]/15 border border-[#628141]/30 text-[#E5D9B6] text-xs font-medium backdrop-blur-md">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Gathering live weather, traffic &amp; insights…
                        </div>
                    </div>
                )}

                {/* 3. Split: persistent map anchor + scrolling insight sections */}
                <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 pb-40 relative z-10 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-8 lg:items-start">

                    {/* Map column — the spatial core of the product, sticky on desktop */}
                    <div className="mb-8 lg:mb-0 lg:sticky lg:top-24 h-[42vh] lg:h-[calc(100vh-7rem)]">
                        <div className="w-full h-full glass-surface overflow-hidden">
                            {map}
                        </div>
                    </div>

                    {/* Content column — scrolling insights */}
                    <div className="flex flex-col gap-16">

                    {/* Overview Section */}
                    <section id="overview" className="scroll-mt-32">
                        <div className="mb-8">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-1 h-8 rounded-full bg-gradient-to-b from-[#628141] to-[#628141]/30" />
                                <h2 className="text-2xl md:text-3xl font-display font-medium text-foreground">Overview</h2>
                            </div>
                            <p className="text-muted-foreground mt-2 ml-[19px]">AI-powered journey confidence and insights</p>
                        </div>
                        <div className="glass-surface overflow-hidden p-4 md:p-8">
                            {isEnriching && !aiAnalysis ? (
                                <CardSkeleton rows={2} />
                            ) : (
                                <OverviewTab
                                    tripScore={aiAnalysis?.tripScore?.score ?? aiAnalysis?.tripScore ?? 0}
                                    aiAnalysis={aiAnalysis}
                                    metrics={metrics}
                                    alertCount={alertCount}
                                />
                            )}
                        </div>
                    </section>

                    {/* Weather Forecast Section */}
                    <section id="weather" className="scroll-mt-32">
                        <div className="mb-8">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-1 h-8 rounded-full bg-gradient-to-b from-[#E67E22] to-[#E67E22]/30" />
                                <h2 className="text-2xl md:text-3xl font-display font-medium text-foreground">Weather Forecast</h2>
                            </div>
                            <p className="text-muted-foreground mt-2 ml-[19px]">Local forecasts along your route</p>
                        </div>
                        <div className="glass-surface overflow-hidden p-4 md:p-8">
                            {isEnriching && weatherData.length === 0 ? (
                                <CardSkeleton rows={2} />
                            ) : (
                                <ForecastTab weatherData={weatherData} unit={unit} />
                            )}
                        </div>
                    </section>

                    {/* Stops Section */}
                    <section id="stops" className="scroll-mt-32">
                        <div className="mb-8">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-1 h-8 rounded-full bg-gradient-to-b from-[#E5D9B6] to-[#E5D9B6]/30" />
                                <h2 className="text-2xl md:text-3xl font-display font-medium text-foreground">Stops</h2>
                            </div>
                            <p className="text-muted-foreground mt-2 ml-[19px]">Recommended stops, dining, and accommodations along the route</p>
                        </div>
                        <div className="glass-surface overflow-hidden min-h-[400px]">
                            {isEnriching && recommendations.length === 0 ? (
                                <CardSkeleton rows={2} />
                            ) : (
                                <StopsTab recommendations={recommendations} />
                            )}
                        </div>
                    </section>

                    {/* Road Conditions Section */}
                    <section id="road" className="scroll-mt-32">
                        <div className="mb-8">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-1 h-8 rounded-full bg-gradient-to-b from-amber-500 to-amber-500/30" />
                                <h2 className="text-2xl md:text-3xl font-display font-medium text-foreground">Road Conditions</h2>
                            </div>
                            <p className="text-muted-foreground mt-2 ml-[19px]">Alerts and driving logistics for your destination</p>
                        </div>
                        <div className="glass-surface overflow-hidden">
                            {isEnriching && roadConditions.length === 0 && (!incidents || incidents.length === 0) ? (
                                <CardSkeleton rows={2} />
                            ) : (
                            <RoadTab
                                roadConditions={roadConditions}
                                incidents={incidents}
                                onSegmentSelect={(condition) => {
                                    if (condition.location) {
                                        onSegmentSelect(condition.location.lat, condition.location.lon);
                                    }
                                }}
                                onIncidentSelect={(incident) => {
                                    if (incident.location) {
                                        onSegmentSelect(incident.location.lat, incident.location.lng);
                                    }
                                }}
                            />
                            )}
                        </div>
                    </section>

                    {/* Rental Vehicles Section */}
                    <section id="rentals" className="scroll-mt-32">
                        <div className="mb-8">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-1 h-8 rounded-full bg-gradient-to-b from-[#628141] to-[#E67E22]/30" />
                                <h2 className="text-2xl md:text-3xl font-display font-medium text-foreground">Rental Vehicles</h2>
                            </div>
                            <p className="text-muted-foreground mt-2 ml-[19px]">Smart vehicle recommendations for your trip profile</p>
                        </div>
                        <div className="glass-surface overflow-hidden p-4 md:p-8">
                            <RentalTab
                                metrics={metrics}
                                weatherData={weatherData}
                                start={start}
                                destination={destination}
                                depDate={depDate}
                                returnDate={rawReturnDate || returnDate}
                                depTime={depTime}
                                returnTime={rawReturnTime}
                            />
                        </div>
                    </section>

                    {/* Hotels / Stay Section */}
                    <section id="stay" className="scroll-mt-32">
                        <div className="mb-8">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-1 h-8 rounded-full bg-gradient-to-b from-[#E5D9B6] to-[#628141]/30" />
                                <h2 className="text-2xl md:text-3xl font-display font-medium text-foreground">Hotels</h2>
                            </div>
                            <p className="text-muted-foreground mt-2 ml-[19px]">Overnight stays matched to your route and budget</p>
                        </div>
                        <div className="glass-surface overflow-hidden p-4 md:p-8">
                            <StayTab
                                metrics={metrics}
                                start={start}
                                destination={destination}
                                depDate={depDate}
                                returnDate={rawReturnDate || returnDate}
                            />
                        </div>
                    </section>

                    </div> {/* end content column */}
                </div> {/* end split grid */}
            </div>
        </div>
    );
}
