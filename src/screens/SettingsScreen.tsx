// src/screens/SettingsScreen.tsx
// Also the home for Restore Purchases and the legal links — App Review expects
// both to be reachable without going through the purchase sheet.
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  Keyboard,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  loadSettings,
  saveSettings,
  clearDebtsAndSettings,
  AppSettings,
  FREE_DEBT_LIMIT,
} from '../storage';
import { clearPayments } from '../history';
import { restorePro } from '../purchases';
import { scheduleMonthlyReminder, cancelReminders } from '../notifications';
import { usePro } from '../ProContext';
import { PRIVACY_POLICY_URL, TERMS_URL, SUPPORT_URL } from '../links';

export default function SettingsScreen() {
  const { isPro, setPro, showPaywall } = usePro();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [dayInput, setDayInput] = useState('1');
  const [restoring, setRestoring] = useState(false);

  const refresh = useCallback(async () => {
    const s = await loadSettings();
    setSettings(s);
    setDayInput(String(s.reminderDay));
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  if (!settings) return null;

  const persist = async (next: AppSettings) => {
    setSettings(next);
    await saveSettings(next);
  };

  const toggleReminders = async (value: boolean) => {
    if (value && !isPro) {
      showPaywall('Payment reminders are part of Debt Free Date Pro.');
      return;
    }
    if (value) {
      const ok = await scheduleMonthlyReminder(settings.reminderDay);
      if (!ok) {
        // iOS shows the permission prompt once, ever. Once it has been declined
        // the app cannot ask again — it can only hand the user to Settings, so
        // do that for them rather than describing where to go.
        Alert.alert(
          'Notifications are off',
          'Debt Free Date needs permission to send reminders. Turn on Allow Notifications and try again.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
    } else {
      await cancelReminders();
    }
    await persist({ ...settings, remindersEnabled: value });
  };

  const commitDay = async () => {
    const parsed = Math.min(Math.max(Math.round(parseFloat(dayInput) || 1), 1), 28);
    setDayInput(String(parsed));
    const next = { ...settings, reminderDay: parsed };
    await persist(next);
    if (next.remindersEnabled && isPro) await scheduleMonthlyReminder(parsed);
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const result = await restorePro();
      if (result.status === 'purchased') {
        setPro(true);
        Alert.alert('Restored', 'Debt Free Date Pro is unlocked on this device.');
      } else if (result.status !== 'cancelled') {
        Alert.alert('Restore failed', result.message);
      }
    } finally {
      setRestoring(false);
    }
  };

  /**
   * Deleting debts one by one leaves payment history behind by design, so
   * without this there is no way to actually start over — which is exactly the
   * dead end people hit when they try.
   *
   * Pro is deliberately NOT cleared. It was paid for.
   */
  const handleReset = () => {
    Alert.alert(
      'Reset all data?',
      'This deletes every debt and every logged payment on this device. Your Pro purchase is not affected. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset everything',
          style: 'destructive',
          onPress: async () => {
            await Promise.all([clearDebtsAndSettings(), clearPayments(), cancelReminders()]);
            await refresh();
            Alert.alert('Reset', 'Your debts and payment history have been cleared.');
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>{isPro ? 'Debt Free Date Pro' : 'Free version'}</Text>
        <Text style={styles.statusBody}>
          {isPro
            ? 'All features unlocked. Thank you for your purchase.'
            : `Tracking up to ${FREE_DEBT_LIMIT} debts with the Snowball strategy.`}
        </Text>
        {!isPro && (
          <TouchableOpacity style={styles.upgradeBtn} onPress={() => showPaywall()}>
            <Text style={styles.upgradeBtnText}>See what's in Pro</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.sectionTitle}>Reminders</Text>
      {/* For a free user the switch is disabled and the whole row opens the
          paywall. Leaving it live meant the toggle slid across, snapped back and
          threw up a paywall — which reads as broken rather than as locked. */}
      <TouchableOpacity
        style={styles.row}
        activeOpacity={isPro ? 1 : 0.6}
        disabled={isPro}
        onPress={() => showPaywall('Payment reminders are part of Debt Free Date Pro.')}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.rowLabel}>Monthly payment reminder</Text>
          <Text style={styles.rowSub}>
            {isPro ? 'A nudge each month to log your payments.' : 'Included with Pro →'}
          </Text>
        </View>
        <Switch
          value={settings.remindersEnabled}
          onValueChange={toggleReminders}
          disabled={!isPro}
        />
      </TouchableOpacity>

      {settings.remindersEnabled && (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Day of month</Text>
            <Text style={styles.rowSub}>1–28</Text>
          </View>
          <TextInput
            style={styles.dayInput}
            keyboardType="number-pad"
            value={dayInput}
            onChangeText={setDayInput}
            onBlur={commitDay}
            maxLength={2}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />
        </View>
      )}

      <Text style={styles.sectionTitle}>Purchase</Text>
      <TouchableOpacity style={styles.linkRow} onPress={handleRestore} disabled={restoring}>
        <Text style={styles.linkText}>{restoring ? 'Restoring…' : 'Restore purchase'}</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Data</Text>
      <TouchableOpacity style={styles.linkRow} onPress={handleReset}>
        <Text style={styles.destructiveText}>Reset all data</Text>
      </TouchableOpacity>
      <Text style={styles.rowCaption}>
        Deletes every debt and logged payment on this device. Your Pro purchase is not affected.
      </Text>

      <Text style={styles.sectionTitle}>About</Text>
      <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
        <Text style={styles.linkText}>Privacy Policy</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL(TERMS_URL)}>
        <Text style={styles.linkText}>Terms of Use</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL(SUPPORT_URL)}>
        <Text style={styles.linkText}>Support</Text>
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        Debt Free Date is a calculator. Its projections assume the payment amounts you enter and
        do not account for fees, rate changes, or promotional periods. It is not financial advice.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  statusCard: { backgroundColor: '#1B1F3B', borderRadius: 16, padding: 18 },
  statusLabel: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  statusBody: { color: '#C7CAEA', fontSize: 13, marginTop: 6, lineHeight: 18 },
  upgradeBtn: {
    backgroundColor: '#7CE0A0',
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 14,
  },
  upgradeBtnText: { color: '#0B2A1A', fontWeight: '700', fontSize: 14 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    marginTop: 24,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  rowLabel: { fontSize: 15 },
  rowSub: { fontSize: 12, color: '#888', marginTop: 2 },
  dayInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    minWidth: 56,
    textAlign: 'center',
  },
  linkRow: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 8 },
  linkText: { fontSize: 15, color: '#1B1F3B' },
  destructiveText: { fontSize: 15, color: '#C33', fontWeight: '600' },
  rowCaption: { fontSize: 12, color: '#888', marginTop: 6, lineHeight: 17 },
  disclaimer: {
    fontSize: 11,
    color: '#999',
    lineHeight: 16,
    marginTop: 24,
    marginBottom: 40,
  },
});
