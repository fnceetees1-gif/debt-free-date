// src/screens/DashboardScreen.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  Debt,
  simulatePayoff,
  compareStrategies,
  totalDebt,
  totalMinimumPayments,
} from '../calculator';
import { loadDebts, loadSettings, AppSettings } from '../storage';
import { loadPayments, summarize } from '../history';
import ShareMilestoneCard from '../components/ShareMilestoneCard';
import BalanceChart from '../components/BalanceChart';
import { DashboardIcon } from '../components/TabIcons';
import { usePro } from '../ProContext';
import { formatMoney } from '../format';

/**
 * Whole-dollar currency for the dashboard's projected totals, where pennies are
 * noise. Bare toLocaleString() emits up to three fraction digits, so a balance
 * of 31459.5708 renders as "$31,459.571" — which reads as a bug in the largest
 * number on the screen.
 */
function money(n: number): string {
  return formatMoney(n, { cents: false });
}

/** "38 months" reads as a number; "3 yr 2 mo" reads as a length of time. */
function humanDuration(months: number): string {
  if (months < 1) return 'less than a month to go';
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} to go`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (!rest) return `${years} year${years === 1 ? '' : 's'} to go`;
  return `${years} yr ${rest} mo to go`;
}

export default function DashboardScreen() {
  const { isPro, showPaywall } = usePro();
  const navigation = useNavigation<any>();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  // Principal actually paid, for the progress bar. Only from logged payments,
  // so it means "since you started tracking" — see the caption on the bar.
  const [paidPrincipal, setPaidPrincipal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const [d, s, payments] = await Promise.all([loadDebts(), loadSettings(), loadPayments()]);
    setDebts(d);
    setSettings(s);
    setPaidPrincipal(summarize(payments).totalPrincipal);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  if (!settings) return null;

  // The first screen a new user sees, and it used to be two lines of grey text
  // centred on an empty field — it read as a screen that had failed to load
  // rather than one waiting for input. It now shows the mark, says what the app
  // will do with a debt once it has one, and carries the button instead of
  // telling you to go find another tab.
  if (debts.length === 0) {
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyArt}>
          <DashboardIcon size={64} color="#7CE0A0" />
        </View>
        <Text style={styles.emptyTitle}>Let's find your debt-free date</Text>
        <Text style={styles.emptySubtitle}>
          Add a debt — the balance, its rate, and the minimum payment. That's enough to work out
          the month you're free and what the interest is costing you.
        </Text>
        <TouchableOpacity
          style={styles.emptyCta}
          onPress={() => navigation.navigate('Debts', { openAdd: true })}
          accessibilityRole="button"
        >
          <Text style={styles.emptyCtaText}>Add my first debt</Text>
        </TouchableOpacity>
        <Text style={styles.emptyFootnote}>
          Everything stays on this device. Nothing is uploaded.
        </Text>
      </View>
    );
  }

  // Debts exist but every one is cleared. Without this the screen renders a
  // $0 hero, a payoff date of today and an empty chart — a flat, faintly broken
  // read on what should be the best day the user has with this app.
  if (totalDebt(debts) <= 0.01) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.celebrate}>🎉</Text>
        <Text style={styles.emptyTitle}>You're debt free</Text>
        <Text style={styles.emptySubtitle}>
          Every debt you're tracking is paid off.
          {paidPrincipal > 0 ? ` You cleared ${money(paidPrincipal)} of it.` : ''}
        </Text>
        <TouchableOpacity
          style={styles.emptyCta}
          onPress={() => navigation.navigate('Progress')}
          accessibilityRole="button"
        >
          <Text style={styles.emptyCtaText}>See what it took</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const plan = simulatePayoff(debts, settings.strategy, settings.extraMonthlyPayment);
  const { snowball, avalanche } = compareStrategies(debts, settings.extraMonthlyPayment);
  const interestDelta = snowball.totalInterestPaid - avalanche.totalInterestPaid;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      {/* The app is called Debt Free Date and the date used to sit in a small
          box with the same weight as the minimum payment total, while the hero
          went to the one number that gets worse the more debt you have. The
          date is the promise; it leads. */}
      {plan.neverPaysOff ? (
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>⚠️ These payments never clear the debt</Text>
          <Text style={styles.warningBody}>
            At the minimums you've entered, interest is outpacing your payments on at least one
            debt, so the balance grows instead of shrinking. Add an extra monthly payment on the
            Strategy tab, or raise a minimum, to see a real payoff date.
          </Text>
        </View>
      ) : (
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Debt-free date</Text>
          <Text style={styles.heroValue}>
            {plan.payoffDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </Text>
          <Text style={styles.heroSub}>{humanDuration(plan.totalMonths)}</Text>

          {/* Progress only appears once there's something to show. A 0% bar on
              day one is discouraging, and the prompt is more useful anyway. */}
          {paidPrincipal > 0 ? (
            <View style={styles.progressWrap}>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${Math.min(
                        (paidPrincipal / (paidPrincipal + totalDebt(debts))) * 100,
                        100
                      )}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {money(paidPrincipal)} paid · {money(totalDebt(debts))} to go
              </Text>
              {/* Honest label: this only counts payments logged in the app, so
                  it is not a lifetime figure for a debt added part-paid. */}
              <Text style={styles.progressNote}>since you started tracking</Text>
            </View>
          ) : (
            <View style={styles.progressWrap}>
              <Text style={styles.progressText}>
                {money(totalDebt(debts))} to go. Log a payment on the Debts tab and your progress
                shows up here.
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.statRow}>
        <StatBlock label="Total remaining" value={money(totalDebt(debts))} />
        <StatBlock
          label="Interest ahead"
          value={plan.neverPaysOff ? '—' : money(plan.totalInterestPaid)}
        />
      </View>
      <View style={styles.statRow}>
        <StatBlock label="Min. payments/mo" value={money(totalMinimumPayments(debts))} />
        <StatBlock label="Extra payment/mo" value={money(settings.extraMonthlyPayment)} />
      </View>

      {interestDelta > 1 && !plan.neverPaysOff && (
        <View style={styles.insightCard}>
          <Text style={styles.insightTitle}>💡 Strategy insight</Text>
          <Text style={styles.insightBody}>
            Switching to Avalanche (highest interest first) would save you{' '}
            <Text style={styles.bold}>${interestDelta.toFixed(0)}</Text> in interest on your
            current debts, though Snowball clears your first debt faster for early motivation.
          </Text>
        </View>
      )}

      <BalanceChart plan={plan} />

      <Text style={styles.sectionTitle}>Payoff order</Text>
      {plan.debtFreeOrder.map((d, i) => (
        <View key={d.debtId} style={styles.orderRow}>
          <Text style={styles.orderIndex}>{i + 1}</Text>
          <Text style={styles.orderName}>{d.name}</Text>
          <Text style={styles.orderMonth}>month {d.monthPaidOff}</Text>
        </View>
      ))}

      {/* This is the organic-growth feature: a shareable "debt-free date" card
          designed to be screenshotted/shared to social media - rides the
          existing "debt payoff journey" content trend without any ad spend.
          Hidden when there's no real payoff date to show. */}
      {!plan.neverPaysOff &&
        (isPro ? (
          <ShareMilestoneCard payoffDate={plan.payoffDate} totalDebt={totalDebt(debts)} />
        ) : (
          <TouchableOpacity style={styles.shareLocked} onPress={() => showPaywall()}>
            <Text style={styles.shareLockedTitle}>Share your debt-free countdown</Text>
            <Text style={styles.shareLockedBody}>
              Unlock Pro to generate a shareable progress card →
            </Text>
          </TouchableOpacity>
        ))}
    </ScrollView>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA', padding: 16 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#F7F8FA',
  },
  emptyArt: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: '#1B1F3B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  celebrate: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 21 },
  emptyCta: {
    backgroundColor: '#1B1F3B',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 26,
  },
  emptyCtaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  emptyFootnote: { fontSize: 12, color: '#9AA0B4', marginTop: 18, textAlign: 'center' },
  heroCard: {
    backgroundColor: '#1B1F3B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  heroLabel: {
    color: '#AEB3D9',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroValue: { color: '#FFFFFF', fontSize: 34, fontWeight: '700', marginTop: 6 },
  heroSub: { color: '#7CE0A0', fontSize: 14, fontWeight: '600', marginTop: 2 },
  progressWrap: { marginTop: 18 },
  track: { height: 8, borderRadius: 4, backgroundColor: '#2C3160', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: '#7CE0A0' },
  progressText: { color: '#C7CAEA', fontSize: 12, marginTop: 8, lineHeight: 17 },
  progressNote: { color: '#7076A8', fontSize: 11, marginTop: 2 },
  statRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statBlock: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
  },
  statLabel: { fontSize: 12, color: '#888' },
  statValue: { fontSize: 18, fontWeight: '600', marginTop: 4 },
  warningCard: {
    backgroundColor: '#FDECEC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  warningTitle: { fontWeight: '700', marginBottom: 4, color: '#7A2020' },
  warningBody: { fontSize: 13, color: '#7A2020', lineHeight: 18 },
  shareLocked: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    marginBottom: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E4E6F0',
    borderStyle: 'dashed',
  },
  shareLockedTitle: { fontWeight: '700', fontSize: 15, color: '#1B1F3B' },
  shareLockedBody: { fontSize: 13, color: '#888', marginTop: 6, textAlign: 'center' },
  insightCard: {
    backgroundColor: '#FFF7E6',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  insightTitle: { fontWeight: '600', marginBottom: 4 },
  insightBody: { fontSize: 13, color: '#5A4A20', lineHeight: 18 },
  bold: { fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  orderIndex: { width: 24, fontWeight: '700', color: '#1B1F3B' },
  orderName: { flex: 1, fontSize: 14 },
  orderMonth: { fontSize: 12, color: '#888' },
});
