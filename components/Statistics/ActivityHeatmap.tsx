'use client';

import React, { useRef, useState, useEffect } from 'react';
import { ActivityCalendar, type Activity } from 'react-activity-calendar';
import { useTheme } from 'next-themes';
import { Tooltip as RadixTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { ActivityDay } from './types';
import { formatDateLong, parseLocalDate } from '@/lib/dateUtils';

interface Props {
  readonly data: ActivityDay[];
  readonly loading?: boolean;
}

// Light mode: neutral empty → progressively darker violet (less=lighter, more=darker)
const VIOLET_LIGHT: [string, string, string, string, string] = [
  '#f1f5f9', // slate-100 — neutral empty, no color tint
  '#e9d5ff', // purple-100
  '#a855f7', // purple-500
  '#7c3aed', // violet-600
  '#4c1d95', // violet-900 — max activity
];

// Dark mode same direction: empty=subtle light, max=deep violet
// Less activity = lighter/more visible; more activity = deeper/darker.
// Note: level-4 (deep violet) stands out clearly against the zinc-900 card background.
const VIOLET_DARK: [string, string, string, string, string] = [
  '#c4b5fd', // violet-300 — empty (visibly light on dark bg)
  '#8b5cf6', // violet-500
  '#6d28d9', // violet-700
  '#4c1d95', // violet-900
  '#2e1065', // violet-950 — max activity (darkest)
];

/** Map a total activity count to a heatmap level 0–4. */
function getActivityLevel(total: number): 0 | 1 | 2 | 3 | 4 {
  if (total === 0) return 0;
  if (total < 3) return 1;
  if (total < 8) return 2;
  if (total < 15) return 3;
  return 4;
}

export function ActivityHeatmap({ data, loading }: Props) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const containerRef = useRef<HTMLDivElement>(null);
  const [blockSize, setBlockSize] = useState(13);

  // Recalculate blockSize whenever the container resizes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const WEEKS = 53;
    const BLOCK_MARGIN = 4;
    // ~28 px for the day-label column on the left
    const LABEL_PAD = 28;

    const calculate = (width: number) => {
      const size = Math.floor((width - LABEL_PAD - WEEKS * BLOCK_MARGIN) / WEEKS);
      setBlockSize(Math.min(18, Math.max(9, size)));
    };

    calculate(el.clientWidth);

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        calculate(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Map ActivityDay[] → Activity[] (date, count, level)
  const calendarData = data.map((d) => {
    const total = d.contentEvents + Math.floor(d.sessionMs / 60_000);
    return { date: d.date, count: total, level: getActivityLevel(total) };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Heatmap</CardTitle>
        <CardDescription>Your daily activity over the last 12 months</CardDescription>
      </CardHeader>
      <CardContent ref={containerRef} className="pb-4">
        {(() => {
          if (loading) return <div className="h-28 w-full animate-pulse rounded bg-muted" />;
          if (calendarData.length === 0) {
            return (
              <div className="flex h-28 items-center justify-center text-sm text-muted-foreground">
                No activity data yet
              </div>
            );
          }
          return (
            <TooltipProvider>
            <ActivityCalendar
              data={calendarData}
              colorScheme={isDark ? 'dark' : 'light'}
              theme={{
                light: VIOLET_LIGHT,
                dark: VIOLET_DARK,
              }}
              blockSize={blockSize}
              blockMargin={4}
              fontSize={11}
              renderBlock={(block: React.ReactElement, activity: Activity) => (
                <TooltipProvider>
                  <RadixTooltip>
                    <TooltipTrigger asChild>{block}</TooltipTrigger>
                    <TooltipContent>
                      <span className="font-medium">{activity.count} events</span>
                      <span className="ml-1 text-muted-foreground">
                        on {formatDateLong(parseLocalDate(activity.date))}
                      </span>
                    </TooltipContent>
                  </RadixTooltip>
                </TooltipProvider>
              )}
              labels={{
                months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                totalCount: '{{count}} activities in {{year}}',
                legend: { less: 'Less', more: 'More' },
              }}
            />
          </TooltipProvider>
          );
        })()}
      </CardContent>
    </Card>
  );
}

