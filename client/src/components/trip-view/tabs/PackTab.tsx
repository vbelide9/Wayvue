// "Pack for this trip" — trip-tailored gear recommendations with affiliate links.
// Suggestions adapt to the route's weather, drive length, season, and how outdoorsy it is.
import { ExternalLink, ShoppingBag } from 'lucide-react';
import { buildPackContext, recommendProducts, amazonLink, hasAffiliateTag } from '@/lib/travelShopping';
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
    const products = recommendProducts(ctx);

    return (
        <div className="p-4 space-y-4">
            <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight flex items-center gap-2"><ShoppingBag className="w-5 h-5 text-primary" /> Pack for this trip</h2>
                <p className="text-xs text-muted-foreground">
                    Gear picked for your route — {ctx.precipChance >= 40 ? 'wet forecast, ' : ''}
                    {ctx.maxTempC >= 28 ? 'warm weather, ' : ctx.minTempC <= 2 ? 'cold temps, ' : ''}
                    {ctx.durationHours >= 5 ? `a ${Math.round(ctx.durationHours)}-hour drive` : 'the road ahead'}.
                </p>
            </div>

            <div className="flex flex-col gap-2">
                {products.map(p => {
                    const Icon = p.icon;
                    return (
                        <a
                            key={p.id}
                            href={amazonLink(p.query)}
                            target="_blank"
                            rel="noopener noreferrer sponsored nofollow"
                            className="group bg-card border border-border rounded-2xl p-3.5 flex items-center gap-3.5 hover:border-primary/40 hover:bg-secondary/40 transition-colors"
                        >
                            <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
                                <Icon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-foreground truncate">{p.title}</span>
                                    <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground bg-secondary/70 border border-border rounded-full px-2 py-0.5 shrink-0">{p.category}</span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-snug mt-0.5">{p.blurb}</p>
                            </div>
                            <span className="flex items-center gap-1 text-xs font-bold text-primary shrink-0 whitespace-nowrap">
                                Amazon <ExternalLink className="w-3.5 h-3.5" />
                            </span>
                        </a>
                    );
                })}
            </div>

            {/* FTC / Amazon Associates disclosure */}
            <p className="text-[11px] text-muted-foreground/80 leading-relaxed pt-2 border-t border-border">
                {hasAffiliateTag
                    ? 'As an Amazon Associate, Wayvue earns from qualifying purchases — at no extra cost to you.'
                    : 'Links open product searches on Amazon. Suggestions are tailored to your trip’s conditions.'}
            </p>
        </div>
    );
}
