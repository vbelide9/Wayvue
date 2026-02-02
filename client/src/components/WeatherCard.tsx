import { Sun, Cloud, CloudRain, CloudSnow, Wind, Droplets, MapPin, ArrowUp, AlertTriangle, CheckCircle, AlertOctagon, Fuel } from "lucide-react"

interface WeatherData {
    location: string
    condition?: "clear" | "cloudy" | "rain" | "snow" | "fog"
    weathercode?: number
    temperature: number
    humidity: number
    windSpeed: number
    windDirection?: number
    precipitationProbability?: number
    eta?: string
    distanceFromStart?: number
    gasPrice?: string
}

interface WeatherCardProps {
    weather: WeatherData
    variant?: "card" | "chip" | "overlay"
    unit: "C" | "F"
    type?: "start" | "destination" | "waypoint"
}

export function WeatherCard({ weather, variant = "card", unit, type }: WeatherCardProps) {

    // Help map Open-Meteo codes to condition strings
    function mapCodeToCondition(code: number | undefined): "clear" | "cloudy" | "rain" | "snow" | "fog" {
        if (code === undefined || code === null) return "clear";
        if (code <= 3) return "clear";
        if (code <= 48) return "cloudy";
        if (code <= 67 || (code >= 80 && code <= 82)) return "rain";
        if (code <= 77 || (code >= 85 && code <= 86)) return "snow";
        return "clear";
    }

    // Determine values robustly
    const hasTemp = weather.temperature !== undefined && weather.temperature !== null;
    const displayTemp = hasTemp
        ? (unit.toUpperCase() === 'F'
            ? Math.round((weather.temperature * 9 / 5) + 32)
            : Math.round(weather.temperature))
        : "--";

    const condition = weather.condition || mapCodeToCondition(weather.weathercode);

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

    // Road Risk Badge Logic
    const getRoadRisk = (w: WeatherData) => {
        const code = w.weathercode || 0;
        const wind = w.windSpeed || 0;
        const precip = w.precipitationProbability || 0;
        const temp = w.temperature || 0; // assuming C for logic check, but might be raw

        // Hazard: Snow/Ice codes, heavy rain/thunder, or high wind
        if (
            [71, 73, 75, 77, 85, 86].includes(code) || // Snow
            [95, 96, 99].includes(code) || // Thunderstorm
            wind > 35
        ) {
            return { level: 'hazard', color: 'bg-red-500', text: 'Hazard', icon: AlertOctagon };
        }

        // Caution: Rain, Fog, Wind > 20, or near freezing
        if (
            [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code) || // Rain
            [45, 48].includes(code) || // Fog
            wind > 20 ||
            precip > 50 ||
            temp < 3
        ) {
            return { level: 'caution', color: 'bg-yellow-500', text: 'Caution', icon: AlertTriangle };
        }

        // Clear
        return { level: 'clear', color: 'bg-green-500', text: 'Clear', icon: CheckCircle };
    };

    // --- VARIANT: CHIP (Timeline) ---
    if (variant === "chip") {
        const risk = getRoadRisk(weather);
        const precip = weather.precipitationProbability ?? 0;
        const windDir = weather.windDirection ?? 0;

        return (
            <div className="flex flex-col min-w-[150px] rounded-xl bg-card border border-border hover:bg-white/5 transition-all cursor-default shadow-sm relative overflow-hidden group">

                <div className="p-3 pb-2">
                    {/* Header: ETA & Distance */}
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono text-muted-foreground font-medium tracking-tight">
                            {weather.eta || '--:--'}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground font-medium tracking-tight">
                            {weather.distanceFromStart !== undefined ? `${weather.distanceFromStart} mi` : ''}
                        </span>
                    </div>

                    {/* Main: Temp & Icon */}
                    <div className="flex items-center gap-3 mb-3">
                        {getIcon(condition, "w-8 h-8")}
                        <div className="flex flex-col">
                            <span className="text-2xl font-bold text-foreground leading-none">
                                {displayTemp}{hasTemp ? "°" : ""}
                            </span>
                            <span className="text-[10px] font-medium text-muted-foreground truncate max-w-[80px]" title={weather.location}>
                                {weather.location}
                            </span>
                        </div>
                    </div>

                    {/* Metrics: Signals (Wind & Precip) */}
                    <div className="grid grid-cols-3 gap-1 pt-2 border-t border-border/50 mb-1">
                        {/* Precip */}
                        <div className="flex items-center gap-1" title="Precipitation Probability">
                            {(unit === 'F' ? weather.temperature <= 32 : weather.temperature <= 0)
                                ? <CloudSnow className="w-3 h-3 text-white" />
                                : <Droplets className="w-3 h-3 text-blue-400" />
                            }
                            <span className="text-[10px] font-semibold text-foreground/80">{precip}%</span>
                        </div>
                        {/* Wind */}
                        <div className="flex items-center gap-1 justify-center" title="Wind Speed & Direction">
                            <div className="flex items-center">
                                <Wind className="w-3 h-3 text-foreground/50" />
                                <ArrowUp
                                    className="w-2.5 h-2.5 text-blue-400 -ml-0.5"
                                    style={{ transform: `rotate(${windDir}deg)` }}
                                />
                            </div>
                            <span className="text-[10px] font-semibold text-foreground/80">{Math.round(weather.windSpeed)}</span>
                        </div>
                        {/* Gas Price */}
                        <div className="flex items-center gap-1 justify-end" title="Est. Gas Price">
                            <Fuel className="w-4 h-4 text-orange-400" />
                            <span className="text-[10px] font-semibold text-foreground/80">${weather.gasPrice || '--'}</span>
                        </div>
                    </div>
                </div>

                {/* Footer: Risk Badge (Full Width) */}
                <div className={`mt-auto px-3 py-1.5 flex items-center justify-center gap-1.5 ${risk.color}/10 border-t border-${risk.color}/20`}>
                    <risk.icon className={`w-3 h-3 ${risk.color.replace('bg-', 'text-')}`} />
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${risk.color.replace('bg-', 'text-')}`}>
                        {risk.text}
                    </span>
                </div>
            </div>
        )
    }

    // --- VARIANT: OVERLAY (Map Corners) ---
    if (variant === "overlay") {
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
                        <span className="text-lg font-bold text-foreground">{displayTemp}{hasTemp ? "°" : ""}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">{condition}</span>
                    </div>
                </div>
            </div>
        )
    }

    // --- VARIANT: CARD (Default) ---
    return (
        <div className="bg-card border border-border rounded-xl p-3 sm:p-4 flex flex-col gap-2 shadow-sm">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-foreground text-lg truncate max-w-[150px]" title={weather.location}>
                        {weather.location}
                    </h3>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        {type === 'start' ? 'Start' : type === 'destination' ? 'Destination' : 'Forecast'}
                    </p>
                    {/* ETA & Distance Context */}
                    {(weather.eta || weather.distanceFromStart !== undefined) && (
                        <div className="flex items-center gap-2 mt-1">
                            {weather.eta && (
                                <span className="text-[11px] font-medium text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded-md">
                                    {weather.eta}
                                </span>
                            )}
                            {weather.distanceFromStart !== undefined && (
                                <span className="text-[11px] font-medium text-muted-foreground font-mono">
                                    {weather.distanceFromStart} mi
                                </span>
                            )}
                        </div>
                    )}
                </div>
                {getIcon(condition, "w-8 h-8")}
            </div>

            <div className="flex items-end gap-2 mt-1">
                <span className="font-bold text-foreground text-4xl">{displayTemp}{hasTemp ? "°" : ""}</span>
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
