'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { TopicData } from './types';
import { formatDuration } from './types';

interface Props {
  data: TopicData[];
  loading?: boolean;
}

const PALETTE = [
  'hsl(var(--primary))',
  'hsl(217 91% 60%)',
  'hsl(142 76% 36%)',
  'hsl(38 92% 50%)',
  'hsl(280 68% 60%)',
  'hsl(355 78% 56%)',
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as TopicData;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-sm text-sm space-y-1">
      <p className="font-medium">{d.folderName}</p>
      <p className="text-muted-foreground">Time spent: <span className="text-foreground font-medium">{formatDuration(d.timeSpentMs)}</span></p>
      <p className="text-muted-foreground">Pages: <span className="text-foreground font-medium">{d.pageCount}</span></p>
    </div>
  );
}

export function TopicsBarChart({ data, loading }: Props) {
  const chartData = data
    .filter((d) => d.timeSpentMs > 0)
    .slice(0, 8)
    .map((d) => ({ ...d, timeMin: Math.round(d.timeSpentMs / 60_000) }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Time per Topic</CardTitle>
        <CardDescription>How long you spent in each folder</CardDescription>
      </CardHeader>
      <CardContent className="h-64">
        {loading ? (
          <div className="h-full w-full animate-pulse rounded bg-muted" />
        ) : chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No topic data yet — spend some time in your notes
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit="m" />
              <YAxis
                type="category"
                dataKey="folderName"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={90}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
              <Bar dataKey="timeMin" radius={[0, 4, 4, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
