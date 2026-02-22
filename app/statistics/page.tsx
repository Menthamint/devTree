'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

import { UserMenu } from '@/components/UserMenu/UserMenu';
import { StatsSummaryCards } from '@/components/Statistics/StatsSummaryCards';
import { StreakCard } from '@/components/Statistics/StreakCard';
import { DailyActivityChart } from '@/components/Statistics/DailyActivityChart';
import { TopicsBarChart } from '@/components/Statistics/TopicsBarChart';
import { ContentTypeDonut } from '@/components/Statistics/ContentTypeDonut';
import { ActivityHeatmap } from '@/components/Statistics/ActivityHeatmap';
import { MotivationBanner } from '@/components/Statistics/MotivationBanner';
import { useUIStore } from '@/lib/uiStore';
import type { ActivityDay, ContentData, SummaryData, TopicData } from '@/components/Statistics/types';

/** Safely decode a fetch Response as JSON, throwing if the response is not OK. */
async function safeJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export default function StatisticsPage() {
  const { status } = useSession();
  const router = useRouter();
  const { openSettings } = useUIStore();

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [activity, setActivity] = useState<ActivityDay[]>([]);
  const [topics, setTopics] = useState<TopicData[]>([]);
  const [content, setContent] = useState<ContentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  // Data fetching
  useEffect(() => {
    if (status !== 'authenticated') return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [summaryRes, activityRes, topicsRes, contentRes] = await Promise.all([
          fetch('/api/stats/summary'),
          fetch('/api/stats/activity?days=90'),
          fetch('/api/stats/topics'),
          fetch('/api/stats/content'),
        ]);

        const [summaryData, activityData, topicsData, contentData] = await Promise.all([
          safeJson<SummaryData>(summaryRes),
          safeJson<ActivityDay[]>(activityRes),
          safeJson<TopicData[]>(topicsRes),
          safeJson<ContentData>(contentRes),
        ]);

        setSummary(summaryData);
        setActivity(activityData);
        setTopics(topicsData);
        setContent(contentData);
      } catch (err) {
        console.error('Failed to load statistics:', err);
        setError(err instanceof Error ? err.message : 'Failed to load statistics data.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [status]);

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Top header bar — matches MainContent header style */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 shadow-sm md:px-6">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">Statistics</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <UserMenu onOpenSettings={openSettings} />
        </div>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl space-y-6 p-6 lg:p-8">
          {/* Page title + description */}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Statistics</h1>
            <p className="text-sm text-muted-foreground">
              Track your learning progress and habits
            </p>
          </div>

          {/* Error state */}
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              <strong className="font-medium">Failed to load statistics: </strong>{error}
            </div>
          )}

          {/* Motivation banner */}
          <MotivationBanner data={summary} />

          {/* Summary cards + Streak */}
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-4">
              <StatsSummaryCards data={summary} loading={loading} />
            </div>
            <div className="lg:col-span-1">
              <StreakCard data={summary} loading={loading} />
            </div>
          </div>

          {/* Daily activity chart */}
          <DailyActivityChart data={activity} loading={loading} />

          {/* Topics + Block type distribution */}
          <div className="grid gap-4 lg:grid-cols-2">
            <TopicsBarChart data={topics} loading={loading} />
            <ContentTypeDonut data={content} loading={loading} />
          </div>

          {/* Activity heatmap */}
          <ActivityHeatmap data={activity} loading={loading} />
        </div>
      </div>
    </div>
  );
}
