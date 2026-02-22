'use client';

import React from 'react';
import { ActivityCalendar, type Activity } from 'react-activity-calendar';
import { Tooltip as RadixTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { ActivityDay } from './types';

interface Props {
  data: ActivityDay[];
  loading?: boolean;
}

export function ActivityHeatmap({ data, loading }: Props) {
  // react-activity-calendar requires at least a year of data with sequential dates
  // Map ActivityDay[] → Activity[] (date, count, level)
  const calendarData = data.map((d) => {
    const total = d.contentEvents + Math.floor(d.sessionMs / 60_000);
    const level = total === 0 ? 0 : total < 3 ? 1 : total < 8 ? 2 : total < 15 ? 3 : 4;
    return { date: d.date, count: total, level: level as 0 | 1 | 2 | 3 | 4 };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Heatmap</CardTitle>
        <CardDescription>Your daily activity over the last 90 days</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {loading ? (
          <div className="h-28 w-full animate-pulse rounded bg-muted" />
        ) : calendarData.length === 0 ? (
          <div className="flex h-28 items-center justify-center text-sm text-muted-foreground">
            No activity data yet
          </div>
        ) : (
          <TooltipProvider>
            <ActivityCalendar
              data={calendarData}
              colorScheme="light"
              theme={{
                light: ['hsl(var(--muted))', 'hsl(var(--primary) / 0.25)', 'hsl(var(--primary) / 0.5)', 'hsl(var(--primary) / 0.75)', 'hsl(var(--primary))'],
                dark: ['hsl(var(--muted))', 'hsl(var(--primary) / 0.25)', 'hsl(var(--primary) / 0.5)', 'hsl(var(--primary) / 0.75)', 'hsl(var(--primary))'],
              }}
              renderBlock={(block: React.ReactElement, activity: Activity) => (
                <TooltipProvider>
                  <RadixTooltip>
                    <TooltipTrigger asChild>{block}</TooltipTrigger>
                    <TooltipContent>
                      {activity.count} events on {activity.date}
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
        )}
      </CardContent>
    </Card>
  );
}
