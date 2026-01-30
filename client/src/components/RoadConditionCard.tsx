import { AlertCircle, CheckCircle, Construction } from "lucide-react"

export interface RoadCondition {
    segment: string
    status: "good" | "moderate" | "poor"
    description: string
    distance: string
    estimatedTime: string
}

interface RoadConditionCardProps {
    conditions: RoadCondition[]
}

export function RoadConditionCard({ conditions }: RoadConditionCardProps) {
    if (conditions.length === 0) return null;

    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Construction className="w-4 h-4 text-primary" />
                    Road Conditions
                </h3>
                <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-medium">
                    {conditions.length} Segments
                </span>
            </div>

            <div className="divide-y divide-border">
                {conditions.map((condition, idx) => (
                    <div key={idx} className="p-3 hover:bg-white/5 transition-colors">
                        <div className="flex items-start justify-between mb-0.5">
                            <span className="font-medium text-xs text-foreground">{condition.segment}</span>
                            <StatusBadge status={condition.status} />
                        </div>
                        <p className="text-[10px] text-muted-foreground mb-1.5">{condition.description}</p>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
                            <span>{condition.distance}</span>
                            <span>•</span>
                            <span>{condition.estimatedTime}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function StatusBadge({ status }: { status: "good" | "moderate" | "poor" }) {
    if (status === "good") {
        return (
            <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">
                <CheckCircle className="w-3 h-3" /> Good
            </span>
        )
    }
    if (status === "moderate") {
        return (
            <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded">
                <AlertCircle className="w-3 h-3" /> Moderate
            </span>
        )
    }
    return (
        <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">
            <AlertCircle className="w-3 h-3" /> Poor
        </span>
    )
}
