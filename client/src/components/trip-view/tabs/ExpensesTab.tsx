// Splitwise-style expense splitting for group trips. Any member can log a shared expense,
// split it equally / by exact amounts / by shares / by percentage, edit it, see everyone's
// running balance (per currency), record real payments ("mark as paid"), settle up via a
// minimized set of transfers, and view a category / per-member spend summary. Collaborative
// via RLS — everyone on the trip sees the same ledger. Mirrors PlaylistTab's gating.
import { useEffect, useMemo, useState } from 'react';
import { Wallet, Plus, Trash2, Loader2, Check, ArrowRight, Scale, X, Pencil, PieChart, Undo2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useTripPlan } from '@/lib/TripPlanContext';
import { useGroupTrip } from '@/lib/GroupTripContext';
import { useNotify } from '@/lib/Notifications';
import type { TripMember } from '@/lib/groupTrips';
import {
    listExpenses, addExpense, updateExpense, removeExpense,
    listSettlements, addSettlement, removeSettlement,
    computeBalances, simplifyDebts, groupByCurrency, categoryTotals, memberSpend,
    splitByWeight, formatMoney, parseAmountToCents, CURRENCIES,
    type TripExpense, type TripSettlement, type SplitType, type Settlement, type CurrencySlice, type NewExpense,
} from '@/lib/tripExpenses';

const SPLIT_TABS: { id: SplitType; label: string }[] = [
    { id: 'equal', label: 'Equally' },
    { id: 'shares', label: 'By shares' },
    { id: 'percent', label: 'By %' },
    { id: 'exact', label: 'Exact' },
];
const CATEGORIES = ['food', 'fuel', 'lodging', 'activity', 'other'] as const;
const SPLIT_LABEL: Record<SplitType, string> = {
    equal: 'split equally', exact: 'split by exact amounts', shares: 'split by shares', percent: 'split by %',
};

function Avatar({ member, size = 24 }: { member?: TripMember; size?: number }) {
    const initials = (member?.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    return (
        <div title={member?.name} style={{ width: size, height: size, fontSize: size * 0.38 }}
            className="rounded-full overflow-hidden bg-primary/10 text-primary font-bold flex items-center justify-center border border-card ring-1 ring-border/60 shrink-0">
            {member?.avatar ? <img src={member.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <span>{initials}</span>}
        </div>
    );
}

export function ExpensesTab() {
    const { user } = useAuth();
    const { enabled, signedIn, tripId } = useTripPlan();
    const { members, memberById, isGroup } = useGroupTrip();
    const toast = useNotify();

    const [expenses, setExpenses] = useState<TripExpense[]>([]);
    const [settled, setSettled] = useState<TripSettlement[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<TripExpense | null>(null);
    const [showSettle, setShowSettle] = useState(false);
    const [showSummary, setShowSummary] = useState(false);

    const reload = () => {
        if (!tripId) { setExpenses([]); setSettled([]); setLoading(false); return () => {}; }
        let cancelled = false;
        setLoading(true);
        Promise.all([listExpenses(tripId), listSettlements(tripId)])
            .then(([e, s]) => { if (!cancelled) { setExpenses(e); setSettled(s); } })
            .catch(() => {})
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    };
    useEffect(reload, [tripId]);

    const memberIds = useMemo(() => members.map(m => m.userId), [members]);
    const slices = useMemo(() => groupByCurrency(expenses, settled), [expenses, settled]);
    const multiCurrency = slices.length > 1;

    const onSaved = (e: TripExpense, mode: 'add' | 'edit') => {
        setExpenses(prev => mode === 'add' ? [e, ...prev] : prev.map(x => x.id === e.id ? e : x));
        setShowForm(false); setEditing(null);
    };
    const onRemove = async (id: string) => {
        setExpenses(prev => prev.filter(e => e.id !== id));
        try { await removeExpense(id); } catch (err) { console.error('[expenses] remove failed:', err); toast('Could not delete that expense.'); }
    };
    const onSettle = async (s: Settlement, currency: string) => {
        if (!tripId) return;
        try {
            const rec = await addSettlement(tripId, { fromUser: s.from, toUser: s.to, amountCents: s.amount, currency });
            if (rec) setSettled(prev => [rec, ...prev]);
        } catch (e) { console.error('[expenses] settle failed:', e); toast('Could not record that payment.'); }
    };
    const onUnsettle = async (id: string) => {
        setSettled(prev => prev.filter(s => s.id !== id));
        try { await removeSettlement(id); } catch (e) { console.error('[expenses] unsettle failed:', e); toast('Could not undo that payment.'); }
    };

    if (!enabled) return <div className="p-6 text-center text-sm text-muted-foreground">Community features aren’t configured.</div>;
    if (!signedIn || !tripId) {
        return (
            <div className="p-8 text-center">
                <Wallet className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm font-bold text-foreground">Split trip costs</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    Tap <span className="font-semibold">Save</span> in the top bar to save this trip, then log shared expenses — everyone on the trip can add and settle up.
                </p>
            </div>
        );
    }
    if (!isGroup) {
        return (
            <div className="p-8 text-center">
                <Wallet className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm font-bold text-foreground">Invite your travel buddies</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    Expense splitting kicks in once someone else joins this trip. Share the invite link from <span className="font-semibold">My Plan</span> to start splitting costs.
                </p>
            </div>
        );
    }

    // Header summary — single-currency shows your net; multi-currency stays neutral.
    const primary = slices[0];
    const myNet = !multiCurrency && primary
        ? computeBalances(primary.expenses, memberIds, primary.settlements).find(b => b.userId === user?.id)?.net ?? 0
        : 0;

    const startEdit = (e: TripExpense) => { setEditing(e); setShowForm(true); setShowSettle(false); setShowSummary(false); };

    return (
        <div className="p-4 space-y-4">
            {/* Header + summary */}
            <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight flex items-center gap-2"><Wallet className="w-5 h-5 text-primary" /> Trip Expenses</h2>
                <p className="text-xs text-muted-foreground">
                    {expenses.length === 0 ? 'Log a shared cost and split it any way you like.'
                        : multiCurrency ? `${expenses.length} expenses across ${slices.length} currencies`
                        : <>Total spent <span className="font-semibold text-foreground">{formatMoney(primary.total, primary.currency)}</span> · {
                            myNet === 0 ? 'you’re all settled'
                                : myNet > 0 ? <>you’re owed <span className="font-semibold text-emerald-500">{formatMoney(myNet, primary.currency)}</span></>
                                    : <>you owe <span className="font-semibold text-rose-500">{formatMoney(-myNet, primary.currency)}</span></>
                        }</>}
                </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
                <button onClick={() => { setShowForm(v => !v || !!editing); setEditing(null); setShowSettle(false); setShowSummary(false); }}
                    className="flex-1 h-10 rounded-full text-sm font-bold flex items-center justify-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                    {showForm && !editing ? <><X className="w-4 h-4" /> Close</> : <><Plus className="w-4 h-4" /> Add expense</>}
                </button>
                <button onClick={() => { setShowSettle(v => !v); setShowForm(false); setEditing(null); setShowSummary(false); }}
                    disabled={expenses.length === 0}
                    className="h-10 px-4 rounded-full text-sm font-bold flex items-center justify-center gap-1.5 bg-secondary text-foreground border border-border hover:border-primary/40 disabled:opacity-40 disabled:cursor-default transition-colors">
                    <Scale className="w-4 h-4" /> Settle up
                </button>
                <button onClick={() => { setShowSummary(v => !v); setShowForm(false); setEditing(null); setShowSettle(false); }}
                    disabled={expenses.length === 0} aria-label="Summary"
                    className="h-10 px-3 rounded-full text-sm font-bold flex items-center justify-center bg-secondary text-foreground border border-border hover:border-primary/40 disabled:opacity-40 disabled:cursor-default transition-colors">
                    <PieChart className="w-4 h-4" />
                </button>
            </div>

            {showForm && (
                <ExpenseForm key={editing?.id || 'new'} members={members} defaultPayer={user?.id} tripId={tripId}
                    editing={editing} onSaved={onSaved} onCancel={() => { setShowForm(false); setEditing(null); }} onError={m => toast(m)} />
            )}

            {showSettle && slices.map(slice => (
                <SettleUp key={slice.currency} slice={slice} memberIds={memberIds} memberById={memberById}
                    showCurrencyLabel={multiCurrency} onSettle={onSettle} onUnsettle={onUnsettle} />
            ))}

            {showSummary && slices.map(slice => (
                <Summary key={slice.currency} slice={slice} memberIds={memberIds} memberById={memberById} showCurrencyLabel={multiCurrency} />
            ))}

            {/* Balances (per currency) */}
            {expenses.length > 0 && !showSettle && !showSummary && slices.map(slice => {
                const balances = computeBalances(slice.expenses, memberIds, slice.settlements);
                return (
                    <div key={slice.currency} className="bg-card border border-border rounded-2xl p-4 space-y-2.5">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Balances{multiCurrency ? ` · ${slice.currency}` : ''}
                        </p>
                        {balances.map(b => {
                            const m = memberById(b.userId);
                            return (
                                <div key={b.userId} className="flex items-center gap-2.5">
                                    <Avatar member={m} size={26} />
                                    <span className="text-sm font-medium text-foreground flex-1 truncate">{m?.name || 'Member'}{b.userId === user?.id && ' (you)'}</span>
                                    <span className={`text-sm font-bold tabular-nums ${b.net > 0 ? 'text-emerald-500' : b.net < 0 ? 'text-rose-500' : 'text-muted-foreground'}`}>
                                        {b.net === 0 ? 'settled' : b.net > 0 ? `+${formatMoney(b.net, slice.currency)}` : `−${formatMoney(-b.net, slice.currency)}`}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                );
            })}

            {/* Expense list */}
            {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : expenses.length === 0 ? (
                !showForm && <p className="text-sm text-muted-foreground text-center py-6">No expenses yet.</p>
            ) : (
                <div className="flex flex-col gap-2">
                    {expenses.map(e => {
                        const payer = memberById(e.paid_by);
                        const myShare = e.shares.find(s => s.user_id === user?.id)?.amount_cents ?? 0;
                        return (
                            <div key={e.id} className="group bg-card border border-border rounded-2xl p-3 flex items-center gap-3">
                                <Avatar member={payer} size={34} />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-foreground truncate">{e.description}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {payer?.userId === user?.id ? 'You' : payer?.name || 'Someone'} paid · {SPLIT_LABEL[e.split_type]}
                                        {myShare > 0 && <> · your share {formatMoney(myShare, e.currency)}</>}
                                    </p>
                                </div>
                                <span className="text-sm font-bold text-foreground tabular-nums shrink-0">{formatMoney(e.amount_cents, e.currency)}</span>
                                <button onClick={() => startEdit(e)} aria-label="Edit expense" className="p-1.5 rounded-full text-muted-foreground/60 hover:text-primary hover:bg-primary/10 shrink-0"><Pencil className="w-3.5 h-3.5" /></button>
                                <button onClick={() => onRemove(e.id)} aria-label="Delete expense" className="p-1.5 rounded-full text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ── Settle up (per currency) ────────────────────────────────────────────────────
function SettleUp({ slice, memberIds, memberById, showCurrencyLabel, onSettle, onUnsettle }: {
    slice: CurrencySlice;
    memberIds: string[];
    memberById: (id: string) => TripMember | undefined;
    showCurrencyLabel: boolean;
    onSettle: (s: Settlement, currency: string) => void;
    onUnsettle: (id: string) => void;
}) {
    const balances = computeBalances(slice.expenses, memberIds, slice.settlements);
    const suggestions = simplifyDebts(balances);
    return (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-primary" />
                <p className="text-sm font-bold text-foreground">Settle up{showCurrencyLabel ? ` · ${slice.currency}` : ''}</p>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">The fewest payments that clear every balance. Tap “Mark as paid” once someone pays.</p>
            {suggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Everyone’s settled up.</p>
            ) : suggestions.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                    <Avatar member={memberById(s.from)} size={26} />
                    <span className="font-medium text-foreground truncate max-w-[22%]">{memberById(s.from)?.name || 'Member'}</span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    <Avatar member={memberById(s.to)} size={26} />
                    <span className="font-medium text-foreground truncate max-w-[22%]">{memberById(s.to)?.name || 'Member'}</span>
                    <span className="ml-auto font-bold text-foreground tabular-nums shrink-0">{formatMoney(s.amount, slice.currency)}</span>
                    <button onClick={() => onSettle(s, slice.currency)} className="shrink-0 h-7 px-2.5 rounded-full text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90">Mark paid</button>
                </div>
            ))}

            {/* Recorded payments */}
            {slice.settlements.length > 0 && (
                <div className="pt-3 mt-1 border-t border-border space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Recorded payments</p>
                    {slice.settlements.map(st => (
                        <div key={st.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span className="truncate"><span className="font-semibold text-foreground">{memberById(st.from_user)?.name || 'Member'}</span> paid <span className="font-semibold text-foreground">{memberById(st.to_user)?.name || 'Member'}</span></span>
                            <span className="ml-auto font-bold text-foreground tabular-nums shrink-0">{formatMoney(st.amount_cents, st.currency)}</span>
                            <button onClick={() => onUnsettle(st.id)} aria-label="Undo payment" className="p-1 rounded-full hover:text-foreground shrink-0"><Undo2 className="w-3.5 h-3.5" /></button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Summary (per currency) ──────────────────────────────────────────────────────
function Summary({ slice, memberIds, memberById, showCurrencyLabel }: {
    slice: CurrencySlice; memberIds: string[]; memberById: (id: string) => TripMember | undefined; showCurrencyLabel: boolean;
}) {
    const cats = categoryTotals(slice.expenses);
    const spend = memberSpend(slice.expenses, memberIds);
    const max = Math.max(1, ...cats.map(c => c.cents));
    return (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-primary" />
                <p className="text-sm font-bold text-foreground">Summary{showCurrencyLabel ? ` · ${slice.currency}` : ''}</p>
                <span className="ml-auto text-sm font-bold tabular-nums">{formatMoney(slice.total, slice.currency)}</span>
            </div>

            {/* By category */}
            <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">By category</p>
                {cats.map(c => (
                    <div key={c.category} className="space-y-1">
                        <div className="flex justify-between text-xs">
                            <span className="capitalize font-medium text-foreground">{c.category}</span>
                            <span className="tabular-nums text-muted-foreground">{formatMoney(c.cents, slice.currency)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.round((c.cents / max) * 100)}%` }} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Per member */}
            <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Per person</p>
                {spend.map(s => {
                    const m = memberById(s.userId);
                    return (
                        <div key={s.userId} className="flex items-center gap-2.5 text-xs">
                            <Avatar member={m} size={24} />
                            <span className="font-medium text-foreground flex-1 truncate">{m?.name || 'Member'}</span>
                            <span className="text-muted-foreground">paid <span className="font-semibold text-foreground tabular-nums">{formatMoney(s.paid, slice.currency)}</span></span>
                            <span className="text-muted-foreground">· share <span className="font-semibold text-foreground tabular-nums">{formatMoney(s.share, slice.currency)}</span></span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Add / edit expense form ─────────────────────────────────────────────────────
function ExpenseForm({ members, defaultPayer, tripId, editing, onSaved, onCancel, onError }: {
    members: TripMember[];
    defaultPayer?: string;
    tripId: string;
    editing: TripExpense | null;
    onSaved: (e: TripExpense, mode: 'add' | 'edit') => void;
    onCancel: () => void;
    onError: (m: string) => void;
}) {
    // Prefill from the expense being edited (reconstruct the raw split inputs from its shares).
    const initWeights = (): Record<string, string> => {
        if (!editing) return {};
        const w: Record<string, string> = {};
        for (const s of editing.shares) {
            if (editing.split_type === 'exact') w[s.user_id] = (s.amount_cents / 100).toFixed(2);
            else if (editing.split_type !== 'equal') w[s.user_id] = String(s.weight);
        }
        return w;
    };
    const [description, setDescription] = useState(editing?.description || '');
    const [amount, setAmount] = useState(editing ? (editing.amount_cents / 100).toFixed(2) : '');
    const [currency, setCurrency] = useState(editing?.currency || 'USD');
    const [category, setCategory] = useState<string>(editing?.category || 'food');
    const [paidBy, setPaidBy] = useState<string>(editing?.paid_by || defaultPayer || members[0]?.userId || '');
    const [splitType, setSplitType] = useState<SplitType>(editing?.split_type || 'equal');
    const [selected, setSelected] = useState<Set<string>>(
        new Set(editing ? editing.shares.map(s => s.user_id) : members.map(m => m.userId)));
    const [weights, setWeights] = useState<Record<string, string>>(initWeights);
    const [saving, setSaving] = useState(false);

    const parts = members.filter(m => selected.has(m.userId));
    // In 'exact' mode the total IS the sum of the per-person amounts — the user shouldn't also
    // have to type a separate total. For every other mode, the typed amount is the total.
    const exactSumCents = parts.reduce((sum, p) => sum + (parseAmountToCents(weights[p.userId] ?? '') ?? 0), 0);
    const totalCents = splitType === 'exact' ? exactSumCents : (parseAmountToCents(amount) ?? 0);

    const toggle = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const setWeight = (id: string, v: string) => setWeights(w => ({ ...w, [id]: v }));
    const fmt = (c: number) => formatMoney(c, currency);

    const { owed, error } = useMemo(() => {
        const owed = new Map<string, number>();
        if (parts.length === 0) return { owed, error: 'Pick who’s splitting this.' };
        if (totalCents <= 0) return { owed, error: null };
        const ids = parts.map(p => p.userId);
        if (splitType === 'equal') {
            splitByWeight(totalCents, ids.map(() => 1)).forEach((c, i) => owed.set(ids[i], c));
            return { owed, error: null };
        }
        if (splitType === 'shares') {
            const ws = ids.map(id => Math.max(0, Number(weights[id] ?? '1') || 0));
            if (ws.every(w => w === 0)) return { owed, error: 'Give at least one person a share.' };
            splitByWeight(totalCents, ws).forEach((c, i) => owed.set(ids[i], c));
            return { owed, error: null };
        }
        if (splitType === 'percent') {
            const ws = ids.map(id => Math.max(0, Number(weights[id] ?? '') || 0));
            const sum = ws.reduce((s, w) => s + w, 0);
            splitByWeight(totalCents, ws).forEach((c, i) => owed.set(ids[i], c));
            if (Math.abs(sum - 100) > 0.01) return { owed, error: `Percentages add up to ${+sum.toFixed(2)}% — they need to total 100%.` };
            return { owed, error: null };
        }
        // exact: each input IS the amount that person owes; the total is their sum (above).
        const cents = ids.map(id => parseAmountToCents(weights[id] ?? '') ?? 0);
        cents.forEach((c, i) => owed.set(ids[i], c));
        if (cents.every(c => c === 0)) return { owed, error: null };
        return { owed, error: null };
    }, [parts, totalCents, splitType, weights, currency]);

    const canSave = description.trim() && totalCents > 0 && paidBy && !error && parts.length > 0 && !saving;
    // Why the Add button is disabled (shown when there's no harder validation error).
    const disabledReason = !description.trim() ? 'Add a description'
        : totalCents <= 0 ? (splitType === 'exact' ? 'Enter each person’s amount' : 'Enter an amount')
        : parts.length === 0 ? 'Pick who’s splitting this' : null;

    const submit = async () => {
        if (!canSave) return;
        setSaving(true);
        try {
            const rawWeight = (id: string): number => {
                if (splitType === 'equal') return 1;
                if (splitType === 'exact') return parseAmountToCents(weights[id] ?? '') ?? 0;
                return Number(weights[id] ?? (splitType === 'shares' ? '1' : '0')) || 0;
            };
            const shares = parts.map(p => ({ userId: p.userId, amountCents: owed.get(p.userId) ?? 0, weight: rawWeight(p.userId) }));
            const payload: NewExpense = { description: description.trim(), amountCents: totalCents, paidBy, currency, category, splitType, shares };
            if (editing) {
                const updated = await updateExpense(editing.id, tripId, payload);
                if (updated) onSaved(updated, 'edit');
            } else {
                const created = await addExpense(tripId, payload);
                if (created) onSaved(created, 'add');
            }
        } catch (e: any) {
            console.error('[expenses] save failed:', e);
            onError(e?.message || 'Could not save that expense.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
            {editing && (
                <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-foreground">Edit expense</p>
                    <button onClick={onCancel} aria-label="Cancel edit" className="p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                </div>
            )}
            {/* Description + amount + currency */}
            <div className="flex gap-2">
                <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What was it for?"
                    className="flex-1 min-w-0 h-10 px-3 text-sm bg-secondary/40 border border-border rounded-xl outline-none focus:border-primary/50" />
                <input
                    value={splitType === 'exact' ? (totalCents > 0 ? (totalCents / 100).toFixed(2) : '') : amount}
                    onChange={e => setAmount(e.target.value)}
                    readOnly={splitType === 'exact'}
                    inputMode="decimal"
                    placeholder={splitType === 'exact' ? 'auto' : '0.00'}
                    title={splitType === 'exact' ? 'Total is the sum of each person’s exact amount' : undefined}
                    className={`w-20 h-10 px-3 text-sm bg-secondary/40 border border-border rounded-xl outline-none focus:border-primary/50 tabular-nums ${splitType === 'exact' ? 'text-muted-foreground cursor-default' : ''}`} />
                <select value={currency} onChange={e => setCurrency(e.target.value)}
                    className="h-10 px-2 text-sm bg-secondary/40 border border-border rounded-xl outline-none focus:border-primary/50">
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>

            {/* Category */}
            <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map(c => (
                    <button key={c} onClick={() => setCategory(c)}
                        className={`h-7 px-3 rounded-full text-xs font-semibold capitalize transition-colors ${category === c ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'}`}>
                        {c}
                    </button>
                ))}
            </div>

            {/* Paid by */}
            <div className="space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Paid by</p>
                <div className="flex flex-wrap gap-1.5">
                    {members.map(m => (
                        <button key={m.userId} onClick={() => setPaidBy(m.userId)}
                            className={`flex items-center gap-1.5 h-8 pl-1 pr-3 rounded-full text-xs font-semibold border transition-colors ${paidBy === m.userId ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-secondary/40 text-muted-foreground hover:text-foreground'}`}>
                            <Avatar member={m} size={22} /> {m.userId === defaultPayer ? 'You' : m.name.split(' ')[0]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Split method */}
            <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Split</p>
                <div className="grid grid-cols-4 gap-1 bg-secondary/40 p-1 rounded-xl">
                    {SPLIT_TABS.map(t => (
                        <button key={t.id} onClick={() => setSplitType(t.id)}
                            className={`h-8 rounded-lg text-xs font-bold transition-colors ${splitType === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Participants + per-method inputs */}
            <div className="space-y-1.5">
                {members.map(m => {
                    const on = selected.has(m.userId);
                    const owedC = owed.get(m.userId);
                    return (
                        <div key={m.userId} className={`flex items-center gap-2.5 p-2 rounded-xl transition-opacity ${on ? '' : 'opacity-40'}`}>
                            <button onClick={() => toggle(m.userId)} className="shrink-0" aria-label={on ? 'Exclude' : 'Include'}>
                                <span className={`w-5 h-5 rounded-md border flex items-center justify-center ${on ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                                    {on && <Check className="w-3.5 h-3.5" />}
                                </span>
                            </button>
                            <Avatar member={m} size={26} />
                            <span className="text-sm font-medium text-foreground flex-1 truncate">{m.userId === defaultPayer ? 'You' : m.name}</span>

                            {on && splitType === 'shares' && (
                                <input value={weights[m.userId] ?? '1'} onChange={e => setWeight(m.userId, e.target.value)} inputMode="numeric"
                                    className="w-14 h-8 px-2 text-sm text-center bg-secondary/40 border border-border rounded-lg outline-none focus:border-primary/50 tabular-nums" />
                            )}
                            {on && splitType === 'percent' && (
                                <div className="flex items-center gap-1">
                                    <input value={weights[m.userId] ?? ''} onChange={e => setWeight(m.userId, e.target.value)} inputMode="decimal" placeholder="0"
                                        className="w-14 h-8 px-2 text-sm text-center bg-secondary/40 border border-border rounded-lg outline-none focus:border-primary/50 tabular-nums" />
                                    <span className="text-xs text-muted-foreground">%</span>
                                </div>
                            )}
                            {on && splitType === 'exact' && (
                                <input value={weights[m.userId] ?? ''} onChange={e => setWeight(m.userId, e.target.value)} inputMode="decimal" placeholder="0.00"
                                    className="w-20 h-8 px-2 text-sm text-right bg-secondary/40 border border-border rounded-lg outline-none focus:border-primary/50 tabular-nums" />
                            )}
                            {on && splitType === 'equal' && (
                                <span className="text-sm font-semibold text-muted-foreground tabular-nums">{owedC != null ? fmt(owedC) : ''}</span>
                            )}
                            {on && (splitType === 'shares' || splitType === 'percent') && owedC != null && (
                                <span className="text-xs text-muted-foreground tabular-nums w-16 text-right">{fmt(owedC)}</span>
                            )}
                        </div>
                    );
                })}
            </div>

            {error ? <p className="text-xs text-rose-500 font-medium">{error}</p>
                : disabledReason && !saving ? <p className="text-xs text-muted-foreground">{disabledReason}</p> : null}

            <button onClick={submit} disabled={!canSave}
                className="w-full h-10 rounded-full text-sm font-bold flex items-center justify-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-default transition-colors">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? <>Save changes</> : <>Add {totalCents > 0 ? fmt(totalCents) : 'expense'}</>}
            </button>
        </div>
    );
}
