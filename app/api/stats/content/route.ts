import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { userId } = auth;

  try {
    const [blocks, contentEvents] = await Promise.all([
      prisma.block.findMany({
        where: { page: { ownerId: userId } },
        select: { type: true, createdAt: true },
      }),
      prisma.contentEvent.findMany({
        where: { userId },
        select: { type: true, timestamp: true },
        orderBy: { timestamp: 'asc' },
      }),
    ]);

    // Block type distribution
    const blockTypeCounts: Record<string, number> = {};
    for (const b of blocks) {
      blockTypeCounts[b.type] = (blockTypeCounts[b.type] ?? 0) + 1;
    }

    // Content events grouped by type
    const eventTypeCounts: Record<string, number> = {};
    for (const e of contentEvents) {
      eventTypeCounts[e.type] = (eventTypeCounts[e.type] ?? 0) + 1;
    }

    // Creation timeline: blocks created per week (last 52 weeks)
    const since = new Date();
    since.setDate(since.getDate() - 364);
    since.setHours(0, 0, 0, 0);

    const weeklyBlocks = new Map<string, number>();
    for (const b of blocks) {
      if (b.createdAt < since) continue;
      const weekStart = new Date(b.createdAt);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const key = weekStart.toISOString().split('T')[0];
      weeklyBlocks.set(key, (weeklyBlocks.get(key) ?? 0) + 1);
    }

    const creationTimeline = Array.from(weeklyBlocks.entries())
      .map(([week, count]) => ({ week, count }))
      .sort((a, b) => a.week.localeCompare(b.week));

    return NextResponse.json({
      blockTypeCounts,
      eventTypeCounts,
      creationTimeline,
    });
  } catch (err) {
    console.error('[stats/content] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
