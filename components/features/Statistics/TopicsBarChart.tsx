'use client';

import React from 'react';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/shared/ui/card';

import type { TopicData } from './types';
import { formatDuration } from './types';

interface Props {
  data: TopicData[];
  loading?: boolean;
}

// Explicit hex colours — CSS custom properties are not reliably resolved
// inside Recharts SVG elements, causing invisible bars on dark backgrounds.
const PALETTE = [
  '#8b5cf6', // violet-500
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#a855f7', // purple-500
  '#ef4444', // red-500
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as TopicData;
  return (
    <div className="bg-background space-y-1 rounded-lg border p-3 text-sm shadow-sm">
      <p className="font-medium">{d.folderName}</p>
      <p className="text-muted-foreground">
        Time spent:{' '}
        <span className="text-foreground font-medium">{formatDuration(d.timeSpentMs)}</span>
      </p>
      <p className="text-muted-foreground">
        Pages: <span className="text-foreground font-medium">{d.pageCount}</span>
      </p>
    </div>
  );
}

export function TopicsBarChart({ data, loading }: Props) {
  const chartData = data
    .filter((d) => d.timeSpentMs > 0)
    .slice(0, 8)
    .map((d) => ({ ...d, timeMin: Math.round(d.timeSpentMs / 60_000) }));

  return (
    <Card className="motion-surface motion-interactive hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader>
        <CardTitle>Time per Topic</CardTitle>
        <CardDescription>How long you spent in each folder</CardDescription>
      </CardHeader>
      <CardContent className="h-64">
        {(() => {
          if (loading) return <div className="bg-muted h-full w-full animate-pulse rounded" />;
          if (chartData.length === 0) {
            return (
              <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                No topic data yet — spend some time in your notes
              </div>
            );
          }
          return (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  unit="m"
                />
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
          );
        })()}
      </CardContent>
    </Card>
  );
}
