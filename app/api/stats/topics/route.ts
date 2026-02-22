import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { userId } = auth;

  try {
    const [folders, visits, pages] = await Promise.all([
      prisma.folder.findMany({
        where: { ownerId: userId },
        select: { id: true, name: true },
      }),
      prisma.pageVisit.findMany({
        where: { userId, folderId: { not: null }, durationMs: { not: null } },
        select: { folderId: true, durationMs: true },
      }),
      prisma.page.findMany({
        where: { ownerId: userId },
        select: { folderId: true },
      }),
    ]);

    // Aggregate time and page count per folder
    const byFolder = new Map<string, { timeSpentMs: number; pageCount: number; eventCount: number }>();

    const get = (folderId: string) => {
      if (!byFolder.has(folderId)) byFolder.set(folderId, { timeSpentMs: 0, pageCount: 0, eventCount: 0 });
      return byFolder.get(folderId)!;
    };

    for (const v of visits) {
      if (v.folderId) get(v.folderId).timeSpentMs += v.durationMs ?? 0;
    }

    for (const p of pages) {
      if (p.folderId) get(p.folderId).pageCount += 1;
    }

    const result = folders.map((f) => ({
      folderId: f.id,
      folderName: f.name,
      ...(byFolder.get(f.id) ?? { timeSpentMs: 0, pageCount: 0, eventCount: 0 }),
    }));

    // Sort by time spent descending
    result.sort((a, b) => b.timeSpentMs - a.timeSpentMs);

    return NextResponse.json(result);
  } catch (err) {
    console.error('[stats/topics] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
