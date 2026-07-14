import { useState, useEffect } from 'react';
import { Ticket, Loader2 } from 'lucide-react';
import { ActivityCard, type Activity } from '../../ActivityCard';

interface ActivitiesTabProps {
    destination?: string;
}

// Things-to-do near the destination (Viator). Placeholder-friendly: when the Viator API
// isn't configured yet the endpoint returns no activities and we show a "coming soon" state.
export function ActivitiesTab({ destination }: ActivitiesTabProps) {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!destination) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/trip/activity-recommendations?destination=${encodeURIComponent(destination)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (!cancelled) setActivities(Array.isArray(data.activities) ? data.activities : []);
                }
            } catch {
                /* ignore — show the empty state */
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [destination]);

    return (
        <div className="p-4 space-y-6">
            <div className="space-y-2">
                <h2 className="text-xl font-bold tracking-tight">Things to Do</h2>
                <p className="text-xs text-muted-foreground">
                    Activities and experiences near {destination || 'your destination'}.
                </p>
            </div>

            {loading && (
                <div className="flex justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
            )}

            {!loading && activities.length > 0 && (
                <div className="grid grid-cols-1 gap-4">
                    {activities.map(a => <ActivityCard key={a.code} activity={a} />)}
                </div>
            )}

            {!loading && activities.length === 0 && (
                <div className="text-center py-10 px-4 bg-secondary/20 rounded-2xl border border-dashed border-border">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
                        <Ticket className="w-6 h-6 text-primary" />
                    </div>
                    <p className="text-sm font-bold text-foreground">Activities coming soon</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                        Bookable experiences — water sports, tours, and attractions at your destination —
                        will appear here, powered by Viator.
                    </p>
                </div>
            )}
        </div>
    );
}
