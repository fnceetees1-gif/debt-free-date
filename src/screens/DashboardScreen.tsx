// src/screens/DashboardScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Debt,
  simulatePayoff,
  compareStrategies,
  totalDebt,
  totalMinimumPayments,
} from '../calculator';
import { loadDebts, loadSettings, AppSettings } from '../storage';
import ShareMilestoneCard from '../components/ShareMilestoneCard';
import BalanceChart from '../components/BalanceChart';
import { usePro } from '../ProContext';

export default function DashboardScreen() {
  const { isPro, showPaywall } = usePro();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const [d, s] = await Promise.all([loadDebts(), loadSettings()]);
    setDebts(d);
    setSettings(s);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  if (!settings) return null;

  if (debts.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No debts tracked yet</Text>
        <Text style={styles.emptySubtitle}>
          Add your first debt from the Debts tab to see your payoff timeline.
        </Text>
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
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Total debt remaining</Text>
        <Text style={styles.heroValue}>${totalDebt(debts).toLocaleString()}</Text>
      </View>

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
        <View style={styles.statRow}>
          <StatBlock label="Debt-free date" value={plan.payoffDate.toDateString()} />
          <StatBlock label="Months left" value={String(plan.totalMonths)} />
        </View>
      )}
      <View style={styles.statRow}>
        <StatBlock
          label="Min. payments/mo"
          value={`$${totalMinimumPayments(debts).toLocaleString()}`}
        />
        <StatBlock
          label="Extra payment/mo"
          value={`$${settings.extraMonthlyPayment.toLocaleString()}`}
        />
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
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#666', textAlign: 'center' },
  heroCard: {
    backgroundColor: '#1B1F3B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  heroLabel: { color: '#AEB3D9', fontSize: 13 },
  heroValue: { color: '#FFFFFF', fontSize: 34, fontWeight: '700', marginTop: 4 },
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
