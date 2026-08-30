// src/screens/StrategyScreen.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { Debt, PayoffStrategy, compareStrategies, orderDebts } from '../calculator';
import { loadDebts, loadSettings, saveSettings, AppSettings } from '../storage';
import { usePro } from '../ProContext';
import { parseAmount } from '../format';

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
    // Empty, not "0". A literal zero in the box means typing 500 produces
    // "0500" and you have to clear it first. The greyed placeholder already
    // says 0, which is what an empty field means here anyway.
    setExtraInput(s.extraMonthlyPayment ? String(s.extraMonthlyPayment) : '');
  }, []);

  // Same parser as every other amount field — parseFloat here meant "1,200"
  // silently became an extra payment of $1. Computed before the early return
  // below so the focus effect can see it.
  const extra = parseAmount(extraInput);

  // What the cleanup below needs to see. Kept in a ref because the focus effect
  // is created once and would otherwise close over the first render's values.
  const pending = useRef<{ extra: number; settings: AppSettings | null }>({
    extra: 0,
    settings: null,
  });
  useEffect(() => {
    pending.current = { extra, settings };
  });

  useFocusEffect(
    useCallback(() => {
      refresh();
      return () => {
        // Leaving the tab commits whatever is in the box.
        //
        // Saving on blur alone misses the ordinary case: type an extra payment,
        // then swipe straight to Dashboard or Progress. The field never blurs,
        // the value is never written, and every other screen goes on projecting
        // with the old extra payment — so the amount you just entered appears to
        // have been ignored.
        const { extra: e, settings: s } = pending.current;
        if (s && e !== s.extraMonthlyPayment) {
          void saveSettings({ ...s, extraMonthlyPayment: e });
        }
      };
    }, [refresh])
  );

  if (!settings) return null;

  const { snowball, avalanche } = debts.length
    ? compareStrategies(debts, extra)
    : { snowball: null, avalanche: null };

  /**
   * Whether the two strategies genuinely come out the same for these debts.
   *
   * They often do, and the app used to just print the same number on both cards
   * and offer to sell you a $0 saving — which reads as a broken calculator
   * rather than as the true answer. Every case below is the engine being right:
   *
   *  - one debt, so there is no order to choose;
   *  - smallest balance is also the highest rate, so both orders agree;
   *  - no extra payment, so there is nothing to redirect and both plans just pay
   *    the minimums in the same sequence.
   */
  const tied =
    !!snowball &&
    !!avalanche &&
    snowball.totalMonths === avalanche.totalMonths &&
    Math.abs(snowball.totalInterestPaid - avalanche.totalInterestPaid) < 1;

  const ordersAgree =
    debts.length > 1 &&
    orderDebts(debts, 'snowball')
      .map((d) => d.id)
      .join('|') ===
      orderDebts(debts, 'avalanche')
        .map((d) => d.id)
        .join('|');

  const tieReason =
    debts.length < 2
      ? "You're tracking one debt, so there's no order to choose — both strategies are the same plan."
      : ordersAgree
        ? 'Your smallest balance is also your highest rate, so both strategies pay your debts in the same order.'
        : extra <= 0
          ? 'With no extra monthly payment there is nothing to redirect, so both plans just pay the minimums. Add an extra payment above and they will separate.'
          : 'For these balances and rates the two plans work out even.';

  const pick = async (strategy: PayoffStrategy) => {
    // Persist the typed extra even when the strategy tap is going to be blocked
    // — the amount in the box is the user's, not a reward for buying Pro.
    const next = { ...settings, extraMonthlyPayment: extra };
    if (strategy === 'avalanche' && !isPro) {
      setSettings(next);
      await saveSettings(next);
      showPaywall('Avalanche and the side-by-side comparison are part of Debt Free Date Pro.');
      return;
    }
    const chosen = { ...next, strategy };
    setSettings(chosen);
    await saveSettings(chosen);
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
        placeholderTextColor="#AAB"
        // Tapping an existing amount selects it, so typing replaces rather than
        // appends. Without this, editing 500 to 600 means backspacing first.
        selectTextOnFocus
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

      {/* Two identical numbers with no explanation look like a bug, and
          offering to sell a $0 saving looks worse. When the plans really do tie,
          say so and say why instead. */}
      {tied && snowball && (
        <View style={styles.tieCard}>
          <Text style={styles.tieTitle}>Both strategies cost you the same here</Text>
          <Text style={styles.tieBody}>{tieReason}</Text>
        </View>
      )}

      {!tied && !isPro && snowball && avalanche && (
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
  tieCard: { backgroundColor: '#EEF0F8', borderRadius: 12, padding: 14, marginBottom: 24 },
  tieTitle: { fontWeight: '700', fontSize: 14, color: '#1B1F3B' },
  tieBody: { fontSize: 13, color: '#4A4F70', marginTop: 4, lineHeight: 18 },
  teaseTitle: { fontWeight: '700', fontSize: 14, color: '#5A4A20' },
  teaseBody: { fontSize: 13, color: '#5A4A20', marginTop: 4, lineHeight: 18 },
  cardSubtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  cardDescription: { fontSize: 13, color: '#444', marginTop: 8, lineHeight: 18 },
  cardStats: { flexDirection: 'row', gap: 16, marginTop: 12 },
  cardStat: { fontSize: 12, color: '#1B1F3B', fontWeight: '600' },
});
