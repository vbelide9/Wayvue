import { WeatherCard } from '@/components/WeatherCard';


interface ForecastTabProps {
    weatherData: any[];
    unit: 'C' | 'F';
}

export function ForecastTab({ weatherData, unit }: ForecastTabProps) {
    if (!weatherData || weatherData.length === 0) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                No weather data available for this route.
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-4 overflow-y-auto custom-scrollbar">
            <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider py-2 border-b border-border/50">
                Weather Context
            </h3>
            <div className="space-y-3">
                {weatherData.map((w, i) => (
                    <WeatherCard
                        key={i}
                        variant="card"
                        unit={unit}
                        weather={w}
                        type={i === 0 ? 'start' : i === weatherData.length - 1 ? 'destination' : 'waypoint'}
                    />
                ))}
            </div>
        </div>
    );
}

// Note: I used a simple div overflow instead of ScrollArea to match OverviewTab. 
// Can upgrade to shadcn ScrollArea if needed.
