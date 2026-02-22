'use client';

import React, { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import type { SummaryData } from './types';

interface Props {
  data: SummaryData | null;
}

interface BannerDef {
  id: string;
  predicate: (d: SummaryData) => boolean;
  message: string;
  emoji: string;
}

const BANNERS: BannerDef[] = [
  {
    id: 'first-page',
    predicate: (d) => d.totalPages >= 1,
    message: "You've created your first note! The journey of a thousand pages begins with one.",
    emoji: '🌱',
  },
  {
    id: '10-pages',
    predicate: (d) => d.totalPages >= 10,
    message: "10 notes in! You're building a real knowledge base.",
    emoji: '📚',
  },
  {
    id: '50-pages',
    predicate: (d) => d.totalPages >= 50,
    message: '50 pages! Your second brain is growing strong.',
    emoji: '🧠',
  },
  {
    id: 'streak-7',
    predicate: (d) => d.streakCurrent >= 7,
    message: '7-day streak! Consistency is the superpower of learners.',
    emoji: '🔥',
  },
  {
    id: 'streak-30',
    predicate: (d) => d.streakCurrent >= 30,
    message: "30 days in a row! You're unstoppable.",
    emoji: '⚡',
  },
  {
    id: 'streak-100',
    predicate: (d) => d.streakCurrent >= 100,
    message: '100-day streak! You are a true learning champion.',
    emoji: '🏆',
  },
];

export function MotivationBanner({ data }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  if (!data) return null;

  const activeBanners = BANNERS.filter(
    (b) => b.predicate(data) && !dismissed.has(b.id),
  ).slice(0, 1); // Show at most one banner at a time

  if (activeBanners.length === 0) return null;

  const banner = activeBanners[0];

  return (
    <div className="relative flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 pr-10 text-sm">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <p>
        <span className="mr-1">{banner.emoji}</span>
        <span className="font-medium text-foreground">{banner.message}</span>
      </p>
      <button
        onClick={() => setDismissed((s) => new Set([...s, banner.id]))}
        aria-label="Dismiss"
        className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
