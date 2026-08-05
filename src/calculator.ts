// src/calculator.ts
// Core debt payoff calculation engine — pure functions, no UI/storage dependencies.
// This is the heart of the app: everything else is UI wrapped around this.

export type PayoffStrategy = 'snowball' | 'avalanche' | 'custom';

export interface Debt {
  id: string;
  name: string;
  balance: number;       // current principal remaining
  apr: number;            // annual percentage rate, e.g. 0.1899 for 18.99%
  minPayment: number;     // minimum required monthly payment
  customOrder?: number;   // used only when strategy === 'custom'
}

export interface MonthlySnapshot {
  month: number;                     // 1-indexed month number
  totalRemaining: number;
  totalInterestPaidThisMonth: number;
  perDebt: {
    debtId: string;
    balanceStart: number;
    interestCharged: number;
    principalPaid: number;
    balanceEnd: number;
    paidOff: boolean;
  }[];
}

export interface PayoffPlan {
  strategy: PayoffStrategy;
  months: MonthlySnapshot[];
  totalMonths: number;
  totalInterestPaid: number;
  payoffDate: Date;
  debtFreeOrder: { debtId: string; name: string; monthPaidOff: number }[];
  /**
   * True when the simulation hit `maxMonths` with debt still outstanding —
   * i.e. the payments entered never clear the balance, usually because a
   * minimum payment is below the monthly interest. When this is set,
   * `payoffDate` and `totalMonths` are floors, not predictions, and the UI
   * must not present them as a real debt-free date.
   */
  neverPaysOff: boolean;
}

/**
 * Orders debts according to the chosen strategy.
 * - snowball: smallest balance first (psychological wins)
 * - avalanche: highest APR first (mathematically optimal)
 * - custom: user-defined order via customOrder field
 */
function orderDebts(debts: Debt[], strategy: PayoffStrategy): Debt[] {
  const copy = [...debts];
  switch (strategy) {
    case 'snowball':
      return copy.sort((a, b) => a.balance - b.balance);
    case 'avalanche':
      return copy.sort((a, b) => b.apr - a.apr);
    case 'custom':
      return copy.sort((a, b) => (a.customOrder ?? 0) - (b.customOrder ?? 0));
  }
}

/**
 * Simulates the full payoff timeline given a fixed extra monthly payment
 * that gets applied to the highest-priority (per strategy) debt, with the
 * "snowball" effect of rolling freed-up minimum payments into extra payment
 * once a debt is paid off.
 */
export function simulatePayoff(
  debts: Debt[],
  strategy: PayoffStrategy,
  extraMonthlyPayment: number,
  startDate: Date = new Date(),
  maxMonths: number = 600 // 50-year safety cap to avoid infinite loops on bad input
): PayoffPlan {
  let working = debts.map((d) => ({ ...d }));
  const priorityOrder = orderDebts(working, strategy).map((d) => d.id);

  const months: MonthlySnapshot[] = [];
  const debtFreeOrder: PayoffPlan['debtFreeOrder'] = [];
  let month = 0;
  let extraPool = extraMonthlyPayment;
  let totalInterestPaid = 0;

  while (working.some((d) => d.balance > 0.01) && month < maxMonths) {
    month += 1;
    // Every dollar of the monthly budget not consumed by a minimum payment ends
    // up here, and pass 2 spends it down the priority order. Nothing is allowed
    // to sit in this pool at the end of a month while debt remains.
    let pool = extraPool;
    const snapshot: MonthlySnapshot = {
      month,
      totalRemaining: 0,
      totalInterestPaidThisMonth: 0,
      perDebt: [],
    };

    // Priority is fixed from the balances at the start of the month, so a debt
    // retired mid-month can't reshuffle the order underneath us.
    const activeInOrder = priorityOrder
      .map((id) => working.find((d) => d.id === id))
      .filter((d): d is Debt => !!d && d.balance > 0.01);

    // Pass 1: charge interest, take minimums, recycle any unused minimum.
    // A debt needing less than its minimum to close out only takes what it
    // needs; the remainder is budget the user still has, so it goes to the pool.
    const charged = new Map<
      string,
      { balanceStart: number; interestCharged: number; payment: number }
    >();

    for (const debt of activeInOrder) {
      const balanceStart = debt.balance;
      const interestCharged = balanceStart * (debt.apr / 12);
      const due = balanceStart + interestCharged;
      const payment = Math.min(debt.minPayment, due);

      pool += debt.minPayment - payment;
      debt.balance = due - payment;

      charged.set(debt.id, { balanceStart, interestCharged, payment });
      totalInterestPaid += interestCharged;
      snapshot.totalInterestPaidThisMonth += interestCharged;
    }

    // Pass 2: spend the pool down the priority order, cascading past each debt
    // as it closes out instead of stranding the leftover on the top debt.
    for (const debt of activeInOrder) {
      if (pool <= 0.01) break;
      if (debt.balance <= 0.01) continue;

      const applied = Math.min(pool, debt.balance);
      debt.balance -= applied;
      pool -= applied;
      charged.get(debt.id)!.payment += applied;
    }

    // Record payoffs in priority order so same-month ties read sensibly.
    for (const debt of activeInOrder) {
      if (debt.balance <= 0.01) {
        debt.balance = 0;
        debtFreeOrder.push({ debtId: debt.id, name: debt.name, monthPaidOff: month });
        // Snowball effect: freed minimum payment joins the pool going forward
        extraPool += debt.minPayment;
      }
    }

    for (const debt of working) {
      const c = charged.get(debt.id);
      if (!c) {
        snapshot.perDebt.push({
          debtId: debt.id,
          balanceStart: 0,
          interestCharged: 0,
          principalPaid: 0,
          balanceEnd: 0,
          paidOff: true,
        });
        continue;
      }
      snapshot.perDebt.push({
        debtId: debt.id,
        balanceStart: c.balanceStart,
        interestCharged: c.interestCharged,
        principalPaid: Math.max(c.payment - c.interestCharged, 0),
        balanceEnd: debt.balance,
        paidOff: debt.balance <= 0.01,
      });
    }

    snapshot.totalRemaining = working.reduce((sum, d) => sum + d.balance, 0);
    months.push(snapshot);
  }

  const payoffDate = new Date(startDate);
  payoffDate.setMonth(payoffDate.getMonth() + month);

  return {
    strategy,
    months,
    totalMonths: month,
    totalInterestPaid,
    payoffDate,
    debtFreeOrder,
    neverPaysOff: working.some((d) => d.balance > 0.01),
  };
}

/** Convenience: compare snowball vs avalanche vs a custom order side by side. */
export function compareStrategies(
  debts: Debt[],
  extraMonthlyPayment: number,
  startDate: Date = new Date()
) {
  return {
    snowball: simulatePayoff(debts, 'snowball', extraMonthlyPayment, startDate),
    avalanche: simulatePayoff(debts, 'avalanche', extraMonthlyPayment, startDate),
  };
}

export function totalMinimumPayments(debts: Debt[]): number {
  return debts.reduce((sum, d) => sum + d.minPayment, 0);
}

export function totalDebt(debts: Debt[]): number {
  return debts.reduce((sum, d) => sum + d.balance, 0);
}
