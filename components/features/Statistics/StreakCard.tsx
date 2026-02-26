'use client';

import React from 'react';

import { Flame, Trophy, Zap } from 'lucide-react';

import { Badge } from '@/components/shared/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';

import type { SummaryData } from './types';

interface Props {
  data: SummaryData | null;
  loading?: boolean;
}

const MILESTONES = [7, 30, 60, 100, 200, 365];

function getMilestoneLabel(streak: number): string | null {
  const hit = [...MILESTONES].reverse().find((m) => streak >= m);
  if (!hit) return null;
  return `${hit}-day streak! 🎉`;
}

export function StreakCard({ data, loading }: Props) {
  if (loading || !data) {
    return (
      <Card className="motion-surface flex h-full flex-col justify-between">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Daily Streak</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted h-12 w-32 animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  const { streakCurrent, streakLongest } = data;
  const milestone = getMilestoneLabel(streakCurrent);

  return (
    <Card className="motion-surface motion-interactive flex h-full flex-col justify-between hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Daily Streak</CardTitle>
        <Flame className="h-4 w-4 text-orange-500" />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {/* Current streak */}
        <div className="flex items-end gap-2">
          <span className="text-4xl leading-none font-bold">{streakCurrent}</span>
          <span className="text-muted-foreground pb-1 text-sm">days</span>
        </div>

        {/* Longest streak */}
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Trophy className="h-3.5 w-3.5" />
          <span>Best: {streakLongest} days</span>
        </div>

        {/* Milestone badge */}
        {milestone && (
          <Badge variant="secondary" className="mt-1 w-fit gap-1 text-xs">
            <Zap className="h-3 w-3" />
            {milestone}
          </Badge>
        )}

        {/* Progress to next milestone */}
        {(() => {
          const next = MILESTONES.find((m) => m > streakCurrent);
          if (!next) return null;
          const prev = MILESTONES[MILESTONES.indexOf(next) - 1] ?? 0;
          const pct = Math.round(((streakCurrent - prev) / (next - prev)) * 100);
          return (
            <div className="mt-1 space-y-1">
              <div className="text-muted-foreground flex justify-between text-xs">
                <span>
                  {next - streakCurrent} days to {next}-day milestone
                </span>
                <span>{pct}%</span>
              </div>
              <div className="bg-muted h-1.5 w-full rounded-full">
                <div
                  className="motion-interactive h-1.5 rounded-full bg-orange-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}
