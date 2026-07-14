// A bookable activity (Viator) — image, rating, "from" price, and an affiliate CTA.
import { Star, ArrowUpRight } from 'lucide-react';
import { AddToPlanButton } from './AddToPlanButton';

export interface Activity {
    code: string;
    title: string;
    image?: string;
    rating?: number;
    reviewCount?: number;
    fromPrice?: string;
    bookingUrl: string;
}

export function ActivityCard({ activity }: { activity: Activity }) {
    return (
        <div className="group block bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:border-primary/40 hover:shadow-soft transition-all"><a
            href={activity.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
        >
            {activity.image && (
                <div className="h-32 w-full overflow-hidden bg-secondary">
                    <img
                        src={activity.image}
                        alt={activity.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                </div>
            )}
            <div className="p-4">
                <h4 className="font-bold text-sm text-foreground line-clamp-2">{activity.title}</h4>
                <div className="flex items-center justify-between mt-2 gap-2">
                    {activity.rating != null ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            {activity.rating.toFixed(1)}{activity.reviewCount ? ` (${activity.reviewCount})` : ''}
                        </span>
                    ) : <span />}
                    {activity.fromPrice && (
                        <span className="text-xs font-bold text-foreground whitespace-nowrap">from {activity.fromPrice}</span>
                    )}
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-primary">
                    Book on Viator <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
            </div>
        </a>
        <div className="px-4 pb-4">
            <AddToPlanButton item={{
                kind: 'attraction',
                title: activity.title,
                external_url: activity.bookingUrl,
                image_url: activity.image ?? null,
                detail: activity.fromPrice ? `from ${activity.fromPrice}` : null,
            }} />
        </div>
        </div>
    );
}
