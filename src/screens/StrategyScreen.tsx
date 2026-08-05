// src/screens/StrategyScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Keyboard,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Debt, PayoffStrategy, compareStrategies } from '../calculator';
import { loadDebts, loadSettings, saveSettings, AppSettings } from '../storage';
import { usePro } from '../ProContext';

export default function StrategyScreen() {
  const { isPro, showPaywall } = usePro();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [extraInput, setExtraInput] = useState('0');
  // Shows a Done button only while the keypad is up — the decimal pad has no
  // built-in one, and a permanent hint is clutter the rest of the time.
  const [editingExtra, setEditingExtra] = useState(false);

  const refresh = useCallback(async () => {
    const [d, s] = await Promise.all([loadDebts(), loadSettings()]);
    setDebts(d);
    setSettings(s);
    setExtraInput(String(s.extraMonthlyPayment || 0));
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  if (!settings) return null;

  const extra = parseFloat(extraInput) || 0;
  const { snowball, avalanche } = debts.length
    ? compareStrategies(debts, extra)
    : { snowball: null, avalanche: null };

  const pick = async (strategy: PayoffStrategy) => {
    if (strategy === 'avalanche' && !isPro) {
      showPaywall('Avalanche and the side-by-side comparison are part of Debt Free Date Pro.');
      return;
    }
    const next = { ...settings, strategy, extraMonthlyPayment: extra };
    setSettings(next);
    await saveSettings(next);
  };

  return (
    // Dragging the list dismisses the keypad — the decimal keyboard has no Done
    // key, so scrolling is the natural escape. keyboardShouldPersistTaps keeps
    // the strategy cards tappable while the keypad is up.
    <ScrollView
      style={styles.container}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.sectionTitle}>Extra monthly payment</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        value={extraInput}
        onChangeText={setExtraInput}
        onBlur={() => pick(settings.strategy)}
        placeholder="0"
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
        onFocus={() => setEditingExtra(true)}
      />
      {editingExtra && (
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => {
            Keyboard.dismiss();
            setEditingExtra(false);
            pick(settings.strategy);
          }}
        >
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>Choose your strategy</Text>

      <StrategyCard
        title="Snowball"
        subtitle="Smallest balance first"
        description="Pay off small debts fast for quick psychological wins and momentum."
        selected={settings.strategy === 'snowball'}
        months={snowball?.totalMonths}
        interest={snowball?.totalInterestPaid}
        onPress={() => pick('snowball')}
      />
      <StrategyCard
        title="Avalanche"
        subtitle="Highest interest rate first"
        description="Mathematically optimal - minimizes total interest paid over time."
        selected={settings.strategy === 'avalanche'}
        months={isPro ? avalanche?.totalMonths : undefined}
        interest={isPro ? avalanche?.totalInterestPaid : undefined}
        locked={!isPro}
        onPress={() => pick('avalanche')}
      />

      {!isPro && snowball && avalanche && (
        <TouchableOpacity style={styles.teaseCard} onPress={() => showPaywall()}>
          <Text style={styles.teaseTitle}>
            Avalanche could save you $
            {Math.max(snowball.totalInterestPaid - avalanche.totalInterestPaid, 0).toFixed(0)}
          </Text>
          <Text style={styles.teaseBody}>
            Unlock Pro to switch strategies and see the full side-by-side breakdown.
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function StrategyCard(props: {
  title: string;
  subtitle: string;
  description: string;
  selected: boolean;
  months?: number;
  interest?: number;
  locked?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.card, props.selected && styles.cardSelected]}
      onPress={props.onPress}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{props.title}</Text>
        {props.selected && <Text style={styles.selectedBadge}>Selected</Text>}
        {props.locked && <Text style={styles.lockedBadge}>PRO</Text>}
      </View>
      <Text style={styles.cardSubtitle}>{props.subtitle}</Text>
      <Text style={styles.cardDescription}>{props.description}</Text>
      {props.months !== undefined && (
        <View style={styles.cardStats}>
          <Text style={styles.cardStat}>{props.months} months to debt-free</Text>
          <Text style={styles.cardStat}>${(props.interest ?? 0).toFixed(0)} total interest</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA', padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 8, marginTop: 8 },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 6,
  },
  doneBtn: {
    alignSelf: 'flex-end',
    backgroundColor: '#1B1F3B',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 16,
  },
  doneBtnText: { color: '#FFF', fontWeight: '600', fontSize: 13 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: { borderColor: '#1B1F3B' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  selectedBadge: {
    fontSize: 11,
    color: '#1B1F3B',
    backgroundColor: '#E6E8F5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    fontWeight: '600',
  },
  lockedBadge: {
    fontSize: 11,
    color: '#5A4A20',
    backgroundColor: '#FFE9B8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  teaseCard: { backgroundColor: '#FFF7E6', borderRadius: 12, padding: 14, marginBottom: 24 },
  teaseTitle: { fontWeight: '700', fontSize: 14, color: '#5A4A20' },
  teaseBody: { fontSize: 13, color: '#5A4A20', marginTop: 4, lineHeight: 18 },
  cardSubtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  cardDescription: { fontSize: 13, color: '#444', marginTop: 8, lineHeight: 18 },
  cardStats: { flexDirection: 'row', gap: 16, marginTop: 12 },
  cardStat: { fontSize: 12, color: '#1B1F3B', fontWeight: '600' },
});
