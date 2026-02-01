import {
    Sparkles, AlertTriangle, ChevronDown, ChevronUp
} from "lucide-react";
import { useState } from "react";

interface WayvueAISummaryProps {
    analysis: {
        structured: {
            overview: { distance: string, duration: string, delay: string | null };
            fuel: { gas: string, ev: string | null };
            weather: { tempRange: string, wind: string | null, precipChance: string | null, condition: string };
            roads: { condition: string, delay: string | null, details: string };
            stops: { city: string, reason: string }[];
            tip: string | null;
        };
        insights?: {
            bullets: string[];
            funMoment: string;
        };
        tone: string;
    } | null;
}

export function WayvueAISummary({ analysis }: WayvueAISummaryProps) {
    const [isOpen, setIsOpen] = useState(true);

    if (!analysis || !analysis.structured) return null;

    const { tone } = analysis;
    const isCaution = tone === 'caution';

    // Styles
    const containerClass = isCaution
        ? "border-red-500/30 bg-gradient-to-br from-red-500/10 to-transparent"
        : "border-primary/30 bg-gradient-to-br from-primary/10 to-transparent";

    return (
        <div className={`rounded-xl border ${containerClass} overflow-hidden backdrop-blur-md transition-all duration-300 shadow-lg`}>
            {/* Header */}
            <div
                className="p-3 flex items-center justify-between cursor-pointer hover:bg-white/5 active:bg-white/10 border-b border-white/5"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg bg-background/60 border border-white/10 shadow-inner`}>
                        <Sparkles className={`w-4 h-4 ${isCaution ? 'text-amber-400' : 'text-primary'}`} />
                    </div>
                    <div>
                        <h3 className="font-bold text-xs tracking-wide text-foreground flex items-center gap-2">
                            WAYVUE INTELLIGENCE
                            <span className="text-[8px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-mono">BETA</span>
                        </h3>
                    </div>
                </div>
                {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
            </div>

            {/* Expanded Content */}
            {isOpen && (
                <div className="animate-in slide-in-from-top-2 fade-in duration-300">
                    <div className="max-h-[300px] overflow-y-auto p-4 custom-scrollbar">
                        {/* Simplified Header - Always show Sparkles, maybe Alert next to it if caution */}
                        {isCaution && (
                            <div className="mb-4 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                                <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Caution advised</span>
                            </div>
                        )}

                        {/* AI Insights Section (Directly) */}
                        {analysis.insights && (
                            <div className="space-y-4">
                                <div className="space-y-2.5">
                                    {analysis.insights.bullets.map((bullet, i) => (
                                        <div key={i} className="flex gap-3 items-start">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-1.5 flex-shrink-0" />
                                            <p className="text-sm text-foreground/90 leading-relaxed">
                                                {bullet}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                <div className="bg-white/5 px-4 py-3 rounded-xl border border-white/10 mt-4">
                                    <p className="text-xs text-foreground/80 leading-relaxed italic">
                                        <span className="text-primary font-bold not-italic mr-1.5 uppercase text-[10px] tracking-wider">Fun moment:</span>
                                        {analysis.insights.funMoment}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
