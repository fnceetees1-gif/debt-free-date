// src/history.ts
// Actual payment history — what the user really paid, as opposed to what the
// simulation projects. This is what separates a tracker from a calculator:
// the projection tells you where you're going, the log tells you where you've
// been, and the gap between them is the interesting part.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Debt } from './calculator';
import { generateId } from './storage';

const PAYMENTS_KEY = 'debtPayoff:payments';

export interface PaymentRecord {
  id: string;
  debtId: string;
  debtName: string; // denormalized so history survives deleting a debt
  date: string; // ISO 8601
  amount: number;
  interestPortion: number;
  principalPortion: number;
  balanceBefore: number;
  balanceAfter: number;
  clearedDebt: boolean;
}

export async function loadPayments(): Promise<PaymentRecord[]> {
  const raw = await AsyncStorage.getItem(PAYMENTS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PaymentRecord[];
  } catch {
    return [];
  }
}

async function savePayments(payments: PaymentRecord[]): Promise<void> {
  await AsyncStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments));
}

/**
 * Splits a payment into interest and principal exactly the way the simulation
 * does, so logged history and projected timeline stay directly comparable.
 * Returns the record plus the debt's new balance.
 */
export function applyPayment(
  debt: Debt,
  amount: number,
  when: Date = new Date()
): { record: PaymentRecord; newBalance: number } {
  const balanceBefore = debt.balance;

  // Interest accrues in full regardless of what you pay. Keep it separate from
  // the interest *portion of this payment* — conflating them silently discards
  // unpaid interest and under-reports the debt.
  const interestAccrued = balanceBefore * (debt.apr / 12);
  const payoffAmount = balanceBefore + interestAccrued;

  // Paying more than the payoff amount doesn't overpay the lender, so only the
  // amount that actually lands on this debt is recorded.
  const effective = Math.min(amount, payoffAmount);

  const interestPortion = Math.min(interestAccrued, effective);
  const principalPortion = effective - interestPortion;
  const newBalance = Math.max(payoffAmount - effective, 0);

  return {
    newBalance,
    record: {
      id: generateId(),
      debtId: debt.id,
      debtName: debt.name,
      date: when.toISOString(),
      amount: effective,
      interestPortion,
      principalPortion,
      balanceBefore,
      balanceAfter: newBalance,
      clearedDebt: newBalance <= 0.01,
    },
  };
}

export async function recordPayment(record: PaymentRecord): Promise<void> {
  const all = await loadPayments();
  all.push(record);
  await savePayments(all);
}

export async function deletePayment(id: string): Promise<PaymentRecord | null> {
  const all = await loadPayments();
  const found = all.find((p) => p.id === id) ?? null;
  await savePayments(all.filter((p) => p.id !== id));
  return found;
}

export interface HistoryTotals {
  totalPaid: number;
  totalPrincipal: number;
  totalInterest: number;
  paymentCount: number;
  debtsCleared: number;
  firstPaymentDate: Date | null;
  currentStreak: number; // consecutive calendar months with at least one payment
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

export function summarize(payments: PaymentRecord[]): HistoryTotals {
  if (payments.length === 0) {
    return {
      totalPaid: 0,
      totalPrincipal: 0,
      totalInterest: 0,
      paymentCount: 0,
      debtsCleared: 0,
      firstPaymentDate: null,
      currentStreak: 0,
    };
  }

  let totalPaid = 0;
  let totalPrincipal = 0;
  let totalInterest = 0;
  let debtsCleared = 0;
  let earliest = Number.POSITIVE_INFINITY;
  const months = new Set<string>();

  for (const p of payments) {
    totalPaid += p.amount;
    totalPrincipal += p.principalPortion;
    totalInterest += p.interestPortion;
    if (p.clearedDebt) debtsCleared += 1;
    const t = new Date(p.date);
    earliest = Math.min(earliest, t.getTime());
    months.add(monthKey(t));
  }

  // Walk backwards from the current month while each month has a payment.
  let streak = 0;
  const cursor = new Date();
  cursor.setDate(1);
  while (months.has(monthKey(cursor))) {
    streak += 1;
    cursor.setMonth(cursor.getMonth() - 1);
  }

  return {
    totalPaid,
    totalPrincipal,
    totalInterest,
    paymentCount: payments.length,
    debtsCleared,
    firstPaymentDate: new Date(earliest),
    currentStreak: streak,
  };
}

/** Total balance across all debts at each month that had activity, oldest first. */
export function balanceTimeline(
  payments: PaymentRecord[]
): { label: string; balance: number }[] {
  if (payments.length === 0) return [];

  const sorted = [...payments].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Running balance per debt, snapshotted at the end of each calendar month.
  const perDebt = new Map<string, number>();
  const out: { label: string; balance: number }[] = [];
  let currentKey: string | null = null;

  const pushSnapshot = (d: Date) => {
    let total = 0;
    for (const v of perDebt.values()) total += v;
    out.push({
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      balance: total,
    });
  };

  for (const p of sorted) {
    const when = new Date(p.date);
    const key = monthKey(when);
    if (currentKey !== null && key !== currentKey) {
      // Close out the previous month before moving on.
      const prev = new Date(when);
      prev.setMonth(prev.getMonth() - 1);
      pushSnapshot(prev);
    }
    // Seed with the pre-payment balance the first time we see a debt.
    if (!perDebt.has(p.debtId)) perDebt.set(p.debtId, p.balanceBefore);
    perDebt.set(p.debtId, p.balanceAfter);
    currentKey = key;
  }

  const last = sorted[sorted.length - 1];
  if (last) pushSnapshot(new Date(last.date));

  return out;
}
