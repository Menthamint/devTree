/**
 * dateUtils unit tests.
 *
 * Covers `formatRelativeTime` edge cases — all other helpers are thin wrappers
 * around `toLocaleDateString` and are tested implicitly through usage.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

import { formatRelativeTime } from './dateUtils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a Date that is `ms` milliseconds in the past relative to fakeNow. */
function ago(ms: number, now: Date): Date {
  return new Date(now.getTime() - ms);
}

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('formatRelativeTime', () => {
  const fakeNow = new Date('2026-02-23T12:00:00.000Z');

  afterEach(() => {
    vi.useRealTimers();
  });

  function withNow(fn: () => void) {
    vi.useFakeTimers();
    vi.setSystemTime(fakeNow);
    fn();
    vi.useRealTimers();
  }

  it('returns "just now" for 0 seconds ago', () => {
    withNow(() => {
      expect(formatRelativeTime(ago(0, fakeNow))).toBe('just now');
    });
  });

  it('returns "just now" for 59 seconds ago', () => {
    withNow(() => {
      expect(formatRelativeTime(ago(59 * SEC, fakeNow))).toBe('just now');
    });
  });

  it('returns "1 minute ago" for exactly 60 seconds ago', () => {
    withNow(() => {
      expect(formatRelativeTime(ago(60 * SEC, fakeNow))).toBe('1 minute ago');
    });
  });

  it('returns "5 minutes ago" for 5 minutes ago', () => {
    withNow(() => {
      expect(formatRelativeTime(ago(5 * MIN, fakeNow))).toBe('5 minutes ago');
    });
  });

  it('returns "59 minutes ago" for 59 minutes ago', () => {
    withNow(() => {
      expect(formatRelativeTime(ago(59 * MIN, fakeNow))).toBe('59 minutes ago');
    });
  });

  it('returns "1 hour ago" for exactly 60 minutes ago', () => {
    withNow(() => {
      expect(formatRelativeTime(ago(60 * MIN, fakeNow))).toBe('1 hour ago');
    });
  });

  it('returns "3 hours ago" for 3 hours ago', () => {
    withNow(() => {
      expect(formatRelativeTime(ago(3 * HOUR, fakeNow))).toBe('3 hours ago');
    });
  });

  it('returns "23 hours ago" for 23 hours ago', () => {
    withNow(() => {
      expect(formatRelativeTime(ago(23 * HOUR, fakeNow))).toBe('23 hours ago');
    });
  });

  it('returns "1 day ago" for exactly 24 hours ago', () => {
    withNow(() => {
      expect(formatRelativeTime(ago(24 * HOUR, fakeNow))).toBe('1 day ago');
    });
  });

  it('returns "6 days ago" for 6 days ago', () => {
    withNow(() => {
      expect(formatRelativeTime(ago(6 * DAY, fakeNow))).toBe('6 days ago');
    });
  });

  it('returns "1 week ago" for exactly 7 days ago', () => {
    withNow(() => {
      expect(formatRelativeTime(ago(7 * DAY, fakeNow))).toBe('1 week ago');
    });
  });

  it('returns "4 weeks ago" for 29 days ago', () => {
    withNow(() => {
      expect(formatRelativeTime(ago(29 * DAY, fakeNow))).toBe('4 weeks ago');
    });
  });

  it('falls back to medium date format for 30+ days ago', () => {
    withNow(() => {
      // 30 days before 2026-02-23 → Jan 24, 2026
      const result = formatRelativeTime(ago(30 * DAY, fakeNow));
      // The exact string is locale-dependent but should NOT be a relative string
      expect(result).not.toMatch(/ago$/);
      expect(result).not.toBe('just now');
    });
  });

  it('also accepts an ISO datetime string', () => {
    withNow(() => {
      // 2 hours before fakeNow
      const isoStr = ago(2 * HOUR, fakeNow).toISOString();
      expect(formatRelativeTime(isoStr)).toBe('2 hours ago');
    });
  });

  it('returns "1 week ago" for a WEEK-old Date', () => {
    withNow(() => {
      expect(formatRelativeTime(ago(WEEK, fakeNow))).toBe('1 week ago');
    });
  });
});
