import { type ReactNode } from 'react';
import { TripHeader } from './TripHeader';
import { TripSidebar } from './TripSidebar';
import { type RoadCondition } from '@/components/RoadConditionCard';

interface TripViewLayoutProps {
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
    onSegmentSelect: (lat: number, lng: number) => void;

    // Slots
    map: ReactNode;
}

export function TripViewLayout({
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
    onSegmentSelect,
    map
}: TripViewLayoutProps) {

    const alertCount = roadConditions.filter(c => c.status !== 'good').length;

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground font-sans">

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
            />

            {/* 2. Main Content Area */}
            <div className="flex-1 flex overflow-hidden relative z-0">

                {/* Map Area (Flex Grow) */}
                <div className="flex-1 relative z-0 min-w-0 bg-background/5">
                    {map}

                    {/* Optional Overlay Weather Cards on Map Corner could go here if needed */}
                </div>

                {/* Right Sidebar (Fixed Width) */}
                <div className="hidden lg:flex w-[400px] shrink-0 border-l border-border bg-card z-20 shadow-xl h-full">
                    <TripSidebar
                        aiAnalysis={aiAnalysis}
                        recommendations={recommendations}
                        roadConditions={roadConditions}
                        weatherData={weatherData}
                        unit={unit}
                        onSegmentSelect={onSegmentSelect}
                    />
                </div>

                {/* Mobile Drawer Placeholder (if requested later) */}
            </div>
        </div>
    );
}
