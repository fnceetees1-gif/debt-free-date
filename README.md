# Debt Free Date

React Native / Expo (SDK 51) app for planning debt payoff with the Snowball and
Avalanche strategies. One-time purchase, no subscription, no backend — all data
stays on the device.

Names in play, all intentional:

| Where | Value |
| --- | --- |
| App Store listing | `Debt Free Date: Snowball` — keywords live here |
| Home screen (`app.json` → `name`) | `Debt Free Date` |
| Paid tier | `Debt Free Date Pro` |
| Bundle ID | `com.christian.debtpayoffpro` — from the working title, permanent |

## Running it

```bash
npm install
npm run check      # typecheck + calculation engine tests
npm start          # Expo dev server; scan the QR with Expo Go
```

In-app purchases do **not** work in Expo Go — the RevenueCat native module isn't
there. In a development build the purchase flow is simulated so the rest of the
app is testable (`src/purchases.ts`, guarded by `__DEV__`; a release binary can
never take that path).

## Project layout

| Path | What it does |
| --- | --- |
| `src/calculator.ts` | Payoff simulation engine. Pure functions, no I/O. |
| `src/calculator.test.ts` | 13 assertions incl. budget conservation. `npm run test-engine` |
| `src/storage.ts` | AsyncStorage persistence + `FREE_DEBT_LIMIT` |
| `src/history.ts` | Logged payments, interest/principal splits, streaks |
| `src/components/BalanceChart.tsx` | Projected balance bars, plain Views (no chart dep) |
| `src/purchases.ts` | RevenueCat wrapper — the only file that touches the SDK |
| `src/notifications.ts` | Rolling 12-month payment reminder window |
| `src/ProContext.tsx` | Entitlement state + `showPaywall()` |
| `src/links.ts` | Privacy/Terms/Support URLs — **must be set before submitting** |
| `scripts/generate-assets.js` | Generates icon/splash/adaptive PNGs. `npm run assets` |

## Free vs Pro

Free tracks **2 debts on Snowball**. Pro unlocks unlimited debts, Avalanche and
the side-by-side comparison, payment reminders, and the shareable countdown card.

The paywall is a dismissible sheet triggered from upsells, never a wall in front
of a cold launch — a hard gate on first run is a common 3.1.1 rejection because
the reviewer can't see the app work.

## Before you can submit — required, in order

Everything below needs an account or a decision only you can make. The code is
ready for all of it; these are the placeholders to replace.

**1. Apple Developer Program** — $99/yr, enrollment can take 24–48h.
<https://developer.apple.com/programs/>

**2. ~~Pick a bundle identifier~~** — done. `com.christian.debtpayoffpro` is
registered with Apple and set in `app.json` at both `ios.bundleIdentifier` and
`android.package`. Permanent; do not edit.

**3. Publish a privacy policy and terms page**, then set the URLs in
`src/links.ts`. Apple loads these during review, so they must be real HTTPS
pages — but no domain purchase is needed. GitHub Pages (`yourname.github.io/...`),
a public Notion page, or Google Sites all work. The privacy policy can be short
and honest: the app collects nothing and stores everything on-device.

**4. RevenueCat** — free up to $2.5k/mo tracked revenue.
- Create a project, add the iOS app with your bundle ID
- Create an entitlement with identifier exactly `pro` (matches `ENTITLEMENT_ID`)
- Create an offering with your non-consumable attached
- Copy the **public** SDK keys into `app.json` → `extra.revenueCatApiKeyIos` /
  `revenueCatApiKeyAndroid`

**5. App Store Connect** — create the app record, then add one
**non-consumable** in-app purchase, product ID `pro_unlock`, at your price.
Attach it to the RevenueCat offering above. Fill in the App Privacy
questionnaire — for this app the honest answer is **Data Not Collected**.

**6. EAS** — `npm i -g eas-cli && eas login && eas init`, which writes the real
`extra.eas.projectId`. Then fill in the three `REPLACE_WITH_*` fields in
`eas.json` → `submit.production.ios`.

**7. Screenshots** — required at 6.7" (1290×2796) and 6.5" (1284×2778). You need
a simulator or device for these; they cannot be generated from Windows.

## Building and submitting

```bash
eas build --profile development --platform ios   # dev client, tests real IAP
eas build --profile production --platform ios    # App Store binary
eas submit --profile production --platform ios
```

EAS compiles in the cloud, so **no Mac is required** for the build itself. You
will still want a device or a borrowed Mac to test the purchase flow end to end
before release — a broken restore path is the single most common IAP rejection.

## Known gaps

- **Custom strategy** — `PayoffStrategy` includes `'custom'` and the engine
  honours `customOrder`, but no UI exposes reordering.
- **Passcode lock** — `AppSettings.passcodeEnabled` is persisted but unused.
  Wire to `expo-local-authentication` if you want it.
- **Android** — configured and should build, but only iOS has been exercised.

## Notes on the engine

`simulatePayoff` runs a two-pass monthly loop: charge interest and take
minimums, recycling any unused minimum into a pool, then spend that pool down
the priority order. The cascade matters — an earlier version stranded the
leftover on the top-priority debt in any month where a debt was retired, which
made Avalanche report a *later* payoff date than Snowball despite paying less
interest. The budget-conservation assertion in the test suite guards that.

`neverPaysOff` is set when the simulation hits its 600-month cap with debt
outstanding, which happens when a minimum payment is below the monthly interest.
The dashboard shows a warning instead of a fabricated payoff date.

**This app is a calculator, not financial advice.** Projections assume the
payment amounts entered and ignore fees, rate changes, and promotional periods.
