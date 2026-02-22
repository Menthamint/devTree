'use client';

import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { ActivityDay } from './types';
import { formatDuration } from './types';

interface Props {
  data: ActivityDay[];
  loading?: boolean;
}

type View = '30' | '90';

const COLORS = {
  sessionMs: 'hsl(var(--primary))',
  contentEvents: 'hsl(var(--chart-2, 142 76% 36%))',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-sm text-sm">
      <p className="font-medium mb-1">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">
            {entry.name === 'Session time' ? formatDuration(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DailyActivityChart({ data, loading }: Props) {
  const [view, setView] = useState<View>('30');

  const displayData = data.slice(-Number(view)).map((d) => ({
    date: d.date.slice(5), // MM-DD
    'Session time': d.sessionMs,
    'Content events': d.contentEvents,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Daily Activity</CardTitle>
          <CardDescription>Session time and content changes over time</CardDescription>
        </div>
        <div className="flex gap-1 rounded-md border p-0.5 text-xs">
          {(['30', '90'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded px-2 py-1 transition-colors ${
                view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {v}d
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="h-64">
        {loading ? (
          <div className="h-full w-full animate-pulse rounded bg-muted" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={displayData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="sessionGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.sessionMs} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.sessionMs} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="eventsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.contentEvents} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.contentEvents} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="Session time"
                stroke={COLORS.sessionMs}
                fill="url(#sessionGrad)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="Content events"
                stroke={COLORS.contentEvents}
                fill="url(#eventsGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
