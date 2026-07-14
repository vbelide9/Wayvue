import { useState } from 'react';
import { RoadConditionCard, type RoadCondition } from '@/components/RoadConditionCard';
import { AlertTriangle, Construction, Car, Ban, TriangleAlert, ChevronDown } from 'lucide-react';

export interface TrafficIncident {
    id: string;
    type: 'accident' | 'closure' | 'construction' | 'jam' | 'hazard';
    severity?: number;
    description: string;
    location?: { lat: number; lng: number } | null;
    from?: string | null;
    to?: string | null;
    miles?: number;   // distance from the start
    place?: string;   // location label: road + town, e.g. "I-376 W · Beaver, PA"
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

const INCIDENT_PREVIEW_COUNT = 4;

export function RoadTab({ roadConditions, incidents, onSegmentSelect, onIncidentSelect }: RoadTabProps) {
    const [showAllIncidents, setShowAllIncidents] = useState(false);
    // Same ordering as the top-bar alerts popover: nearest-first by distance from start.
    const sortedIncidents = incidents
        ? [...incidents].sort((a, b) => (a.miles ?? Infinity) - (b.miles ?? Infinity))
        : [];
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
                                ? `No major disruptions on your route. ${minorCount} minor item${minorCount !== 1 ? 's' : ''} to be aware of.`
                                : `${majorCount} disruption${majorCount !== 1 ? 's' : ''} may affect your route. Review before you go.`}
                        </p>
                    </div>
                    <div className="divide-y divide-border">
                        {(showAllIncidents ? sortedIncidents : sortedIncidents.slice(0, INCIDENT_PREVIEW_COUNT)).map((inc, idx) => {
                            const meta = INCIDENT_META[inc.type] || INCIDENT_META.hazard;
                            const Icon = meta.icon;
                            const location = inc.place || (inc.from ? `${inc.from}${inc.to ? ` → ${inc.to}` : ''}` : null);
                            const showDesc = inc.description && inc.description.toLowerCase() !== 'closed';
                            return (
                                <div
                                    key={inc.id || idx}
                                    onClick={() => onIncidentSelect && inc.location && onIncidentSelect(inc)}
                                    className={`p-3.5 flex items-start gap-3 transition-colors ${inc.location ? 'cursor-pointer hover:bg-secondary' : ''}`}
                                >
                                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${meta.color}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <span className={`text-xs font-bold uppercase tracking-wider ${meta.color}`}>
                                                {meta.label}
                                            </span>
                                            {inc.miles != null && (
                                                <span className="text-[10px] font-semibold text-amber-600 whitespace-nowrap shrink-0">{inc.miles} mi</span>
                                            )}
                                        </div>
                                        {location && (
                                            <p className="text-xs font-medium text-foreground/80 leading-snug mt-0.5 truncate">
                                                {location}
                                            </p>
                                        )}
                                        {showDesc && (
                                            <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
                                                {inc.description}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {incidents!.length > INCIDENT_PREVIEW_COUNT && (
                        <button
                            onClick={() => setShowAllIncidents(v => !v)}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-primary hover:bg-secondary transition-colors border-t border-border"
                        >
                            {showAllIncidents ? 'Show less' : `Show all ${incidents!.length} alerts`}
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAllIncidents ? 'rotate-180' : ''}`} />
                        </button>
                    )}
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
