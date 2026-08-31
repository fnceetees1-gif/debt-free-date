// src/reminders.ts
// Pure reminder date arithmetic — no React Native, no expo-notifications, so it
// can be tested directly by `npm run test-engine`. notifications.ts owns the
// scheduling; this owns the maths, and both use these functions so the date the
// UI shows and the date that actually fires cannot drift apart.

export const REMINDER_HOUR = 9;

/** 1–31. */
export function clampReminderDay(day: number): number {
  return Math.min(Math.max(Math.round(day) || 1, 1), 31);
}

/** Days in a given month. Month is 0-indexed and may overflow — 12 is next January. */
export function daysInMonth(year: number, month: number): number {
  // Day 0 of month+1 is the last day of `month`.
  return new Date(year, month + 1, 0).getDate();
}

/**
 * The reminder date within one specific month.
 *
 * The picker offers 1–31, so a chosen day may not exist in every month. Rather
 * than skip those months — a reminder that silently vanishes in February is
 * worse than one that arrives a couple of days early — the date falls back to
 * the last day the month actually has. Pick the 31st and February fires on the
 * 28th, or the 29th in a leap year.
 *
 * This also has to be done per month rather than once up front, because
 * `new Date(2026, 3, 31)` is not "April 31st", it is the 1st of May. Letting
 * that overflow through would fire the reminder in the wrong month entirely.
 */
export function reminderDateForMonth(year: number, month: number, day: number): Date {
  const safeDay = Math.min(clampReminderDay(day), daysInMonth(year, month));
  return new Date(year, month, safeDay, REMINDER_HOUR, 0, 0, 0);
}

/**
 * When the next reminder for `dayOfMonth` would actually fire.
 *
 * Exported so Settings can show the user the same date the scheduler is about
 * to use. Computing it twice — once to schedule, once to display — is how a
 * screen ends up confidently naming a day that nothing fires on.
 */
export function nextReminderDate(dayOfMonth: number, from: Date = new Date()): Date {
  const thisMonth = reminderDateForMonth(from.getFullYear(), from.getMonth(), dayOfMonth);
  // Strictly after: at 9am on the day itself, that month's reminder has fired.
  if (thisMonth.getTime() > from.getTime()) return thisMonth;
  // Month 12 rolls the year over on its own — new Date(2026, 12, 1) is Jan 2027.
  return reminderDateForMonth(from.getFullYear(), from.getMonth() + 1, dayOfMonth);
}
