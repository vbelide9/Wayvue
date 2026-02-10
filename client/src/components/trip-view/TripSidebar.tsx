import { useState } from 'react';
import { TripTabs, type TabId } from './TripTabs';
import { OverviewTab } from './tabs/OverviewTab';
import { ForecastTab } from './tabs/ForecastTab';
import { StopsTab } from './tabs/StopsTab';
import { RoadTab } from './tabs/RoadTab';
import { RentalTab } from './tabs/RentalTab';
import { type RoadCondition } from '@/components/RoadConditionCard';

interface TripSidebarProps {
    aiAnalysis: any;
    recommendations: any[];
    roadConditions: RoadCondition[];
    weatherData: any[];
    unit: 'C' | 'F';
    onSegmentSelect: (lat: number, lng: number) => void;
    activeLeg?: 'outbound' | 'return';
    hasReturn?: boolean;
    onLegChange?: (leg: 'outbound' | 'return') => void;
    metrics: any;
    // [NEW] Props for Deep Linking
    start?: string;
    destination?: string;
    depDate?: string;
    returnDate?: string;
    depTime?: string;
    returnTime?: string;
}

export function TripSidebar({
    aiAnalysis,
    recommendations,
    roadConditions,
    weatherData,
    unit,
    onSegmentSelect,
    activeLeg,
    hasReturn,
    onLegChange,
    metrics,
    // [NEW] Props for Deep Linking
    start,
    destination,
    depDate,
    returnDate,
    depTime,
    returnTime
}: TripSidebarProps) {
    const [activeTab, setActiveTab] = useState<TabId>('overview');

    const renderContent = () => {
        switch (activeTab) {
            case 'overview':
                // Check if aiAnalysis has the nested structure or direct structure.
                // In App.tsx we construct: fullAiAnalysis = { ...response.aiAnalysis, tripScore: ..., departureInsights: ... }
                // TripConfidenceCard expects score, etc. OverviewTab handles passing it down.
                // For now pass the whole object.
                // Note: aiAnalysis.tripScore might be an object { score, label, deductions } or just score?
                // Looking at App.tsx, response.tripScore is passed. 
                // Let's assume OverviewTab handles the parsing or verify OverviewTab props.
                // OverviewTab expects { tripScore, aiAnalysis }.
                // If aiAnalysis.tripScore exists and is an object, we should extract the score number.
                // Or if aiAnalysis.tripScore is the score number itself.

                // Let's pass the raw aiAnalysis and let OverviewTab handle specific fields if possible, 
                // but OverviewTab props are currently defined as { tripScore: number, aiAnalysis: any }.
                // We should pass explicit score if we have it.

                return <OverviewTab
                    tripScore={aiAnalysis?.tripScore?.score ?? aiAnalysis?.tripScore ?? 0}
                    aiAnalysis={aiAnalysis}
                />;
            case 'forecast':
                return <ForecastTab weatherData={weatherData} unit={unit} />;
            case 'stops':
                return <StopsTab recommendations={recommendations} />;
            case 'road':
                return <RoadTab
                    roadConditions={roadConditions}
                    onSegmentSelect={(condition) => {
                        if (condition.location) {
                            onSegmentSelect(condition.location.lat, condition.location.lon);
                        }
                    }}
                />;
            case 'rental':
                return <RentalTab
                    metrics={metrics}
                    weatherData={weatherData}
                    start={start}
                    destination={destination}
                    depDate={depDate}
                    returnDate={returnDate}
                    depTime={depTime}
                    returnTime={returnTime}
                />;
            default:
                return null;
        }
    };

    return (
        <div className="flex flex-col h-full bg-card/95 backdrop-blur-xl border-l border-border shadow-2xl z-20 overflow-hidden w-full lg:max-w-md">

            {/* Tabs Header */}
            <div className="flex flex-col border-b border-border bg-card/50">
                {/* Leg Switcher - Only if Round Trip */}
                {hasReturn && onLegChange && (
                    <div className="px-3 pt-3 pb-1">
                        <div className="flex items-center p-1 bg-background/40 rounded-lg border border-white/5">
                            <button
                                onClick={() => onLegChange('outbound')}
                                className={`flex-1 flex items-center justify-center py-1.5 px-3 rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-200 ${activeLeg === 'outbound'
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                                    }`}
                            >
                                Start Trip
                            </button>
                            <button
                                onClick={() => onLegChange('return')}
                                className={`flex-1 flex items-center justify-center py-1.5 px-3 rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-200 ${activeLeg === 'return'
                                    ? 'bg-[#E67E22] text-white shadow-sm' // Orange for Return leg distinctiveness
                                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                                    }`}
                            >
                                Return Trip
                            </button>
                        </div>
                    </div>
                )}

                <div className="p-3 pt-2">
                    <TripTabs activeTab={activeTab} onTabChange={setActiveTab} />
                </div>
            </div>

            {/* Tab Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {/* Use key to force re-render animation if desired, or keep same container */}
                <div key={activeTab} className="h-full animate-in fade-in slide-in-from-right-2 duration-300">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
}
