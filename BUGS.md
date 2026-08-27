# Debt Free Date — bug log

**Version 1.0.1 build 13 was SUBMITTED to Apple on Aug 27, 2026 at 2:11 PM** —
submission ID 82e58619-37e0-40d8-8c7c-8a25d66b9251, status Waiting for Review.
It can still be pulled via Cancel Submission in App Store Connect until review
begins. Android versionCode 6 holds the same fixes and is not yet uploaded.
submitted — the plan is to keep testing against the fixed build and submit when
the list stops growing.

Android has not shipped to production, so these fixes cost nothing there; its
first production release will simply contain them. Only Apple needs an update.

---

## Fixed in 1.0.1 — awaiting submission

### 1. Undoing an older payment corrupted the balance ✅

Every payment in Progress has its own Undo button, and `ProgressScreen.undo()`
restored `record.balanceBefore` unconditionally. That is only correct for the
newest payment.

Log 1000→900, then 900→800, then undo the **first** one: the balance jumped to
1000, discarding the second payment while it stayed visible in the history.
Balance and totals then disagreed.

**Fixed** by reversing the payment's *effect* instead of restoring a snapshot —
`balanceAfterUndo()` in `history.ts`:

```
newBalance = current - (balanceAfter - balanceBefore)
```

Order-independent, and always consistent with the records that remain. Chosen
over literally replaying surviving payments, which would have to recompute
interest against balances that never existed, rewriting history the user can
see on screen.

Covered by five tests, including one that fails under the old behaviour.

---

### 2. The payment field parsed differently from every other field ✅

`confirmPayment()` used `parseFloat` while everything else used a comma-stripping
parser. A pasted `1,200` logged **$1**; the same text in Balance read 1200.

**Fixed** with one shared `parseAmount()` in `src/format.ts`, used everywhere.

It also handles the case the old parser got backwards: iOS renders `decimal-pad`
from the **device** locale, so a comma-decimal user types `12,50` for
twelve-fifty. Deleting the comma made that **1250** — a hundredfold error.
A lone comma with 1–2 trailing digits is now treated as a decimal point;
otherwise commas are thousands separators.

---

### 3. "Rolls into your next debt" appeared when there was no next debt ✅

Clearing the final debt still promised the minimum would roll onward. The best
moment in the app ended on a sentence that made no sense.

**Fixed** — clearing the last debt now says *"You are debt free."*

---

### 4. Minimum payment was unformatted in the debt list ✅

Rendered raw beside a formatted balance: `$1200.5/mo min` next to `$1,200.50`.

---

### 5. Money was formatted three different ways ✅

Dashboard rounded to whole dollars, Debts allowed up to two decimals with no
minimum, minimum payments were raw. **Fixed** with `formatMoney()`, which takes
`{ cents: false }` for the projected totals where pennies are noise.

---

### 6. The decimal point was hard to find on the keypad *(Floyd)* ✅

Three changes, since the system keyboard cannot be restyled:

- **Done button** in the debt modal header. The Strategy screen already had one;
  the debt form only told you to tap outside, which is not discoverable.
- **Example placeholders** — Balance `2500`, APR `19.99`, Minimum `75`.
- **A hint under APR**: *"Use the . key for a decimal — 5.5 is five and a half
  percent."*

---

### 7. Deleting a debt kept its payment history without saying so *(Floyd)* ✅

Deliberate behaviour — `history.ts` stores a copy of the debt's name on every
payment specifically so history survives deletion. Pay off a card, delete it,
and you should not lose the record that you paid $8,000 toward it.

The app just never said so. **Fixed** — the confirmation now reads *"Payments
you've logged for it stay in your Progress history."*

---

### 8. There was no way to start over ✅

**Fixed** — **Reset all data** in Settings clears debts, settings and payment
history together, and cancels reminders. Pro is deliberately untouched: it was
paid for, and RevenueCat is the source of truth.

---

### 9. `passcodeEnabled` was a dead setting ✅

Declared in `AppSettings`, referenced nowhere. Removed.

---

### 10. Reminder toggle appeared broken *(Floyd, Aug 27, on the 1.0.1 TestFlight build)* ✅

Tapping the monthly reminder switch did nothing visible except an alert saying
to enable notifications in device Settings.

**Working as written, but badly.** iOS shows the notification permission prompt
**once, ever**. Once declined the app cannot ask again — so on any install where
permission was previously refused, the toggle can only fail and point at a
Settings page.

Useful side-effect of the diagnosis: the Pro check runs *before* the notification
check, so reaching this alert proves the Pro entitlement carried over to the
TestFlight build.

**Fixed, two parts:**

- The alert now has an **Open Settings** button (`Linking.openSettings()`) rather
  than describing where to go and leaving the user to find it.
- For a **free** user the switch is now **disabled** and the whole row opens the
  paywall. Previously the toggle slid across, snapped back and threw a paywall —
  indistinguishable from a broken control. The caption already said "Included
  with Pro"; now the control agrees with it.

---

### 11. Corrupt storage bricked the app on a permanent spinner ✅ **worst one found**

`loadDebts()` and `loadSettings()` called `JSON.parse` with no guard, and App's
startup effect had no `catch`. One malformed record — an interrupted write, a
crash mid-save, a full disk — and the promise rejected, `setLoading(false)`
never ran, and the app sat on its spinner **forever**. No recovery except
deleting and reinstalling, which also destroys the user's data.

`loadPayments()` already had a try/catch. The other two didn't. Nothing marked
the difference.

**Fixed:** both loaders now return defaults instead of throwing, and validate
the parsed shape (an array for debts, an object for settings). App's startup is
wrapped in try/finally so the UI is always released — nothing that happens at
launch is worth trapping someone on a spinner.

---

### 12. The paywall could become permanently unopenable ✅

An iOS `pageSheet` can be swiped away without `onRequestClose` firing, leaving
`paywallVisible` stuck at `true`. The next `showPaywall()` then sets true over
true, React sees no change, and the sheet never appears again until the app is
restarted — so a user who swipes the paywall away once may be unable to buy Pro
at all.

**Fixed:** `onDismiss` also resets the flag, so the state is honest however the
sheet went away.

---

### 13. The extra-payment field had the same parser bug as #2 ✅

`StrategyScreen` still used `parseFloat`, so "1,200" became an extra payment of
**$1** — quietly wrecking every projection on the screen. Now uses the shared
`parseAmount`. The reminder-day field was switched over too, for consistency;
there is now exactly one parser in the app.

---

### 14. Paying off everything left the Dashboard looking broken ✅

With debts present but all cleared, the screen rendered a $0 hero, a payoff date
of today and an empty chart. Flat and faintly broken on what should be the best
day a user has with this app.

**Fixed:** an all-cleared state that says so and points at the Progress tab.

---

### 15. Extra payment field started with a literal "0" *(Floyd, Aug 27)* ✅

Tapping the extra monthly payment field and typing 500 produced **"0500"** —
you had to clear the box first every single time.

`setExtraInput(String(s.extraMonthlyPayment || 0))` rendered a real `"0"` into
the input when the value was zero, while a greyed `placeholder="0"` sat unused
behind it.

**Fixed:** empty when the value is zero, so the placeholder does its job.

**Also, everywhere:** `selectTextOnFocus` on the extra payment, the reminder day
and the payment amount. Tapping a field with a value now selects it, so typing
replaces instead of appending. The payment field is prefilled with the minimum,
which is usually right but often needs changing — that one needed it most.

---

## New findings — add them here

*(nothing yet)*

Date, what you were doing, what you expected, what happened. That's enough.
Screenshots help for anything visual.

**Keep using the app.** The code read that found #1–#5 is blind to timing,
layout, gesture and device behaviour — #6 and #7 came from actually using it,
and that is where the interesting failures live.
