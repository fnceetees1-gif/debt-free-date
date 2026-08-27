# Reply to App Review — Guideline 2.1, Information Needed

Paste the block below into **App Store Connect → App Review → Reply to App Review**,
and attach the screen recording. Also paste the same text into
**App Review Information → Notes** so future submissions include it.

Replace the two bracketed values in item 2 with your real device and iOS version
before sending.

---

Thank you for reviewing Debt Free Date. Responses to each item below.

**1. Screen recording**

Attached. Recorded on a physical iPhone, beginning at app launch and moving
through the core flows: adding debts, logging a payment, viewing payoff
progress, comparing the Snowball and Avalanche strategies, and completing the
in-app purchase. The app has no account registration, login, or account
deletion, and hosts no user-generated content, so those flows do not appear.
The only permission prompt is the optional local notification prompt shown when
the user enables payment reminders, and it is included in the recording.

**2. Devices and operating systems tested**

Tested on iPhone 14 running iOS 26.5.2, via TestFlight, prior to submission.
Purchase and restore were both verified against the StoreKit sandbox on that
physical device.

**3. App functions and target audience**

Debt Free Date is a debt payoff planner and tracker for consumers repaying
credit cards, car loans, student loans, and similar debts.

The problem it solves: people repaying multiple debts rarely know when they
will actually be free of them, or which repayment order costs less. The app
answers both. The user enters each debt's balance, APR, and minimum payment,
and the app simulates the full repayment timeline month by month, producing a
specific debt-free date and total interest figure.

It compares the two established repayment strategies side by side using the
user's own numbers: Snowball, which clears the smallest balance first, and
Avalanche, which targets the highest interest rate first. The payoff engine
rolls freed-up payments onto the next debt as each one is cleared, matching how
repayment works in practice.

Beyond projection, the user can log each real payment. Every payment is split
into its interest and principal components, the balance updates, and a payment
history accumulates with running totals and a month-by-month streak.

The app is a calculator and tracker. It does not provide financial advice, and
the disclaimer to that effect appears in the app, on the support page, and in
the App Store description.

**4. Setting up and accessing the main features**

No account, login, or credentials are required. All features are reachable
immediately on first launch.

To exercise the app:
- Debts tab, tap "+", add a debt (any name, balance, APR, minimum payment)
- Add a second debt the same way
- Tap "Log payment" on either debt and enter an amount
- Progress tab shows the logged payment split into interest and principal
- Dashboard shows the projected debt-free date and balance chart
- Strategy tab compares Snowball and Avalanche

To reach the in-app purchase:
- Settings tab, tap "See what's in Pro", or
- Debts tab, attempt to add a third debt

The free version is fully functional and tracks up to 2 debts using the
Snowball strategy. The in-app purchase (product ID pro_unlock) is a one-time
non-consumable unlock, not a subscription. It unlocks unlimited debts, the
Avalanche strategy and comparison, monthly payment reminders, and a shareable
progress card. Restore Purchase is on the Settings tab and has been tested.

**5. External services, tools, and platforms**

- Apple StoreKit — processes the in-app purchase.
- RevenueCat — validates the purchase receipt and restores entitlement across
  reinstalls and devices. It receives an anonymous installation identifier and
  Apple's purchase receipt. It receives no personal information and none of the
  debt data entered in the app.

That is the complete list. The app has no backend server, no user accounts, no
analytics, no advertising SDKs, no attribution or tracking SDKs, and no AI
services. It does not connect to any bank, card issuer, lender, or financial
data aggregator. Every figure in the app is entered manually by the user and
stored only on the device.

**6. Regional differences**

None. The app functions identically in every region. There is no
region-specific content, no geographic gating, and no region-dependent
behaviour. The only difference is the in-app purchase price, which Apple
localizes automatically per storefront. The app is offered in English (U.S.)
and displays currency and dates using the device's own locale settings.

**7. Regulated industry or third-party protected material**

Not applicable. Debt Free Date is a self-contained calculator. It is not a
financial institution, lender, broker, debt collector, credit counsellor, or
financial adviser, and it provides no regulated financial service. It has no
access to any financial account, moves no money, and makes no personalized
financial recommendations. It contains no third-party protected or licensed
material; all artwork, copy, and calculation logic are original.

Thank you.
