import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { userId } = auth;

  try {
    const [
      totalPages,
      totalBlocks,
      sessionAgg,
      pageTimeAgg,
      streak,
    ] = await Promise.all([
      prisma.page.count({ where: { ownerId: userId } }),
      prisma.block.count({ where: { page: { ownerId: userId } } }),
      prisma.userSession.aggregate({
        where: { userId, durationMs: { not: null } },
        _sum: { durationMs: true },
      }),
      prisma.pageVisit.aggregate({
        where: { userId, durationMs: { not: null } },
        _sum: { durationMs: true },
      }),
      prisma.userStreak.findUnique({ where: { userId } }),
    ]);

    return NextResponse.json({
      totalPages,
      totalBlocks,
      totalSessionTimeMs: sessionAgg._sum.durationMs ?? 0,
      totalWritingTimeMs: pageTimeAgg._sum.durationMs ?? 0,
      streakCurrent: streak?.currentStreak ?? 0,
      streakLongest: streak?.longestStreak ?? 0,
      achievements: streak?.achievements ?? [],
    });
  } catch (err) {
    console.error('[stats/summary] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
