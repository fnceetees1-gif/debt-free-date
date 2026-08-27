# Debt Free Date — findings for the next build

Add anything you hit while using the app. No need to be precise or technical —
"the number looked wrong on the strategy screen" is a perfectly good entry. It
is far cheaper to write it down now than to discover it after a release.

**Nothing here is urgent.** Debt Free Date 1.0 is live on the App Store and
working; these are refinements. Android has not shipped to production yet, so
every fix made before that launch rides along free — only Apple needs an
actual update cycle.

**Target:** one build that fixes the confirmed list, submitted to Apple as
**1.0.1**, and the same code becomes Android's **first production release**.

---

## Confirmed — fix in 1.0.1

### 1. Deleting a debt leaves its payment history behind, with no warning

**Found:** Aug 26, 2026, by Floyd, in normal use.

Deleted all debts expecting a clean slate. The Progress screen still showed the
logged payment. Had to go find that payment and delete it individually before
the app actually looked empty.

**Not a data bug — this is deliberate.** `history.ts` stores a copy of the
debt's name on every payment record, specifically so history survives the debt
being deleted:

```ts
debtName: string; // denormalized so history survives deleting a debt
```

And `DebtsScreen.remove()` only filters the debts array; it never touches
payments. The reasoning is sound: pay off a credit card, delete it, and you
should not lose the record that you paid $8,000 toward it over two years.
Total paid, total interest, debts cleared and the monthly streak would all
silently reset.

**The problem is that the app never says so.** The confirmation reads:

> Delete debt? This cannot be undone.

Nothing about history persisting. And there is no way to start over short of
deleting every payment one at a time.

**Fix:**
1. Honest confirmation copy —
   *"Delete debt? Payments you've logged stay in your Progress history. This
   cannot be undone."*
2. Add **Reset all data** to Settings — clears debts and payments together,
   with a proper confirmation. This is what was actually wanted, and it is what
   anyone testing the app will want too.

---

## Reported — not yet investigated

*(nothing yet)*

---

## How to log one

Date, what you were doing, what you expected, what happened. That is enough.

```
### Short description
**Found:** date, who, what they were doing
Expected: ...
Happened: ...
```

Screenshots help for anything visual — drop them in and note the filename.
