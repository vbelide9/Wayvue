import { MapPin, Navigation, Compass } from 'lucide-react';

export function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center h-full w-full p-8 text-center animate-in fade-in duration-700">
            <div className="relative mb-8 group">
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 group-hover:scale-175 transition-transform duration-1000"></div>
                <div className="relative bg-card/50 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl ring-1 ring-white/10">
                    <Compass className="w-16 h-16 text-primary animate-pulse-slow" />
                </div>
            </div>

            <h2 className="text-3xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-white to-white/60 mb-4 tracking-tight">
                Where to today?
            </h2>

            <p className="text-muted-foreground/80 max-w-md text-lg leading-relaxed mb-8">
                Enter your start and destination to get AI-powered weather insights, road conditions, and the safest time to leave.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-sm">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-default">
                    <div className="p-2 bg-blue-500/20 rounded-lg text-blue-300">
                        <Navigation className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                        <div className="text-sm font-medium text-white/90">Smart Routing</div>
                        <div className="text-[10px] text-white/50">Avoids severe weather</div>
                    </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-default">
                    <div className="p-2 bg-amber-500/20 rounded-lg text-amber-300">
                        <MapPin className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                        <div className="text-sm font-medium text-white/90">Road Conditions</div>
                        <div className="text-[10px] text-white/50">Real-time alerts</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
