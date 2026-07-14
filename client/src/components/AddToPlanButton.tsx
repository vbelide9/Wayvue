// Small "Add to plan" control for recommendation cards (stops, hotels, activities).
// Adds the item to the current trip's plan (saving the trip first if needed; prompts
// sign-in if signed out). Shows "Added" once it's in the plan.
import { useState } from 'react';
import { Plus, Check, Loader2 } from 'lucide-react';
import { useTripPlan } from '@/lib/TripPlanContext';
import { type NewTripItem } from '@/lib/tripItems';

export function AddToPlanButton({ item, className = '' }: { item: NewTripItem; className?: string }) {
    const { enabled, items, addToPlan } = useTripPlan();
    const [pending, setPending] = useState(false);

    if (!enabled) return null;

    const added = items.some(i => i.kind === item.kind && i.title === item.title);

    const onClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (added || pending) return;
        setPending(true);
        try { await addToPlan(item); }
        finally { setPending(false); }
    };

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={added}
            aria-label={added ? 'Added to plan' : 'Add to plan'}
            className={`inline-flex items-center gap-1 text-xs font-bold rounded-full px-3 py-1.5 border transition-colors ${added
                ? 'text-emerald-600 border-emerald-500/30 bg-emerald-500/10 cursor-default'
                : 'text-primary border-primary/30 bg-primary/10 hover:bg-primary/20'} ${className}`}
        >
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : added ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {added ? 'Added' : 'Add to plan'}
        </button>
    );
}
