// App.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet, Modal } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashboardScreen from './src/screens/DashboardScreen';
import DebtsScreen from './src/screens/DebtsScreen';
import StrategyScreen from './src/screens/StrategyScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PaywallScreen from './src/screens/PaywallScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import {
  DashboardIcon,
  DebtsIcon,
  StrategyIcon,
  ProgressIcon,
  SettingsIcon,
} from './src/components/TabIcons';
import { ProContext } from './src/ProContext';
import { loadSettings, saveSettings, loadDebts } from './src/storage';
import { initPurchases, refreshProStatus } from './src/purchases';
import { scheduleMonthlyReminder } from './src/notifications';

const Tab = createBottomTabNavigator();

// Hold the native splash until startup has actually finished. Without this it
// hides the moment JS mounts, so you get splash -> blank -> spinner -> app.
// Failing here must never block launch, hence the catch.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallReason, setPaywallReason] = useState<string | undefined>();
  const [showWelcome, setShowWelcome] = useState(false);
  // Someone who just finished onboarding is being sent to add a debt, so open
  // on the Debts tab. Setting initialRouteName is enough because the navigator
  // doesn't mount until the welcome gate is dismissed.
  const [justOnboarded, setJustOnboarded] = useState(false);

  useEffect(() => {
    (async () => {
      // Everything in here is best-effort. Nothing during startup is important
      // enough to justify leaving the user on a spinner they cannot escape, so
      // the finally always releases the UI even if a step blew up.
      try {
        const settings = await loadSettings();
        // Render from the cached flag first so there's no paid-content flicker.
        setIsPro(settings.isPro);
        setShowWelcome(!settings.hasSeenWelcome);

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
        SplashScreen.hideAsync().catch(() => {});
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

  const finishWelcome = useCallback(async () => {
    // Order matters: initialRouteName is only read when the navigator mounts,
    // and it mounts the moment showWelcome flips. So decide the landing tab
    // first, and hide the welcome last.
    try {
      const [settings, debts] = await Promise.all([loadSettings(), loadDebts()]);
      // "Add my first debt" should land on Debts — but an existing user
      // upgrading into 1.0.2 also sees this welcome once, and they already have
      // debts. Send them to their Dashboard, not to an empty add form.
      setJustOnboarded(debts.length === 0);
      await saveSettings({ ...settings, hasSeenWelcome: true });
    } catch (err) {
      // Failing to persist the flag means seeing the welcome again next launch,
      // which is not worth blocking entry to the app over.
      console.warn('[app] could not save onboarding flag:', err);
    } finally {
      setShowWelcome(false);
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#1B1F3B" />
      </View>
    );
  }

  if (showWelcome) {
    return (
      <SafeAreaProvider>
        <WelcomeScreen onDone={finishWelcome} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ProContext.Provider value={{ isPro, setPro, showPaywall }}>
        <NavigationContainer>
          {/* Every tab needs its own tabBarIcon. With none, React Navigation
              substitutes MissingIcon, which is the character "⏷" — iOS has a
              glyph for it, Android mostly doesn't, so all five tabs drew a tofu
              box instead of an icon. */}
          <Tab.Navigator
            initialRouteName={justOnboarded ? 'Debts' : 'Dashboard'}
            screenOptions={{
              headerTitleStyle: { fontWeight: '700' },
              tabBarActiveTintColor: '#1B1F3B',
              tabBarInactiveTintColor: '#9AA0B4',
            }}
          >
            <Tab.Screen
              name="Dashboard"
              component={DashboardScreen}
              options={{ tabBarIcon: (p) => <DashboardIcon {...p} /> }}
            />
            <Tab.Screen
              name="Debts"
              component={DebtsScreen}
              options={{ tabBarIcon: (p) => <DebtsIcon {...p} /> }}
            />
            <Tab.Screen
              name="Strategy"
              component={StrategyScreen}
              options={{ tabBarIcon: (p) => <StrategyIcon {...p} /> }}
            />
            <Tab.Screen
              name="Progress"
              component={ProgressScreen}
              options={{ tabBarIcon: (p) => <ProgressIcon {...p} /> }}
            />
            <Tab.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ tabBarIcon: (p) => <SettingsIcon {...p} /> }}
            />
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
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F8FA' },
});
