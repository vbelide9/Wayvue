import { Shield, ShieldAlert, ShieldCheck, AlertTriangle, Wind, CloudRain, Thermometer, Moon, Clock } from "lucide-react";
import { motion } from "framer-motion";

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
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.0, ease: [0.76, 0, 0.24, 1] }}
            className="bg-card/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col gap-4 shadow-2xl hover:-translate-y-1 hover:shadow-primary/10 transition-all duration-300"
        >
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-black text-foreground text-xl tracking-tight">Trip Confidence</h3>
                    <p className="text-sm text-foreground/80 mt-1 font-medium bg-background/30 inline-block px-2.5 py-1 rounded-full border border-white/5">
                        AI-Calculated Safety Score
                    </p>
                </div>
                <div className={`p-3 rounded-xl bg-gradient-to-br from-background to-secondary/50 shadow-inner border border-white/5`}>
                    {score >= 80 ? <ShieldCheck className={`w-8 h-8 ${textColor} drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]`} /> :
                        score >= 60 ? <Shield className={`w-8 h-8 ${textColor} drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]`} /> :
                            <ShieldAlert className={`w-8 h-8 ${textColor} drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]`} />}
                </div>
            </div>

            {/* Gauge */}
            <div className="relative pt-3 mt-2">
                <div className="flex justify-between items-end mb-2">
                    <span className={`text-5xl font-black tracking-tighter ${textColor} drop-shadow-md`}>{score}%</span>
                    <span className={`text-sm font-bold px-3 py-1 rounded-full ${bgColor}/10 ${textColor} border border-${bgColor}/30 uppercase tracking-widest shadow-[0_0_15px_rgba(0,0,0,0.2)]`}>
                        {label}
                    </span>
                </div>
                <div className="h-3 w-full bg-black/40 rounded-full overflow-hidden shadow-inner border border-white/5 p-0.5">
                    <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${score}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.5, ease: [0.76, 0, 0.24, 1] }}
                        className={`h-full ${bgColor} rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]`}
                    />
                </div>
            </div>

            {/* Deductions / Factors */}
            <div className="space-y-2.5 mt-4">
                {deductions.length === 0 ? (
                    <div className="flex items-center gap-3 text-sm text-green-400 font-medium bg-green-500/10 p-4 rounded-xl border border-green-500/20 shadow-inner">
                        <ShieldCheck className="w-5 h-5" />
                        <span>Conditions look optimal. Safe travels.</span>
                    </div>
                ) : (
                    deductions.map((d, i) => (
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1, duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
                            key={i}
                            className="flex items-center justify-between text-sm p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 shadow-sm hover:bg-red-500/15 transition-colors"
                        >
                            <div className="flex items-center gap-3 text-foreground font-medium">
                                <div className="p-1.5 bg-background/50 rounded-lg shadow-inner">
                                    {d.type.includes('Rain') || d.type.includes('Snow') ? <CloudRain className="w-4 h-4 text-blue-400" /> :
                                        d.type.includes('Wind') ? <Wind className="w-4 h-4 text-slate-400" /> :
                                            d.type.includes('Cold') ? <Thermometer className="w-4 h-4 text-cyan-400" /> :
                                                d.type.includes('Heat') ? <Thermometer className="w-4 h-4 text-orange-400" /> :
                                                    d.type.includes('Night') ? <Moon className="w-4 h-4 text-indigo-300" /> :
                                                        d.type.includes('Fatigue') || d.type.includes('Drive') ? <Clock className="w-4 h-4 text-amber-400" /> :
                                                            <AlertTriangle className="w-4 h-4 text-amber-400" />}
                                </div>
                                <span>{d.type}</span>
                            </div>
                            <span className="font-mono font-black text-red-500 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">{d.val}</span>
                        </motion.div>
                    ))
                )}
            </div>
        </motion.div>
    );
}
