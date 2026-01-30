import { Sun, Cloud, CloudRain, CloudSnow, Wind, Droplets } from "lucide-react"

interface WeatherData {
    location: string
    condition: "clear" | "cloudy" | "rain" | "snow" | "fog"
    temperature: number
    humidity: number
    windSpeed: number
}

interface WeatherCardProps {
    weather: WeatherData
    type: "start" | "destination" | "waypoint"
    unit: "C" | "F"
    size?: "default" | "compact"
}

export function WeatherCard({ weather, type, unit, size = "default" }: WeatherCardProps) {
    const isCompact = size === "compact";

    const getIcon = (condition: string) => {
        const iconClass = isCompact ? "w-6 h-6" : "w-8 h-8";
        switch (condition) {
            case "clear": return <Sun className={`${iconClass} text-yellow-500`} />
            case "cloudy": return <Cloud className={`${iconClass} text-gray-400`} />
            case "rain": return <CloudRain className={`${iconClass} text-blue-400`} />
            case "snow": return <CloudSnow className={`${iconClass} text-white`} />
            default: return <Sun className={`${iconClass} text-yellow-500`} />
        }
    }

    const getLabel = () => {
        if (type === "start") return "Starting Conditions"
        if (type === "destination") return "Destination Forecast"
        return weather.location // For waypoints, location is "Mile X"
    }

    const displayTemp = unit === 'F'
        ? Math.round((weather.temperature * 9 / 5) + 32)
        : Math.round(weather.temperature);

    return (
        <div className={`bg-card border border-border rounded-xl flex flex-col ${isCompact ? 'p-3 gap-2' : 'p-4 gap-3'}`}>
            <div className="flex justify-between items-start">
                <div>
                    {!isCompact && (
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                            {getLabel()}
                        </p>
                    )}
                    <h3 className={`font-bold text-foreground truncate ${isCompact ? 'text-sm max-w-[100px]' : 'text-lg max-w-[120px]'}`} title={weather.location}>
                        {type !== 'waypoint' ? weather.location : 'En Route'}
                    </h3>
                    {isCompact && (
                        <p className="text-[10px] text-muted-foreground uppercase">{getLabel()}</p>
                    )}
                </div>
                {getIcon(weather.condition)}
            </div>

            <div className={`flex items-end gap-2 ${isCompact ? 'mt-0' : 'mt-1'}`}>
                <span className={`font-bold text-foreground ${isCompact ? 'text-2xl' : 'text-4xl'}`}>{displayTemp}°</span>
                <span className="text-sm font-medium text-muted-foreground mb-1.5">{unit}</span>
                {!isCompact && <span className="text-sm font-medium text-muted-foreground mb-1.5 capitalize ml-auto">{weather.condition}</span>}
            </div>

            <div className={`grid grid-cols-2 gap-2 border-t border-border/50 ${isCompact ? 'pt-2 mt-1' : 'pt-3 mt-2'}`}>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Wind className="w-3.5 h-3.5" />
                    <span>{weather.windSpeed} <span className="scale-75 inline-block origin-left">mph</span></span>
                </div>
                {!isCompact && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Droplets className="w-3.5 h-3.5" />
                        <span>{weather.humidity}%</span>
                    </div>
                )}
                {isCompact && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Droplets className="w-3.5 h-3.5" />
                        <span>{weather.humidity}%</span>
                    </div>
                )}
            </div>
        </div>
    )
}
