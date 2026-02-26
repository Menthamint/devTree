import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { userId } = auth;

  try {
    const [totalPages, totalBlocks, sessionAgg, writingAgg, streak] = await Promise.all([
      prisma.page.count({ where: { ownerId: userId } }),
      prisma.block.count({ where: { page: { ownerId: userId } } }),
      prisma.userSession.aggregate({
        where: { userId, durationMs: { not: null } },
        _sum: { durationMs: true },
      }),
      // Writing time = sum of WritingSession durations (edit-mode only).
      // For users who have no WritingSession rows yet (pre-migration), we fall
      // back to PageVisit totals so the card never shows zero unexpectedly.
      prisma.writingSession.aggregate({
        where: { userId, durationMs: { not: null } },
        _sum: { durationMs: true },
      }),
      prisma.userStreak.findUnique({ where: { userId } }),
    ]);

    const rawSessionMs = sessionAgg._sum.durationMs ?? 0;
    const writingMs = writingAgg._sum.durationMs ?? 0;
    // WritingSession is the authoritative source for edit-mode time.
    // We intentionally show 0 for users who haven't entered edit mode yet
    // (after the WritingSession migration) rather than falling back to
    // PageVisit totals which include all page views and would equal session time.
    const totalSessionTimeMs = rawSessionMs;

    return NextResponse.json({
      totalPages,
      totalBlocks,
      totalSessionTimeMs,
      totalWritingTimeMs: writingMs,
      streakCurrent: streak?.currentStreak ?? 0,
      streakLongest: streak?.longestStreak ?? 0,
      achievements: streak?.achievements ?? [],
    });
  } catch (err) {
    console.error('[stats/summary] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
