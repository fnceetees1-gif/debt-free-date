// src/screens/PaywallScreen.tsx
//
// Presented as a dismissible sheet from an upsell — never as a wall in front of
// a cold launch. App Review guideline 3.1.1 wants a reviewer to be able to see
// the app work; a hard gate on first run is a common rejection.
//
// Requirements this screen satisfies:
//   - Restore Purchases control (required for non-consumables)
//   - Price pulled from StoreKit, not hardcoded, so it matches the storefront
//   - Links to Terms and Privacy Policy
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
} from 'react-native';
import { FREE_DEBT_LIMIT } from '../storage';
import { getProPriceString, purchasePro, restorePro, type PurchaseResult } from '../purchases';
import { PRIVACY_POLICY_URL, TERMS_URL } from '../links';

interface Props {
  onUnlocked: () => void;
  onClose?: () => void;
  reason?: string;
}

const FALLBACK_PRICE = '$4.99';

export default function PaywallScreen({ onUnlocked, onClose, reason }: Props) {
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [price, setPrice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProPriceString().then((p) => {
      if (!cancelled) setPrice(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleResult = (result: PurchaseResult, restoring: boolean) => {
    switch (result.status) {
      case 'purchased':
        onUnlocked();
        return;
      case 'cancelled':
        return; // user backed out; no dialog
      case 'unavailable':
        Alert.alert('Not available', result.message);
        return;
      case 'error':
        Alert.alert(restoring ? 'Restore failed' : 'Purchase failed', result.message);
        return;
    }
  };

  const handlePurchase = async () => {
    setBusy('buy');
    try {
      handleResult(await purchasePro(), false);
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async () => {
    setBusy('restore');
    try {
      handleResult(await restorePro(), true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {onClose && (
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel="Close">
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.title}>Debt Free Date Pro</Text>
      <Text style={styles.subtitle}>
        {reason ??
          `Unlimited debts, Snowball & Avalanche comparison, payment reminders, and progress sharing. One payment, yours forever — no subscription.`}
      </Text>

      <View style={styles.featureList}>
        <Feature text="Track unlimited debts" />
        <Feature text="Compare payoff strategies side by side" />
        <Feature text="Payment due reminders" />
        <Feature text="Shareable debt-free countdown card" />
      </View>

      <TouchableOpacity
        style={[styles.buyBtn, busy !== null && styles.btnDisabled]}
        onPress={handlePurchase}
        disabled={busy !== null}
      >
        {busy === 'buy' ? (
          <ActivityIndicator color="#0B2A1A" />
        ) : (
          <Text style={styles.buyBtnText}>Unlock for {price ?? FALLBACK_PRICE}</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.oneTime}>One-time purchase. Not a subscription.</Text>

      <TouchableOpacity onPress={handleRestore} disabled={busy !== null}>
        <Text style={styles.restoreText}>
          {busy === 'restore' ? 'Restoring…' : 'Restore purchase'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.freeNote}>
        The free version tracks up to {FREE_DEBT_LIMIT} debts with the Snowball strategy.
      </Text>

      <View style={styles.legalRow}>
        <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
          <Text style={styles.legalLink}>Terms of Use</Text>
        </TouchableOpacity>
        <Text style={styles.legalDot}>·</Text>
        <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
          <Text style={styles.legalLink}>Privacy Policy</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <View style={styles.featureRow}>
      <Text style={styles.checkmark}>✓</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1B1F3B' },
  content: { padding: 28, paddingTop: 56, flexGrow: 1, justifyContent: 'center' },
  closeBtn: { position: 'absolute', top: 16, right: 20, padding: 8, zIndex: 1 },
  closeText: { color: '#8B90C4', fontSize: 20 },
  title: { color: '#FFF', fontSize: 28, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: '#C7CAEA', fontSize: 14, textAlign: 'center', marginTop: 12, lineHeight: 20 },
  featureList: { marginTop: 32, marginBottom: 32 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  checkmark: { color: '#7CE0A0', fontSize: 16, marginRight: 10 },
  featureText: { color: '#FFF', fontSize: 14 },
  buyBtn: {
    backgroundColor: '#7CE0A0',
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  buyBtnText: { color: '#0B2A1A', fontSize: 16, fontWeight: '700' },
  oneTime: { color: '#8B90C4', textAlign: 'center', marginTop: 10, fontSize: 12 },
  restoreText: { color: '#C7CAEA', textAlign: 'center', marginTop: 16, fontSize: 13 },
  freeNote: {
    color: '#6E73A8',
    textAlign: 'center',
    marginTop: 24,
    fontSize: 12,
    lineHeight: 17,
  },
  legalRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, gap: 8 },
  legalLink: { color: '#6E73A8', fontSize: 12, textDecorationLine: 'underline' },
  legalDot: { color: '#6E73A8', fontSize: 12 },
});
