# Debt Free Date — bug log

**Version 1.0.1 build 13 was SUBMITTED to Apple on Aug 27, 2026 at 2:11 PM** —
submission ID 82e58619-37e0-40d8-8c7c-8a25d66b9251, status Waiting for Review.
It can still be pulled via Cancel Submission in App Store Connect until review
begins. Android versionCode 6 holds the same fixes and is not yet uploaded.

Android has not shipped to production, so these fixes cost nothing there; its
first production release will simply contain them. Only Apple needed an update.

---

## Fixed in 1.0.1

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

## Fixed after the 1.0.1 submission — needs a new build

These three came from Floyd using the Android internal-test build on Aug 30.
They are **not** in iOS build 13 or Android versionCode 6.

### 16. Every Android tab showed a box with an X in it *(Floyd, Aug 30)* ✅

`Tab.Navigator` in `App.tsx` never set a `tabBarIcon` on any of the five tabs.
With none supplied, React Navigation substitutes its own `MissingIcon`, which
renders the character **`⏷`** (U+23F7).

iOS ships a glyph for that codepoint, so on iPhone it drew a small triangle —
odd, but not obviously broken, which is why it survived App Review and a
TestFlight pass. Most Android system fonts have no glyph for it, so Android drew
tofu: a box with an X in it, on all five tabs at once.

**Fixed** with real icons in `src/components/TabIcons.tsx` — bar chart, card,
target, checkmark, sliders — drawn from plain `View`s. No icon font added:
`@expo/vector-icons` isn't installed, and it's a lot of binary for five shapes.
Same reasoning as the hand-rolled PNG generator in `scripts/generate-assets.js`.
Active/inactive tint colors set at the same time, since they were also default.

---

### 17. The extra monthly payment was silently dropped *(Floyd, Aug 30)* ✅

`StrategyScreen` only persisted the extra payment in the `TextInput`'s `onBlur`.
Type an amount and then swipe straight to another tab and the field never blurs,
so nothing is written. Dashboard kept projecting on the old value and the amount
just entered looked like it had been ignored.

**Fixed:** leaving the tab now commits whatever is in the box, via a cleanup on
the focus effect reading a ref (the effect is created once, so a closure would
have captured the first render's value).

Also fixed alongside it: tapping Avalanche as a free user opened the paywall and
returned **before** saving, throwing away the extra payment the user had just
typed. The amount in the box is theirs; it's saved now either way.

---

### 18. Logged payments could never match the plan *(Floyd, Aug 30)* ✅

The Log-payment prefill was `String(d.minPayment)` — always the bare minimum.
But the projection assumes the targeted debt gets **minimum + extra** every
month. So a user following their own plan still logged the minimum, and the
extra payment they'd committed to never appeared anywhere in Progress.

That breaks the premise in the header of `history.ts`: the projection tells you
where you're going, the log tells you where you've been, and *the gap between
them is the interesting part*. The gap here was an artifact of the prefill.

**Fixed:** `priorityDebt()` in `calculator.ts` exposes the debt the current
strategy is targeting, and the prefill adds the extra payment on that debt only,
with a line in the sheet saying where the number came from. Still just a prefill
— `selectTextOnFocus` means typing replaces it.

---

### Not a bug: snowball and avalanche showing the same interest ✅ *(explained)*

Reported as identical numbers on the Strategy cards. The engine is right — they
really are the same in three common cases:

- **one debt** — there is no order to choose;
- **smallest balance is also the highest rate** — both orders agree;
- **no extra monthly payment** — nothing to redirect, so both plans just pay the
  minimums in the same sequence. This is the default state for a new user, and
  with only two debts it holds even when the orders are exact opposites.

The defect was the presentation: two identical figures with no explanation read
as a broken calculator, and the free-user tease card offered to sell *"Avalanche
could save you $0"*.

**Fixed:** when the plans tie, the screen says so and says which of the three
reasons applies. The $0 tease is suppressed. Four new assertions pin this down,
including one that fails if opposed orders with a real extra payment ever stop
diverging — i.e. if the comparison genuinely does break.

---

## 1.0.2 — platform sweep and feature batch

Release decision: **Play vc6 is being replaced** (its five tabs render tofu, and
it hasn't reached production so it costs nothing). **iOS build 13 rides out its
review** — it carries the 15 real fixes and its tabs are merely odd, not broken.
Everything below ships as **1.0.2** on both stores.

### 19. Android back button was dead inside both Debts modals ✅

`Modal` without `onRequestClose` swallows the Android back button. Log payment
and Add/Edit debt both had none, so back did nothing and the only way out was
finding Cancel. iOS has no back button, so it never surfaced there.

**Fixed** — both dismiss on back, matching what Cancel does.

---

### 20. The paywall's close button sat under the Android status bar ✅

`presentationStyle="pageSheet"` is **iOS-only**. On Android the paywall is a
plain full-screen modal, and Expo defaults Android to edge-to-edge — so a
hardcoded `top: 16` put the ✕ behind the status bar. Combined with #19's missing
back handling being the only other exit, a user could be stuck on the paywall.

**Fixed** — `SafeAreaProvider` added at the app root (`react-native-safe-area-
context` was already a dependency and entirely unused), and the close button and
scroll padding now offset by the real insets. Added `hitSlop` while there.

---

### 21. Splash flashed through blank to a spinner ✅

`expo-splash-screen` was configured but `preventAutoHideAsync()` was never
called, so the native splash hid as soon as JS mounted — splash, blank, spinner,
app. **Fixed:** hold the splash until startup finishes, released in the same
`finally` that releases the loading state.

---

### 22. Welcome screen *(feature)* ✅

New `WelcomeScreen.tsx`, three panels, skippable, gated on
`AppSettings.hasSeenWelcome`. `loadSettings` already spreads stored settings
over `defaultSettings`, so the new field is a free migration — no migration
code, and 1.0.1 users read `false` and see it once. That's intended: it explains
the extra payment, which they have and were never told about.

Panels: find your debt-free date / one debt at a time / log what you actually
pay. The "not financial advice" disclosure is on the way in rather than only at
the bottom of Settings. Deliberately not a paywall — guideline 3.1.1.

Two details worth keeping: `initialRouteName` is only read when the navigator
mounts, so the landing tab is decided *before* the welcome is dismissed; and a
user who already has debts lands on Dashboard, not on an empty add form.

`clearDebtsAndSettings` now carries `hasSeenWelcome` and `isPro` across the
wipe — someone deliberately starting over doesn't need onboarding again, and a
flicker back to locked after a reset reads as a lost purchase.

---

### 23. The extra payment was invisible in Progress *(feature)* ✅

Fix #18 let logged payments *match* the plan. This makes Progress *show* it.

A month card at the top of Progress: planned budget (minimums + extra, broken
out), what's been logged, a bar, and the gap. Shown before the first payment
too — "$0 of $760 logged" is the clearest possible statement of what the app
wants from you.

Minimums count only debts that still carry a balance. Including cleared ones
would tell people they were behind on a plan that no longer exists.

---

### 24. The reminder never said when it would remind you *(feature)* ✅

Settings had a switch and a number box and no way to tell what either did.

The date arithmetic moved to a new `src/reminders.ts` — pure, no
`expo-notifications` import, so `npm run test-engine` can reach it.
`notifications.ts` re-exports it and schedules from the same functions, so the
date shown and the date that fires cannot drift. Settings now reads
*"Next reminder: Wed 1 Oct at 9:00 AM, then the same day each month"*, shown as a
preview when reminders are off too. The day field explains why it caps at 28.

Six new assertions cover the edges: rollover at the hour boundary, December into
the next year, and day 31 in February resolving to the 28th rather than into
March.

---

**Suite: 45 assertions, all passing.** Up from 29 at the 1.0.1 submission.

---

## New findings — add them here

*(nothing yet)*

Date, what you were doing, what you expected, what happened. That's enough.
Screenshots help for anything visual.

**Keep using the app.** The code read that found #1–#5 is blind to timing,
layout, gesture and device behaviour — #6 and #7 came from actually using it,
and that is where the interesting failures live.
