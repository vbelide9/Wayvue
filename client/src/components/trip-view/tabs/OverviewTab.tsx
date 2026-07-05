import { TripConfidenceCard } from "@/components/TripConfidenceCard";
import { WayvueAISummary } from "@/components/WayvueAISummary";
import { SmartScheduleCard } from "@/components/SmartScheduleCard";
import { Fuel, Zap, CircleDollarSign, ShieldCheck, AlertTriangle, Clock } from "lucide-react";

interface OverviewTabProps {
    tripScore: number;
    aiAnalysis: any;
    metrics?: { distance: string; time: string; fuel: string; ev: string; tollCost?: string; tollEstimated?: boolean };
    alertCount?: number;
}

export function OverviewTab({ tripScore, aiAnalysis, metrics, alertCount = 0 }: OverviewTabProps) {
    // Best departure (soonest high-scoring option) from the streamed insights
    const insights = aiAnalysis?.departureInsights as { time: string; score: number; label: string }[] | undefined;
    const bestDeparture = insights && insights.length > 0
        ? [...insights].sort((a, b) => b.score - a.score)[0]
        : null;

    const hasFuel = metrics?.fuel && metrics.fuel !== "0 gal" && metrics.fuel !== "";
    const hasEv = metrics?.ev && metrics.ev !== "$0" && metrics.ev !== "";
    const hasToll = metrics?.tollCost && metrics.tollCost !== "$0";

    return (
        <div className="flex flex-col gap-4 p-4">
            {/* 1. Trip Confidence — the hero metric */}
            {tripScore !== undefined && (
                <TripConfidenceCard
                    score={tripScore}
                    label={getAttributeLabel(tripScore)}
                    deductions={aiAnalysis?.tripScore?.deductions || []}
                />
            )}

            {/* 2. Bento row — headline intelligence at a glance */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Trip cost */}
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        <CircleDollarSign className="w-3.5 h-3.5 text-emerald-400" /> Trip cost
                    </div>
                    {(hasFuel || hasEv || hasToll) ? (
                        <div className="flex flex-col gap-1.5 mt-0.5">
                            {hasFuel && (
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-1.5 text-muted-foreground"><Fuel className="w-3.5 h-3.5 text-orange-400" />Fuel</span>
                                    <span className="font-bold text-foreground">{metrics!.fuel}</span>
                                </div>
                            )}
                            {hasEv && (
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-1.5 text-muted-foreground"><Zap className="w-3.5 h-3.5 text-yellow-400" />EV</span>
                                    <span className="font-bold text-foreground">{metrics!.ev}</span>
                                </div>
                            )}
                            {hasToll && (
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-1.5 text-muted-foreground"><CircleDollarSign className="w-3.5 h-3.5 text-emerald-400" />Tolls</span>
                                    <span className="font-bold text-foreground">{metrics!.tollCost}{metrics!.tollEstimated ? <span className="text-[10px] text-muted-foreground font-normal ml-1">est.</span> : null}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <span className="text-sm text-muted-foreground mt-1">Calculating…</span>
                    )}
                </div>

                {/* Best departure */}
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        <Clock className="w-3.5 h-3.5 text-blue-400" /> Best departure
                    </div>
                    {bestDeparture ? (
                        <div className="mt-0.5">
                            <div className="text-2xl font-black text-foreground tracking-tight">{bestDeparture.time}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{bestDeparture.label} · {bestDeparture.score}% confidence</div>
                        </div>
                    ) : (
                        <span className="text-sm text-muted-foreground mt-1">Leaving now is optimal</span>
                    )}
                </div>

                {/* Alerts */}
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Alerts
                    </div>
                    {alertCount > 0 ? (
                        <div className="mt-0.5 flex items-center gap-2">
                            <span className="text-2xl font-black text-amber-400 tracking-tight">{alertCount}</span>
                            <span className="text-xs text-muted-foreground">condition{alertCount > 1 ? 's' : ''} to review on your route</span>
                        </div>
                    ) : (
                        <div className="mt-0.5 flex items-center gap-2 text-emerald-400">
                            <ShieldCheck className="w-5 h-5" />
                            <span className="text-sm font-semibold">All clear</span>
                        </div>
                    )}
                </div>
            </div>

            {/* 3. AI Summary */}
            <WayvueAISummary analysis={aiAnalysis} />

            {/* 4. Smart Schedule */}
            {aiAnalysis?.departureInsights && aiAnalysis.departureInsights.length > 0 && (
                <SmartScheduleCard insights={aiAnalysis.departureInsights} />
            )}

            {/* Empty state while analysis streams in */}
            {!aiAnalysis && (
                <div className="text-center p-8 text-muted-foreground border border-dashed border-border rounded-xl">
                    <p>Calculating trip insights...</p>
                </div>
            )}
        </div>
    );
}

function getAttributeLabel(score: number) {
    if (score >= 90) return "Excellent";
    if (score >= 80) return "Good";
    if (score >= 60) return "Fair";
    return "Risky";
}
