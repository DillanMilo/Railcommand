/**
 * Date utility helpers to avoid timezone bugs with date-only values.
 *
 * Key principle: for date-only fields (due_date, log_date, target_date, etc.),
 * always pass "YYYY-MM-DD" strings from picker → database → display.
 * NEVER use `new Date("2026-03-13")` as it creates a UTC midnight date which
 * shifts back one day in US timezones.
 */
import { parseISO, format } from 'date-fns';

/**
 * Returns today's date as a "YYYY-MM-DD" string in the local timezone.
 * Use instead of `new Date().toISOString().split('T')[0]` which uses UTC.
 */
export function getLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns a future/past date as a "YYYY-MM-DD" string in the local timezone.
 * Use instead of `new Date(Date.now() + days * 86400000).toISOString().split('T')[0]`.
 */
export function getLocalDateStringOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Safely format a date-only string ("YYYY-MM-DD") or ISO timestamp for display.
 * Uses parseISO which interprets date-only strings as local midnight (not UTC).
 *
 * Use instead of `format(new Date(dateStr), pattern)`.
 */
export function formatDateSafe(dateStr: string, pattern: string): string {
  return format(parseISO(dateStr), pattern);
}

/**
 * Safely parse a date-only string to a Date object for comparisons/sorting.
 * Uses parseISO which interprets "YYYY-MM-DD" as local midnight.
 *
 * Use instead of `new Date(dateStr)` for date-only fields.
 */
export function parseDateSafe(dateStr: string): Date {
  return parseISO(dateStr);
}
