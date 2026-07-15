// "Pack for this trip" — trip-tailored gear grouped into sub-categories, each shoppable at
// multiple stores (Amazon + best-fit specialty retailers). Adapts to the route's conditions.
import { ExternalLink, ShoppingBag } from 'lucide-react';
import {
    buildPackContext, recommendGrouped, storeLink, MERCHANTS, hasAffiliateTag,
} from '@/lib/travelShopping';
import type { Waypoint } from '@/components/WaypointsEditor';

export function PackTab({ weatherData, durationText, depDate, destination, waypoints = [] }: {
    weatherData?: any[];
    durationText?: string;
    depDate?: string;
    destination?: string;
    waypoints?: Waypoint[];
}) {
    const placeNames = [destination, ...waypoints.map(w => w?.name)].filter(Boolean) as string[];
    const ctx = buildPackContext({ weatherData, durationText, depDate, placeNames });
    const groups = recommendGrouped(ctx);

    return (
        <div className="p-4 space-y-5">
            <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight flex items-center gap-2"><ShoppingBag className="w-5 h-5 text-primary" /> Pack for this trip</h2>
                <p className="text-xs text-muted-foreground">
                    Gear picked for your route — {ctx.precipChance >= 40 ? 'wet forecast, ' : ''}
                    {ctx.maxTempC >= 28 ? 'warm weather, ' : ctx.minTempC <= 2 ? 'cold temps, ' : ''}
                    {ctx.durationHours >= 5 ? `a ${Math.round(ctx.durationHours)}-hour drive` : 'the road ahead'}. Shop each at your preferred store.
                </p>
            </div>

            {groups.map(({ group, items }) => (
                <div key={group} className="space-y-2">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-1">{group}</h3>
                    <div className="flex flex-col gap-2">
                        {items.map(item => {
                            const Icon = item.icon;
                            return (
                                <div key={item.id} className="bg-card border border-border rounded-2xl p-3.5 flex items-center gap-3.5">
                                    <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center text-primary shrink-0">
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-foreground truncate">{item.title}</p>
                                        <p className="text-xs text-muted-foreground leading-snug">{item.blurb}</p>
                                    </div>
                                    {/* Shop at each applicable store (Amazon primary, specialty stores secondary) */}
                                    <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0 max-w-[46%]">
                                        {item.merchants.map((id, i) => (
                                            <a
                                                key={id}
                                                href={storeLink(id, item.query)}
                                                target="_blank"
                                                rel="noopener noreferrer sponsored nofollow"
                                                title={`Shop ${item.title} at ${MERCHANTS[id].name}`}
                                                className={`flex items-center gap-1 h-8 px-2.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors ${i === 0 ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-secondary/60 border border-border text-foreground hover:border-primary/40'}`}
                                            >
                                                {MERCHANTS[id].name}<ExternalLink className="w-3 h-3 opacity-70" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            {/* FTC / affiliate disclosure */}
            <p className="text-[11px] text-muted-foreground/80 leading-relaxed pt-2 border-t border-border">
                {hasAffiliateTag
                    ? 'As an Amazon Associate, Wayvue earns from qualifying purchases — at no extra cost to you. Some store links may be affiliate links.'
                    : 'Store links open product searches. Suggestions are tailored to your trip’s conditions.'}
            </p>
        </div>
    );
}
