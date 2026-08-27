// src/storage.ts
// Everything lives on-device. No backend, no server cost, no subscription
// infrastructure to maintain - this is what makes the one-time-purchase
// model actually work economically.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Debt, PayoffStrategy } from './calculator';

const DEBTS_KEY = 'debtPayoff:debts';
const SETTINGS_KEY = 'debtPayoff:settings';

/**
 * How many debts the free tier can track. Beyond this the Debts screen shows
 * the upsell. Kept here so the paywall copy and the enforcement can't drift.
 */
export const FREE_DEBT_LIMIT = 2;

export interface AppSettings {
  strategy: PayoffStrategy;
  extraMonthlyPayment: number;
  reminderDay: number; // day of month for payment due reminder, 1-28
  remindersEnabled: boolean;
  /**
   * Cached entitlement flag. RevenueCat is the source of truth — this only
   * exists so the UI can render correctly before the network check returns.
   * Never grant access on this alone after `refreshProStatus()` has answered.
   */
  isPro: boolean;
}

export const defaultSettings: AppSettings = {
  strategy: 'snowball',
  extraMonthlyPayment: 0,
  reminderDay: 1,
  remindersEnabled: false,
  isPro: false,
};

export async function loadDebts(): Promise<Debt[]> {
  const raw = await AsyncStorage.getItem(DEBTS_KEY);
  return raw ? (JSON.parse(raw) as Debt[]) : [];
}

export async function saveDebts(debts: Debt[]): Promise<void> {
  await AsyncStorage.setItem(DEBTS_KEY, JSON.stringify(debts));
}

export async function loadSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Wipes debts and the strategy/reminder settings.
 *
 * Deliberately leaves the Pro entitlement alone — that was paid for, and
 * RevenueCat is the source of truth for it anyway. Clearing payment history is
 * a separate call in history.ts; keeping them apart avoids a circular import,
 * and Settings calls both.
 */
export async function clearDebtsAndSettings(): Promise<void> {
  await AsyncStorage.multiRemove([DEBTS_KEY, SETTINGS_KEY]);
}
