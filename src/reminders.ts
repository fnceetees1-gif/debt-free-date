// src/reminders.ts
// Pure reminder date arithmetic — no React Native, no expo-notifications, so it
// can be tested directly by `npm run test-engine`. notifications.ts owns the
// scheduling; this owns the maths, and both use these functions so the date the
// UI shows and the date that actually fires cannot drift apart.

export const REMINDER_HOUR = 9;

/** 1–28. Capped at 28 so the date exists in February too. */
export function clampReminderDay(day: number): number {
  return Math.min(Math.max(Math.round(day) || 1, 1), 28);
}

/**
 * When the next reminder for `dayOfMonth` would actually fire.
 *
 * The reminder used to be a switch and a number with no way to tell what it
 * would do. Settings shows this; scheduleMonthlyReminder schedules from the
 * same rule.
 */
export function nextReminderDate(dayOfMonth: number, from: Date = new Date()): Date {
  const day = clampReminderDay(dayOfMonth);
  const thisMonth = new Date(from.getFullYear(), from.getMonth(), day, REMINDER_HOUR, 0, 0, 0);
  // Strictly after: at 9am on the day itself, that month's reminder has fired.
  if (thisMonth.getTime() > from.getTime()) return thisMonth;
  // Month 12 rolls the year over on its own — new Date(2026, 12, 1) is Jan 2027.
  return new Date(from.getFullYear(), from.getMonth() + 1, day, REMINDER_HOUR, 0, 0, 0);
}
