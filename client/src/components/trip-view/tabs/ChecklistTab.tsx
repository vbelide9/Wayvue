// Shared trip checklist. Any member can add to-do items and check them off — everyone on the
// trip sees the same list (RLS-scoped to participants). Shows who added each item and who
// completed it. Mirrors PlaylistTab/ExpensesTab gating & patterns.
import { useEffect, useMemo, useState } from 'react';
import { ListChecks, Plus, Trash2, Check, Loader2 } from 'lucide-react';
import { useTripPlan } from '@/lib/TripPlanContext';
import { useGroupTrip } from '@/lib/GroupTripContext';
import { useNotify } from '@/lib/Notifications';
import type { TripMember } from '@/lib/groupTrips';
import {
    listChecklist, addChecklistItem, setChecklistDone, removeChecklistItem,
    type ChecklistItem,
} from '@/lib/tripChecklist';

function Avatar({ member, size = 20 }: { member?: TripMember; size?: number }) {
    if (!member) return null;
    const initials = member.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
    return (
        <div title={member.name} style={{ width: size, height: size, fontSize: size * 0.4 }}
            className="rounded-full overflow-hidden bg-primary/10 text-primary font-bold flex items-center justify-center border border-card ring-1 ring-border/60 shrink-0">
            {member.avatar ? <img src={member.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <span>{initials}</span>}
        </div>
    );
}

export function ChecklistTab() {
    const { enabled, signedIn, tripId } = useTripPlan();
    const { memberById, isGroup } = useGroupTrip();
    const toast = useNotify();

    const [items, setItems] = useState<ChecklistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [title, setTitle] = useState('');
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        if (!tripId) { setItems([]); setLoading(false); return; }
        let cancelled = false;
        setLoading(true);
        listChecklist(tripId).then(i => { if (!cancelled) setItems(i); }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [tripId]);

    const doneCount = useMemo(() => items.reduce((n, i) => n + (i.done ? 1 : 0), 0), [items]);

    const onAdd = async () => {
        const t = title.trim();
        if (!t || !tripId || adding) return;
        setAdding(true);
        try {
            const created = await addChecklistItem(tripId, t);
            if (created) { setItems(prev => [...prev, created]); setTitle(''); }
        } catch (e: any) {
            console.error('[checklist] add failed:', e);
            toast(e?.message || 'Could not add that item.');
        } finally {
            setAdding(false);
        }
    };

    const onToggle = async (item: ChecklistItem) => {
        const next = !item.done;
        // Optimistic; reconcile with the server row (completed_by/at) on success.
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, done: next } : i));
        try {
            const updated = await setChecklistDone(item.id, next);
            if (updated) setItems(prev => prev.map(i => i.id === item.id ? updated : i));
        } catch (e) {
            console.error('[checklist] toggle failed:', e);
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, done: item.done } : i));
            toast('Could not update that item.');
        }
    };

    const onRemove = async (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id));
        try { await removeChecklistItem(id); } catch (e) { console.error('[checklist] remove failed:', e); toast('Could not delete that item.'); }
    };

    if (!enabled) return <div className="p-6 text-center text-sm text-muted-foreground">Community features aren’t configured.</div>;
    if (!signedIn || !tripId) {
        return (
            <div className="p-8 text-center">
                <ListChecks className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm font-bold text-foreground">Shared trip checklist</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    Tap <span className="font-semibold">Save</span> in the top bar to save this trip, then add to-dos — everyone on the trip can check them off.
                </p>
            </div>
        );
    }
    if (!isGroup) {
        return (
            <div className="p-8 text-center">
                <ListChecks className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm font-bold text-foreground">Invite your travel buddies</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    The shared checklist opens up once someone else joins this trip. Share the invite link from <span className="font-semibold">My Plan</span> to plan together.
                </p>
            </div>
        );
    }

    // Not-done first (in add order), then completed items.
    const sorted = [...items].sort((a, b) => Number(a.done) - Number(b.done));

    return (
        <div className="p-4 space-y-4">
            <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight flex items-center gap-2"><ListChecks className="w-5 h-5 text-primary" /> Trip Checklist</h2>
                <p className="text-xs text-muted-foreground">
                    {items.length === 0 ? 'Add shared to-dos — everyone can check them off.' : `${doneCount} of ${items.length} done`}
                </p>
            </div>

            {/* Progress bar */}
            {items.length > 0 && (
                <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round((doneCount / items.length) * 100)}%` }} />
                </div>
            )}

            {/* Add item */}
            <div className="flex gap-2">
                <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') onAdd(); }}
                    placeholder="Add an item…"
                    className="flex-1 min-w-0 h-11 px-4 text-sm bg-card border border-border rounded-full outline-none focus:border-primary/50"
                />
                <button
                    onClick={onAdd}
                    disabled={!title.trim() || adding}
                    aria-label="Add item"
                    className="h-11 w-11 shrink-0 rounded-full flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-default transition-colors"
                >
                    {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-5 h-5" />}
                </button>
            </div>

            {/* List */}
            {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nothing on the list yet.</p>
            ) : (
                <div className="flex flex-col gap-2">
                    {sorted.map(item => {
                        const author = memberById(item.created_by);
                        const completer = item.done && item.completed_by ? memberById(item.completed_by) : undefined;
                        return (
                            <div key={item.id} className="group bg-card border border-border rounded-2xl p-3 flex items-center gap-3">
                                <button onClick={() => onToggle(item)} aria-label={item.done ? 'Mark not done' : 'Mark done'} className="shrink-0">
                                    <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${item.done ? 'bg-primary border-primary text-primary-foreground' : 'border-border hover:border-primary/60'}`}>
                                        {item.done && <Check className="w-4 h-4" />}
                                    </span>
                                </button>
                                <div className="min-w-0 flex-1">
                                    <p className={`text-sm font-medium truncate ${item.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{item.title}</p>
                                    <p className="text-[11px] text-muted-foreground truncate">
                                        {completer ? `Done by ${completer.name}` : author ? `Added by ${author.name}` : ''}
                                    </p>
                                </div>
                                {(completer || author) && <Avatar member={completer || author} size={22} />}
                                <button onClick={() => onRemove(item.id)} aria-label="Delete item" className="p-1.5 rounded-full text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
