// src/notifications.ts
// Monthly "payment due" reminder.
//
// Note on scheduling: expo-notifications' repeating calendar triggers are not
// consistent across iOS and Android for day-of-month recurrence, so instead we
// schedule a rolling window of one-shot notifications and top it back up every
// time the app opens. Twelve months of runway means a user who never reopens
// the app still gets reminders for a year.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { clampReminderDay, reminderDateForMonth } from './reminders';

const MONTHS_AHEAD = 12;

// The date arithmetic lives in reminders.ts so it can be unit tested without
// pulling in expo-notifications. Re-exported so callers have one import.
export { REMINDER_HOUR, clampReminderDay, nextReminderDate } from './reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Returns true if we are allowed to post notifications. Never throws. */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;
    // Don't re-prompt if the user has already said no — iOS only shows the
    // system dialog once anyway.
    if (!existing.canAskAgain) return false;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch (err) {
    console.warn('[notifications] permission check failed:', err);
    return false;
  }
}

export async function cancelReminders(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (err) {
    console.warn('[notifications] cancel failed:', err);
  }
}

/**
 * Clears and re-schedules the reminder window.
 * @param dayOfMonth 1-28 (28 max so every month has the date)
 */
export async function scheduleMonthlyReminder(dayOfMonth: number): Promise<boolean> {
  const day = clampReminderDay(dayOfMonth);

  const granted = await ensureNotificationPermission();
  if (!granted) return false;

  await cancelReminders();

  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('payment-reminders', {
        name: 'Payment reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    } catch (err) {
      console.warn('[notifications] channel setup failed:', err);
    }
  }

  const now = new Date();
  let scheduled = 0;

  for (let i = 0; i < MONTHS_AHEAD; i++) {
    // Per month, not once up front: day 31 in a 30-day month must land on the
    // 30th, and `new Date(y, 3, 31)` would silently become the 1st of May.
    const when = reminderDateForMonth(now.getFullYear(), now.getMonth() + i, day);
    if (when.getTime() <= now.getTime()) continue; // skip this month if the day already passed

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Debt payments due',
          body: "Log this month's payments to keep your debt-free date accurate.",
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: when,
          ...(Platform.OS === 'android' ? { channelId: 'payment-reminders' } : {}),
        },
      });
      scheduled += 1;
    } catch (err) {
      console.warn('[notifications] schedule failed:', err);
    }
  }

  return scheduled > 0;
}
