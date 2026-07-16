// Splitwise-style expense splitting for group trips. Any member can log a shared expense,
// split it equally / by exact amounts / by shares / by percentage, see everyone's running
// balance, and "settle up" via a minimized set of payments (debt simplification). Collaborative
// via RLS — everyone on the trip sees the same ledger. Mirrors PlaylistTab's gating/patterns.
import { useEffect, useMemo, useState } from 'react';
import { Wallet, Plus, Trash2, Loader2, Check, ArrowRight, Scale, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useTripPlan } from '@/lib/TripPlanContext';
import { useGroupTrip } from '@/lib/GroupTripContext';
import { useNotify } from '@/lib/Notifications';
import type { TripMember } from '@/lib/groupTrips';
import {
    listExpenses, addExpense, removeExpense, computeBalances, simplifyDebts,
    splitByWeight, formatMoney, parseAmountToCents,
    type TripExpense, type SplitType, type Settlement,
} from '@/lib/tripExpenses';

const SPLIT_TABS: { id: SplitType; label: string }[] = [
    { id: 'equal', label: 'Equally' },
    { id: 'shares', label: 'By shares' },
    { id: 'percent', label: 'By %' },
    { id: 'exact', label: 'Exact' },
];

const CATEGORIES = ['food', 'fuel', 'lodging', 'activity', 'other'] as const;

function Avatar({ member, size = 24 }: { member?: TripMember; size?: number }) {
    const initials = (member?.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    return (
        <div
            title={member?.name}
            style={{ width: size, height: size, fontSize: size * 0.38 }}
            className="rounded-full overflow-hidden bg-primary/10 text-primary font-bold flex items-center justify-center border border-card ring-1 ring-border/60 shrink-0"
        >
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
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [showSettle, setShowSettle] = useState(false);

    useEffect(() => {
        if (!tripId) { setExpenses([]); setLoading(false); return; }
        let cancelled = false;
        setLoading(true);
        listExpenses(tripId).then(e => { if (!cancelled) setExpenses(e); }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [tripId]);

    // ── Balances + settlements (derived) ────────────────────────────────────────
    const memberIds = useMemo(() => members.map(m => m.userId), [members]);
    const balances = useMemo(() => computeBalances(expenses, memberIds), [expenses, memberIds]);
    const settlements = useMemo(() => simplifyDebts(balances), [balances]);
    const totalSpent = expenses.reduce((s, e) => s + e.amount_cents, 0);
    const currency = expenses[0]?.currency || 'USD';
    const myNet = balances.find(b => b.userId === user?.id)?.net ?? 0;

    const onAdded = (e: TripExpense) => { setExpenses(prev => [e, ...prev]); setShowForm(false); };
    const onRemove = async (id: string) => {
        setExpenses(prev => prev.filter(e => e.id !== id));
        try { await removeExpense(id); } catch (err) { console.error('[expenses] remove failed:', err); toast('Could not delete that expense.'); }
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

    return (
        <div className="p-4 space-y-4">
            {/* Header + summary */}
            <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight flex items-center gap-2"><Wallet className="w-5 h-5 text-primary" /> Trip Expenses</h2>
                <p className="text-xs text-muted-foreground">
                    {expenses.length === 0
                        ? 'Log a shared cost and split it any way you like.'
                        : <>Total spent <span className="font-semibold text-foreground">{formatMoney(totalSpent, currency)}</span> · {
                            myNet === 0 ? 'you’re all settled'
                                : myNet > 0 ? <>you’re owed <span className="font-semibold text-emerald-500">{formatMoney(myNet, currency)}</span></>
                                    : <>you owe <span className="font-semibold text-rose-500">{formatMoney(-myNet, currency)}</span></>
                        }</>}
                </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
                <button
                    onClick={() => { setShowForm(v => !v); setShowSettle(false); }}
                    className="flex-1 h-10 rounded-full text-sm font-bold flex items-center justify-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                    {showForm ? <><X className="w-4 h-4" /> Close</> : <><Plus className="w-4 h-4" /> Add expense</>}
                </button>
                <button
                    onClick={() => { setShowSettle(v => !v); setShowForm(false); }}
                    disabled={settlements.length === 0}
                    className="h-10 px-4 rounded-full text-sm font-bold flex items-center justify-center gap-1.5 bg-secondary text-foreground border border-border hover:border-primary/40 disabled:opacity-40 disabled:cursor-default transition-colors"
                >
                    <Scale className="w-4 h-4" /> Settle up
                </button>
            </div>

            {showForm && <ExpenseForm members={members} defaultPayer={user?.id} tripId={tripId} onAdded={onAdded} onError={m => toast(m)} />}

            {/* Settle up — simplified debts */}
            {showSettle && (
                <SettleUp settlements={settlements} memberById={memberById} currency={currency} />
            )}

            {/* Balances */}
            {expenses.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-4 space-y-2.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Balances</p>
                    {balances.map(b => {
                        const m = memberById(b.userId);
                        return (
                            <div key={b.userId} className="flex items-center gap-2.5">
                                <Avatar member={m} size={26} />
                                <span className="text-sm font-medium text-foreground flex-1 truncate">{m?.name || 'Member'}{b.userId === user?.id && ' (you)'}</span>
                                <span className={`text-sm font-bold tabular-nums ${b.net > 0 ? 'text-emerald-500' : b.net < 0 ? 'text-rose-500' : 'text-muted-foreground'}`}>
                                    {b.net === 0 ? 'settled' : b.net > 0 ? `+${formatMoney(b.net, currency)}` : `−${formatMoney(-b.net, currency)}`}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

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
                            <div key={e.id} className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3">
                                <Avatar member={payer} size={34} />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-foreground truncate">{e.description}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {payer?.userId === user?.id ? 'You' : payer?.name || 'Someone'} paid · {SPLIT_LABEL[e.split_type]}
                                        {myShare > 0 && <> · your share {formatMoney(myShare, e.currency)}</>}
                                    </p>
                                </div>
                                <span className="text-sm font-bold text-foreground tabular-nums shrink-0">{formatMoney(e.amount_cents, e.currency)}</span>
                                <button onClick={() => onRemove(e.id)} aria-label="Delete expense" className="p-1.5 rounded-full text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

const SPLIT_LABEL: Record<SplitType, string> = {
    equal: 'split equally', exact: 'split by exact amounts', shares: 'split by shares', percent: 'split by %',
};

// ── Settle up ─────────────────────────────────────────────────────────────────
function SettleUp({ settlements, memberById, currency }: {
    settlements: Settlement[];
    memberById: (id: string) => TripMember | undefined;
    currency: string;
}) {
    return (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-primary" />
                <p className="text-sm font-bold text-foreground">Simplified settle-up</p>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">The fewest payments that clear every balance.</p>
            {settlements.length === 0 ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Everyone’s settled up.</p>
            ) : settlements.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                    <Avatar member={memberById(s.from)} size={26} />
                    <span className="font-medium text-foreground truncate max-w-[28%]">{memberById(s.from)?.name || 'Member'}</span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    <Avatar member={memberById(s.to)} size={26} />
                    <span className="font-medium text-foreground truncate max-w-[28%]">{memberById(s.to)?.name || 'Member'}</span>
                    <span className="ml-auto font-bold text-foreground tabular-nums shrink-0">{formatMoney(s.amount, currency)}</span>
                </div>
            ))}
        </div>
    );
}

// ── Add-expense form ──────────────────────────────────────────────────────────
function ExpenseForm({ members, defaultPayer, tripId, onAdded, onError }: {
    members: TripMember[];
    defaultPayer?: string;
    tripId: string;
    onAdded: (e: TripExpense) => void;
    onError: (m: string) => void;
}) {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState<string>('food');
    const [paidBy, setPaidBy] = useState<string>(defaultPayer || members[0]?.userId || '');
    const [splitType, setSplitType] = useState<SplitType>('equal');
    const [selected, setSelected] = useState<Set<string>>(new Set(members.map(m => m.userId)));
    const [weights, setWeights] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const totalCents = parseAmountToCents(amount) ?? 0;
    const parts = members.filter(m => selected.has(m.userId));

    const toggle = (id: string) => setSelected(s => {
        const next = new Set(s);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });
    const setWeight = (id: string, v: string) => setWeights(w => ({ ...w, [id]: v }));

    // Live preview of who owes what, plus a validation error for exact/percent.
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
        // exact: each input is a currency amount
        const cents = ids.map(id => parseAmountToCents(weights[id] ?? '') ?? 0);
        cents.forEach((c, i) => owed.set(ids[i], c));
        const sum = cents.reduce((s, c) => s + c, 0);
        if (sum !== totalCents) return { owed, error: `Shares add up to ${formatMoney(sum)} — they need to total ${formatMoney(totalCents)}.` };
        return { owed, error: null };
    }, [parts, totalCents, splitType, weights]);

    const canSave = description.trim() && totalCents > 0 && paidBy && !error && parts.length > 0 && !saving;

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
            const created = await addExpense(tripId, {
                description: description.trim(), amountCents: totalCents, paidBy, category, splitType, shares,
            });
            if (created) onAdded(created);
        } catch (e: any) {
            console.error('[expenses] add failed:', e);
            onError(e?.message || 'Could not add that expense.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
            {/* Description + amount */}
            <div className="flex gap-2">
                <input
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="What was it for?"
                    className="flex-1 min-w-0 h-10 px-3 text-sm bg-secondary/40 border border-border rounded-xl outline-none focus:border-primary/50"
                />
                <input
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="w-24 h-10 px-3 text-sm bg-secondary/40 border border-border rounded-xl outline-none focus:border-primary/50 tabular-nums"
                />
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
                                <span className="text-sm font-semibold text-muted-foreground tabular-nums">{owedC != null ? formatMoney(owedC) : ''}</span>
                            )}
                            {on && splitType !== 'equal' && splitType !== 'exact' && owedC != null && (
                                <span className="text-xs text-muted-foreground tabular-nums w-16 text-right">{formatMoney(owedC)}</span>
                            )}
                        </div>
                    );
                })}
            </div>

            {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}

            <button onClick={submit} disabled={!canSave}
                className="w-full h-10 rounded-full text-sm font-bold flex items-center justify-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-default transition-colors">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Add {totalCents > 0 ? formatMoney(totalCents) : 'expense'}</>}
            </button>
        </div>
    );
}
