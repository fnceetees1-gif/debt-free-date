// App.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet, Modal } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashboardScreen from './src/screens/DashboardScreen';
import DebtsScreen from './src/screens/DebtsScreen';
import StrategyScreen from './src/screens/StrategyScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PaywallScreen from './src/screens/PaywallScreen';
import { ProContext } from './src/ProContext';
import { loadSettings, saveSettings } from './src/storage';
import { initPurchases, refreshProStatus } from './src/purchases';
import { scheduleMonthlyReminder } from './src/notifications';

const Tab = createBottomTabNavigator();

export default function App() {
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallReason, setPaywallReason] = useState<string | undefined>();

  useEffect(() => {
    (async () => {
      // Everything in here is best-effort. Nothing during startup is important
      // enough to justify leaving the user on a spinner they cannot escape, so
      // the finally always releases the UI even if a step blew up.
      try {
        const settings = await loadSettings();
        // Render from the cached flag first so there's no paid-content flicker.
        setIsPro(settings.isPro);

        await initPurchases();
        // RevenueCat is authoritative. A null answer means we couldn't reach it,
        // in which case the cached flag stands rather than locking out a payer.
        const live = await refreshProStatus();
        if (live !== null && live !== settings.isPro) {
          setIsPro(live);
          await saveSettings({ ...settings, isPro: live });
        }

        // Top up the rolling reminder window on every launch.
        if (settings.remindersEnabled && (live ?? settings.isPro)) {
          await scheduleMonthlyReminder(settings.reminderDay);
        }
      } catch (err) {
        console.warn('[app] startup step failed, continuing:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setPro = useCallback(async (value: boolean) => {
    setIsPro(value);
    const settings = await loadSettings();
    await saveSettings({ ...settings, isPro: value });
  }, []);

  const showPaywall = useCallback((reason?: string) => {
    setPaywallReason(reason);
    setPaywallVisible(true);
  }, []);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#1B1F3B" />
      </View>
    );
  }

  return (
    <ProContext.Provider value={{ isPro, setPro, showPaywall }}>
      <NavigationContainer>
        <Tab.Navigator screenOptions={{ headerTitleStyle: { fontWeight: '700' } }}>
          <Tab.Screen name="Dashboard" component={DashboardScreen} />
          <Tab.Screen name="Debts" component={DebtsScreen} />
          <Tab.Screen name="Strategy" component={StrategyScreen} />
          <Tab.Screen name="Progress" component={ProgressScreen} />
          <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
      </NavigationContainer>

      {/* onDismiss matters as much as onRequestClose here: a pageSheet on iOS
          can be swiped away without either callback firing on some versions,
          which leaves paywallVisible stuck true. The next showPaywall() then
          sets true over true, nothing re-renders, and the paywall can never be
          opened again until the app restarts. Resetting on dismiss keeps the
          state honest whichever way the sheet went away. */}
      <Modal
        visible={paywallVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPaywallVisible(false)}
        onDismiss={() => setPaywallVisible(false)}
      >
        <PaywallScreen
          reason={paywallReason}
          onClose={() => setPaywallVisible(false)}
          onUnlocked={() => {
            setPro(true);
            setPaywallVisible(false);
          }}
        />
      </Modal>
    </ProContext.Provider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F8FA' },
});
