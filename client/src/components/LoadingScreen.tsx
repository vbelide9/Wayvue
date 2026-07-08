import { useEffect, useState } from 'react';
import { Route, CloudSun, TriangleAlert, Fuel, Gauge } from 'lucide-react';

interface LoadingScreenProps {
    title?: string;
}

// Honest pipeline — each step reflects work the backend is actually doing.
// Durations are rough weights so the bar advances believably; the final step
// holds (never claims "done") until real data arrives and this unmounts.
const STEPS = [
    { icon: Route, label: 'Calculating your route', ms: 3000 },
    { icon: CloudSun, label: 'Reading weather along the way', ms: 8000 },
    { icon: TriangleAlert, label: 'Checking live traffic & incidents', ms: 10000 },
    { icon: Fuel, label: 'Estimating fuel & tolls', ms: 6000 },
    { icon: Gauge, label: 'Scoring your trip', ms: 5000 },
];
const TOTAL_MS = STEPS.reduce((s, x) => s + x.ms, 0);

export function LoadingScreen({ title = "Planning your trip" }: LoadingScreenProps) {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const start = Date.now();
        const interval = setInterval(() => setElapsed(Date.now() - start), 200);
        return () => clearInterval(interval);
    }, []);

    // Determine current step from cumulative durations (holds on last step)
    let acc = 0;
    let currentStep = STEPS.length - 1;
    for (let i = 0; i < STEPS.length; i++) {
        if (elapsed < acc + STEPS[i].ms) { currentStep = i; break; }
        acc += STEPS[i].ms;
    }

    // Determinate progress, capped at 95% until real data lands (then we unmount)
    const progress = Math.min(95, (elapsed / TOTAL_MS) * 95);
    const CurrentIcon = STEPS[currentStep].icon;

    return (
        <div
            className="absolute inset-0 z-[1000] flex flex-col items-center justify-center bg-background/60 backdrop-blur-xl animate-in fade-in duration-300"
            role="status"
            aria-live="polite"
            aria-label={`${title}. ${STEPS[currentStep].label}`}
        >
            <div className="bg-card border border-border/50 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full mx-4">

                {/* Animated Icon Container */}
                <div className="relative w-20 h-20 flex items-center justify-center">
                    <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-20 duration-1000" />
                    <div className="relative bg-primary/10 p-5 rounded-2xl border border-primary/20">
                        <CurrentIcon key={currentStep} className="w-10 h-10 text-primary animate-bounce-subtle" />
                    </div>
                </div>

                {/* Text Content */}
                <div className="text-center space-y-2">
                    <h3 className="text-xl font-bold tracking-tight text-foreground">
                        {title}
                    </h3>
                    <div className="h-6 overflow-hidden relative">
                        {/* Real key prop re-triggers the entrance animation each step */}
                        <p key={currentStep} className="text-sm font-medium text-muted-foreground animate-fade-in-up">
                            {STEPS[currentStep].label}
                        </p>
                    </div>
                </div>

                {/* Segmented Step Progress */}
                <div className="w-full flex flex-col gap-2">
                    <div className="w-full flex gap-1.5" aria-hidden="true">
                        {STEPS.map((_, i) => (
                            <div key={i} className="flex-1 h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${i < currentStep ? 'bg-primary w-full' : i === currentStep ? 'bg-primary animate-progress-pulse w-2/3' : 'w-0'}`}
                                />
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between text-[10px] font-medium text-muted-foreground/70 tabular-nums">
                        <span>Step {currentStep + 1} of {STEPS.length}</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes bounce-subtle {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                .animate-bounce-subtle {
                    animation: bounce-subtle 2s infinite ease-in-out;
                }
                @keyframes progress-pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.55; }
                }
                .animate-progress-pulse {
                    animation: progress-pulse 1.4s infinite ease-in-out;
                }
                @keyframes fade-in-up {
                    0% { opacity: 0; transform: translateY(10px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up {
                    animation: fade-in-up 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
}
