// Splitwise-style trip expenses (Supabase). Any trip member can add/remove expenses — RLS
// scopes it to participants (is_trip_member). Each expense has one payer and a total; the
// split is materialized into per-member shares (trip_expense_shares) so balances are a pure
// aggregation. All money is in integer cents; splits sum back to the total exactly.
import { supabase } from './supabase';

export type SplitType = 'equal' | 'exact' | 'shares' | 'percent';

/** Per-member input to a split. `weight` means: equal → ignored; shares → share count;
 *  percent → percent (0–100); exact → the exact cents that member owes. */
export interface ShareInput {
    userId: string;
    weight: number;
}

export interface ExpenseShare {
    id: string;
    expense_id: string;
    trip_id: string;
    user_id: string;
    amount_cents: number;
    weight: number;
}

export interface TripExpense {
    id: string;
    trip_id: string;
    created_by: string;
    paid_by: string;
    description: string;
    amount_cents: number;
    currency: string;
    category: string | null;
    split_type: SplitType;
    created_at: string;
    shares: ExpenseShare[];
}

/** A member's net position across all trip expenses (positive = owed money / paid more than
 *  their share; negative = owes money). */
export interface Balance {
    userId: string;
    net: number; // cents; paid − owed
}

/** A single "A pays B $X" transaction from the debt-simplification pass. */
export interface Settlement {
    from: string; // userId who pays
    to: string;   // userId who receives
    amount: number; // cents
}

/** A recorded (actually-paid) settlement. */
export interface TripSettlement {
    id: string;
    trip_id: string;
    from_user: string;
    to_user: string;
    amount_cents: number;
    currency: string;
    created_by: string;
    created_at: string;
}

// ── Split math ────────────────────────────────────────────────────────────────
// Distribute `total` cents across the given integer/float weights using the
// largest-remainder method, so the parts always sum back to `total` exactly (any leftover
// cents go to the members with the biggest fractional remainder — deterministic and fair).
export function splitByWeight(total: number, weights: number[]): number[] {
    const sum = weights.reduce((s, w) => s + w, 0);
    if (sum <= 0) return weights.map(() => 0);
    const raw = weights.map(w => (total * w) / sum);
    const floors = raw.map(Math.floor);
    let remainder = total - floors.reduce((s, f) => s + f, 0);
    // Order members by descending fractional part; hand out the leftover cents one at a time.
    const order = raw
        .map((v, i) => ({ i, frac: v - Math.floor(v) }))
        .sort((a, b) => b.frac - a.frac);
    const out = [...floors];
    for (let k = 0; k < order.length && remainder > 0; k++, remainder--) out[order[k].i]++;
    return out;
}

/** Resolve the amount (cents) each participant owes for one expense from the split method.
 *  For 'exact', the caller's weights ARE the owed cents (validate they sum to the total). */
export function computeShares(splitType: SplitType, totalCents: number, inputs: ShareInput[]): ShareInput[] {
    const participants = inputs.filter(i => (splitType === 'equal' ? true : i.weight > 0));
    if (participants.length === 0) return [];
    if (splitType === 'exact') {
        // Weights are literal owed cents; return as-is (UI enforces the sum).
        return participants.map(p => ({ userId: p.userId, weight: Math.round(p.weight) }));
    }
    const weights = splitType === 'equal' ? participants.map(() => 1) : participants.map(p => p.weight);
    const amounts = splitByWeight(totalCents, weights);
    return participants.map((p, i) => ({ userId: p.userId, weight: amounts[i] }));
}

// ── Balances & debt simplification ─────────────────────────────────────────────
/** Net position per member: everything they paid minus everything they owe, folding in any
 *  recorded settlements (a payer's net rises, a receiver's net falls). Operates on a single
 *  currency slice — group with `groupByCurrency` first for multi-currency trips. */
export function computeBalances(expenses: TripExpense[], memberIds: string[], settlements: TripSettlement[] = []): Balance[] {
    const net = new Map<string, number>(memberIds.map(id => [id, 0]));
    for (const e of expenses) {
        net.set(e.paid_by, (net.get(e.paid_by) ?? 0) + e.amount_cents);
        for (const s of e.shares) net.set(s.user_id, (net.get(s.user_id) ?? 0) - s.amount_cents);
    }
    for (const s of settlements) {
        net.set(s.from_user, (net.get(s.from_user) ?? 0) + s.amount_cents);
        net.set(s.to_user, (net.get(s.to_user) ?? 0) - s.amount_cents);
    }
    // Only surface members who actually appear in this currency's activity.
    const active = new Set<string>();
    expenses.forEach(e => { active.add(e.paid_by); e.shares.forEach(s => active.add(s.user_id)); });
    settlements.forEach(s => { active.add(s.from_user); active.add(s.to_user); });
    return [...net.entries()].filter(([id]) => active.has(id)).map(([userId, n]) => ({ userId, net: n }));
}

/** Split expenses + settlements into per-currency slices (most trips have exactly one). */
export interface CurrencySlice {
    currency: string;
    expenses: TripExpense[];
    settlements: TripSettlement[];
    total: number;
}
export function groupByCurrency(expenses: TripExpense[], settlements: TripSettlement[]): CurrencySlice[] {
    const map = new Map<string, CurrencySlice>();
    const slice = (cur: string) => {
        let s = map.get(cur);
        if (!s) { s = { currency: cur, expenses: [], settlements: [], total: 0 }; map.set(cur, s); }
        return s;
    };
    for (const e of expenses) { const s = slice(e.currency || 'USD'); s.expenses.push(e); s.total += e.amount_cents; }
    for (const st of settlements) slice(st.currency || 'USD').settlements.push(st);
    return [...map.values()].sort((a, b) => b.total - a.total);
}

/** Spend totals grouped by category (for the summary). */
export function categoryTotals(expenses: TripExpense[]): { category: string; cents: number }[] {
    const m = new Map<string, number>();
    for (const e of expenses) m.set(e.category || 'other', (m.get(e.category || 'other') ?? 0) + e.amount_cents);
    return [...m.entries()].map(([category, cents]) => ({ category, cents })).sort((a, b) => b.cents - a.cents);
}

/** Per-member paid vs. share-of-costs (for the summary). */
export function memberSpend(expenses: TripExpense[], memberIds: string[]): { userId: string; paid: number; share: number }[] {
    const paid = new Map<string, number>(memberIds.map(id => [id, 0]));
    const share = new Map<string, number>(memberIds.map(id => [id, 0]));
    for (const e of expenses) {
        paid.set(e.paid_by, (paid.get(e.paid_by) ?? 0) + e.amount_cents);
        for (const s of e.shares) share.set(s.user_id, (share.get(s.user_id) ?? 0) + s.amount_cents);
    }
    return memberIds.map(id => ({ userId: id, paid: paid.get(id) ?? 0, share: share.get(id) ?? 0 }))
        .filter(r => r.paid > 0 || r.share > 0);
}

/** Minimize the number of transactions that settle everyone up (greedy min-cash-flow):
 *  repeatedly match the biggest creditor with the biggest debtor. Produces ≤ n−1 transfers. */
export function simplifyDebts(balances: Balance[]): Settlement[] {
    const creditors = balances.filter(b => b.net > 0).map(b => ({ ...b })).sort((a, b) => b.net - a.net);
    const debtors = balances.filter(b => b.net < 0).map(b => ({ id: b.userId, owe: -b.net })).sort((a, b) => b.owe - a.owe);
    const settlements: Settlement[] = [];
    let ci = 0, di = 0;
    while (ci < creditors.length && di < debtors.length) {
        const give = Math.min(creditors[ci].net, debtors[di].owe);
        if (give > 0) settlements.push({ from: debtors[di].id, to: creditors[ci].userId, amount: give });
        creditors[ci].net -= give;
        debtors[di].owe -= give;
        if (creditors[ci].net === 0) ci++;
        if (debtors[di].owe === 0) di++;
    }
    return settlements;
}

// ── Data access ────────────────────────────────────────────────────────────────
export async function listExpenses(tripId: string): Promise<TripExpense[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('trip_expenses')
        .select('*, shares:trip_expense_shares(*)')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as TripExpense[];
}

export interface NewExpense {
    description: string;
    amountCents: number;
    paidBy: string;
    currency?: string;
    category?: string | null;
    splitType: SplitType;
    /** Resolved owed cents per participant (already run through computeShares). */
    shares: { userId: string; amountCents: number; weight: number }[];
}

export async function addExpense(tripId: string, e: NewExpense): Promise<TripExpense | null> {
    if (!supabase) return null;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw new Error('Sign in to add an expense.');

    const { data: expense, error } = await supabase
        .from('trip_expenses')
        .insert({
            trip_id: tripId, created_by: uid, paid_by: e.paidBy, description: e.description,
            amount_cents: e.amountCents, currency: e.currency || 'USD', category: e.category ?? null,
            split_type: e.splitType,
        })
        .select()
        .single();
    if (error) throw error;

    const rows = e.shares.map(s => ({
        expense_id: expense.id, trip_id: tripId, user_id: s.userId,
        amount_cents: s.amountCents, weight: s.weight,
    }));
    const { data: shares, error: sErr } = await supabase.from('trip_expense_shares').insert(rows).select();
    if (sErr) {
        // Roll back the parent so we never leave an expense with no shares (which would skew balances).
        await supabase.from('trip_expenses').delete().eq('id', expense.id);
        throw sErr;
    }
    return { ...(expense as TripExpense), shares: (shares || []) as ExpenseShare[] };
}

/** Edit an expense in place: update the parent row and replace its shares. */
export async function updateExpense(id: string, tripId: string, e: NewExpense): Promise<TripExpense | null> {
    if (!supabase) return null;
    const { data: expense, error } = await supabase
        .from('trip_expenses')
        .update({
            paid_by: e.paidBy, description: e.description, amount_cents: e.amountCents,
            currency: e.currency || 'USD', category: e.category ?? null, split_type: e.splitType,
        })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    // Replace shares wholesale (simpler + correct than diffing).
    await supabase.from('trip_expense_shares').delete().eq('expense_id', id);
    const rows = e.shares.map(s => ({ expense_id: id, trip_id: tripId, user_id: s.userId, amount_cents: s.amountCents, weight: s.weight }));
    const { data: shares, error: sErr } = await supabase.from('trip_expense_shares').insert(rows).select();
    if (sErr) throw sErr;
    return { ...(expense as TripExpense), shares: (shares || []) as ExpenseShare[] };
}

export async function removeExpense(id: string): Promise<void> {
    if (!supabase) return;
    // Shares cascade-delete with the parent (FK on delete cascade).
    const { error } = await supabase.from('trip_expenses').delete().eq('id', id);
    if (error) throw error;
}

// ── Settlements ──────────────────────────────────────────────────────────────────
export async function listSettlements(tripId: string): Promise<TripSettlement[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('trip_settlements')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as TripSettlement[];
}

export async function addSettlement(tripId: string, s: { fromUser: string; toUser: string; amountCents: number; currency: string }): Promise<TripSettlement | null> {
    if (!supabase) return null;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw new Error('Sign in to record a payment.');
    const { data, error } = await supabase
        .from('trip_settlements')
        .insert({ trip_id: tripId, from_user: s.fromUser, to_user: s.toUser, amount_cents: s.amountCents, currency: s.currency, created_by: uid })
        .select()
        .single();
    if (error) throw error;
    return data as TripSettlement;
}

export async function removeSettlement(id: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from('trip_settlements').delete().eq('id', id);
    if (error) throw error;
}

/** Common currencies for the picker. Value is the ISO 4217 code passed to Intl. Amounts are
 *  stored as a uniform ×100 fixed-point integer regardless of currency, so splits sum exactly
 *  and Intl handles each currency's symbol/decimals at display time. */
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR', 'MXN'] as const;

// ── Formatting ──────────────────────────────────────────────────────────────────
export function formatMoney(cents: number, currency = 'USD'): string {
    try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
    } catch {
        return `$${(cents / 100).toFixed(2)}`;
    }
}

/** Parse a user-typed amount ("$42.50", "42,5") into integer cents, or null if invalid. */
export function parseAmountToCents(input: string): number | null {
    const cleaned = input.replace(/[^0-9.,]/g, '').replace(',', '.');
    if (!cleaned) return null;
    const value = Number(cleaned);
    if (!isFinite(value) || value <= 0) return null;
    return Math.round(value * 100);
}
