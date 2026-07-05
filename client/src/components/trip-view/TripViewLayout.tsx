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

interface TripViewLayoutProps {
    isLoading?: boolean;
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

export function TripViewLayout({
    isLoading,
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

                {/* 1. Hero Section */}
                <div className="relative min-h-[70vh] flex flex-col items-center pt-12 pb-32 w-full">
                    <ThreeGlobeBackground />

                    {/* Warm ambient glow overlays */}
                    <div className="absolute inset-0 pointer-events-none z-[1]">
                        <div className="absolute top-[15%] left-[10%] w-[500px] h-[500px] rounded-full bg-[#628141]/[0.08] blur-[150px]" />
                        <div className="absolute top-[30%] right-[15%] w-[400px] h-[400px] rounded-full bg-[#E67E22]/[0.06] blur-[130px]" />
                        <div className="absolute bottom-[10%] left-[40%] w-[350px] h-[350px] rounded-full bg-[#40513B]/[0.1] blur-[120px]" />
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

                    {/* Premium Glass Map Container */}
                    <div className="relative z-10 w-full max-w-7xl mx-auto px-4 mt-8 h-[40vh] md:h-[50vh]">
                        <div className="w-full h-full rounded-3xl overflow-hidden border border-[#628141]/20 shadow-[0_8px_32px_rgba(64,81,59,0.15),0_0_0_1px_rgba(98,129,65,0.1)] bg-[#111D14]/60 backdrop-blur-xl">
                            {map}
                        </div>
                    </div>
                </div>

                {/* 2. Top-Center Floating Category Navigation */}
                <div className="sticky top-4 z-[500] pointer-events-none w-full flex justify-center mt-[-2rem] mb-8">
                    <div className="pointer-events-auto shadow-2xl rounded-full">
                        <TopCategoryNav activeSection={activeSection} onNavigate={scrollToSection} />
                    </div>
                </div>

                {/* 3. Vertical Sections Container */}
                <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 pb-64 flex flex-col gap-40 relative z-10">

                    {/* Overview Section */}
                    <section id="overview" className="scroll-mt-32">
                        <div className="mb-8">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-1 h-8 rounded-full bg-gradient-to-b from-[#628141] to-[#628141]/30" />
                                <h2 className="text-4xl font-display font-medium text-foreground">Overview</h2>
                            </div>
                            <p className="text-muted-foreground mt-2 ml-[19px]">AI-powered journey confidence and insights</p>
                        </div>
                        <div className="bg-[#111D14]/60 backdrop-blur-xl border border-[#628141]/15 rounded-3xl overflow-hidden shadow-[0_8px_32px_rgba(64,81,59,0.12)] p-4 md:p-8">
                            <OverviewTab
                                tripScore={aiAnalysis?.tripScore?.score ?? aiAnalysis?.tripScore ?? 0}
                                aiAnalysis={aiAnalysis}
                            />
                        </div>
                    </section>

                    {/* Weather Forecast Section */}
                    <section id="weather" className="scroll-mt-32">
                        <div className="mb-8">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-1 h-8 rounded-full bg-gradient-to-b from-[#E67E22] to-[#E67E22]/30" />
                                <h2 className="text-4xl font-display font-medium text-foreground">Weather Forecast</h2>
                            </div>
                            <p className="text-muted-foreground mt-2 ml-[19px]">Local forecasts along your route</p>
                        </div>
                        <div className="bg-[#111D14]/60 backdrop-blur-xl border border-[#628141]/15 rounded-3xl overflow-hidden shadow-[0_8px_32px_rgba(64,81,59,0.12)] p-4 md:p-8">
                            <ForecastTab weatherData={weatherData} unit={unit} />
                        </div>
                    </section>

                    {/* Stops Section */}
                    <section id="stops" className="scroll-mt-32">
                        <div className="mb-8">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-1 h-8 rounded-full bg-gradient-to-b from-[#E5D9B6] to-[#E5D9B6]/30" />
                                <h2 className="text-4xl font-display font-medium text-foreground">Stops</h2>
                            </div>
                            <p className="text-muted-foreground mt-2 ml-[19px]">Recommended stops, dining, and accommodations along the route</p>
                        </div>
                        <div className="bg-[#111D14]/60 backdrop-blur-xl border border-[#628141]/15 rounded-3xl overflow-hidden shadow-[0_8px_32px_rgba(64,81,59,0.12)] min-h-[400px]">
                            <StopsTab recommendations={recommendations} />
                        </div>
                    </section>

                    {/* Road Conditions Section */}
                    <section id="road" className="scroll-mt-32">
                        <div className="mb-8">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-1 h-8 rounded-full bg-gradient-to-b from-amber-500 to-amber-500/30" />
                                <h2 className="text-4xl font-display font-medium text-foreground">Road Conditions</h2>
                            </div>
                            <p className="text-muted-foreground mt-2 ml-[19px]">Alerts and driving logistics for your destination</p>
                        </div>
                        <div className="bg-[#111D14]/60 backdrop-blur-xl border border-[#628141]/15 rounded-3xl overflow-hidden shadow-[0_8px_32px_rgba(64,81,59,0.12)]">
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
                        </div>
                    </section>

                    {/* Rental Vehicles Section */}
                    <section id="rentals" className="scroll-mt-32">
                        <div className="mb-8">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-1 h-8 rounded-full bg-gradient-to-b from-[#628141] to-[#E67E22]/30" />
                                <h2 className="text-4xl font-display font-medium text-foreground">Rental Vehicles</h2>
                            </div>
                            <p className="text-muted-foreground mt-2 ml-[19px]">Smart vehicle recommendations for your trip profile</p>
                        </div>
                        <div className="bg-[#111D14]/60 backdrop-blur-xl border border-[#628141]/15 rounded-3xl overflow-hidden shadow-[0_8px_32px_rgba(64,81,59,0.12)] p-4 md:p-8">
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
                                <h2 className="text-4xl font-display font-medium text-foreground">Hotels</h2>
                            </div>
                            <p className="text-muted-foreground mt-2 ml-[19px]">Overnight stays matched to your route and budget</p>
                        </div>
                        <div className="bg-[#111D14]/60 backdrop-blur-xl border border-[#628141]/15 rounded-3xl overflow-hidden shadow-[0_8px_32px_rgba(64,81,59,0.12)] p-4 md:p-8">
                            <StayTab
                                metrics={metrics}
                                start={start}
                                destination={destination}
                                depDate={depDate}
                                returnDate={rawReturnDate || returnDate}
                            />
                        </div>
                    </section>

                </div>
            </div>
        </div>
    );
}
