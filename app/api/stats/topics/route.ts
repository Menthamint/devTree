import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

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
      // Include visits without a stored folderId — we'll resolve them via the
      // page's current folderId below (handles legacy rows from before folder
      // tracking was added).
      prisma.pageVisit.findMany({
        where: { userId, durationMs: { not: null } },
        select: { folderId: true, durationMs: true, pageId: true },
      }),
      prisma.page.findMany({
        where: { ownerId: userId },
        select: { id: true, folderId: true },
      }),
    ]);

    // Build a quick lookup of pageId → folderId from the current page state.
    const pageFolderMap = new Map<string, string>(
      pages.flatMap((p) => (p.folderId ? [[p.id, p.folderId]] : [])),
    );

    // Aggregate time and page count per folder
    const byFolder = new Map<
      string,
      { timeSpentMs: number; pageCount: number; eventCount: number }
    >();

    const get = (folderId: string) => {
      if (!byFolder.has(folderId))
        byFolder.set(folderId, { timeSpentMs: 0, pageCount: 0, eventCount: 0 });
      return byFolder.get(folderId)!;
    };

    for (const v of visits) {
      // Prefer the folderId stored on the visit; fall back to the page's current folder.
      const fid = v.folderId ?? (v.pageId ? (pageFolderMap.get(v.pageId) ?? null) : null);
      if (fid) get(fid).timeSpentMs += v.durationMs ?? 0;
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
