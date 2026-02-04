import { type ReactNode } from 'react';
import { TripHeader } from './TripHeader';
import { TripSidebar } from './TripSidebar';
import { type RoadCondition } from '@/components/RoadConditionCard';

import { LoadingScreen } from '@/components/LoadingScreen';

interface TripViewLayoutProps {
    isLoading?: boolean; // New prop
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
    roadConditions: RoadCondition[];
    weatherData: any[]; // Using any for weather data to match simplified types, can be strict later
    aiAnalysis: any;
    recommendations: any[];
    unit: 'C' | 'F';

    // Callbacks
    onBack: () => void;
    onUnitChange: (unit: 'C' | 'F') => void;
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
    onSegmentSelect: (lat: number, lng: number) => void;

    // Round Trip Props
    activeLeg?: 'outbound' | 'return';
    hasReturn?: boolean;
    routePreference?: 'fastest' | 'scenic';
    returnDate?: string; // New prop
    onLegChange?: (leg: 'outbound' | 'return') => void;

    // Slots
    map: ReactNode;
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
    hasReturn,
    routePreference,
    onLegChange,
    returnDate
}: TripViewLayoutProps) {

    console.log('[TripViewLayout] Render. hasReturn:', hasReturn, 'activeLeg:', activeLeg);

    const alertCount = roadConditions.filter(c => c.status !== 'good').length;

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground font-sans relative">
            {/* Loading Overlay */}
            {isLoading && <LoadingScreen title="Updating your journey" />}

            {/* 1. Header (Compact) */}
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
                isRoundTrip={hasReturn}
                routePreference={routePreference}
                returnDate={returnDate}
                activeLeg={activeLeg}
                onLegChange={onLegChange}
            />



            {/* 2. Main Content Area */}
            <div className={`flex-1 flex flex-col lg:flex-row overflow-hidden relative z-0 ${isLoading ? 'opacity-20 pointer-events-none filter blur-sm transition-all duration-300' : ''}`}>

                {/* Map Area (Grow on Desktop, 45% height on Mobile) */}
                <div className="relative z-0 min-w-0 bg-background/5 h-[45%] lg:h-auto lg:flex-1 w-full lg:w-auto order-1 lg:order-1">
                    {map}

                    {/* Optional Overlay Weather Cards on Map Corner could go here if needed */}
                </div>

                {/* Right Sidebar (Fixed Width on Desktop, Fill remaning on Mobile) */}
                <div className="flex flex-col w-full h-[55%] lg:w-[400px] lg:h-full shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-card z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] lg:shadow-xl order-2 lg:order-2 rounded-t-3xl lg:rounded-none overflow-hidden relative">

                    {/* Mobile Drag Handle Indicator */}
                    <div className="lg:hidden absolute top-0 left-0 right-0 h-6 flex items-center justify-center pointer-events-none z-30 bg-card/50 backdrop-blur-sm">
                        <div className="w-12 h-1.5 bg-muted rounded-full opacity-50" />
                    </div>
                    {/* Sidebar (Tabs) - Fixed Width on Desktop, Bottom Sheet on Mobile */}
                    <TripSidebar
                        aiAnalysis={aiAnalysis}
                        recommendations={recommendations}
                        roadConditions={roadConditions}
                        weatherData={weatherData}
                        unit={unit}
                        onSegmentSelect={onSegmentSelect}
                        activeLeg={activeLeg}
                        hasReturn={hasReturn}
                        onLegChange={onLegChange}
                    />
                </div>

                {/* Mobile Drawer Placeholder (if requested later) */}
            </div>
        </div>
    );
}
