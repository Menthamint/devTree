/**
 * dateUtils.ts — locale-aware date formatting utilities.
 *
 * Use these helpers throughout the app instead of ad-hoc `toLocaleDateString`
 * calls so that date presentation is consistent and easy to change globally.
 *
 * All functions accept either a `Date` object or an ISO/YYYY-MM-DD string.
 * YYYY-MM-DD strings are parsed as **local** midnight (not UTC) to avoid
 * off-by-one-day bugs in timezones west of UTC.
 */

/**
 * Parse a `YYYY-MM-DD` string as local midnight.
 * `new Date("2025-01-15")` is UTC midnight → local Jan 14 in UTC-5 zones.
 * This helper avoids that pitfall.
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Short locale date — suitable for chart axis labels.
 * Examples: "Feb 15", "15 feb.", depending on locale.
 */
export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? parseLocalDate(date) : date;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Medium locale date — suitable for cards and tooltips where the year matters.
 * Examples: "Feb 15, 2025", "15 févr. 2025".
 */
export function formatDateMedium(date: Date | string): string {
  const d = typeof date === 'string' ? parseLocalDate(date) : date;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Long locale date — suitable for detailed tooltips and labels.
 * Examples: "February 15, 2025", "15 February 2025".
 */
export function formatDateLong(date: Date | string): string {
  const d = typeof date === 'string' ? parseLocalDate(date) : date;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Relative time — returns a human-readable string relative to now.
 * Accepts ISO datetime strings (e.g. from the API) or Date objects.
 *
 * Thresholds:
 *   < 60 s   → "just now"
 *   < 60 min → "X minutes ago"
 *   < 24 h   → "X hours ago"
 *   < 7 days → "X days ago"
 *   < 30 days → "X weeks ago"
 *   ≥ 30 days → medium date (e.g. "Feb 15, 2025")
 *
 * NOTE: Unlike the other helpers, this function parses ISO timestamp strings
 * with `new Date()` (not `parseLocalDate`), because the input is a full
 * datetime string from the server, not a YYYY-MM-DD calendar date.
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  if (diffDays < 30) return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`;
  // Fall back to medium locale date for anything older than a month
  return formatDateMedium(d);
}
