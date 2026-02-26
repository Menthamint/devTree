'use client';

import React from 'react';

import { BookOpen, Clock, HelpCircle, Layout, PenTool } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/shared/ui/tooltip';

import type { SummaryData } from './types';
import { formatDuration } from './types';

interface Props {
  data: SummaryData | null;
  loading?: boolean;
}

interface BarConfig {
  label: string;
  pct: number;
  color: string;
  tooltip: string;
}

interface CardConfig {
  key: string;
  label: string;
  helpText: string;
  icon: React.ReactNode;
  value: string | null;
  sub1: string;
  sub2: string | null;
  bar: BarConfig | null;
}

// Returns { pct, label } for the nearest milestone above `value`
function milestoneProgress(value: number, milestones: number[]): { pct: number; label: string } {
  const next = milestones.find((m) => m > value) ?? milestones[milestones.length - 1];
  const prev = milestones[milestones.indexOf(next) - 1] ?? 0;
  const pct = Math.min(100, Math.round(((value - prev) / (next - prev)) * 100));
  return { pct, label: `${value} / ${next}` };
}

const NOTE_MILESTONES = [10, 25, 50, 100, 250, 500];
// Writing time milestones in ms: 30m, 2h, 10h, 25h, 50h, 100h
const WRITING_MILESTONES = [
  30 * 60_000,
  2 * 3_600_000,
  10 * 3_600_000,
  25 * 3_600_000,
  50 * 3_600_000,
  100 * 3_600_000,
];

function buildNotesBar(noteMilestone: { pct: number; label: string } | null): BarConfig | null {
  if (!noteMilestone) return null;
  return {
    label: `next milestone: ${noteMilestone.label.split(' / ')[1]}`,
    pct: noteMilestone.pct,
    color: 'bg-violet-500',
    tooltip: `${noteMilestone.label} notes — progress toward your next milestone`,
  };
}

function buildBlocksBar(
  data: SummaryData | null,
  avgBlocksPerNote: string | null,
  richnessPct: number,
): BarConfig | null {
  if (!data || data.totalPages === 0) return null;
  return {
    label: 'note richness',
    pct: richnessPct,
    color: 'bg-cyan-500',
    tooltip: `Avg ${avgBlocksPerNote} blocks/note. A well-developed note has 5+ blocks.`,
  };
}

function buildSessionBar(writingPct: number | null): BarConfig | null {
  if (writingPct === null) return null;
  return {
    label: 'writing focus',
    pct: writingPct,
    color: 'bg-emerald-500',
    tooltip: `${writingPct}% of your session time is spent actively writing. Higher = more productive.`,
  };
}

function buildWritingBar(
  data: SummaryData | null,
  writingMilestone: { pct: number; label: string } | null,
): BarConfig | null {
  if (!writingMilestone) return null;
  const nextMs =
    WRITING_MILESTONES.find((m) => m > (data?.totalWritingTimeMs ?? 0)) ??
    WRITING_MILESTONES[WRITING_MILESTONES.length - 1]!;
  return {
    label: `next milestone: ${formatDuration(nextMs)}`,
    pct: writingMilestone.pct,
    color: 'bg-indigo-500',
    tooltip: 'Progress toward your next writing time milestone',
  };
}

function buildCountCards(
  data: SummaryData | null,
  avgBlocksPerNote: string | null,
  noteMilestone: { pct: number; label: string } | null,
  richnessPct: number,
): CardConfig[] {
  return [
    {
      key: 'notes',
      label: 'Total Notes',
      helpText:
        "Total number of notes you've created. The bar shows progress toward your next notes milestone.",
      icon: <BookOpen className="text-muted-foreground h-4 w-4" />,
      value: data ? data.totalPages.toLocaleString() : null,
      sub1: avgBlocksPerNote !== null ? `${avgBlocksPerNote} blocks / note` : 'No notes yet',
      sub2: data ? `${data.totalBlocks.toLocaleString()} blocks total` : null,
      bar: buildNotesBar(noteMilestone),
    },
    {
      key: 'blocks',
      label: 'Total Blocks',
      helpText:
        'Total content blocks across all notes (paragraphs, code, diagrams, etc.). The bar shows average note richness — how many blocks your typical note has vs a well-developed 5-block note.',
      icon: <Layout className="text-muted-foreground h-4 w-4" />,
      value: data ? data.totalBlocks.toLocaleString() : null,
      sub1: data && data.totalPages > 0 ? `across ${data.totalPages} notes` : 'Start writing!',
      sub2: avgBlocksPerNote !== null ? `avg ${avgBlocksPerNote} per note` : null,
      bar: buildBlocksBar(data, avgBlocksPerNote, richnessPct),
    },
  ];
}

function buildTimeCards(
  data: SummaryData | null,
  writingPct: number | null,
  browsingTimeMs: number,
  writingMilestone: { pct: number; label: string } | null,
): CardConfig[] {
  return [
    {
      key: 'session',
      label: 'Total Time in App',
      helpText:
        "Total time you've spent in the app across all sessions. The bar shows your writing focus — what portion of that time was spent actively writing vs just browsing.",
      icon: <Clock className="text-muted-foreground h-4 w-4" />,
      value: data ? formatDuration(data.totalSessionTimeMs) : null,
      sub1: writingPct !== null ? `${writingPct}% writing focus` : 'Time spent in app',
      sub2: browsingTimeMs > 0 ? `${formatDuration(browsingTimeMs)} browsing` : null,
      bar: buildSessionBar(writingPct),
    },
    {
      key: 'writing',
      label: 'Writing Time',
      helpText:
        'Total time spent actively typing in the editor. The bar shows progress toward your next writing time milestone (30m → 2h → 10h → 25h…).',
      icon: <PenTool className="text-muted-foreground h-4 w-4" />,
      value: data ? formatDuration(data.totalWritingTimeMs) : null,
      sub1: writingPct !== null ? `${writingPct}% of session time` : 'Actively typing',
      sub2: browsingTimeMs > 0 ? `${formatDuration(browsingTimeMs)} other activity` : null,
      bar: buildWritingBar(data, writingMilestone),
    },
  ];
}

function buildCards(data: SummaryData | null): CardConfig[] {
  const avgBlocksPerNote =
    data && data.totalPages > 0 ? (data.totalBlocks / data.totalPages).toFixed(1) : null;
  const writingPct =
    data && data.totalSessionTimeMs > 0
      ? Math.min(100, Math.round((data.totalWritingTimeMs / data.totalSessionTimeMs) * 100))
      : null;
  const browsingTimeMs = data ? Math.max(0, data.totalSessionTimeMs - data.totalWritingTimeMs) : 0;
  const noteMilestone = data ? milestoneProgress(data.totalPages, NOTE_MILESTONES) : null;
  const richnessPct =
    data && data.totalPages > 0
      ? Math.min(100, Math.round((data.totalBlocks / data.totalPages / 5) * 100))
      : 0;
  const writingMilestone = data
    ? milestoneProgress(data.totalWritingTimeMs, WRITING_MILESTONES)
    : null;
  return [
    ...buildCountCards(data, avgBlocksPerNote, noteMilestone, richnessPct),
    ...buildTimeCards(data, writingPct, browsingTimeMs, writingMilestone),
  ];
}

export function StatsSummaryCards({ data, loading }: Props) {
  const cards = buildCards(data);

  return (
    <TooltipProvider>
      <div className="grid h-full grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <Card
            key={card.key}
            className="motion-surface motion-interactive flex flex-col hover:-translate-y-0.5 hover:shadow-md"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="text-muted-foreground/50 hover:text-muted-foreground h-3.5 w-3.5 cursor-default transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-56 text-xs leading-relaxed">
                    {card.helpText}
                  </TooltipContent>
                </Tooltip>
              </div>
              {card.icon}
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              {loading || !data ? (
                <>
                  <div className="bg-muted h-7 w-24 animate-pulse rounded" />
                  <div className="bg-muted mt-2 h-3.5 w-36 animate-pulse rounded" />
                  <div className="bg-muted mt-1.5 h-3.5 w-28 animate-pulse rounded" />
                  <div className="mt-auto pt-4">
                    <div className="bg-muted h-1.5 w-full animate-pulse rounded-full" />
                  </div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold tabular-nums">{card.value}</div>
                  <p className="text-muted-foreground mt-1 text-xs leading-none">{card.sub1}</p>
                  {card.sub2 && (
                    <p className="text-muted-foreground/60 mt-1 text-xs leading-none">
                      {card.sub2}
                    </p>
                  )}

                  {card.bar && (
                    <div className="mt-auto space-y-1.5 pt-4">
                      <div className="text-muted-foreground flex items-center justify-between text-[11px]">
                        <span>{card.bar.label}</span>
                        <span className="font-medium tabular-nums">{card.bar.pct}%</span>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="bg-muted h-1.5 w-full cursor-default overflow-hidden rounded-full">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${card.bar.color}`}
                              style={{ width: `${card.bar.pct}%` }}
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-48 text-xs">
                          {card.bar.tooltip}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </TooltipProvider>
  );
}
