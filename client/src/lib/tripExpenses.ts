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
/** Net position per member: everything they paid minus everything they owe. */
export function computeBalances(expenses: TripExpense[], memberIds: string[]): Balance[] {
    const net = new Map<string, number>(memberIds.map(id => [id, 0]));
    for (const e of expenses) {
        net.set(e.paid_by, (net.get(e.paid_by) ?? 0) + e.amount_cents);
        for (const s of e.shares) net.set(s.user_id, (net.get(s.user_id) ?? 0) - s.amount_cents);
    }
    return [...net.entries()].map(([userId, n]) => ({ userId, net: n }));
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

export async function removeExpense(id: string): Promise<void> {
    if (!supabase) return;
    // Shares cascade-delete with the parent (FK on delete cascade).
    const { error } = await supabase.from('trip_expenses').delete().eq('id', id);
    if (error) throw error;
}

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
