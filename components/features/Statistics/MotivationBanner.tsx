'use client';

import React, { useEffect, useRef, useState } from 'react';

import { BookOpen, Sparkles, Star, Trophy, X, Zap } from 'lucide-react';

import type { SummaryData } from './types';

interface Props {
  data: SummaryData | null;
  /**
   * Override the "already shown today" guard.
   * Useful in Storybook/tests to force the banner to render unconditionally.
   */
  forceShow?: boolean;
}

// ─── DB message shape ──────────────────────────────────────────────────────
interface DbMessage {
  id: string;
  type: 'daily' | 'achievement';
  achievementId: string | null;
  text: string;
  emoji: string;
}

// ─── Local fallback messages ────────────────────────────────────────────────
// Used when the DB hasn't been seeded yet or the API is unreachable.
const FALLBACK_DAILY: { text: string; emoji: string }[] = [
  { text: 'Every note you write is a thought made permanent.', emoji: '✍️' },
  { text: "Knowledge compounds just like interest. You're investing in yourself.", emoji: '📈' },
  { text: 'The act of writing clarifies thinking. Keep going.', emoji: '💡' },
  { text: 'Small, consistent steps outperform long occasional bursts.', emoji: '🐢' },
  { text: "Your notes today are the shortcuts you'll thank yourself for tomorrow.", emoji: '🗺️' },
  { text: "A second brain starts with a single note. You've already started.", emoji: '🧠' },
  { text: 'Deep work leaves a trace. Your blocks are proof.', emoji: '🔬' },
  { text: 'Reviewing old notes once is worth writing them ten times.', emoji: '🔁' },
  { text: "Curiosity is a muscle. You're exercising it right now.", emoji: '💪' },
  { text: 'The best time to document something is right now.', emoji: '⏱️' },
  { text: 'Connecting ideas is the highest form of learning.', emoji: '🕸️' },
  { text: 'Great notes are great questions in disguise.', emoji: '❓' },
  { text: "You don't have to remember everything — your notes do.", emoji: '📦' },
  { text: "Progress is invisible until suddenly it isn't.", emoji: '🌅' },
  { text: 'Structured thinking starts with structured notes.', emoji: '🏗️' },
  { text: 'Each block you write is a brick in your knowledge base.', emoji: '🧱' },
  { text: "The learner's advantage: you never stop improving.", emoji: '🎓' },
  { text: "Document the 'why' as much as the 'how'.", emoji: '🗺️' },
  { text: "What you write today, you'll understand better next week.", emoji: '📆' },
  { text: 'Habits beat motivation. Your streak is proof of that.', emoji: '🔥' },
  { text: 'Consistency is the compound interest of personal growth.', emoji: '📊' },
  { text: 'Your notes are your thinking made visible.', emoji: '👁️' },
  { text: 'The best learning tool is the one you actually use.', emoji: '🛠️' },
  { text: 'Even five minutes of focused writing moves the needle.', emoji: '📍' },
  { text: 'Capture ideas fast. Refine them later. Ship knowledge today.', emoji: '🚀' },
  { text: "Writing is thinking. You're doing both right now.", emoji: '🤔' },
  { text: 'Build in public starts with building in your notes.', emoji: '🏛️' },
  { text: 'Every expert started by taking notes on the basics.', emoji: '📝' },
  { text: 'Your knowledge base grows every time you open the app.', emoji: '🌱' },
  { text: "Today's note is tomorrow's shortcut.", emoji: '⚡' },
];

// ─── Achievement banners ────────────────────────────────────────────────────
interface AchievementDef {
  id: string;
  predicate: (d: SummaryData) => boolean;
  fallbackMessage: string;
  fallbackEmoji: string;
  icon: React.ReactNode;
  type: 'milestone' | 'note';
}

const ACHIEVEMENT_BANNERS: AchievementDef[] = [
  {
    id: 'streak-100',
    predicate: (d) => d.streakCurrent >= 100,
    fallbackMessage: '100-day streak! You are a true learning champion.',
    fallbackEmoji: '🏆',
    icon: <Trophy className="h-5 w-5 text-amber-500" />,
    type: 'milestone',
  },
  {
    id: 'streak-30',
    predicate: (d) => d.streakCurrent >= 30,
    fallbackMessage: "30 days in a row — you're unstoppable.",
    fallbackEmoji: '⚡',
    icon: <Zap className="h-5 w-5 text-violet-500" />,
    type: 'milestone',
  },
  {
    id: 'streak-7',
    predicate: (d) => d.streakCurrent >= 7,
    fallbackMessage: '7-day streak! Consistency is the superpower of learners.',
    fallbackEmoji: '🔥',
    icon: <Star className="h-5 w-5 text-orange-500" />,
    type: 'milestone',
  },
  {
    id: '50-pages',
    predicate: (d) => d.totalPages >= 50,
    fallbackMessage: '50 notes — your second brain is growing strong.',
    fallbackEmoji: '🧠',
    icon: <BookOpen className="h-5 w-5 text-emerald-500" />,
    type: 'note',
  },
  {
    id: '10-pages',
    predicate: (d) => d.totalPages >= 10,
    fallbackMessage: "10 notes in! You're building a real knowledge base.",
    fallbackEmoji: '📚',
    icon: <BookOpen className="h-5 w-5 text-blue-500" />,
    type: 'note',
  },
  {
    id: 'first-page',
    predicate: (d) => d.totalPages >= 1,
    fallbackMessage:
      "You've created your first note! The journey of a thousand pages begins with one.",
    fallbackEmoji: '🌱',
    icon: <Sparkles className="h-5 w-5 text-green-500" />,
    type: 'note',
  },
];

// ─── Persistence logic ─────────────────────────────────────────────────────
const STORAGE_KEY_DAILY = 'devtree-motivation-banner-date';
const STORAGE_KEY_ACHIEVEMENTS = 'devtree-seen-achievements';

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function wasShownToday(): boolean {
  if (typeof globalThis.window === 'undefined') return false;
  try {
    if (sessionStorage.getItem(STORAGE_KEY_DAILY) === getTodayKey()) return true;
    if (localStorage.getItem(STORAGE_KEY_DAILY) === getTodayKey()) return true;
  } catch {
    /* ignore private-mode storage errors */
  }
  return false;
}

function markShownToday(): void {
  try {
    const today = getTodayKey();
    sessionStorage.setItem(STORAGE_KEY_DAILY, today);
    localStorage.setItem(STORAGE_KEY_DAILY, today);
  } catch {
    /* ignore */
  }
}

/** Returns the set of achievement IDs the user has permanently dismissed. */
function getSeenAchievements(): Set<string> {
  if (typeof globalThis.window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACHIEVEMENTS);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    /* ignore */
  }
  return new Set();
}

/** Permanently marks an achievement as seen so it never shows again. */
function markAchievementSeen(id: string): void {
  try {
    const seen = getSeenAchievements();
    seen.add(id);
    localStorage.setItem(STORAGE_KEY_ACHIEVEMENTS, JSON.stringify([...seen]));
  } catch {
    /* ignore */
  }
}

/** Returns 0-based index stable per calendar day, modulo the pool size. */
function dayOfYearIndex(poolSize: number): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000) % poolSize;
}

// ─── Celebration particles ─────────────────────────────────────────────────
const PARTICLES = ['✨', '🎉', '⭐', '🌟', '💫', '🎊'];

function CelebrationParticles() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
      {PARTICLES.map((p, i) => (
        <span
          key={p}
          className="absolute text-lg"
          style={{
            left: `${10 + i * 14}%`,
            top: `${20 + (i % 3) * 20}%`,
            animation: `banner-float-up ${1.2 + i * 0.15}s ease-out ${i * 0.1}s both`,
          }}
        >
          {p}
        </span>
      ))}
    </div>
  );
}

// ─── Internal sub-component ────────────────────────────────────────────────
function BannerLabel({
  isMilestone,
  hasAchievement,
}: Readonly<{
  isMilestone: boolean;
  hasAchievement: boolean;
}>) {
  if (isMilestone) {
    return (
      <span className="text-xs font-semibold tracking-wide text-amber-600 uppercase dark:text-amber-400">
        Milestone reached!
      </span>
    );
  }
  if (hasAchievement) {
    return (
      <span className="text-xs font-semibold tracking-wide text-violet-600 uppercase dark:text-violet-400">
        Achievement
      </span>
    );
  }
  return <span className="text-muted-foreground/80 text-xs">Daily motivation</span>;
}

// ─── Banner component ──────────────────────────────────────────────────────
export function MotivationBanner({ data, forceShow = false }: Readonly<Props>) {
  // ── Fetch messages from DB ────────────────────────────────────────────────
  const [dbMessages, setDbMessages] = useState<DbMessage[]>([]);
  useEffect(() => {
    fetch('/api/stats/motivation')
      .then((r) => r.ok ? r.json() as Promise<DbMessage[]> : Promise.resolve([]))
      .then((msgs) => { if (msgs.length > 0) setDbMessages(msgs); })
      .catch(() => { /* fallback to local messages silently */ });
  }, []);

  // Derive the daily pool — prefer DB, fall back to local array.
  const dailyPool = React.useMemo(() => {
    const db = dbMessages.filter((m) => m.type === 'daily');
    return db.length > 0 ? db : FALLBACK_DAILY;
  }, [dbMessages]);

  // Resolve text/emoji for an achievement from DB if available.
  const resolveAchievement = React.useCallback(
    (def: AchievementDef) => {
      const db = dbMessages.find(
        (m) => m.type === 'achievement' && m.achievementId === def.id,
      );
      return {
        message: db?.text ?? def.fallbackMessage,
        emoji: db?.emoji ?? def.fallbackEmoji,
      };
    },
    [dbMessages],
  );

  // Find the highest-priority achievement that hasn't been permanently dismissed.
  const achievement = React.useMemo(() => {
    if (!data) return null;
    const seen = forceShow ? new Set<string>() : getSeenAchievements();
    return ACHIEVEMENT_BANNERS.find((b) => b.predicate(data) && !seen.has(b.id)) ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, forceShow]);

  // Daily messages are shown once per calendar day.
  const [shownToday] = useState<boolean>(() => (forceShow ? false : wasShownToday()));

  const shouldShow = !!achievement || !shownToday;

  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (shouldShow && !dismissed) {
      timerRef.current = setTimeout(() => setVisible(true), 50);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [shouldShow, dismissed]);

  if (!data || !shouldShow || dismissed) return null;

  const dailyIdx = dayOfYearIndex(dailyPool.length);
  const dailyMsg = dailyPool[dailyIdx];

  const isMilestone = !!achievement && achievement.type === 'milestone';
  const resolved = achievement ? resolveAchievement(achievement) : null;
  const emoji = resolved?.emoji ?? dailyMsg.emoji;
  const message = resolved?.message ?? dailyMsg.text;
  const icon = achievement ? achievement.icon : <Sparkles className="h-4 w-4 text-violet-500" />;

  const handleDismiss = () => {
    if (achievement) {
      markAchievementSeen(achievement.id);
    } else {
      markShownToday();
    }
    setVisible(false);
    setTimeout(() => setDismissed(true), 300);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'relative overflow-hidden rounded-xl border shadow-sm transition-all duration-300',
        isMilestone
          ? 'border-amber-500/30 bg-linear-to-r from-amber-500/10 via-orange-500/5 to-yellow-500/10'
          : 'border-violet-500/20 bg-linear-to-r from-violet-500/5 via-purple-500/5 to-indigo-500/5',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
      ].join(' ')}
    >
      {isMilestone && <CelebrationParticles />}

      <div className="relative flex items-start gap-3 p-4 pr-10">
        <div className="mt-0.5 shrink-0">{icon}</div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-1.5">
            <BannerLabel isMilestone={isMilestone} hasAchievement={!!achievement} />
          </div>

          <p className="text-foreground text-sm leading-snug font-medium">
            <span className="mr-1.5">{emoji}</span>
            {message}
          </p>

          <p className="text-muted-foreground/60 mt-1.5 text-xs">
            {achievement
              ? 'Unlocked based on your learning progress ✨'
              : `Daily motivation · ${dailyIdx + 1} of ${dailyPool.length} — changes each day ✨`}
          </p>
        </div>

        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="motion-interactive text-muted-foreground hover:bg-muted/60 absolute top-2 right-2 rounded p-1.5 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
