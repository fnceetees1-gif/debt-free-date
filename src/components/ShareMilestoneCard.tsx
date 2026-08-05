// src/components/ShareMilestoneCard.tsx
// This is the growth-loop feature the original 2011 app never had: a
// screenshot-ready, shareable "debt-free countdown" card. Debt-payoff
// journey content is one of the most consistently viral personal-finance
// categories on TikTok/Instagram - this gives users a built-in reason to
// post progress, which is free distribution for the app.
import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

interface Props {
  payoffDate: Date;
  totalDebt: number;
}

export default function ShareMilestoneCard({ payoffDate, totalDebt }: Props) {
  const viewShotRef = useRef<ViewShot>(null);

  const daysUntilFree = Math.max(
    0,
    Math.ceil((payoffDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );

  const handleShare = async () => {
    try {
      const uri = await viewShotRef.current?.capture?.();
      if (!uri) return;
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Sharing not available on this device');
        return;
      }
      await Sharing.shareAsync(uri);
    } catch (err) {
      Alert.alert('Could not create share image', String(err));
    }
  };

  return (
    <View style={styles.wrapper}>
      <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>MY DEBT-FREE COUNTDOWN</Text>
          <Text style={styles.days}>{daysUntilFree}</Text>
          <Text style={styles.daysLabel}>days to go</Text>
          <Text style={styles.date}>Freedom date: {payoffDate.toDateString()}</Text>
          <Text style={styles.appTag}>tracked with Debt Free Date</Text>
        </View>
      </ViewShot>
      <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
        <Text style={styles.shareBtnText}>Share my progress</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: 20, marginBottom: 40, alignItems: 'center' },
  card: {
    width: 320,
    backgroundColor: '#1B1F3B',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
  },
  eyebrow: { color: '#8B90C4', fontSize: 11, letterSpacing: 1.5, fontWeight: '700' },
  days: { color: '#FFF', fontSize: 64, fontWeight: '800', marginTop: 12 },
  daysLabel: { color: '#C7CAEA', fontSize: 14, marginTop: -6 },
  date: { color: '#FFF', fontSize: 13, marginTop: 16 },
  appTag: { color: '#6E73A8', fontSize: 11, marginTop: 20 },
  shareBtn: {
    marginTop: 14,
    backgroundColor: '#1B1F3B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  shareBtnText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
});
