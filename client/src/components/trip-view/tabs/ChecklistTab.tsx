// Shared trip checklist. Any member can add to-do items and check them off — everyone on the
// trip sees the same list (RLS-scoped to participants). Items can be assigned to a member,
// given a due date, reordered by drag, and seeded from trip-tailored suggestions. Shows who
// added / completed each. Mirrors PlaylistTab/ExpensesTab gating & patterns.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ListChecks, Plus, Trash2, Check, Loader2, Calendar, User as UserIcon, GripVertical, Sparkles, X } from 'lucide-react';
import { useTripPlan } from '@/lib/TripPlanContext';
import { useGroupTrip } from '@/lib/GroupTripContext';
import { useAuth } from '@/lib/AuthContext';
import { useNotify } from '@/lib/Notifications';
import type { TripMember } from '@/lib/groupTrips';
import {
    listChecklist, addChecklistItem, setChecklistDone, removeChecklistItem, updateChecklistItem,
    reorderChecklist, suggestedChecklistItems,
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

type Filter = 'all' | 'mine' | 'open';

// "in 3 days" / "today" / "2 days ago", plus whether it's overdue for an open item.
function dueMeta(due: string | null, done: boolean): { label: string; overdue: boolean } | null {
    if (!due) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(due + 'T00:00:00');
    const days = Math.round((d.getTime() - today.getTime()) / 86400000);
    const overdue = !done && days < 0;
    const label = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days === -1 ? 'Yesterday'
        : days > 0 ? `in ${days}d` : `${-days}d ago`;
    return { label, overdue };
}

export function ChecklistTab({ destination, placeNames, depDate }: { destination?: string; placeNames?: string[]; depDate?: string }) {
    const { enabled, signedIn, tripId } = useTripPlan();
    const { members, memberById, isGroup } = useGroupTrip();
    const toast = useNotify();

    const [items, setItems] = useState<ChecklistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [title, setTitle] = useState('');
    const [assignee, setAssignee] = useState<string | null>(null);
    const [due, setDue] = useState<string>('');
    const [showDetails, setShowDetails] = useState(false);
    const [adding, setAdding] = useState(false);
    const [filter, setFilter] = useState<Filter>('all');
    const [showSuggest, setShowSuggest] = useState(false);
    const dragId = useRef<string | null>(null);

    const myId = useAuth().user?.id ?? null;

    useEffect(() => {
        if (!tripId) { setItems([]); setLoading(false); return; }
        let cancelled = false;
        setLoading(true);
        listChecklist(tripId).then(i => { if (!cancelled) setItems(i); }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [tripId]);

    const doneCount = useMemo(() => items.reduce((n, i) => n + (i.done ? 1 : 0), 0), [items]);

    // Suggestions not already on the list (case-insensitive title match).
    const suggestions = useMemo(() => {
        const have = new Set(items.map(i => i.title.trim().toLowerCase()));
        return suggestedChecklistItems({ destination, placeNames, depDate }).filter(s => !have.has(s.toLowerCase()));
    }, [items, destination, placeNames, depDate]);

    const addItem = async (text: string, opts?: { assignedTo?: string | null; dueDate?: string | null }) => {
        const t = text.trim();
        if (!t || !tripId) return;
        try {
            const created = await addChecklistItem(tripId, { title: t, assignedTo: opts?.assignedTo ?? null, dueDate: opts?.dueDate ?? null }, items.length);
            if (created) setItems(prev => [...prev, created]);
        } catch (e: any) {
            console.error('[checklist] add failed:', e);
            toast(e?.message || 'Could not add that item.');
        }
    };

    const onAdd = async () => {
        if (!title.trim() || adding) return;
        setAdding(true);
        await addItem(title, { assignedTo: assignee, dueDate: due || null });
        setTitle(''); setAssignee(null); setDue(''); setShowDetails(false);
        setAdding(false);
    };

    const onToggle = async (item: ChecklistItem) => {
        const next = !item.done;
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

    const patchItem = async (id: string, patch: { assignedTo?: string | null; dueDate?: string | null }) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, assigned_to: 'assignedTo' in patch ? patch.assignedTo ?? null : i.assigned_to, due_date: 'dueDate' in patch ? patch.dueDate ?? null : i.due_date } : i));
        try { await updateChecklistItem(id, patch); } catch (e) { console.error('[checklist] patch failed:', e); toast('Could not update that item.'); }
    };

    // Drag reorder (open items only, since completed sink to the bottom).
    const onDrop = async (targetId: string) => {
        const src = dragId.current; dragId.current = null;
        if (!src || src === targetId) return;
        setItems(prev => {
            const arr = [...prev];
            const from = arr.findIndex(i => i.id === src);
            const to = arr.findIndex(i => i.id === targetId);
            if (from < 0 || to < 0) return prev;
            const [moved] = arr.splice(from, 1);
            arr.splice(to, 0, moved);
            reorderChecklist(arr).catch(() => {});
            return arr;
        });
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

    // Filter, then sort: open first (by position), completed last.
    const visible = items
        .filter(i => filter === 'all' ? true : filter === 'mine' ? i.assigned_to === myId : !i.done)
        .sort((a, b) => Number(a.done) - Number(b.done) || a.position - b.position);

    return (
        <div className="p-4 space-y-4">
            <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight flex items-center gap-2"><ListChecks className="w-5 h-5 text-primary" /> Trip Checklist</h2>
                <p className="text-xs text-muted-foreground">
                    {items.length === 0 ? 'Add shared to-dos — assign them, set due dates, check them off.' : `${doneCount} of ${items.length} done`}
                </p>
            </div>

            {items.length > 0 && (
                <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round((doneCount / items.length) * 100)}%` }} />
                </div>
            )}

            {/* Add item */}
            <div className="space-y-2">
                <div className="flex gap-2">
                    <input
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') onAdd(); }}
                        placeholder="Add an item…"
                        className="flex-1 min-w-0 h-11 px-4 text-sm bg-card border border-border rounded-full outline-none focus:border-primary/50"
                    />
                    <button onClick={() => setShowDetails(v => !v)} aria-label="Assignee & due date"
                        className={`h-11 w-11 shrink-0 rounded-full flex items-center justify-center border transition-colors ${showDetails || assignee || due ? 'border-primary/50 text-primary bg-primary/5' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                        <UserIcon className="w-4 h-4" />
                    </button>
                    <button onClick={onAdd} disabled={!title.trim() || adding} aria-label="Add item"
                        className="h-11 w-11 shrink-0 rounded-full flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-default transition-colors">
                        {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-5 h-5" />}
                    </button>
                </div>
                {showDetails && (
                    <div className="flex flex-wrap items-center gap-2 px-1">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Assign</span>
                            <button onClick={() => setAssignee(null)} className={`h-7 px-2.5 rounded-full text-xs font-semibold border ${assignee === null ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground'}`}>Anyone</button>
                            {members.map(m => (
                                <button key={m.userId} onClick={() => setAssignee(m.userId)} title={m.name}
                                    className={`h-7 w-7 rounded-full flex items-center justify-center border ${assignee === m.userId ? 'border-primary ring-1 ring-primary' : 'border-transparent'}`}>
                                    <Avatar member={m} size={24} />
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-1.5 ml-auto">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                            <input type="date" value={due} onChange={e => setDue(e.target.value)}
                                className="h-7 px-2 text-xs bg-secondary/40 border border-border rounded-lg outline-none focus:border-primary/50" />
                        </div>
                    </div>
                )}
            </div>

            {/* Suggestions */}
            {suggestions.length > 0 && (
                <div className="bg-secondary/30 border border-border rounded-2xl p-3">
                    <button onClick={() => setShowSuggest(v => !v)} className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                        <Sparkles className="w-3.5 h-3.5 text-primary" /> Suggested items
                        <span className="text-muted-foreground font-normal">({suggestions.length})</span>
                    </button>
                    {showSuggest && (
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {suggestions.map(s => (
                                <button key={s} onClick={() => addItem(s)}
                                    className="flex items-center gap-1 h-7 px-2.5 rounded-full text-xs font-medium bg-card border border-border text-foreground hover:border-primary/50 transition-colors">
                                    <Plus className="w-3 h-3 text-primary" /> {s}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Filters */}
            {items.length > 0 && (
                <div className="flex gap-1 bg-secondary/40 p-1 rounded-full w-fit">
                    {(['all', 'mine', 'open'] as Filter[]).map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={`h-7 px-3 rounded-full text-xs font-bold capitalize transition-colors ${filter === f ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                            {f === 'mine' ? 'Assigned to me' : f}
                        </button>
                    ))}
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : visible.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{items.length === 0 ? 'Nothing on the list yet.' : 'Nothing matches this filter.'}</p>
            ) : (
                <div className="flex flex-col gap-2">
                    {visible.map(item => {
                        const author = memberById(item.created_by);
                        const completer = item.done && item.completed_by ? memberById(item.completed_by) : undefined;
                        const assigned = item.assigned_to ? memberById(item.assigned_to) : undefined;
                        const dm = dueMeta(item.due_date, item.done);
                        return (
                            <div key={item.id}
                                draggable={!item.done}
                                onDragStart={() => { dragId.current = item.id; }}
                                onDragOver={e => { if (!item.done) e.preventDefault(); }}
                                onDrop={() => onDrop(item.id)}
                                className="group bg-card border border-border rounded-2xl p-3 flex items-center gap-2.5">
                                {!item.done && <GripVertical className="w-4 h-4 text-muted-foreground/40 cursor-grab shrink-0 hidden sm:block" />}
                                <button onClick={() => onToggle(item)} aria-label={item.done ? 'Mark not done' : 'Mark done'} className="shrink-0">
                                    <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${item.done ? 'bg-primary border-primary text-primary-foreground' : 'border-border hover:border-primary/60'}`}>
                                        {item.done && <Check className="w-4 h-4" />}
                                    </span>
                                </button>
                                <div className="min-w-0 flex-1">
                                    <p className={`text-sm font-medium truncate ${item.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{item.title}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {dm && (
                                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${dm.overdue ? 'text-rose-500' : 'text-muted-foreground'}`}>
                                                <Calendar className="w-3 h-3" /> {dm.label}
                                            </span>
                                        )}
                                        <span className="text-[11px] text-muted-foreground truncate">
                                            {completer ? `Done by ${completer.name}` : author ? `Added by ${author.name}` : ''}
                                        </span>
                                    </div>
                                </div>
                                {/* Assignee picker */}
                                <AssignMenu members={members} value={item.assigned_to} assigned={assigned} onChange={uid => patchItem(item.id, { assignedTo: uid })} />
                                <button onClick={() => onRemove(item.id)} aria-label="Delete item" className="p-1.5 rounded-full text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// Small popover to (re)assign an item to a member.
function AssignMenu({ members, value, assigned, onChange }: {
    members: TripMember[]; value: string | null; assigned?: TripMember; onChange: (uid: string | null) => void;
}) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative shrink-0">
            <button onClick={() => setOpen(o => !o)} title={assigned ? `Assigned to ${assigned.name}` : 'Assign'} aria-label="Assign">
                {assigned ? <Avatar member={assigned} size={24} /> : (
                    <span className="w-6 h-6 rounded-full border border-dashed border-border flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:border-primary/50">
                        <UserIcon className="w-3.5 h-3.5" />
                    </span>
                )}
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 top-8 z-20 w-44 bg-card border border-border rounded-xl shadow-soft-lg p-1">
                        <button onClick={() => { onChange(null); setOpen(false); }} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-secondary">
                            <X className="w-3.5 h-3.5" /> Unassigned
                        </button>
                        {members.map(m => (
                            <button key={m.userId} onClick={() => { onChange(m.userId); setOpen(false); }}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs hover:bg-secondary ${value === m.userId ? 'text-primary font-bold' : 'text-foreground'}`}>
                                <Avatar member={m} size={20} /> <span className="truncate">{m.name}</span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
