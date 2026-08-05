// src/calculator.test.ts
// Quick sanity test - run with: npx tsx src/calculator.test.ts
import { simulatePayoff, compareStrategies, totalDebt, totalMinimumPayments, Debt } from './calculator';
import { applyPayment } from './history';

const sampleDebts: Debt[] = [
  { id: 'student', name: 'Student Loan', balance: 2000, apr: 0.08, minPayment: 60 },
  { id: 'cc2', name: 'Visa (high APR)', balance: 5000, apr: 0.24, minPayment: 140 },
  { id: 'personal', name: 'Personal Loan', balance: 1000, apr: 0.05, minPayment: 40 },
  { id: 'car', name: 'Car Loan', balance: 8000, apr: 0.15, minPayment: 220 },
];

console.log('=== Debt Free Date - Calculation Engine Test ===\n');
console.log('Total starting debt: $' + totalDebt(sampleDebts).toFixed(2));
console.log('Total minimum payments: $' + totalMinimumPayments(sampleDebts).toFixed(2) + '/mo');

const extraPayment = 300;

const result = compareStrategies(sampleDebts, extraPayment);
const snowball = result.snowball;
const avalanche = result.avalanche;

function summarize(label: string, plan: ReturnType<typeof simulatePayoff>) {
  console.log('\n--- ' + label + ' ---');
  console.log('Debt-free in: ' + plan.totalMonths + ' months (' + (plan.totalMonths / 12).toFixed(1) + ' years)');
  console.log('Payoff date: ' + plan.payoffDate.toDateString());
  console.log('Total interest paid: $' + plan.totalInterestPaid.toFixed(2));
  console.log('Order debts get eliminated:');
  plan.debtFreeOrder.forEach(function (d, i) {
    console.log('  ' + (i + 1) + '. ' + d.name + ' - paid off month ' + d.monthPaidOff);
  });
}

summarize('SNOWBALL (smallest balance first)', snowball);
summarize('AVALANCHE (highest APR first)', avalanche);

const interestSaved = snowball.totalInterestPaid - avalanche.totalInterestPaid;
console.log('\nAvalanche saves $' + interestSaved.toFixed(2) + ' in interest vs snowball on this debt set.');
console.log('(This is the exact comparison view the app should show the user up front.)');

// --- Assertions -------------------------------------------------------------
// These guard the invariants that a payoff engine cannot violate. The engine
// previously stranded budget in any month where a debt was retired, which made
// avalanche finish LATER than snowball while paying less interest.

let failures = 0;
function check(label: string, condition: boolean, detail: string) {
  if (condition) {
    console.log('  PASS  ' + label);
  } else {
    failures += 1;
    console.log('  FAIL  ' + label + ' -> ' + detail);
  }
}

console.log('\n=== Assertions ===');

const budget = totalMinimumPayments(sampleDebts) + extraPayment;

// 1. Budget conservation: every month except the last must spend the full
//    budget. The final month legitimately underspends (debt ran out).
for (const plan of [snowball, avalanche]) {
  let leaks = 0;
  let worstMonth = 0;
  let worstGap = 0;
  for (const m of plan.months) {
    if (m.month === plan.totalMonths) continue;
    const spent = m.perDebt.reduce((s, d) => s + d.interestCharged + d.principalPaid, 0);
    const gap = budget - spent;
    if (gap > 0.01) {
      leaks += 1;
      if (gap > worstGap) { worstGap = gap; worstMonth = m.month; }
    }
  }
  check(
    plan.strategy + ': spends full $' + budget + ' budget every month before payoff',
    leaks === 0,
    leaks + ' month(s) underspent, worst was month ' + worstMonth + ' stranding $' + worstGap.toFixed(2)
  );
}

// 2. Money in equals money out: principal + interest must equal what was paid.
for (const plan of [snowball, avalanche]) {
  const paid = plan.months.reduce(
    (s, m) => s + m.perDebt.reduce((t, d) => t + d.interestCharged + d.principalPaid, 0), 0);
  const owed = totalDebt(sampleDebts) + plan.totalInterestPaid;
  check(
    plan.strategy + ': total paid reconciles with principal + interest',
    Math.abs(paid - owed) < 0.01,
    'paid $' + paid.toFixed(2) + ' vs owed $' + owed.toFixed(2)
  );
}

// 3. Avalanche is the interest-optimal ordering by construction, so it can
//    never pay more interest or take longer than snowball on the same budget.
check(
  'avalanche pays no more interest than snowball',
  avalanche.totalInterestPaid <= snowball.totalInterestPaid + 0.01,
  'avalanche $' + avalanche.totalInterestPaid.toFixed(2) + ' vs snowball $' + snowball.totalInterestPaid.toFixed(2)
);
check(
  'avalanche finishes no later than snowball',
  avalanche.totalMonths <= snowball.totalMonths,
  'avalanche ' + avalanche.totalMonths + ' months vs snowball ' + snowball.totalMonths
);

// 4. Every debt must actually reach zero and be reported exactly once.
for (const plan of [snowball, avalanche]) {
  check(
    plan.strategy + ': all ' + sampleDebts.length + ' debts reported as paid off',
    plan.debtFreeOrder.length === sampleDebts.length,
    'only ' + plan.debtFreeOrder.length + ' recorded'
  );
  const last = plan.months[plan.months.length - 1];
  check(
    plan.strategy + ': no balance remains at payoff',
    last !== undefined && last.totalRemaining <= 0.01,
    last ? '$' + last.totalRemaining.toFixed(2) + ' left over' : 'no months simulated'
  );
}

// 5. A minimum payment below the monthly interest can never clear the debt.
//    The engine must flag that rather than emitting a bogus payoff date.
const underwater: Debt[] = [
  // $10k at 24% accrues $200/mo; a $50 minimum never touches principal.
  { id: 'trap', name: 'Maxed card', balance: 10000, apr: 0.24, minPayment: 50 },
];
const trapped = simulatePayoff(underwater, 'avalanche', 0);
check(
  'flags debts whose minimum never covers interest',
  trapped.neverPaysOff,
  'reported a payoff at month ' + trapped.totalMonths
);

// The same debt with enough extra payment must resolve normally.
const rescued = simulatePayoff(underwater, 'avalanche', 400);
check(
  'same debt clears once extra payment exceeds interest',
  !rescued.neverPaysOff && rescued.totalMonths > 0 && rescued.totalMonths < 600,
  'neverPaysOff=' + rescued.neverPaysOff + ', months=' + rescued.totalMonths
);

// 6. Zero-interest debts are a real case (0% promo balance transfers) and must
//    divide cleanly rather than producing NaN.
const zeroApr: Debt[] = [
  { id: 'promo', name: '0% transfer', balance: 1200, apr: 0, minPayment: 100 },
];
const promoPlan = simulatePayoff(zeroApr, 'snowball', 0);
check(
  '0% APR debt pays off in exactly balance/payment months',
  promoPlan.totalMonths === 12 && promoPlan.totalInterestPaid === 0,
  promoPlan.totalMonths + ' months, $' + promoPlan.totalInterestPaid.toFixed(2) + ' interest'
);

// --- Payment logging -------------------------------------------------------
// applyPayment must split interest/principal exactly the way the simulation
// does, or logged history and the projected timeline will disagree.

const payDebt: Debt = {
  id: 'x',
  name: 'Card',
  balance: 1000,
  apr: 0.12, // 1% per month → $10 interest on $1000
  minPayment: 50,
};

const { record: r1, newBalance: b1 } = applyPayment(payDebt, 50);
check(
  'payment splits interest and principal like the engine',
  Math.abs(r1.interestPortion - 10) < 0.01 && Math.abs(r1.principalPortion - 40) < 0.01,
  `interest $${r1.interestPortion.toFixed(2)}, principal $${r1.principalPortion.toFixed(2)}`
);
check(
  'payment reduces balance by the principal portion only',
  Math.abs(b1 - 960) < 0.01,
  'balance became $' + b1.toFixed(2)
);
check(
  'interest + principal always equals the amount paid',
  Math.abs(r1.interestPortion + r1.principalPortion - r1.amount) < 0.01,
  `${r1.interestPortion} + ${r1.principalPortion} != ${r1.amount}`
);

// Overpaying must not drive the balance negative or invent principal.
const { record: r2, newBalance: b2 } = applyPayment(payDebt, 5000);
check(
  'overpayment clamps the balance at zero and flags the debt cleared',
  b2 === 0 && r2.clearedDebt,
  `balance $${b2.toFixed(2)}, cleared=${r2.clearedDebt}`
);

// A payment smaller than the interest owed is a real case — it must record
// zero principal rather than negative principal.
const { record: r3, newBalance: b3 } = applyPayment(payDebt, 4);
check(
  'payment below interest records no principal and grows the balance',
  r3.principalPortion === 0 && b3 > payDebt.balance,
  `principal $${r3.principalPortion.toFixed(2)}, balance $${b3.toFixed(2)}`
);

// A 0% debt puts the whole payment against principal.
const zeroDebt: Debt = { id: 'z', name: 'Promo', balance: 500, apr: 0, minPayment: 100 };
const { record: r4, newBalance: b4 } = applyPayment(zeroDebt, 100);
check(
  '0% APR payment is entirely principal',
  r4.interestPortion === 0 && Math.abs(b4 - 400) < 0.01,
  `interest $${r4.interestPortion.toFixed(2)}, balance $${b4.toFixed(2)}`
);

if (failures > 0) {
  console.log('\n' + failures + ' assertion(s) FAILED');
  process.exit(1);
}
console.log('\nAll assertions passed.');
