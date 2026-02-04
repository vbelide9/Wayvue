
import { useEffect, useState } from 'react';
import { Car, Tent, Mountain, Snowflake, Anchor, Compass } from 'lucide-react';

interface LoadingScreenProps {
    title?: string;
}

export function LoadingScreen({ title = "Planning your trip" }: LoadingScreenProps) {
    const icons = [
        { icon: Car, label: "Packing the car..." },
        { icon: Tent, label: "Finding campsites..." },
        { icon: Mountain, label: "Checking trail conditions..." },
        { icon: Snowflake, label: "Scanning forecast..." },
        { icon: Anchor, label: "Exploring waterways..." },
        { icon: Compass, label: "Calculating best route..." }
    ];

    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % icons.length);
        }, 800);
        return () => clearInterval(interval);
    }, []);

    const CurrentIcon = icons[currentIndex].icon;

    return (
        <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center bg-background/60 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-card border border-border/50 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full mx-4">

                {/* Animated Icon Container */}
                <div className="relative w-20 h-20 flex items-center justify-center">
                    <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-20 duration-1000" />
                    <div className="relative bg-primary/10 p-5 rounded-2xl border border-primary/20">
                        <CurrentIcon className="w-10 h-10 text-primary animate-bounce-subtle transition-all duration-300 transform" />
                    </div>
                </div>

                {/* Text Content */}
                <div className="text-center space-y-2">
                    <h3 className="text-xl font-bold tracking-tight text-foreground">
                        {title}
                    </h3>
                    <div className="h-6 overflow-hidden relative">
                        <p className="text-sm font-medium text-muted-foreground animate-fade-in-up key={currentIndex}">
                            {icons[currentIndex].label}
                        </p>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                    <div className="h-full bg-primary animate-progress-indeterminate rounded-full" />
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
                @keyframes progress-indeterminate {
                    0% { width: 0%; margin-left: 0%; }
                    50% { width: 70%; margin-left: 30%; }
                    100% { width: 0%; margin-left: 100%; }
                }
                .animate-progress-indeterminate {
                    animation: progress-indeterminate 1.5s infinite ease-in-out;
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
