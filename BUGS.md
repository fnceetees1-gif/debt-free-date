# Debt Free Date — findings for the next build

**Nothing here is urgent.** 1.0 is live and working. Android has not shipped to
production, so every fix made before that launch rides along free — only Apple
needs an update cycle.

**Target:** one build, submitted to Apple as **1.0.1**, same code becomes
Android's **first production release**.

Findings below come from two sources: **using the app** (Floyd) and a
**code read tracing user flows** (Claude, Aug 26). The code read cannot catch
what only shows up on a real device — the first bug found was Floyd's, in ten
minutes of ordinary use, and it was one the code read missed.

---

## Correctness — fix these

### 1. Undoing an older payment corrupts the balance

`ProgressScreen.undo()` sets the debt's balance to `record.balanceBefore`
unconditionally. Every payment in the history has its own Undo button, so an
older one can be undone while newer ones still exist.

**To reproduce:** log a $100 payment (balance 1000 → 900), then another
(900 → 800). Undo the **first** one. Balance becomes 1000 — the second
payment's effect is wiped, but that payment is still in the history claiming
900 → 800. Totals and the balance now disagree.

**Fix options:** only show Undo on the newest payment per debt, or recompute
the balance by replaying the remaining payments for that debt.

**Severity:** real. Anyone who logs two payments and then corrects the first
hits it, and the resulting number is simply wrong.

---

### 2. The payment field doesn't handle commas the way the debt form does

`DebtsScreen.confirmPayment()` uses `parseFloat(payAmount)` directly. Every
other numeric field goes through `parseAmount()`, which strips commas first.

- Paste `1,200` into the payment field → `parseFloat` stops at the comma →
  logs a **$1** payment.
- The same text in the Balance field → commas stripped → **1200**. Two
  different answers for the same input.

**Related, and worse:** `parseAmount` strips commas *before* parsing, so on a
device with a European locale — where `decimal-pad` renders a comma as the
decimal separator — typing `12,50` for twelve-fifty produces **1250**. A
hundredfold error, silently.

The app is English (US), but iOS renders the keypad using the **device**
locale, not the app's.

**Fix:** one shared parser used everywhere, which treats a lone comma as a
decimal separator rather than deleting it.

---

## Wrong or confusing output

### 3. "Rolls into your next debt" shows even when it was the last debt

After clearing a debt, `confirmPayment` always says:

> Its $X/mo minimum now rolls into your next debt automatically.

If that was the final debt there is no next one. The single best moment in the
whole app — someone becoming debt free — currently ends on a sentence that
doesn't make sense.

**Fix:** branch on whether any debts remain, and make the last-debt case a
proper congratulations.

---

### 4. Minimum payment is unformatted in the debt list

`DebtsScreen` line 216 renders `${item.minPayment}/mo min` raw, sitting
directly beside a balance that *is* formatted. So a row can read:

> 19.99% APR · $1200.5/mo min          $1,200.50

**Fix:** same currency formatting for both.

---

### 5. Money is formatted three different ways

- Dashboard `money()` — rounds to whole dollars
- Debts balance — `maximumFractionDigits: 2`, no minimum, so `$1,200.5`
- Debts minimum payment — raw number

**Fix:** one `formatMoney()` helper, used everywhere.

---

## Usability

### 6. The decimal point is hard to see on the keypad  *(Floyd)*

Entering an APR like `5.5` means finding the `.` on the numeric keypad, and
it's easy to miss. This already caused one round of trouble during
development.

The system keyboard can't be restyled, but three things would help:

1. **An input accessory bar** above the keypad in the debt modal with a large
   `.` and a **Done** button. Native on iOS via `inputAccessoryViewID`.
2. **Example placeholders** — APR `e.g. 19.99`, Balance `e.g. 2500`. The
   `Field` component already accepts a placeholder; nothing passes one.
3. **A Done button in the debt modal.** `StrategyScreen` has one; the debt
   modal instead relies on the hint *"Tap anywhere above this card to close
   the keypad."* Same app, two different escapes from the same keyboard.

---

### 7. Deleting a debt keeps its payment history, and never says so  *(Floyd)*

Deleted all debts expecting a clean slate. Progress still showed the payment.
Had to find and undo that payment individually before the app looked empty.

**This part is deliberate.** `history.ts` stores a copy of the debt's name on
every payment record specifically so history survives deletion:

```ts
debtName: string; // denormalized so history survives deleting a debt
```

The reasoning is right — pay off a card, delete it, and you shouldn't lose the
record that you paid $8,000 toward it. Total paid, total interest, debts
cleared and the monthly streak would all silently reset.

**The problem is the app never says so.** The confirmation reads only
*"Delete debt? This cannot be undone."*

**Fix:** *"Delete debt? Payments you've logged stay in your Progress history.
This cannot be undone."*

---

### 8. There is no way to start over

Nothing in Settings clears your data. To empty the app you must delete every
debt and then every payment individually — which is exactly the dead end
finding #7 leads to.

**Fix:** **Reset all data** in Settings. Clears debts and payments together,
with a real confirmation. Anyone trialling the app wants this, and so does
anyone handing their phone to someone else.

---

## Tidy-up

### 9. `passcodeEnabled` is a dead setting

Declared in `AppSettings` and `defaultSettings`, referenced nowhere else. Either
build the lock or remove the field — it currently reads like a feature that
exists.

---

## How to log one

Date, what you were doing, what you expected, what happened. That's enough.
Screenshots help for anything visual.

**Keep using the app.** The code read above is thorough but blind to timing,
layout, gesture and device behaviour — which is where the interesting failures
live.
