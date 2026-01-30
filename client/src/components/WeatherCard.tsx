import { Sun, Cloud, CloudRain, CloudSnow, Wind, Droplets, MapPin } from "lucide-react"

interface WeatherData {
    location: string
    condition: "clear" | "cloudy" | "rain" | "snow" | "fog"
    temperature: number
    humidity: number
    windSpeed: number
}

interface WeatherCardProps {
    weather: WeatherData
    variant?: "card" | "chip" | "overlay"
    unit: "C" | "F"
    type?: "start" | "destination" | "waypoint"
}

export function WeatherCard({ weather, variant = "card", unit, type }: WeatherCardProps) {

    // Help map Open-Meteo codes to condition strings
    function mapCodeToCondition(code: number): "clear" | "cloudy" | "rain" | "snow" | "fog" {
        if (code === undefined || code === null) return "clear";
        if (code <= 3) return "clear";
        if (code <= 48) return "cloudy";
        if (code <= 67 || (code >= 80 && code <= 82)) return "rain";
        if (code <= 77 || (code >= 85 && code <= 86)) return "snow";
        return "clear";
    }

    // Determine values robustly
    const displayTemp = unit.toUpperCase() === 'F'
        ? Math.round(((weather.temperature || 0) * 9 / 5) + 32)
        : Math.round(weather.temperature || 0);

    const condition = weather.condition || mapCodeToCondition((weather as any).weathercode);

    // Icon Helper
    const getIcon = (cond: string, sizeClass: string) => {
        switch (cond) {
            case "clear": return <Sun className={`${sizeClass} text-yellow-500`} />
            case "cloudy": return <Cloud className={`${sizeClass} text-gray-400`} />
            case "rain": return <CloudRain className={`${sizeClass} text-blue-400`} />
            case "snow": return <CloudSnow className={`${sizeClass} text-white`} />
            default: return <Sun className={`${sizeClass} text-yellow-500`} />
        }
    }

    // --- VARIANT: CHIP (Timeline) ---
    if (variant === "chip") {
        return (
            <div className="flex flex-col items-center justify-center min-w-[100px] p-2 rounded-xl bg-card border border-border hover:bg-white/5 transition-all cursor-default shadow-sm">
                <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-tighter mb-1 text-center truncate w-full px-1">
                    {weather.location}
                </span>
                {getIcon(condition, "w-6 h-6 mb-1")}
                <span className="font-bold text-foreground text-sm">
                    {displayTemp}°
                </span>
            </div>
        )
    }

    // --- VARIANT: OVERLAY (Map Corners) ---
    if (variant === "overlay") {
        const isStart = type === "start"
        return (
            <div className="bg-background/90 backdrop-blur-md border border-border shadow-2xl rounded-xl p-3 flex items-center gap-3 min-w-[140px]">
                <div className="p-2 rounded-full bg-secondary/50">
                    {getIcon(condition, "w-5 h-5")}
                </div>
                <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                        <MapPin className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs font-semibold text-foreground truncate max-w-[100px] block">
                            {weather.location}
                        </span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-lg font-bold text-foreground">{displayTemp}°</span>
                        <span className="text-[10px] text-muted-foreground uppercase">{condition}</span>
                    </div>
                </div>
            </div>
        )
    }

    // --- VARIANT: CARD (Default) ---
    return (
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-foreground text-lg truncate max-w-[150px]" title={weather.location}>
                        {weather.location}
                    </h3>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        {type === 'start' ? 'Start' : type === 'destination' ? 'Destination' : 'Forecast'}
                    </p>
                </div>
                {getIcon(condition, "w-8 h-8")}
            </div>

            <div className="flex items-end gap-2 mt-1">
                <span className="font-bold text-foreground text-4xl">{displayTemp}°</span>
                <span className="text-sm font-medium text-muted-foreground mb-1.5">{unit.toUpperCase()}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-border/50 pt-3 mt-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Wind className="w-3.5 h-3.5" />
                    <span>{weather.windSpeed || 0} mph</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Droplets className="w-3.5 h-3.5" />
                    <span>{weather.humidity || 0}%</span>
                </div>
            </div>
        </div>
    )
}
