# Debt Free Date — backlog

Things deliberately not built yet, with the reasoning, so they can be picked up
without redoing the investigation. `BUGS.md` is for defects; this is for work
that was scoped and parked.

---

## Payment date picker — park until the Expo SDK 58 upgrade

**What:** let someone back-date a logged payment instead of it always being now.

**Why it is nearly free:** `applyPayment(debt, amount, when)` in `history.ts`
already takes a date. The only reason the UI can't offer one is that
`DebtsScreen.tsx` calls it with two arguments. The work is a date row in the
"Log payment" sheet, passing the third argument, and capping the picker at today
so nobody logs a future payment (`paidInMonth` and the streak in `summarize()`
both read calendar months, so a future date would misreport the current month).

**Known limitation to be honest about in any UI:** `applyPayment` charges
`balance * apr/12` regardless of `when`. Back-dating changes the *label* on the
record — history, streaks, charts — not the interest maths. It does not
retroactively recompute interest for the elapsed time.

**Why it is parked (Oct 2026):**

1. **Nobody asked for it.** It comes from reviews of a *competitor*
   (Loan Calculator Pro), not from our users — we have 2 ratings.
2. **It is a native module.** `@react-native-community/datetimepicker` (9.1.0
   resolves for SDK 57) needs a fresh EAS build to test at all, and adds a
   compatibility surface to the **Expo SDK 58** upgrade that the iPhone Duo work
   requires before Apple's ~April 2027 SDK deadline.

**So: build it as part of the SDK 58 release**, when we are rebuilding anyway and
the compatibility question gets answered once. The install was done and reverted
on 11 Oct 2026; redo with `npx expo install @react-native-community/datetimepicker`.

A zero-dependency alternative exists if it is ever wanted sooner: Today /
Yesterday shortcuts plus plain numeric fields, using components already here.

---

## Mortgage payoff tracking — scoped, not started

Scoped against this codebase in Oct 2026.

**Cheaper than it looks.** A mortgage is one debt with a large balance, a low APR
and a fixed payment, so `simulatePayoff([mortgage], 'snowball', extra)` already
models it correctly — monthly amortisation at `balance * apr/12` is how mortgages
amortise, and the 600-month cap covers a 360-month loan. `ShareMilestoneCard`
takes `{ payoffDate, totalDebt }`, so a "house-free date" card is the same
component relabelled. `BalanceChart` and all of `history.ts` are debt-agnostic.

**The real work** is a mortgage screen (the bulk), a data model with the fields
`Debt` lacks (original principal, term, start date, escrow, P&I vs total
payment), an interest-saved with/without chart, and biweekly payments — which is
a genuine design fork, because the engine steps monthly and biweekly is 26
payments ≈ 13 monthly, not monthly ÷ 2.

**Estimate:** ~1 week for a good version, 2–3 days for a thin one
(mortgage-as-`Debt`, no escrow, no biweekly).

**Three decisions it waits on:**

1. Mortgage as a `Debt` (ships in days, cannot show escrow, PMI drop-off, or
   "payment 47 of 360") or its own type (honest, roughly double).
2. Does a mortgage count against `FREE_DEBT_LIMIT = 2`? If so, a free user with a
   mortgage and one card hits the paywall immediately.
3. There would be six tabs. Five is already a lot on a small phone, so mortgage
   may belong inside Debts rather than beside it.

**Why it is parked:** the same reason as above. The constraint on this app is
that ~nobody has installed it, not that it lacks features. Competitor sizing
is in the Oct 2026 analysis: "mortgage payoff" on the App Store is led by
Loan Calculator - Debt Planner (22.5k ratings) and Debt Payoff Planner & Tracker
(7.3k), both of which already span debt *and* mortgage.
