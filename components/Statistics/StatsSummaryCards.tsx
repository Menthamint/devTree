'use client';

import React from 'react';
import { BookOpen, Layout, Clock, PenTool } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SummaryData } from './types';
import { formatDuration } from './types';

interface Props {
  data: SummaryData | null;
  loading?: boolean;
}

const CARDS = [
  {
    key: 'totalPages' as const,
    label: 'Total Notes',
    icon: <BookOpen className="h-4 w-4 text-muted-foreground" />,
    format: (v: number) => v.toLocaleString(),
  },
  {
    key: 'totalBlocks' as const,
    label: 'Total Blocks',
    icon: <Layout className="h-4 w-4 text-muted-foreground" />,
    format: (v: number) => v.toLocaleString(),
  },
  {
    key: 'totalSessionTimeMs' as const,
    label: 'Total Time in App',
    icon: <Clock className="h-4 w-4 text-muted-foreground" />,
    format: (v: number) => formatDuration(v),
  },
  {
    key: 'totalWritingTimeMs' as const,
    label: 'Writing Time',
    icon: <PenTool className="h-4 w-4 text-muted-foreground" />,
    format: (v: number) => formatDuration(v),
  },
];

export function StatsSummaryCards({ data, loading }: Props) {
  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {CARDS.map((card) => (
        <Card key={card.key}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
            {card.icon}
          </CardHeader>
          <CardContent>
            {loading || !data ? (
              <div className="h-7 w-24 animate-pulse rounded bg-muted" />
            ) : (
              <div className="text-2xl font-bold">{card.format(data[card.key] as number)}</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
