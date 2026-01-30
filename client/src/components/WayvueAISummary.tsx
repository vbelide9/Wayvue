import { Sparkles, AlertTriangle, BrainCircuit, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface WayvueAISummaryProps {
    analysis: {
        text: string;
        tone: string;
    } | null;
}

export function WayvueAISummary({ analysis }: WayvueAISummaryProps) {
    const [isOpen, setIsOpen] = useState(false);

    if (!analysis) return null;

    let borderColor = "border-primary/50";
    let bgGradient = "bg-gradient-to-r from-primary/10 to-transparent";
    let Icon = Sparkles;

    if (analysis.tone === 'caution') {
        borderColor = "border-red-500/50";
        bgGradient = "bg-gradient-to-r from-red-500/10 to-transparent";
        Icon = AlertTriangle;
    } else if (analysis.tone === 'moderate') {
        borderColor = "border-amber-500/50";
        bgGradient = "bg-gradient-to-r from-amber-500/10 to-transparent";
        Icon = BrainCircuit;
    }

    // Generate quick bullet points from text (mock simulation since text is blob)
    const sentences = analysis.text.split('. ').slice(0, 2).map(s => s.endsWith('.') ? s : s + '.');

    return (
        <div className={`rounded-xl border ${borderColor} ${bgGradient} overflow-hidden backdrop-blur-sm transition-all duration-300`}>
            <div
                className="p-4 flex items-start justify-between cursor-pointer hover:bg-white/5 active:bg-white/10"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex gap-3">
                    <div className="p-2 rounded-lg bg-background/50 border border-border shadow-sm h-fit">
                        <Icon className={`w-4 h-4 ${analysis.tone === 'caution' ? 'text-red-500' : 'text-primary'}`} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            Wayvue AI Analysis
                            <span className="text-[10px] normal-case opacity-50 font-normal border border-border px-1.5 rounded-full">Beta</span>
                        </h3>

                        {!isOpen && (
                            <div className="mt-1 space-y-1">
                                {sentences.map((s, i) => (
                                    <p key={i} className="text-xs text-foreground/90 flex gap-2">
                                        <span className="text-primary">•</span> {s}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <button className="text-muted-foreground">
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
            </div>

            {/* Expanded Content */}
            {isOpen && (
                <div className="px-4 pb-4 pt-0 animate-in slide-in-from-top-1 fade-in">
                    <div className="h-px bg-border/50 mb-3" />
                    <p className="text-foreground text-sm leading-relaxed">
                        {analysis.text}
                    </p>
                    <div className="mt-3 text-[10px] text-muted-foreground font-mono flex items-center justify-end">
                        POWERED BY WEATHER INTELLIGENCE
                    </div>
                </div>
            )}
        </div>
    );
}
