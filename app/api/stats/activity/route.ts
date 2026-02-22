import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { userId } = auth;

  const { searchParams } = new URL(req.url);
  const days = Math.min(365, Math.max(7, Number(searchParams.get('days') ?? 90)));

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  try {
    const [sessions, visits, events] = await Promise.all([
      prisma.userSession.findMany({
        where: { userId, startedAt: { gte: since }, durationMs: { not: null } },
        select: { startedAt: true, durationMs: true },
      }),
      prisma.pageVisit.findMany({
        where: { userId, startedAt: { gte: since } },
        select: { startedAt: true, pageId: true },
      }),
      prisma.contentEvent.findMany({
        where: { userId, timestamp: { gte: since } },
        select: { timestamp: true },
      }),
    ]);

    /** Aggregate into a map keyed by YYYY-MM-DD. */
    const byDate = new Map<string, { sessionMs: number; pagesVisited: Set<string>; contentEvents: number }>();

    const get = (d: string) => {
      if (!byDate.has(d)) byDate.set(d, { sessionMs: 0, pagesVisited: new Set(), contentEvents: 0 });
      return byDate.get(d)!;
    };

    for (const s of sessions) {
      const d = s.startedAt.toISOString().split('T')[0];
      get(d).sessionMs += s.durationMs ?? 0;
    }

    for (const v of visits) {
      const d = v.startedAt.toISOString().split('T')[0];
      if (v.pageId) get(d).pagesVisited.add(v.pageId);
    }

    for (const e of events) {
      const d = e.timestamp.toISOString().split('T')[0];
      get(d).contentEvents += 1;
    }

    // Build a full array covering the requested range (fill missing days with zeros)
    const result = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      const data = byDate.get(key);
      result.push({
        date: key,
        sessionMs: data?.sessionMs ?? 0,
        pagesVisited: data?.pagesVisited.size ?? 0,
        contentEvents: data?.contentEvents ?? 0,
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[stats/activity] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
