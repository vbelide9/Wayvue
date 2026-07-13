import { Wallet, Clock3, Sparkles } from 'lucide-react';

interface VerdictBarProps {
    tripScore?: { score: number; label: string };
    aiAnalysis: any;
    metrics: { distance: string; time: string; fuel: string; ev: string; tollCost?: string; tollEstimated?: boolean };
    alertCount: number;
    isEnriching?: boolean;
    compact?: boolean; // Slim, wrapper-free layout for the side panel
}

// Parse a leading dollar amount from strings like "$62", "$34.92 est."
function parseDollars(s?: string): number {
    if (!s) return 0;
    const m = s.replace(/,/g, '').match(/\$?\s*(\d+(\.\d+)?)/);
    return m ? parseFloat(m[1]) : 0;
}

function scoreColor(score: number) {
    if (score >= 80) return { text: 'text-emerald-600', ring: '#059669', chip: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' };
    if (score >= 60) return { text: 'text-primary', ring: '#E86A2A', chip: 'bg-primary/10 text-primary border-primary/20' };
    return { text: 'text-red-600', ring: '#DC2626', chip: 'bg-red-500/10 text-red-700 border-red-500/20' };
}

export function VerdictBar({ tripScore, aiAnalysis, metrics, alertCount, isEnriching, compact }: VerdictBarProps) {
    const score = tripScore?.score ?? aiAnalysis?.tripScore?.score;
    const label = tripScore?.label ?? aiAnalysis?.tripScore?.label ?? 'Good';

    // Still computing — compact placeholder
    if (score === undefined || (isEnriching && !aiAnalysis)) {
        if (compact) {
            return (
                <div className="glass-surface px-4 py-3 flex items-center gap-3 text-muted-foreground">
                    <Sparkles className="w-4 h-4 text-primary animate-pulse shrink-0" />
                    <span className="text-sm font-medium">Analyzing your trip…</span>
                </div>
            );
        }
        return (
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 mb-6">
                <div className="glass-surface px-5 py-4 flex items-center gap-3 text-muted-foreground">
                    <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                    <span className="text-sm font-medium">Analyzing your trip…</span>
                </div>
            </div>
        );
    }

    const c = scoreColor(score);

    // Synthesize a plain-language verdict from existing data
    const weatherCond = aiAnalysis?.structured?.weather?.condition; // "Clear" | "Rain/Snow"
    const weatherPhrase = weatherCond === 'Rain/Snow' ? 'wet weather ahead'
        : weatherCond === 'Clear' ? 'clear skies'
            : 'mild conditions';
    const alertPhrase = alertCount === 0
        ? 'no major alerts'
        : `${alertCount} alert${alertCount > 1 ? 's' : ''} to review`;
    const verdict = `${label} trip: ${weatherPhrase}, ${alertPhrase}.`;

    // Total estimated cost = fuel + tolls
    const total = Math.round(parseDollars(metrics.fuel) + parseDollars(metrics.tollCost));
    const totalStr = total > 0 ? `$${total}${metrics.tollEstimated ? ' est.' : ''}` : null;

    // Best departure = highest-scoring streamed option
    const insights = aiAnalysis?.departureInsights as { time: string; score: number }[] | undefined;
    const best = insights && insights.length > 0 ? [...insights].sort((a, b) => b.score - a.score)[0] : null;

    // Compact: slim strip for the side panel (score + verdict + est cost, stacked-friendly)
    if (compact) {
        return (
            <div className="glass-surface px-4 py-3 flex items-center gap-3">
                <div className={`flex items-center justify-center w-12 h-12 rounded-xl bg-secondary/50 border border-border shrink-0`}>
                    <span className={`text-xl font-display font-bold ${c.text}`}>{score}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Trip verdict</span>
                        <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border ${c.chip}`}>{label}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground leading-snug truncate">{verdict}</p>
                </div>
                {totalStr && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-secondary/50 border border-border shrink-0">
                        <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                        <div className="leading-tight">
                            <div className="text-[8px] uppercase tracking-widest text-muted-foreground">Est. cost</div>
                            <div className="text-xs font-bold text-foreground">{totalStr}</div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 mb-6">
            <div className="glass-surface px-5 py-4 md:px-6 md:py-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                {/* Score */}
                <div className="flex items-center gap-4 shrink-0">
                    <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-secondary/50 border border-border">
                        <span className={`text-3xl font-display font-bold ${c.text}`}>{score}</span>
                    </div>
                    <div className="sm:hidden">
                        <span className={`text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${c.chip}`}>{label}</span>
                    </div>
                </div>

                {/* Verdict sentence */}
                <div className="flex-1 min-w-0">
                    <div className="hidden sm:flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Trip verdict</span>
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${c.chip}`}>{label}</span>
                    </div>
                    <p className="text-base md:text-lg font-medium text-foreground leading-snug">{verdict}</p>
                </div>

                {/* Key synthesized chips */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {totalStr && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/50 border border-border">
                            <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                            <div className="leading-tight">
                                <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Est. cost</div>
                                <div className="text-sm font-bold text-foreground">{totalStr}</div>
                            </div>
                        </div>
                    )}
                    {best && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/50 border border-border">
                            <Clock3 className="w-3.5 h-3.5 text-primary" />
                            <div className="leading-tight">
                                <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Best departure</div>
                                <div className="text-sm font-bold text-foreground">{best.time}</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
