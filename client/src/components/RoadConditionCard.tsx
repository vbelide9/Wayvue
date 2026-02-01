import { Construction, Camera, ChevronRight, X } from "lucide-react"
import { useState } from "react"

export interface RoadCondition {
    segment: string
    status: "good" | "moderate" | "poor"
    description: string
    distance: string
    estimatedTime: string
    location?: { lat: number, lon: number }
    camera?: {
        id: string
        name: string
        url: string
        timestamp: string
    }
}

interface RoadConditionCardProps {
    conditions: RoadCondition[]
    onSegmentSelect?: (condition: RoadCondition) => void
}

export function RoadConditionCard({ conditions, onSegmentSelect }: RoadConditionCardProps) {
    const [selectedCamera, setSelectedCamera] = useState<RoadCondition['camera'] | null>(null);

    if (conditions.length === 0) return null;

    const handleCameraClick = (e: React.MouseEvent, camera: RoadCondition['camera']) => {
        e.stopPropagation();
        setSelectedCamera(camera);
    };

    const handleSegmentClick = (condition: RoadCondition) => {
        if (onSegmentSelect) {
            onSegmentSelect(condition);
        }
    };

    return (
        <div className="flex flex-col h-full bg-card/50">
            <div className="p-4 border-b border-border flex items-center justify-between bg-card sticky top-0 z-10">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Construction className="w-5 h-5 text-primary" />
                    Road Conditions
                </h3>
                <span className="text-xs bg-primary/20 text-primary px-2.5 py-0.5 rounded-full font-medium">
                    {conditions.length} Segments
                </span>
            </div>

            <div className="divide-y divide-border overflow-y-auto h-[520px] custom-scrollbar">
                {conditions.map((condition, idx) => {
                    return (
                        <div
                            key={idx}
                            onClick={() => handleSegmentClick(condition)}
                            className="group transition-all duration-200 cursor-pointer hover:bg-white/5"
                        >
                            <div className="p-3.5">
                                <div className="flex items-start gap-3">
                                    {/* Icon Column */}
                                    <div className="mt-1.5">
                                        {condition.status === 'good' ? (
                                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                                        ) : condition.status === 'moderate' ? (
                                            <div className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                                        ) : (
                                            <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse" />
                                        )}
                                    </div>

                                    {/* Content Column */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <h4 className="text-sm font-bold truncate text-foreground">
                                                {condition.segment}
                                            </h4>
                                            {condition.camera && (
                                                <button
                                                    onClick={(e) => handleCameraClick(e, condition.camera)}
                                                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-transparent bg-secondary/30 text-muted-foreground hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-all group/cam-btn"
                                                >
                                                    <Camera className="w-3 h-3" />
                                                    <span className="text-[10px] font-bold uppercase tracking-wider">View Cam</span>
                                                </button>
                                            )}
                                        </div>

                                        <p className="text-xs text-muted-foreground leading-snug mb-1.5 line-clamp-2">
                                            {condition.description}
                                        </p>

                                        <div className="flex items-center gap-4 text-[10px] text-muted-foreground/60 font-mono uppercase tracking-widest">
                                            <span>{condition.distance}</span>
                                        </div>
                                    </div>

                                    {/* Chevron */}
                                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0.5 mt-1" />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Camera Full Screen Page/Modal Overlay */}
            {selectedCamera && (
                <div
                    className="fixed inset-0 z-[1000] flex flex-col bg-black animate-in fade-in duration-300"
                    onClick={() => setSelectedCamera(null)}
                >
                    {/* Modal Header */}
                    <div className="p-6 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent absolute top-0 w-full z-10">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary rounded-xl shadow-lg">
                                <Camera className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white tracking-tight">{selectedCamera.name}</h3>
                                <p className="text-sm text-white/60 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                    Live Traffic Monitor • {new Date(selectedCamera.timestamp).toLocaleTimeString()}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setSelectedCamera(null)}
                            className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-md border border-white/20"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Image Area */}
                    <div className="flex-1 flex items-center justify-center p-4 md:p-12" onClick={e => e.stopPropagation()}>
                        <div className="relative group max-w-6xl w-full aspect-video rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(59,130,246,0.2)] border border-white/10">
                            <img
                                src={selectedCamera.url}
                                alt={selectedCamera.name}
                                className="w-full h-full object-cover opacity-50 grayscale"
                            />

                            {/* Alert Message for Simulated/Limited Access */}
                            {selectedCamera.id.startsWith('sim-') && (
                                <div className="absolute inset-0 flex items-center justify-center p-8 text-center bg-black/40 backdrop-blur-[2px]">
                                    <div className="max-w-md space-y-4">
                                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full text-yellow-500 text-[10px] font-bold uppercase tracking-wider">
                                            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                                            Service Access Limited
                                        </div>
                                        <h2 className="text-2xl font-bold text-white leading-tight">
                                            Real-time traffic images cannot be loaded due to access limitations on public camera feeds.
                                        </h2>
                                        <p className="text-white/60 text-sm">
                                            We are strictly adhering to public agency API usage policies to ensure continuous service availability.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Overlay Controls Placeholder */}
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-8 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                                <div className="flex items-center justify-between">
                                    <div className="flex gap-4">
                                        <button className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm font-medium backdrop-blur transition-colors">Capture Frame</button>
                                        <button className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm font-medium backdrop-blur transition-colors">Alert Intelligence</button>
                                    </div>
                                    <div className="flex items-center gap-3 text-white/60 text-xs font-mono">
                                        <span>40.7128° N, 74.0060° W</span>
                                        <div className="h-4 w-px bg-white/20" />
                                        <span>WAYVUE_SECURE_CHANNEL_01</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Info Bar */}
                    <div className="p-8 bg-gradient-to-t from-black to-transparent flex justify-center pb-12">
                        <p className="text-white/40 text-[10px] tracking-[0.2em] font-mono uppercase">
                            AI-Powered Road Condition Surveillance • Property of Wayvue
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}

