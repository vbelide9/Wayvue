import { Clock, ChevronDown, ChevronUp } from "lucide-react";
import React from 'react';

interface Insight {
    offsetHours: number;
    time: string;
    score: number;
    label: string;
    precip: number;
    temp: number;
    trafficLabel?: string;
    ts?: number;
}

interface DeparturePlannerProps {
    insights: Insight[];
    unit?: 'C' | 'F';
    onSelect?: (offset: number) => void;
}

export function DeparturePlanner({ insights, unit = 'C' }: DeparturePlannerProps) {
    const [showDetails, setShowDetails] = React.useState(false);

    if (!insights || insights.length === 0) return null;

    return (
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2 mb-1">
                <Clock className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-foreground text-lg">Smart Departure</h3>
            </div>

            <p className="text-xs text-muted-foreground -mt-2 mb-2">
                Comparison of leaving within the next 3 hours.
            </p>

            <div className="grid grid-cols-3 gap-2">
                {insights.map((insight, idx) => {
                    // Color logic
                    const color = insight.score >= 80 ? "green" : insight.score >= 60 ? "yellow" : "red";
                    const isBest = idx === 0 || insights.every(i => i.score <= insight.score); // Simple "best" check logic

                    // Format time locally if timestamp is available
                    const localTime = insight.ts
                        ? new Date(insight.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                        : insight.time;

                    return (
                        <div
                            key={idx}
                            className={`
                                relative flex flex-col items-center p-3 rounded-lg border 
                                cursor-default transition-all hover:bg-white/5
                                ${color === 'green' ? 'bg-green-500/5 border-green-500/20' :
                                    color === 'yellow' ? 'bg-yellow-500/5 border-yellow-500/20' :
                                        'bg-red-500/5 border-red-500/20'}
                            `}
                        >
                            {/* Best Badge */}
                            {isBest && insight.score > 70 && (
                                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm border border-blue-400">
                                    Best
                                </span>
                            )}

                            <span className="text-xs font-mono text-muted-foreground mb-1">{localTime}</span>
                            <span className={`text-xl font-bold text-${color}-400`}>{insight.score}</span>
                            <span className={`text-[10px] uppercase font-bold text-${color}-500/80`}>{insight.label}</span>

                            {/* Tiny info */}
                            <div className="flex gap-2 mt-2 pt-2 border-t border-dashed border-white/10 w-full justify-center">
                                {insight.precip > 20 && (
                                    <span className="text-[9px] text-blue-300 font-medium">
                                        {insight.precip}% Rain
                                    </span>
                                )}
                                {insight.precip <= 20 && (
                                    <span className="text-[9px] text-green-300/60 font-medium">
                                        Clear
                                    </span>
                                )}
                            </div>

                            {/* Extended Details */}
                            {showDetails && (
                                <div className="mt-2 pt-2 border-t border-white/10 w-full text-center space-y-1 animate-in fade-in zoom-in-95">
                                    <div className="text-[10px] text-muted-foreground">
                                        Temp: <span className="text-foreground font-medium">
                                            {unit === 'F' ? Math.round(insight.temp * 9 / 5 + 32) : Math.round(insight.temp)}°{unit}
                                        </span>
                                    </div>
                                    <div className="text-[9px] text-muted-foreground/80">
                                        Traffic: {insight.trafficLabel || (insight.score < 70 ? 'Heavy' : 'Normal')}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="flex justify-end mt-1">
                <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors outline-none"
                >
                    {showDetails ? "Hide forecast details" : "See full forecast"}
                    {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
            </div>
        </div >
    );
}
