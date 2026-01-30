import { Clock, Fuel, AlertTriangle, Route } from "lucide-react"

interface RouteSummaryProps {
    totalDistance: string
    totalTime: string
    fuelEstimate: string
    alerts: number
    loading?: boolean
}

export function RouteSummary({ totalDistance, totalTime, fuelEstimate, alerts, loading }: RouteSummaryProps) {
    if (loading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-card/30 rounded-xl border border-border/50 animate-pulse">
                <div className="h-10 bg-white/10 rounded"></div>
                <div className="h-10 bg-white/10 rounded"></div>
                <div className="h-10 bg-white/10 rounded"></div>
                <div className="h-10 bg-white/10 rounded"></div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card p-4 rounded-xl border border-border flex items-center gap-3">
                <div className="p-2 bg-secondary/20 rounded-lg text-secondary-foreground">
                    <Route className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-xs text-muted-foreground font-medium">Distance</p>
                    <p className="text-lg font-bold text-foreground">{totalDistance}</p>
                </div>
            </div>

            <div className="bg-card p-4 rounded-xl border border-border flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-lg text-primary">
                    <Clock className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-xs text-muted-foreground font-medium">Est. Time</p>
                    <p className="text-lg font-bold text-foreground">{totalTime}</p>
                </div>
            </div>

            <div className="bg-card p-4 rounded-xl border border-border flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                    <Fuel className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-xs text-muted-foreground font-medium">Est. Fuel</p>
                    <p className="text-lg font-bold text-foreground">{fuelEstimate}</p>
                </div>
            </div>

            <div className="bg-card p-4 rounded-xl border border-border flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-lg text-red-400">
                    <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-xs text-muted-foreground font-medium">Alerts</p>
                    <p className="text-lg font-bold text-foreground">{alerts} Report{alerts !== 1 ? 's' : ''}</p>
                </div>
            </div>
        </div>
    )
}
