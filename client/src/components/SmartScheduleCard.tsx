import { Clock } from "lucide-react";
import { AnalyticsService } from "@/services/analytics";

interface SmartScheduleCardProps {
    insights: {
        time: string;
        score: number;
        label: string;
        trafficLabel: string;
        offsetHours: number;
    }[];
}

export function SmartScheduleCard({ insights }: SmartScheduleCardProps) {
    if (!insights || insights.length === 0) return null;

    const handleAccept = (insight: any) => {
        AnalyticsService.trackInteraction('departure_accepted', {
            time: insight.time,
            score: insight.score,
            offset: insight.offsetHours
        });
        // In a real app, this might trigger a state change or search update
        // For now, we just track the intent/trust signal.
    };

    return (
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2 uppercase tracking-wider">
                <Clock className="w-4 h-4 text-primary" />
                Smart Schedule
            </h3>

            {/* Scrollable Container with Hidden Scrollbar */}
            <div className="flex gap-2 overflow-x-auto pb-0 scrollbar-none snap-x">
                {insights.map((insight, i) => (
                    <div
                        key={i}
                        onClick={() => handleAccept(insight)}
                        className={`
                            flex-none snap-center cursor-pointer hover:scale-105 active:scale-95
                            w-[100px] py-1.5 px-1 rounded-lg border flex flex-col items-center justify-center text-center transition-all
                            ${insight.score >= 80 ? 'bg-green-500/10 border-green-500/20' :
                                insight.score >= 60 ? 'bg-yellow-500/10 border-yellow-500/20' :
                                    'bg-red-500/10 border-red-500/20'}
                        `}
                    >
                        <span className="text-xs font-bold text-foreground mb-1">{insight.time}</span>

                        {/* Safety Score */}
                        <div className="flex flex-col items-center mb-1 w-full">
                            <span className="text-[7px] uppercase text-muted-foreground/70 font-bold tracking-widest mb-0.5">Safety</span>
                            <div className={`
                                px-2 py-0.5 rounded-md text-[10px] font-bold w-auto
                                ${insight.score >= 80 ? 'bg-green-500/20 text-green-500' :
                                    insight.score >= 60 ? 'bg-yellow-500/20 text-yellow-500' :
                                        'bg-red-500/20 text-red-500'}
                            `}>
                                {insight.score}%
                            </div>
                        </div>

                        {/* Traffic Status */}
                        <div className="flex flex-col items-center w-full">
                            <span className="text-[7px] uppercase text-muted-foreground/70 font-bold tracking-widest mb-0.5">Traffic</span>
                            <span className="text-[9px] text-foreground capitalize font-bold">
                                {insight.trafficLabel}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
