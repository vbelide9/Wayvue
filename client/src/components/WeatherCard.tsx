import { Sun, Cloud, CloudRain, CloudSnow, Wind, Droplets, MapPin, ArrowUp, AlertTriangle, CheckCircle, AlertOctagon, Fuel } from "lucide-react"
import { motion } from "framer-motion";

interface WeatherData {
    location: string
    state?: string | null
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

    // Show "City, ST" when we have a state; avoid duplicating it if the location
    // string already ends with the abbreviation (e.g. "Oakdale, PA").
    const locationLabel = weather.state && !new RegExp(`,\\s*${weather.state}$`, 'i').test(weather.location)
        ? `${weather.location}, ${weather.state}`
        : weather.location;

    // weather.eta already arrives pre-labeled (e.g. "ETA 12:58 PM") — strip any
    // existing prefix so our own "ETA" label is never duplicated.
    const etaTime = weather.eta?.replace(/^ETA\s*/i, '');

    // Icon Helper
    const getIcon = (cond: string, sizeClass: string) => {
        switch (cond) {
            case "clear": return <Sun className={`${sizeClass} text-yellow-600 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]`} />
            case "cloudy": return <Cloud className={`${sizeClass} text-slate-300 drop-shadow-[0_0_10px_rgba(203,213,225,0.4)]`} />
            case "rain": return <CloudRain className={`${sizeClass} text-blue-600 drop-shadow-[0_0_10px_rgba(96,165,250,0.5)]`} />
            case "snow": return <CloudSnow className={`${sizeClass} text-foreground drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]`} />
            default: return <Sun className={`${sizeClass} text-yellow-600`} />
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
            return { level: 'hazard', color: 'bg-red-500', text: 'Hazard', icon: AlertOctagon, textColor: 'text-red-600' };
        }

        // Caution: Rain, Fog, Wind > 20, or near freezing
        if (
            [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code) || // Rain
            [45, 48].includes(code) || // Fog
            wind > 20 ||
            precip > 50 ||
            temp < 3
        ) {
            return { level: 'caution', color: 'bg-yellow-500', text: 'Caution', icon: AlertTriangle, textColor: 'text-yellow-600' };
        }

        // Clear
        return { level: 'clear', color: 'bg-emerald-500', text: 'Clear', icon: CheckCircle, textColor: 'text-emerald-600' };
    };

    // --- VARIANT: CHIP (Timeline) ---
    if (variant === "chip") {
        const risk = getRoadRisk(weather);
        const precip = weather.precipitationProbability ?? 0;
        const windDir = weather.windDirection ?? 0;

        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="flex flex-col min-w-[160px] rounded-[2rem] bg-card border border-border shadow-soft hover:bg-secondary/40 transition-colors cursor-pointer group relative overflow-hidden"
            >
                {/* Subtle Hover Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                <div className="p-4 pb-3">
                    {/* Header: ETA & Distance */}
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-mono text-primary font-bold tracking-tight bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                            {weather.eta || '--:--'}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground font-bold tracking-wider uppercase">
                            {weather.distanceFromStart !== undefined ? `${weather.distanceFromStart} mi` : ''}
                        </span>
                    </div>

                    {/* Main: Temp & Icon */}
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-2 bg-background/50 rounded-xl shadow-inner border border-border">
                            {getIcon(condition, "w-10 h-10")}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-3xl font-black text-foreground tracking-tighter">
                                {displayTemp}{hasTemp ? "°" : ""}
                            </span>
                            <span className="text-xs font-semibold text-muted-foreground truncate max-w-[90px] mt-0.5" title={locationLabel}>
                                {locationLabel}
                            </span>
                        </div>
                    </div>

                    {/* Metrics: Signals (Wind & Precip) */}
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border mb-1">
                        {/* Precip */}
                        <div className="flex flex-col items-center gap-1" title="Precipitation Probability">
                            {(unit === 'F' ? weather.temperature <= 32 : weather.temperature <= 0)
                                ? <CloudSnow className="w-4 h-4 text-foreground/80" />
                                : <Droplets className="w-4 h-4 text-blue-600/90" />
                            }
                            <span className="text-[10px] font-bold text-foreground">{precip}%</span>
                        </div>
                        {/* Wind */}
                        <div className="flex flex-col items-center gap-1" title="Wind Speed & Direction">
                            <div className="flex items-center">
                                <Wind className="w-4 h-4 text-foreground/50" />
                            </div>
                            <span className="text-[10px] font-bold text-foreground flex items-center gap-0.5">
                                {Math.round(weather.windSpeed)}
                                <ArrowUp
                                    className="w-2.5 h-2.5 text-blue-600"
                                    style={{ transform: `rotate(${windDir}deg)` }}
                                />
                            </span>
                        </div>
                        <div className="flex flex-col items-center gap-1" title="Est. Gas Price">
                            <Fuel className="w-4 h-4 text-orange-600/90" />
                            <span className="text-[10px] font-bold text-foreground">${weather.gasPrice || '--'}</span>
                        </div>
                    </div>
                </div>

                {/* Footer: Risk Badge (Full Width) */}
                <div className={`mt-auto px-4 py-2.5 flex items-center justify-center gap-2 ${risk.color}/10 border-t border-${risk.color}/20 backdrop-blur-md relative z-10`}>
                    <risk.icon className={`w-3.5 h-3.5 ${risk.textColor}`} />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${risk.textColor}`}>
                        {risk.text}
                    </span>
                </div>
            </motion.div>
        )
    }

    // --- VARIANT: OVERLAY (Map Corners) ---
    if (variant === "overlay") {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-card border border-border shadow-soft rounded-[2rem] p-4 flex items-center gap-4 min-w-[160px] pointer-events-auto"
            >
                <div className="p-3 rounded-full bg-gradient-to-br from-background to-secondary/50 shadow-inner border border-border">
                    {getIcon(condition, "w-6 h-6")}
                </div>
                <div>
                    <div className="flex items-center gap-1.5 mb-1">
                        <MapPin className="w-3.5 h-3.5 text-primary" />
                        <span className="text-xs font-bold text-foreground truncate max-w-[120px] block tracking-wide">
                            {locationLabel}
                        </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-foreground tracking-tighter">{displayTemp}{hasTemp ? "°" : ""}</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{condition}</span>
                    </div>
                </div>
            </motion.div>
        )
    }

    // --- VARIANT: CARD (Default) — compact single-row layout so a full route's
    // worth of stops fits without excessive scrolling, while keeping every metric.
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            className="bg-card border border-border rounded-2xl px-4 py-3 flex flex-col gap-2.5 shadow-soft transition-colors duration-300 hover:border-primary/30"
        >
            <div className="flex items-center gap-3">
                <div className="p-2 bg-secondary/50 rounded-xl border border-border shrink-0">
                    {getIcon(condition, "w-6 h-6")}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                        <h3 className="font-bold text-foreground text-sm truncate" title={locationLabel}>
                            {locationLabel}
                        </h3>
                        <span className="text-[9px] font-black text-primary uppercase tracking-wider opacity-80 shrink-0">
                            {type === 'start' ? 'Start' : type === 'destination' ? 'Dest' : 'Stop'}
                        </span>
                    </div>
                    {(etaTime || weather.distanceFromStart !== undefined) && (
                        <p className="text-[10px] font-mono text-muted-foreground truncate">
                            {etaTime && <span><span className="text-primary">ETA</span> {etaTime}</span>}
                            {etaTime && weather.distanceFromStart !== undefined && ' · '}
                            {weather.distanceFromStart !== undefined && `${weather.distanceFromStart} mi`}
                        </p>
                    )}
                </div>

                <div className="flex items-baseline gap-0.5 shrink-0">
                    <span className="font-black text-foreground text-2xl leading-none tracking-tighter">
                        {displayTemp}{hasTemp ? "°" : ""}
                    </span>
                    <span className="text-xs font-bold text-muted-foreground">{unit.toUpperCase()}</span>
                </div>
            </div>

            {/* Compact metrics row */}
            <div className="flex items-center gap-3 pt-2 border-t border-border/60 text-xs font-semibold text-foreground/80">
                <span className="flex items-center gap-1.5" title="Wind speed">
                    <Wind className="w-3.5 h-3.5 text-blue-600" />
                    {weather.windSpeed || 0}<span className="text-[10px] text-muted-foreground font-normal">mph</span>
                </span>
                <span className="flex items-center gap-1.5" title="Humidity">
                    <Droplets className="w-3.5 h-3.5 text-cyan-600" />
                    {weather.humidity || 0}<span className="text-[10px] text-muted-foreground font-normal">%</span>
                </span>
                {weather.gasPrice && (
                    <span className="flex items-center gap-1.5" title="Est. gas price">
                        <Fuel className="w-3.5 h-3.5 text-orange-600" />
                        ${weather.gasPrice}
                    </span>
                )}
            </div>
        </motion.div>
    )
}
