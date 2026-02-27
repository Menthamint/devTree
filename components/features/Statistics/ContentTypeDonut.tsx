'use client';

import React from 'react';

import { Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/shared/ui/card';

import type { ContentData } from './types';

interface Props {
  data: ContentData | null;
  loading?: boolean;
}

const BLOCK_TYPE_LABELS: Record<string, string> = {
  text: 'Text',
  code: 'Code',
  diagram: 'Diagram',
  table: 'Table',
  agenda: 'Checklist',
  image: 'Image',
  video: 'Video',
  whiteboard: 'Whiteboard',
  audio: 'Audio',
  link: 'Link',
  heading: 'Heading',
  list: 'List',
};

// Balanced, readable palette — no toxic neons
const PALETTE = [
  '#6366f1', // indigo-500
  '#06b6d4', // cyan-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ec4899', // pink-500
  '#8b5cf6', // violet-500
  '#14b8a6', // teal-500
  '#f97316', // orange-500
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const entry = payload[0] as { name: string; value: number; payload: { percent: number } };
  const pct = entry.payload?.percent ?? 0;
  return (
    <div className="bg-background rounded-lg border p-3 text-sm shadow-sm">
      <p className="text-foreground font-semibold">{entry.name}</p>
      <p className="text-muted-foreground mt-0.5">
        {entry.value} blocks <span className="text-foreground/60">({(pct * 100).toFixed(1)}%)</span>
      </p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomLegend({ payload }: any) {
  if (!payload?.length) return null;
  return (
    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 px-2">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((entry: any) => (
        <div key={`${entry.value as string}-${entry.color as string}`} className="flex min-w-0 items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: entry.color as string }}
          />
          <span className="text-muted-foreground truncate text-xs">{entry.value as string}</span>
          <span className="ml-auto text-xs font-medium tabular-nums">
            {(entry.payload as { value: number }).value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ContentTypeDonut({ data, loading }: Readonly<Props>) {
  const chartData = data
    ? Object.entries(data.blockTypeCounts)
        .map(([type, count], index) => ({
          name: BLOCK_TYPE_LABELS[type] ?? type,
          value: count,
          fill: PALETTE[index % PALETTE.length],
        }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value)
    : [];

  return (
    <Card className="motion-surface motion-interactive overflow-hidden hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader>
        <CardTitle>Block Types</CardTitle>
        <CardDescription>Distribution of content block types</CardDescription>
      </CardHeader>
      <CardContent>
        {(() => {
          if (loading) return <div className="bg-muted h-80 w-full animate-pulse rounded" />;
          if (chartData.length === 0) {
            return (
              <div className="text-muted-foreground flex h-80 w-full items-center justify-center text-sm">
                No blocks yet — start writing!
              </div>
            );
          }
          return (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="42%"
                  outerRadius="82%"
                  innerRadius="68%"
                  paddingAngle={6}
                  cornerRadius={6}
                  strokeWidth={0}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend content={<CustomLegend />} verticalAlign="bottom" />
              </PieChart>
            </ResponsiveContainer>
          );
        })()}
      </CardContent>
    </Card>
  );
}
