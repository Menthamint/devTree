'use client';

import React, { useState } from 'react';

import {
  Area,
  AreaChart,
  CartesianGrid,
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
import { formatDateLong, formatDateShort, parseLocalDate } from '@/lib/dateUtils';

import type { ActivityDay } from './types';
import { formatDuration } from './types';

interface Props {
  data: ActivityDay[];
  loading?: boolean;
}

type View = '30' | '90';

// Explicit hex colours — CSS custom properties are not reliably resolved inside
// Recharts SVG elements in all browsers / render environments.
const COLORS = {
  session: '#3b82f6', // blue-500
  events: '#8b5cf6', // violet-500
};

const TICK_STYLE = { fontSize: 11, fill: '#6b7280' }; // gray-500, readable on dark + light

// ─── Shared tooltip ──────────────────────────────────────────────────────────
interface TooltipProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  isTime?: boolean;
}

function ChartTooltip({ active, payload, isTime }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const rawDate: string | undefined = payload[0]?.payload?.rawDate as string | undefined;
  const dateLabel = rawDate ? formatDateLong(parseLocalDate(rawDate)) : '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entry: any = payload[0];
  return (
    <div className="bg-background rounded-lg border p-3 text-sm shadow-sm">
      {dateLabel && <p className="text-foreground mb-1.5 font-semibold">{dateLabel}</p>}
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
        <span className="text-muted-foreground">{entry.name}:</span>
        <span className="font-medium">
          {isTime ? formatDuration(entry.value as number) : (entry.value as number)}
        </span>
      </div>
    </div>
  );
}

// ─── Single mini-chart ────────────────────────────────────────────────────────
interface MiniChartProps {
  data: ReturnType<typeof buildDisplayData>;
  title: string;
  dataKey: string;
  color: string;
  gradId: string;
  tickInterval: number;
  isTime?: boolean;
}

function buildDisplayData(sliced: ActivityDay[]) {
  return sliced.map((d) => ({
    rawDate: d.date,
    label: formatDateShort(parseLocalDate(d.date)),
    sessionMs: d.sessionMs,
    contentEvents: d.contentEvents,
  }));
}

function MiniChart({ data, title, dataKey, color, gradId, tickInterval, isTime }: MiniChartProps) {
  // Time chart needs a wider Y-axis to fit labels like "16h 10m".
  // Both charts need bottom margin so date labels aren't clipped.
  const yAxisWidth = isTime ? 58 : 30;
  const leftMargin = isTime ? 4 : -10;
  return (
    <div>
      <p className="text-muted-foreground mb-2 text-xs font-medium">{title}</p>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 18, right: 8, left: leftMargin, bottom: 16 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
          <XAxis
            dataKey="label"
            tick={TICK_STYLE}
            tickLine={false}
            axisLine={false}
            interval={tickInterval}
          />
          <YAxis
            tick={TICK_STYLE}
            tickLine={false}
            axisLine={false}
            tickFormatter={isTime ? (v: number) => (v === 0 ? '0' : formatDuration(v)) : undefined}
            width={yAxisWidth}
          />
          <Tooltip content={<ChartTooltip isTime={isTime} />} />
          <Area
            type="monotone"
            dataKey={dataKey}
            name={title}
            stroke={color}
            fill={`url(#${gradId})`}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function DailyActivityChart({ data, loading }: Props) {
  const [view, setView] = useState<View>('30');

  const sliced = data.slice(-Number(view));
  // Tick density: show ~7-8 labels regardless of window size
  const tickInterval = view === '30' ? 3 : 9;
  const displayData = buildDisplayData(sliced);

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
                view === v
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {v}d
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="bg-muted h-48 w-full animate-pulse rounded" />
        ) : (
          <div className="grid grid-cols-2 gap-6">
            <MiniChart
              data={displayData}
              title="Session Time"
              dataKey="sessionMs"
              color={COLORS.session}
              gradId="sessionGrad"
              tickInterval={tickInterval}
              isTime
            />
            <MiniChart
              data={displayData}
              title="Content Events"
              dataKey="contentEvents"
              color={COLORS.events}
              gradId="eventsGrad"
              tickInterval={tickInterval}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
