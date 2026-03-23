import { useEffect, useState, useRef } from 'react';
import { TripHeader } from './TripHeader';
import { type RoadCondition } from '@/components/RoadConditionCard';
import { LoadingScreen } from '@/components/LoadingScreen';
import { OverviewTab } from './tabs/OverviewTab';
import { ForecastTab } from './tabs/ForecastTab';
import { StopsTab } from './tabs/StopsTab';
import { RoadTab } from './tabs/RoadTab';
import { RentalTab } from './tabs/RentalTab';
import { TopCategoryNav } from '../TopCategoryNav';
import { ThreeGlobeBackground } from '../ThreeGlobeBackground';

interface TripViewLayoutProps {
    isLoading?: boolean;
    start: string;
    destination: string;
    metrics: { distance: string; time: string; fuel: string; ev: string; };
    tripScore?: { score: number; label: string; };
    roadConditions: RoadCondition[];
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
    const [activeSection, setActiveSection] = useState('experiences');
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Provide scroll spy functionality
    useEffect(() => {
        const handleScroll = () => {
            if (!scrollContainerRef.current) return;
            const sections = ['hotels', 'rentals', 'experiences', 'destinations'];
            let current = 'experiences'; // default top visible initially below hero

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

    const alertCount = roadConditions.filter(c => c.status !== 'good').length;

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground font-sans relative">
            {isLoading && <LoadingScreen title="Updating your journey" />}

            {/* Main scrollable container */}
            <div ref={scrollContainerRef} className={`flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth ${isLoading ? 'opacity-20 pointer-events-none filter blur-sm transition-all duration-300' : ''}`}>

                {/* 1. Hero Section */}
                <div className="relative min-h-[70vh] flex flex-col items-center pt-12 pb-32 w-full">
                    <ThreeGlobeBackground />

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
                        <div className="w-full h-full rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-card/40 backdrop-blur-xl">
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

                    {/* Experiences Section (AI Insights & Weather) */}
                    <section id="experiences" className="scroll-mt-32">
                        <div className="mb-8">
                            <h2 className="text-4xl font-display font-medium text-foreground">Experiences & Insights</h2>
                            <p className="text-muted-foreground mt-2">AI-powered journey confidence and local forecasts</p>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <OverviewTab
                                    tripScore={aiAnalysis?.tripScore?.score ?? aiAnalysis?.tripScore ?? 0}
                                    aiAnalysis={aiAnalysis}
                                />
                            </div>
                            <div className="bg-card/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                                <ForecastTab weatherData={weatherData} unit={unit} />
                            </div>
                        </div>
                    </section>

                    {/* Rental Cars Section */}
                    <section id="rentals" className="scroll-mt-32">
                        <div className="mb-8">
                            <h2 className="text-4xl font-display font-medium text-foreground">Rental Cars</h2>
                            <p className="text-muted-foreground mt-2">Smart vehicle recommendations for your trip profile</p>
                        </div>
                        <div className="bg-card/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl p-4 md:p-8">
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

                    {/* Hotels & Stops Section */}
                    <section id="hotels" className="scroll-mt-32">
                        <div className="mb-8">
                            <h2 className="text-4xl font-display font-medium text-foreground">Hotels & Places</h2>
                            <p className="text-muted-foreground mt-2">Recommended stops, dining, and accommodations along the route</p>
                        </div>
                        <div className="bg-card/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl min-h-[400px]">
                            <StopsTab recommendations={recommendations} />
                        </div>
                    </section>

                    {/* Destinations & Road Info Section */}
                    <section id="destinations" className="scroll-mt-32">
                        <div className="mb-8">
                            <h2 className="text-4xl font-display font-medium text-foreground">Route & Road Conditions</h2>
                            <p className="text-muted-foreground mt-2">Alerts and driving logistics for your destination</p>
                        </div>
                        <div className="bg-card/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                            <RoadTab
                                roadConditions={roadConditions}
                                onSegmentSelect={(condition) => {
                                    if (condition.location) {
                                        onSegmentSelect(condition.location.lat, condition.location.lon);
                                    }
                                }}
                            />
                        </div>
                    </section>

                </div>
            </div>
        </div>
    );
}
