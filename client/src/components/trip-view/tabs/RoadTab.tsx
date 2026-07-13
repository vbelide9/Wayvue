import { RoadConditionCard, type RoadCondition } from '@/components/RoadConditionCard';
import { AlertTriangle, Construction, Car, Ban, TriangleAlert } from 'lucide-react';

export interface TrafficIncident {
    id: string;
    type: 'accident' | 'closure' | 'construction' | 'jam' | 'hazard';
    severity?: number;
    description: string;
    location?: { lat: number; lng: number } | null;
    from?: string | null;
    to?: string | null;
}

interface RoadTabProps {
    roadConditions: RoadCondition[];
    incidents?: TrafficIncident[];
    onSegmentSelect: (condition: RoadCondition) => void;
    onIncidentSelect?: (incident: TrafficIncident) => void;
}

const INCIDENT_META: Record<string, { icon: any; label: string; color: string }> = {
    accident: { icon: AlertTriangle, label: 'Accident', color: 'text-red-500' },
    closure: { icon: Ban, label: 'Road Closure', color: 'text-red-600' },
    construction: { icon: Construction, label: 'Construction', color: 'text-amber-500' },
    jam: { icon: Car, label: 'Traffic Jam', color: 'text-orange-500' },
    hazard: { icon: TriangleAlert, label: 'Hazard', color: 'text-yellow-500' }
};

export function RoadTab({ roadConditions, incidents, onSegmentSelect, onIncidentSelect }: RoadTabProps) {
    const hasIncidents = incidents && incidents.length > 0;
    const hasConditions = roadConditions && roadConditions.length > 0;

    if (!hasIncidents && !hasConditions) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                No major road alerts or incidents reported along this route.
            </div>
        );
    }

    return (
        <div className="h-full animate-in fade-in slide-in-from-right-2 duration-300 flex flex-col gap-4 p-4">
            {/* Live Traffic Incidents — framed for calm: major vs. minor, not one alarming count */}
            {hasIncidents && (() => {
                const majorTypes = ['accident', 'closure'];
                const majorCount = incidents!.filter(i => majorTypes.includes(i.type)).length;
                const minorCount = incidents!.length - majorCount;
                const calm = majorCount === 0;
                return (
                <div className="bg-card/95 backdrop-blur-xl rounded-xl border border-border overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-border bg-card">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-foreground flex items-center gap-2">
                                <AlertTriangle className={`w-5 h-5 ${calm ? 'text-amber-600' : 'text-red-500'}`} />
                                Road Alerts
                            </h3>
                            <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${calm ? 'bg-amber-500/10 text-amber-700' : 'bg-red-500/15 text-red-500'}`}>
                                {majorCount} major · {minorCount} minor
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">
                            {calm
                                ? `No major disruptions on your route — ${minorCount} minor item${minorCount !== 1 ? 's' : ''} to be aware of.`
                                : `${majorCount} disruption${majorCount !== 1 ? 's' : ''} may affect your route. Review before you go.`}
                        </p>
                    </div>
                    {/* data-lenis-prevent: Lenis smooth-scroll otherwise swallows wheel events over nested scroll areas */}
                    <div data-lenis-prevent className="divide-y divide-border max-h-[280px] overflow-y-auto custom-scrollbar">
                        {incidents!.map((inc, idx) => {
                            const meta = INCIDENT_META[inc.type] || INCIDENT_META.hazard;
                            const Icon = meta.icon;
                            return (
                                <div
                                    key={inc.id || idx}
                                    onClick={() => onIncidentSelect && inc.location && onIncidentSelect(inc)}
                                    className={`p-3.5 flex items-start gap-3 transition-colors ${inc.location ? 'cursor-pointer hover:bg-secondary' : ''}`}
                                >
                                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${meta.color}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-bold uppercase tracking-wider ${meta.color}`}>
                                                {meta.label}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-snug mt-0.5 line-clamp-2">
                                            {inc.description}
                                        </p>
                                        {(inc.from || inc.to) && (
                                            <p className="text-[10px] text-muted-foreground/50 mt-1 font-mono truncate">
                                                {inc.from}{inc.to ? ` → ${inc.to}` : ''}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                );
            })()}

            {/* Road Conditions (weather-derived segments) */}
            {hasConditions && (
                <RoadConditionCard
                    conditions={roadConditions}
                    onSegmentSelect={onSegmentSelect}
                />
            )}
        </div>
    );
}
