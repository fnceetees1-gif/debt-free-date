// src/format.ts
// One parser and one formatter for money, used everywhere.
//
// These used to be three different implementations across three screens, which
// meant the same typed text could produce different numbers depending on which
// field you typed it into. In an app whose entire job is arithmetic, that is
// the worst possible kind of inconsistency.

/**
 * Parses a typed amount into a number.
 *
 * The subtle case is the comma. iOS renders `decimal-pad` using the *device*
 * locale, not the app's, so a user in a comma-decimal locale types "12,50" for
 * twelve-fifty. Simply deleting commas turns that into 1250 — a hundredfold
 * error, silently.
 *
 * Rules, in order:
 *   - a single comma with 1-2 digits after it and no period is a decimal
 *     separator ("12,50" -> 12.5)
 *   - otherwise commas are thousands separators and are dropped
 *     ("1,200" -> 1200, "1,200.50" -> 1200.5)
 *
 * Tolerates "", ".", "5." and stray whitespace. Never returns NaN.
 */
export function parseAmount(text: string): number {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return 0;

  const commas = (trimmed.match(/,/g) ?? []).length;
  const hasPeriod = trimmed.includes('.');

  let normalized: string;
  if (commas === 1 && !hasPeriod && /,\d{1,2}$/.test(trimmed)) {
    // Comma is acting as the decimal point.
    normalized = trimmed.replace(',', '.');
  } else {
    normalized = trimmed.replace(/,/g, '');
  }

  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Formats an amount as US dollars.
 *
 * `cents: false` rounds to whole dollars — right for large projected totals
 * where the pennies are noise. Default keeps exactly two decimals so a real
 * balance never renders as "$1,200.5".
 */
export function formatMoney(amount: number, opts?: { cents?: boolean }): string {
  const cents = opts?.cents ?? true;
  const digits = cents ? 2 : 0;
  return `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}
