import { Shield, ShieldAlert, ShieldCheck, AlertTriangle, Wind, CloudRain, Thermometer } from "lucide-react";

interface Deduction {
    type: string;
    val: number;
}

interface TripConfidenceCardProps {
    score: number;
    label: string;
    deductions: Deduction[];
}

export function TripConfidenceCard({ score, label, deductions }: TripConfidenceCardProps) {
    // Determine color based on score
    const getColor = (s: number) => {
        if (s >= 90) return "text-green-400";
        if (s >= 75) return "text-emerald-400";
        if (s >= 60) return "text-yellow-400";
        return "text-red-400";
    };

    const getBgColor = (s: number) => {
        if (s >= 90) return "bg-green-500";
        if (s >= 75) return "bg-emerald-500";
        if (s >= 60) return "bg-yellow-500";
        return "bg-red-500";
    };

    const textColor = getColor(score);
    const bgColor = getBgColor(score);

    return (
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-foreground text-lg">Trip Confidence</h3>
                    <p className="text-xs text-muted-foreground">AI-Calculated Safety Score</p>
                </div>
                {score >= 80 ? <ShieldCheck className={`w-8 h-8 ${textColor}`} /> :
                    score >= 60 ? <Shield className={`w-8 h-8 ${textColor}`} /> :
                        <ShieldAlert className={`w-8 h-8 ${textColor}`} />}
            </div>

            {/* Gauge */}
            <div className="relative pt-2">
                <div className="flex justify-between items-end mb-1">
                    <span className={`text-4xl font-bold ${textColor}`}>{score}%</span>
                    <span className={`text-sm font-bold px-2 py-0.5 rounded ${bgColor}/10 ${textColor} border border-${bgColor}/20`}>
                        {label.toUpperCase()}
                    </span>
                </div>
                <div className="h-2 w-full bg-secondary/30 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${bgColor} transition-all duration-1000 ease-out`}
                        style={{ width: `${score}%` }}
                    ></div>
                </div>
            </div>

            {/* Deductions / Factors */}
            <div className="space-y-2 mt-1">
                {deductions.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-green-400/80 bg-green-500/5 p-2 rounded-lg border border-green-500/10">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Conditions look optimal. Safe travels.</span>
                    </div>
                ) : (
                    deductions.map((d, i) => (
                        <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                            <div className="flex items-center gap-2 text-foreground/80">
                                {d.type.includes('Rain') ? <CloudRain className="w-3.5 h-3.5 text-blue-400" /> :
                                    d.type.includes('Wind') ? <Wind className="w-3.5 h-3.5 text-slate-400" /> :
                                        d.type.includes('Cold') ? <Thermometer className="w-3.5 h-3.5 text-cyan-400" /> :
                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                                <span>{d.type}</span>
                            </div>
                            <span className="font-mono font-bold text-red-400">{d.val}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
