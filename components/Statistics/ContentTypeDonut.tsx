'use client';

import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
};

const PALETTE = [
  'hsl(var(--primary))',
  'hsl(217 91% 60%)',
  'hsl(142 76% 36%)',
  'hsl(38 92% 50%)',
  'hsl(280 68% 60%)',
  'hsl(355 78% 56%)',
  'hsl(174 60% 41%)',
  'hsl(25 95% 53%)',
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-sm text-sm">
      <p className="font-medium">{payload[0].name}</p>
      <p className="text-muted-foreground">{payload[0].value} blocks</p>
    </div>
  );
}

export function ContentTypeDonut({ data, loading }: Props) {
  const chartData = data
    ? Object.entries(data.blockTypeCounts)
        .map(([type, count]) => ({
          name: BLOCK_TYPE_LABELS[type] ?? type,
          value: count,
        }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value)
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Block Types</CardTitle>
        <CardDescription>Distribution of content block types</CardDescription>
      </CardHeader>
      <CardContent className="h-64 flex items-center">
        {loading ? (
          <div className="h-full w-full animate-pulse rounded bg-muted" />
        ) : chartData.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            No blocks yet — start writing!
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="45%"
                outerRadius="70%"
                paddingAngle={3}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
