# App Store submission — field-by-field

Values to paste into App Store Connect, in the order the forms ask for them.
Anything marked **PERMANENT** cannot be changed after your first submission.

---

## Step 0 — Paid Applications agreement

**App Store Connect → Business** (older accounts: *Agreements, Tax, and Banking*)

Complete the **Paid Applications** agreement. In-app purchases cannot be created
until it reads **Active**. Needs your tax details and bank account, so it is the
long pole — start it before anything else.

---

## Step 1 — Register the Bundle ID

**developer.apple.com/account → Certificates, IDs & Profiles → Identifiers → +**

| Field | Value |
| --- | --- |
| Type | App IDs → App |
| Description | `Debt Payoff Pro` — as registered under the working title; internal label only, never user-visible |
| Bundle ID | **Explicit** — `com.christian.debtpayoffpro` ← **PERMANENT** |
| Capabilities | Leave all unchecked (In-App Purchase is on by default) |

Explicit, not Wildcard — wildcard IDs cannot sell in-app purchases. The app
needs no special entitlements: no push server, no HealthKit, no Sign in with
Apple.

Already wired into `app.json` at both `expo.ios.bundleIdentifier` and
`expo.android.package`. **If Apple says this ID is unavailable** (`com.christian`
is a common enough string that another developer may hold it), fall back to
`com.christianXXXX.debtpayoffpro` with your first name or an initial, register
that, and tell me — both fields in `app.json` must match Apple exactly or
`eas submit` fails with a provisioning error.

---

## Step 2 — Create the app record

**App Store Connect → Apps → +  → New App**

| Field | Value |
| --- | --- |
| Platform | iOS |
| Name | `Debt Free Date: Snowball` — registered ✓ |
| Primary Language | English (U.S.) |
| Bundle ID | select the one from Step 1 |
| SKU | `DEBTPAYOFFPRO001` — internal only, never shown to anyone |
| User Access | Full Access |

Note the App Store name (`Debt Free Date: Snowball`) intentionally differs from
the home-screen name in `app.json` (`Debt Free Date`, which itself truncates on
the springboard). Apple allows this and it is standard practice — the listing
name carries search keywords, the device name stays short.

The bundle ID still reads `com.christian.debtpayoffpro` from the earlier working
title. That mismatch is invisible to users and cannot be changed, so leave it.

---

## Step 3 — In-app purchase

**Your app → Monetization → In-App Purchases → +**

| Field | Value |
| --- | --- |
| Type | **Non-Consumable** (not a subscription) |
| Reference Name | `Pro Unlock` — internal |
| Product ID | `pro_unlock` ← **PERMANENT**, must match RevenueCat exactly |
| Price | Tier for $4.99 (the paywall copy assumes this) |

**Display Name** (shown to the user at purchase):

```
Debt Free Date Pro
```

**Description** (shown to the user at purchase):

```
Unlock unlimited debts, the Avalanche strategy with side-by-side comparison,
monthly payment reminders, and the shareable debt-free countdown card. One
payment, yours forever — no subscription.
```

**Review screenshot**: required, and you can't take it until a build runs on a
device or simulator. Screenshot the paywall sheet. Expect to return here.

**Review notes**:

```
The paywall is reached by tapping "See what's in Pro" on the Settings tab, or by
adding a third debt on the Debts tab. The free version is fully usable and
tracks up to 2 debts.
```

---

## Guideline 4.3 (Spam) — the real rejection risk

Debt payoff calculators are a saturated category. 4.3(b) says *"avoid piling on
to a category that is already saturated"*, it's a subjective reviewer call, and
it is the most likely reason this app gets rejected. Nobody can guarantee a
pass. What follows is what actually moves the odds.

**What triggers 4.3 here:** an app that is a thin calculator wrapper — enter
numbers, see a projection, done. That describes a hundred existing apps and is
what a reviewer pattern-matches against in the thirty seconds they spend.

**What this app now has that a template does not:**

- **Payment logging with real interest/principal splits.** You record what you
  actually paid; balances update; the split is computed the same way the
  projection computes it, so history and forecast agree.
- **A progress history** — per-month grouping, running totals, consecutive-month
  streak, debts cleared, undo.
- **Projected balance chart** rendered from the simulation, not a static image.
- **A correct payoff engine.** Most competitors strand the leftover payment in
  the month a debt is retired. This one cascades it, which is why Avalanche
  correctly finishes sooner here. Invisible to a reviewer, but it's the honest
  answer to "why does this need to exist."
- **Original artwork**, generated from `scripts/generate-assets.js` — not a
  stock template icon, which reviewers do recognize.

**Do not** register additional bundle IDs for variations of this app. 4.3(a)
targets exactly that, and the penalty escalates to developer program removal.

**Review notes** — paste this into App Review Information. It costs nothing and
directly addresses the pattern-match:

```
Debt Free Date is a debt payoff tracker, not only a calculator. Beyond
projecting a payoff timeline, it lets users log each real payment (Debts tab →
"Log payment"), which splits the payment into interest and principal, updates
the balance, and builds a payment history with running totals and a
month-by-month streak on the Progress tab.

The payoff engine correctly cascades leftover payment when a debt is cleared
mid-month, so the Avalanche strategy reports an earlier payoff date than
Snowball as it should.

To see the app fully: add 2 debts on the Debts tab, then use "Log payment" and
check the Progress tab. The free version is fully functional for 2 debts; the
paywall is reached via Settings → "See what's in Pro", or by adding a 3rd debt.

All data is stored on-device. There is no account, no backend, and no analytics.
```

---

## Step 4 — App Privacy questionnaire

**Your app → App Privacy**

Answer: **No, we do not collect data from this app.**

That is accurate. The app has no analytics, no ad identifiers, no accounts, and
no backend. RevenueCat receives only an anonymous install ID and Apple's purchase
receipt, which does not meet Apple's definition of collected data — it is not
linked to identity and is used solely to deliver the purchase.

---

## Step 5 — App information

| Field | Value |
| --- | --- |
| Subtitle | `Avalanche & payoff planner` (26 chars) — "Snowball" is already in the name, so don't spend the subtitle repeating it |
| Category | Primary: **Finance**. Secondary: Productivity |
| Content Rights | Does not contain third-party content |
| Age Rating | 4+ — answer "None" to every content question |
| Privacy Policy URL | `https://____.github.io/debt-free-date/privacy` |
| Support URL | `https://____.github.io/debt-free-date/support` |

**Promotional text** (170 chars, changeable without a new build):

```
Know your real debt-free date. Compare Snowball and Avalanche side by side, and
watch the timeline move every time you pay a little extra.
```

**Description**:

```
Debt Free Date turns your debts into a plan with a date on it.

Enter what you owe, and see exactly when you'll be free — then watch that date
move closer every time you put a little extra toward it.

LOG WHAT YOU ACTUALLY PAY
This isn't just a calculator. Log each payment as you make it and watch the
balance drop for real. Every payment is split into interest and principal, so
you can see exactly how much of it went to the lender and how much went to
getting free. Your history builds month by month, with a streak that rewards
showing up.

COMPARE THE TWO STRATEGIES THAT WORK
Snowball pays your smallest balance first, so you clear whole debts early and
build momentum. Avalanche targets your highest interest rate first, so you pay
less overall. See both side by side, with real numbers from your own debts, and
choose the one you'll actually stick with.

BUILT ON A REAL PAYOFF ENGINE
Every dollar is accounted for. When a debt is cleared mid-month, the leftover
payment rolls straight to the next one, exactly as it would in real life — so
the date you see is the date you get.

YOUR DATA NEVER LEAVES YOUR PHONE
No account. No sign-up. No servers. Nothing to connect to your bank. Everything
you enter stays on your device, and there's nothing for anyone to breach.

ONE PAYMENT, NOT A SUBSCRIPTION
The free version tracks up to 2 debts with the Snowball strategy. Unlock Pro
once for unlimited debts, the Avalanche comparison, monthly payment reminders,
and a shareable debt-free countdown card. No recurring charge, ever.

Debt Free Date is a calculator, not financial advice. Projections assume the
payments you enter and don't account for fees, rate changes, or promotional
periods ending.
```

**Keywords** (100 chars total, comma-separated, no spaces after commas):

```
avalanche,payoff,debt,loan,credit card,budget,finance,tracker,planner,payment,interest,payments
```

Apple already indexes words in your app name, so "snowball", "debt free", and
"date" are wasted characters here — don't repeat them. Don't put a space after
the commas either; it costs you a character each time.

---

## Step 6 — Screenshots

Required sizes: **6.7"** (1290×2796) and **6.5"** (1284×2778). Cannot be
generated from Windows — you need a simulator or a physical device.

The first two are what decide your conversion rate — most people never scroll
past them. Lead with the two things that prove this isn't a template:

1. Dashboard with 3–4 debts, a debt-free date, and the balance chart
2. Progress tab with several logged payments and a visible streak
3. Strategy tab showing the Snowball/Avalanche comparison
4. Debts list with "Log payment"
5. The shareable countdown card

Log a handful of payments across a couple of months before capturing #2 — an
empty Progress tab is worse than not showing it.

---

## Step 7 — Build and submit

```bash
npm i -g eas-cli
eas login
eas init                     # writes the real extra.eas.projectId into app.json
eas build --profile development --platform ios
```

Install that dev build on a device and **test purchase and restore in the
StoreKit sandbox before going further.** The RevenueCat code path in
`src/purchases.ts` has never executed against StoreKit — it was written against
the v8 API but there's no way to run it from Windows. A broken restore is the
most common IAP rejection and costs roughly a week per round trip.

Then:

```bash
eas build --profile production --platform ios
eas submit --profile production --platform ios
```

`eas submit` needs these in `eas.json` → `submit.production.ios`:
- `appleId` — your Apple ID email — **still needed**
- `ascAppId` — App Store Connect → your app → App Information → **Apple ID**
  (a number, not the email) — **available once the app record exists**
- ~~`appleTeamId`~~ — done: `3HYY6SBKZF`

---

## Blocking values I still need

| Where | Value |
| --- | --- |
| ~~`app.json` — bundle ID~~ | ~~done: `com.christian.debtpayoffpro`~~ |
| `app.json` — `extra.revenueCatApiKeyIos` | RevenueCat public SDK key |
| `src/links.ts` — `PRIVACY_POLICY_URL`, `SUPPORT_URL` | your GitHub Pages URLs |
| `docs/privacy.md`, `docs/support.md` | contact email (currently `CHANGEME@example.com`) |
| `eas.json` — submit block | Apple ID, ASC app ID, team ID |

## Publishing the legal pages

The `docs/` folder is ready for GitHub Pages. In your repo: **Settings → Pages →
Source: Deploy from a branch → main → /docs**. The URLs become
`https://<user>.github.io/<repo>/privacy` and `/support`. Set those in
`src/links.ts`.

Terms of Use needs nothing — `TERMS_URL` already points at Apple's Standard
EULA, which applies by default.
