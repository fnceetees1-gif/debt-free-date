// src/screens/ProgressScreen.tsx
// What you've actually paid, as opposed to what the simulation projects.
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  loadPayments,
  deletePayment,
  summarize,
  balanceAfterUndo,
  paidInMonth,
  PaymentRecord,
  HistoryTotals,
} from '../history';
import { loadDebts, saveDebts, loadSettings } from '../storage';
import { totalMinimumPayments, Debt } from '../calculator';
import { formatMoney } from '../format';

/** What the plan says this month costs, and what's actually been logged. */
interface MonthPlan {
  minimums: number;
  extra: number;
  planned: number;
  logged: number;
}

interface Section {
  title: string;
  data: PaymentRecord[];
}

function groupByMonth(payments: PaymentRecord[]): Section[] {
  const sorted = [...payments].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const sections: Section[] = [];
  for (const p of sorted) {
    const label = new Date(p.date).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
    const existing = sections.find((s) => s.title === label);
    if (existing) existing.data.push(p);
    else sections.push({ title: label, data: [p] });
  }
  return sections;
}

export default function ProgressScreen() {
  const [sections, setSections] = useState<Section[]>([]);
  const [totals, setTotals] = useState<HistoryTotals | null>(null);
  const [monthPlan, setMonthPlan] = useState<MonthPlan | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const [payments, debts, settings] = await Promise.all([
      loadPayments(),
      loadDebts(),
      loadSettings(),
    ]);
    setSections(groupByMonth(payments));
    setTotals(summarize(payments));

    // Minimums are counted on debts that still have a balance — a cleared debt
    // is not money you owe this month, and including it would tell people they
    // were behind on a plan that no longer exists.
    const active = debts.filter((d: Debt) => d.balance > 0.01);
    const minimums = totalMinimumPayments(active);
    const extra = active.length ? settings.extraMonthlyPayment : 0;
    setMonthPlan(
      active.length
        ? { minimums, extra, planned: minimums + extra, logged: paidInMonth(payments) }
        : null
    );
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const undo = async (record: PaymentRecord) => {
    // Show the balance this will actually produce, which is only the same as
    // `balanceBefore` when this is the newest payment on the debt.
    const debtsNow = await loadDebts();
    const current = debtsNow.find((d) => d.id === record.debtId);
    const resulting = current ? balanceAfterUndo(current.balance, record) : null;

    Alert.alert(
      'Undo this payment?',
      `This removes the ${formatMoney(record.amount)} payment to ${record.debtName}` +
        (resulting === null
          ? '. That debt has been deleted, so only the history entry is removed.'
          : ` and puts ${formatMoney(resulting)} back on the balance.`),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Undo',
          style: 'destructive',
          onPress: async () => {
            await deletePayment(record.id);
            // Reverse this payment's effect rather than restoring a snapshot —
            // see balanceAfterUndo. Re-read here: the alert may have sat open
            // long enough for the debt to change underneath us.
            const debts = await loadDebts();
            const target = debts.find((d) => d.id === record.debtId);
            if (target) {
              target.balance = balanceAfterUndo(target.balance, record);
              await saveDebts(debts);
            }
            await refresh();
          },
        },
      ]
    );
  };

  if (!totals) return null;

  if (totals.paymentCount === 0) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 16, paddingTop: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {/* Shown before the first payment too. "$0 of $760 logged" is the
            clearest possible statement of what the app wants from you. */}
        <MonthCard plan={monthPlan} />
        <Text style={styles.emptyTitle}>No payments logged yet</Text>
        <Text style={styles.emptySubtitle}>
          When you make a payment, tap “Log payment” on the Debts tab. Your balance updates and
          your real progress shows up here.
        </Text>
      </ScrollView>
    );
  }

  return (
    <SectionList
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      sections={sections}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      ListHeaderComponent={
        <View>
          <MonthCard plan={monthPlan} />

          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>Paid toward debt so far</Text>
            <Text style={styles.heroValue}>
              {formatMoney(totals.totalPaid, { cents: false })}
            </Text>
            <Text style={styles.heroSplit}>
              {formatMoney(totals.totalPrincipal, { cents: false })} principal ·{' '}
              {formatMoney(totals.totalInterest, { cents: false })} interest
            </Text>
          </View>

          <View style={styles.statRow}>
            <Stat label="Payments logged" value={String(totals.paymentCount)} />
            <Stat label="Debts cleared" value={String(totals.debtsCleared)} />
          </View>
          <View style={styles.statRow}>
            <Stat
              label="Month streak"
              value={totals.currentStreak > 0 ? `${totals.currentStreak}` : '—'}
            />
            <Stat
              label="Started"
              value={
                totals.firstPaymentDate
                  ? totals.firstPaymentDate.toLocaleDateString(undefined, {
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—'
              }
            />
          </View>

          <Text style={styles.sectionHeading}>Payment history</Text>
        </View>
      }
      renderSectionHeader={({ section }) => (
        <Text style={styles.monthHeader}>{section.title}</Text>
      )}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.row} onLongPress={() => undo(item)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowName}>
              {item.debtName}
              {item.clearedDebt ? '  🎉' : ''}
            </Text>
            <Text style={styles.rowSub}>
              {formatMoney(item.principalPortion)} principal ·{' '}
              {formatMoney(item.interestPortion)} interest
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.rowAmount}>{formatMoney(item.amount)}</Text>
            <Text style={styles.rowDate}>
              {new Date(item.date).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </View>
        </TouchableOpacity>
      )}
      ListFooterComponent={
        <Text style={styles.hint}>Press and hold a payment to undo it.</Text>
      }
    />
  );
}

/**
 * This month's plan against this month's reality.
 *
 * The extra monthly payment used to exist only inside the projection: you set
 * it on Strategy, every screen quietly assumed you were paying it, and nothing
 * ever told you whether you had. This is where it becomes real — the plan, what
 * you've logged, and the gap, in the one place that knows what actually
 * happened.
 */
function MonthCard({ plan }: { plan: MonthPlan | null }) {
  if (!plan || plan.planned <= 0) return null;

  const pct = Math.min(plan.logged / plan.planned, 1);
  const remaining = plan.planned - plan.logged;
  const onPlan = remaining <= 0.01;

  return (
    <View style={styles.monthCard}>
      <View style={styles.monthTop}>
        <Text style={styles.monthLabel}>
          {new Date().toLocaleDateString(undefined, { month: 'long' })} plan
        </Text>
        <Text style={styles.monthAmount}>
          {formatMoney(plan.logged, { cents: false })} of{' '}
          {formatMoney(plan.planned, { cents: false })}
        </Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%` }, onPlan && styles.fillDone]} />
      </View>

      <Text style={styles.monthBreakdown}>
        {formatMoney(plan.minimums, { cents: false })} in minimums
        {plan.extra > 0
          ? ` + ${formatMoney(plan.extra, { cents: false })} extra payment`
          : ' · no extra payment set'}
      </Text>

      <Text style={[styles.monthStatus, onPlan && styles.monthStatusDone]}>
        {onPlan
          ? plan.logged - plan.planned > 0.01
            ? `On plan, and ${formatMoney(plan.logged - plan.planned, { cents: false })} ahead.`
            : "On plan for this month. That's the whole job."
          : `${formatMoney(remaining, { cents: false })} left to log this month.`}
      </Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#F7F8FA',
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 },
  monthCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E4E6F0',
  },
  monthTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  monthLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  monthAmount: { fontSize: 15, fontWeight: '700', color: '#1B1F3B' },
  track: { height: 8, borderRadius: 4, backgroundColor: '#EEF0F8', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: '#1B1F3B' },
  fillDone: { backgroundColor: '#3FA76B' },
  monthBreakdown: { fontSize: 12, color: '#888', marginTop: 10, lineHeight: 17 },
  monthStatus: { fontSize: 13, color: '#1B1F3B', marginTop: 6, fontWeight: '600' },
  monthStatusDone: { color: '#2A7A4F' },
  heroCard: { backgroundColor: '#1B1F3B', borderRadius: 16, padding: 20, marginBottom: 16 },
  heroLabel: { color: '#AEB3D9', fontSize: 13 },
  heroValue: { color: '#FFFFFF', fontSize: 34, fontWeight: '700', marginTop: 4 },
  heroSplit: { color: '#8B90C4', fontSize: 12, marginTop: 6 },
  statRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statBlock: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14 },
  statLabel: { fontSize: 12, color: '#888' },
  statValue: { fontSize: 18, fontWeight: '600', marginTop: 4 },
  sectionHeading: { fontSize: 16, fontWeight: '600', marginTop: 8, marginBottom: 4 },
  monthHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  rowName: { fontSize: 14, fontWeight: '600' },
  rowSub: { fontSize: 12, color: '#888', marginTop: 2 },
  rowAmount: { fontSize: 15, fontWeight: '700' },
  rowDate: { fontSize: 11, color: '#999', marginTop: 2 },
  hint: { fontSize: 12, color: '#AAA', textAlign: 'center', marginTop: 12, marginBottom: 32 },
});
