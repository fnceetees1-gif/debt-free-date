// src/components/BalanceChart.tsx
// Projected total balance by month, drawn with plain Views — no charting
// dependency, no SVG, nothing to break on a native build. Bars beat a line here
// because the shape people want to see is "it goes to zero", and bars read that
// clearly at thumbnail size.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PayoffPlan } from '../calculator';

interface Props {
  plan: PayoffPlan;
  /** Cap the number of bars so a 30-year mortgage doesn't render 360 slivers. */
  maxBars?: number;
}

export default function BalanceChart({ plan, maxBars = 24 }: Props) {
  if (plan.months.length === 0) return null;

  // Sample evenly when the timeline is longer than the bar budget.
  const step = Math.max(1, Math.ceil(plan.months.length / maxBars));
  const sampled = plan.months.filter((_, i) => i % step === 0);

  const peak = Math.max(...sampled.map((m) => m.totalRemaining), 1);
  const startBalance = plan.months[0]?.totalRemaining ?? 0;

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Text style={styles.title}>Projected balance</Text>
        <Text style={styles.subtitle}>
          {plan.neverPaysOff ? 'Not clearing at current payments' : `${plan.totalMonths} months`}
        </Text>
      </View>

      <View style={styles.plot}>
        {sampled.map((m, i) => {
          const heightPct = Math.max((m.totalRemaining / peak) * 100, 1.5);
          const isLast = i === sampled.length - 1;
          return (
            <View key={m.month} style={styles.barSlot}>
              <View
                style={[
                  styles.bar,
                  { height: `${heightPct}%` },
                  isLast && !plan.neverPaysOff && styles.barFinal,
                ]}
              />
            </View>
          );
        })}
      </View>

      <View style={styles.axis}>
        <Text style={styles.axisLabel}>
          ${Math.round(startBalance).toLocaleString()}
        </Text>
        <Text style={styles.axisLabel}>
          {plan.neverPaysOff ? 'never clears' : plan.payoffDate.toLocaleDateString(undefined, {
            month: 'short',
            year: 'numeric',
          })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontSize: 14, fontWeight: '600' },
  subtitle: { fontSize: 12, color: '#888' },
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 110,
    marginTop: 12,
    gap: 2,
  },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { backgroundColor: '#1B1F3B', borderRadius: 2, width: '100%' },
  barFinal: { backgroundColor: '#7CE0A0' },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  axisLabel: { fontSize: 11, color: '#999' },
});
