import { ChevronLeft, Navigation, Clock, Shield, ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TripHeaderProps {
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
    alertCount: number;
    unit: 'C' | 'F';
    onUnitChange: (unit: 'C' | 'F') => void;
    onBack: () => void;
}

export function TripHeader({ start, destination, metrics, tripScore, alertCount, unit, onUnitChange, onBack }: TripHeaderProps) {
    return (
        <div className="flex items-center justify-between px-4 py-3 bg-card/80 backdrop-blur-md border-b border-border z-50">

            {/* Left: Back & Route */}
            <div className="flex items-center gap-3 min-w-0">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                    onClick={onBack}
                >
                    <ChevronLeft className="w-5 h-5" />
                </Button>

                <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground truncate">
                        <span className="truncate max-w-[120px] sm:max-w-none">{start}</span>
                        <span className="text-muted-foreground">to</span>
                        <span className="truncate max-w-[120px] sm:max-w-none">{destination}</span>
                    </div>
                </div>
            </div>

            {/* Right: Metrics Chips & Actions */}
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-none pl-4 shrink-0">

                {/* Metric: Time & Distance */}
                <div className="flex items-center gap-3 px-3 py-1.5 bg-secondary/50 rounded-full border border-border/50">
                    <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-xs font-bold">{metrics.time}</span>
                    </div>
                    <div className="w-px h-3 bg-border" />
                    <div className="flex items-center gap-1.5">
                        <Navigation className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-foreground">{metrics.distance}</span>
                    </div>
                </div>

                {/* Metric: Score */}
                {tripScore && (
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/50 ${tripScore.score >= 80 ? 'bg-green-500/10 text-green-600' :
                        tripScore.score >= 60 ? 'bg-yellow-500/10 text-yellow-600' :
                            'bg-red-500/10 text-red-600'
                        }`}>
                        {tripScore.score >= 80 ? <ShieldCheck className="w-3.5 h-3.5" /> :
                            tripScore.score >= 60 ? <Shield className="w-3.5 h-3.5" /> :
                                <ShieldAlert className="w-3.5 h-3.5" />}
                        <span className="text-xs font-bold">{tripScore.score}% Safe</span>
                    </div>
                )}

                {/* Metric: Alerts (Only if exists) */}
                {alertCount > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-500 rounded-full border border-amber-500/20">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold">{alertCount}</span>
                    </div>
                )}

                <div className="h-6 w-px bg-border/50 mx-1" />

                {/* Unit Toggle */}
                <div className="flex items-center bg-secondary/30 rounded-lg p-0.5 border border-border/50">
                    <button
                        onClick={() => onUnitChange('C')}
                        className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all ${unit === 'C' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        °C
                    </button>
                    <button
                        onClick={() => onUnitChange('F')}
                        className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all ${unit === 'F' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        °F
                    </button>
                </div>
            </div>
        </div>
    );
}
