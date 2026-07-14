// Markers for the current trip's plan items, placed on the route at each item's mileage
// from the start (plan items store their route mile, not exact coordinates). Each category
// gets its own icon + colour so stops, food, attractions, and hotels read at a glance.
import { useMemo } from 'react';
import { MapPin, Utensils, Ticket, BedDouble } from 'lucide-react';
import { MapMarker, MarkerContent, MarkerPopup } from '@/components/ui/map';
import { useTripPlan } from '@/lib/TripPlanContext';
import { type TripItem } from '@/lib/tripItems';

type LngLat = [number, number];

const STYLE: Record<string, { icon: any; color: string }> = {
    stop: { icon: MapPin, color: '#E86A2A' },
    restaurant: { icon: Utensils, color: '#F97316' },
    attraction: { icon: Ticket, color: '#A855F7' },
    hotel: { icon: BedDouble, color: '#3B82F6' },
};

const R = 3959; // miles
function haversine(a: LngLat, b: LngLat): number {
    const dLat = (b[1] - a[1]) * Math.PI / 180;
    const dLon = (b[0] - a[0]) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2 +
        Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function routeMile(it: TripItem): number | null {
    const m = it.location?.match(/(\d+)\s*mi\b/);
    return m ? parseInt(m[1], 10) : null;
}

export function PlanMarkers({ coordinates }: { coordinates: LngLat[] }) {
    const { items } = useTripPlan();

    // Cumulative miles at each route vertex — lets us map a stop's mileage to a point.
    const cum = useMemo(() => {
        const out: number[] = [0];
        for (let i = 1; i < coordinates.length; i++) out[i] = out[i - 1] + haversine(coordinates[i - 1], coordinates[i]);
        return out;
    }, [coordinates]);

    const total = cum.length ? cum[cum.length - 1] : 0;

    const coordAtMile = (mile: number): LngLat | null => {
        if (coordinates.length === 0) return null;
        if (mile <= 0) return coordinates[0];
        if (mile >= total) return coordinates[coordinates.length - 1];
        let i = 1;
        while (i < cum.length && cum[i] < mile) i++;
        const seg = cum[i] - cum[i - 1] || 1;
        const f = (mile - cum[i - 1]) / seg;
        const a = coordinates[i - 1], b = coordinates[i];
        return [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])];
    };

    if (coordinates.length === 0) return null;

    return (
        <>
            {items.map((it) => {
                const style = STYLE[it.kind];
                if (!style) return null; // notes (and anything without a category marker) skip the map
                const mile = routeMile(it);
                if (mile == null) return null;
                const pos = coordAtMile(mile);
                if (!pos) return null;
                const Icon = style.icon;
                return (
                    <MapMarker key={`plan-${it.id}`} longitude={pos[0]} latitude={pos[1]} anchor="bottom">
                        <MarkerContent>
                            <div
                                className="w-7 h-7 flex items-center justify-center border-2 border-white shadow-[0_3px_8px_rgba(0,0,0,0.4)]"
                                style={{ backgroundColor: style.color, borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)' }}
                            >
                                <Icon className="w-3.5 h-3.5 text-white" style={{ transform: 'rotate(45deg)' }} />
                            </div>
                        </MarkerContent>
                        <MarkerPopup className="p-0 bg-transparent border-none shadow-none">
                            <div className="px-3 py-2 font-sans bg-card/95 backdrop-blur-xl border border-border rounded-2xl text-foreground text-xs max-w-[220px]">
                                <span className="font-bold uppercase tracking-widest text-[10px] text-muted-foreground">In your plan</span>
                                <p className="text-sm font-bold mt-0.5">{it.title}</p>
                                {it.location && <p className="text-foreground/70 mt-0.5">{it.location}</p>}
                            </div>
                        </MarkerPopup>
                    </MapMarker>
                );
            })}
        </>
    );
}
