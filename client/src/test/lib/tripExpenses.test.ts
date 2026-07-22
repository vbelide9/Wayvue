import { describe, expect, it } from 'vitest';
import { splitByWeight, computeShares, computeBalances, simplifyDebts } from '@/lib/tripExpenses';

describe('tripExpenses utilities', () => {
  it('splits a total across weights using largest remainder', () => {
    expect(splitByWeight(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(splitByWeight(5, [1, 1, 1])).toEqual([2, 2, 1]);
  });

  it('computes equal shares for equal split type', () => {
    const shares = computeShares('equal', 100, [
      { userId: 'u1', weight: 1 },
      { userId: 'u2', weight: 1 },
      { userId: 'u3', weight: 1 },
    ]);

    expect(shares).toEqual([
      { userId: 'u1', weight: 34 },
      { userId: 'u2', weight: 33 },
      { userId: 'u3', weight: 33 },
    ]);
  });

  it('computes balances from expenses and settlements', () => {
    const expenses = [
      {
        id: 'e1',
        trip_id: 't1',
        created_by: 'u1',
        paid_by: 'u1',
        description: 'Dinner',
        amount_cents: 600,
        currency: 'USD',
        category: 'food',
        split_type: 'equal' as const,
        created_at: '',
        shares: [
          { id: 's1', expense_id: 'e1', trip_id: 't1', user_id: 'u1', amount_cents: 300, weight: 1 },
          { id: 's2', expense_id: 'e1', trip_id: 't1', user_id: 'u2', amount_cents: 300, weight: 1 },
        ],
      },
    ];

    const balances = computeBalances(expenses, ['u1', 'u2'], []);

    expect(balances).toEqual([
      { userId: 'u1', net: 300 },
      { userId: 'u2', net: -300 },
    ]);
  });

  it('simplifies debts into minimal settlements', () => {
    const settlements = simplifyDebts([
      { userId: 'u1', net: 300 },
      { userId: 'u2', net: -300 },
    ]);

    expect(settlements).toEqual([{ from: 'u2', to: 'u1', amount: 300 }]);
  });
});
