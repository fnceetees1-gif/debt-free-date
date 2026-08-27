// src/calculator.test.ts
// Quick sanity test - run with: npx tsx src/calculator.test.ts
import { simulatePayoff, compareStrategies, totalDebt, totalMinimumPayments, Debt } from './calculator';
import { applyPayment, balanceAfterUndo } from './history';
import { parseAmount, formatMoney } from './format';

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

// --- Undoing a payment -----------------------------------------------------
// Every payment in the history has its own Undo button, so any of them can be
// removed — not just the newest. Restoring balanceBefore looked right until you
// undo an older payment, at which point every later payment silently vanishes
// from the balance while staying visible in the history.

const undoDebt: Debt = { id: 'u', name: 'Card', balance: 1000, apr: 0, minPayment: 50 };

// Two payments: 1000 -> 900 -> 800.
const { record: u1, newBalance: after1 } = applyPayment(undoDebt, 100);
const { record: u2, newBalance: after2 } = applyPayment({ ...undoDebt, balance: after1 }, 100);

check(
  'two payments walk the balance down as expected',
  Math.abs(after1 - 900) < 0.01 && Math.abs(after2 - 800) < 0.01,
  `after1 $${after1.toFixed(2)}, after2 $${after2.toFixed(2)}`
);

// Undoing the NEWEST payment is the easy case: 800 -> 900.
check(
  'undoing the newest payment restores the previous balance',
  Math.abs(balanceAfterUndo(after2, u2) - 900) < 0.01,
  `got $${balanceAfterUndo(after2, u2).toFixed(2)}, want $900.00`
);

// Undoing the OLDER payment must leave the newer one intact: 800 -> 900,
// not 1000. This is the bug: restoring u1.balanceBefore would give 1000 and
// throw away the second payment.
check(
  'undoing an older payment keeps later payments applied',
  Math.abs(balanceAfterUndo(after2, u1) - 900) < 0.01,
  `got $${balanceAfterUndo(after2, u1).toFixed(2)}, want $900.00 (naive restore gives $1000.00)`
);

// Undo is order-independent: removing both, in either order, returns to 1000.
const bothUndone = balanceAfterUndo(balanceAfterUndo(after2, u1), u2);
const bothUndoneReversed = balanceAfterUndo(balanceAfterUndo(after2, u2), u1);
check(
  'undoing both payments returns to the original balance, in either order',
  Math.abs(bothUndone - 1000) < 0.01 && Math.abs(bothUndoneReversed - 1000) < 0.01,
  `$${bothUndone.toFixed(2)} and $${bothUndoneReversed.toFixed(2)}`
);

// A payment that grew the balance (below-interest) must reverse the other way.
const growDebt: Debt = { id: 'g', name: 'Grower', balance: 1000, apr: 0.24, minPayment: 5 };
const { record: g1, newBalance: grown } = applyPayment(growDebt, 5);
check(
  'undoing a below-interest payment removes the growth too',
  grown > 1000 && Math.abs(balanceAfterUndo(grown, g1) - 1000) < 0.01,
  `grew to $${grown.toFixed(2)}, undo gives $${balanceAfterUndo(grown, g1).toFixed(2)}`
);

check(
  'undo never produces a negative balance',
  balanceAfterUndo(0, { ...u1, balanceBefore: 0, balanceAfter: 100 }) === 0,
  'clamped at zero'
);

// --- Parsing typed amounts -------------------------------------------------
// The payment field used parseFloat while every other field stripped commas,
// so the same text produced different numbers depending where you typed it.

check(
  'thousands separators are dropped',
  parseAmount('1,200') === 1200 && parseAmount('1,200.50') === 1200.5,
  `${parseAmount('1,200')} and ${parseAmount('1,200.50')}`
);

// iOS renders decimal-pad from the DEVICE locale, so a comma-decimal user types
// "12,50" for twelve-fifty. Deleting the comma would make that 1250.
check(
  'a lone trailing comma is treated as a decimal point, not deleted',
  parseAmount('12,50') === 12.5 && parseAmount('5,5') === 5.5,
  `${parseAmount('12,50')} and ${parseAmount('5,5')}`
);

check(
  'partial and empty input never produces NaN',
  parseAmount('') === 0 && parseAmount('.') === 0 && parseAmount('5.') === 5,
  `${parseAmount('')}, ${parseAmount('.')}, ${parseAmount('5.')}`
);

check(
  'formatted money always shows two decimals, or none when asked',
  formatMoney(1200.5) === '$1,200.50' &&
    formatMoney(1200) === '$1,200.00' &&
    formatMoney(31459.5708, { cents: false }) === '$31,460',
  `${formatMoney(1200.5)}, ${formatMoney(1200)}, ${formatMoney(31459.5708, { cents: false })}`
);

if (failures > 0) {
  console.log('\n' + failures + ' assertion(s) FAILED');
  process.exit(1);
}
console.log('\nAll assertions passed.');
