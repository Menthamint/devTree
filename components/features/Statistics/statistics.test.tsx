/**
 * Unit tests for Statistics UI components.
 *
 * Covers key rendering cases for MotivationBanner, StreakCard, and
 * StatsSummaryCards so we can catch regressions quickly.
 *
 * @vitest-environment happy-dom
 */
import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MotivationBanner } from './MotivationBanner';
import { StatsSummaryCards } from './StatsSummaryCards';
import { StreakCard } from './StreakCard';
import type { SummaryData } from './types';

// ─── Fixtures ──────────────────────────────────────────────────────────────

const base: SummaryData = {
  totalPages: 42,
  totalBlocks: 318,
  totalSessionTimeMs: 5 * 60 * 60 * 1000, // 5h
  totalWritingTimeMs: 2.5 * 60 * 60 * 1000, // 2h 30m → 50%
  streakCurrent: 3,
  streakLongest: 30,
  achievements: [],
};

const newUser: SummaryData = {
  ...base,
  totalPages: 0,
  totalBlocks: 0,
  totalSessionTimeMs: 0,
  totalWritingTimeMs: 0,
  streakCurrent: 0,
  streakLongest: 0,
};

// ─── MotivationBanner ──────────────────────────────────────────────────────

describe('MotivationBanner', () => {
  beforeEach(() => {
    // Reset storage between tests so dismissed-today state is clear.
    localStorage.clear();
    sessionStorage.clear();
    // Stub fetch so the DB motivation API call resolves to an empty array
    // (component falls back to local hardcoded messages) and doesn't produce
    // unhandled AbortErrors when the happy-dom environment tears down.
    vi.stubGlobal('fetch', () => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders nothing when data is null', async () => {
    const { container } = render(<MotivationBanner data={null} forceShow />);
    // After effects settle:
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a daily motivational message for new users (no achievements)', async () => {
    render(<MotivationBanner data={newUser} forceShow />);
    await waitFor(() => {
      // Daily motivation label should be visible — no achievement qualified
      expect(screen.getByText('Daily motivation')).toBeInTheDocument();
    });
  });

  it('renders the first-note achievement when totalPages >= 1', async () => {
    render(<MotivationBanner data={{ ...base, totalPages: 1, streakCurrent: 0 }} forceShow />);
    await waitFor(() => {
      expect(screen.getByText('Achievement')).toBeInTheDocument();
      expect(screen.getByText(/first note/i)).toBeInTheDocument();
    });
  });

  it('renders the 7-day streak as a milestone (not plain achievement)', async () => {
    render(<MotivationBanner data={{ ...base, streakCurrent: 7 }} forceShow />);
    await waitFor(() => {
      // streak achievements are typed as 'milestone'
      expect(screen.getByText('Milestone reached!')).toBeInTheDocument();
      expect(screen.getByText(/7-day streak/i)).toBeInTheDocument();
    });
  });

  it('renders the 30-day streak as a milestone achievement', async () => {
    render(<MotivationBanner data={{ ...base, streakCurrent: 30 }} forceShow />);
    await waitFor(() => {
      expect(screen.getByText(/30 days in a row/i)).toBeInTheDocument();
    });
  });

  it('renders the 100-day streak as a "Milestone reached!" celebration', async () => {
    render(<MotivationBanner data={{ ...base, streakCurrent: 100 }} forceShow />);
    await waitFor(() => {
      expect(screen.getByText('Milestone reached!')).toBeInTheDocument();
      expect(screen.getByText(/100-day streak/i)).toBeInTheDocument();
    });
  });

  it('shows the 50-notes achievement when totalPages >= 50', async () => {
    render(<MotivationBanner data={{ ...base, totalPages: 50, streakCurrent: 2 }} forceShow />);
    await waitFor(() => {
      // Should show the 50-notes achievement, not a streak one (streak < 7)
      expect(screen.getByText(/50 notes/i)).toBeInTheDocument();
    });
  });

  it('prefers the highest-priority achievement (streak 100 over 50 notes)', async () => {
    render(<MotivationBanner data={{ ...base, totalPages: 55, streakCurrent: 100 }} forceShow />);
    await waitFor(() => {
      expect(screen.getByText('Milestone reached!')).toBeInTheDocument();
      expect(screen.getByText(/100-day streak/i)).toBeInTheDocument();
    });
  });

  it('dismisses the banner when the × button is clicked', async () => {
    render(<MotivationBanner data={newUser} forceShow />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    await waitFor(() => {
      expect(screen.queryByText('Daily motivation')).not.toBeInTheDocument();
    });
  });

  it('shows the source explanation text', async () => {
    render(<MotivationBanner data={newUser} forceShow />);
    await waitFor(() => {
      // Footer source note — daily messages say "changes each day"
      expect(screen.getByText(/changes each day/i)).toBeInTheDocument();
    });
  });

  it('does NOT render when already dismissed today (no forceShow)', async () => {
    // Mark as shown today via localStorage. Use newUser so no achievement can
    // override the "shown today" guard (newUser has 0 pages and 0 streak).
    localStorage.setItem('devtree-motivation-banner-date', new Date().toISOString().slice(0, 10));
    render(<MotivationBanner data={newUser} />);
    await act(async () => {});
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

// ─── StreakCard ─────────────────────────────────────────────────────────────

describe('StreakCard', () => {
  it('renders loading skeletons when loading=true', () => {
    render(<StreakCard data={null} loading />);
    // No streak number visible
    expect(screen.queryByText(/days/i)).not.toBeInTheDocument();
  });

  it('renders "0 days" when there is no streak', () => {
    render(<StreakCard data={newUser} loading={false} />);
    expect(screen.getByText('0')).toBeInTheDocument();
    // No milestone badge for 0 streak
    expect(screen.queryByText(/streak!/i)).not.toBeInTheDocument();
  });

  it('shows the current streak number', () => {
    render(<StreakCard data={{ ...base, streakCurrent: 12 }} loading={false} />);
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('shows the best streak', () => {
    render(<StreakCard data={{ ...base, streakCurrent: 5, streakLongest: 30 }} loading={false} />);
    expect(screen.getByText(/Best: 30 days/i)).toBeInTheDocument();
  });

  it('shows progress toward the next milestone', () => {
    // Current=3 → next milestone is 7
    render(<StreakCard data={{ ...base, streakCurrent: 3, streakLongest: 7 }} loading={false} />);
    expect(screen.getByText(/days to 7-day milestone/i)).toBeInTheDocument();
  });

  it('shows a milestone badge when a milestone is hit', () => {
    render(<StreakCard data={{ ...base, streakCurrent: 7 }} loading={false} />);
    expect(screen.getByText(/7-day streak/i)).toBeInTheDocument();
  });

  it('shows the 100-day milestone badge', () => {
    render(<StreakCard data={{ ...base, streakCurrent: 100 }} loading={false} />);
    expect(screen.getByText(/100-day streak/i)).toBeInTheDocument();
  });

  it('does not show a progress bar when the user is beyond all milestones (365+ days)', () => {
    render(<StreakCard data={{ ...base, streakCurrent: 365 }} loading={false} />);
    // No "days to X-day milestone" text
    expect(screen.queryByText(/days to \d+-day milestone/i)).not.toBeInTheDocument();
  });
});

// ─── StatsSummaryCards ──────────────────────────────────────────────────────

describe('StatsSummaryCards', () => {
  it('renders loading skeletons while data is null and loading=true', () => {
    const { container } = render(<StatsSummaryCards data={null} loading />);
    // All 4 cards should render the animated pulse skeletons
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders all four card titles', () => {
    render(<StatsSummaryCards data={base} loading={false} />);
    expect(screen.getByText('Total Notes')).toBeInTheDocument();
    expect(screen.getByText('Total Blocks')).toBeInTheDocument();
    expect(screen.getByText('Total Time in App')).toBeInTheDocument();
    expect(screen.getByText('Writing Time')).toBeInTheDocument();
  });

  it('renders the correct count values', () => {
    render(<StatsSummaryCards data={base} loading={false} />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('318')).toBeInTheDocument();
  });

  it('renders formatted durations for time cards', () => {
    render(<StatsSummaryCards data={base} loading={false} />);
    // 5h session time
    expect(screen.getByText('5h')).toBeInTheDocument();
    // 2h 30m writing time
    expect(screen.getByText('2h 30m')).toBeInTheDocument();
  });

  it('renders the writing focus percentage as a sub-stat', () => {
    render(<StatsSummaryCards data={base} loading={false} />);
    // 50% = (2.5h / 5h) * 100
    expect(screen.getAllByText(/50% writing focus/i).length).toBeGreaterThan(0);
  });

  it('renders the avg blocks/note sub-stat', () => {
    render(<StatsSummaryCards data={base} loading={false} />);
    // 318 / 42 ≈ 7.6
    expect(screen.getByText(/7\.6 blocks \/ note/i)).toBeInTheDocument();
  });

  it('handles zero-session gracefully (no division by zero)', () => {
    render(<StatsSummaryCards data={newUser} loading={false} />);
    // Both time cards show '< 1m' — getAllByText avoids "found multiple" error
    expect(screen.getAllByText('< 1m').length).toBe(2);
    // Should NOT show NaN in any derived stat
    expect(screen.queryByText(/NaN/i)).not.toBeInTheDocument();
  });

  it('handles null data with loading=false gracefully', () => {
    render(<StatsSummaryCards data={null} loading={false} />);
    // Should render skeletons even when not "loading" but data is null
    const { container } = render(<StatsSummaryCards data={null} loading={false} />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });
});
