import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { requireAuth } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

type Params = { params: Promise<{ pageId: string }> };

// ─── Shared ownership check ───────────────────────────────────────────────────

async function getOwnedPage(pageId: string, userId: string) {
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    include: {
      blocks: { orderBy: { order: 'asc' } },
    },
  });

  if (!page) return null;
  if (page.ownerId !== userId) return null; // 403 — don't reveal existence
  return page;
}

// ─── GET /api/pages/[pageId] ──────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { pageId } = await params;
  const page = await getOwnedPage(pageId, auth.userId);
  if (!page) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }

  return NextResponse.json(page);
}

// ─── PUT /api/pages/[pageId] ──────────────────────────────────────────────────
// Body: { title?: string; order?: number; tags?: string[] }

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { pageId } = await params;
  const page = await getOwnedPage(pageId, auth.userId);
  if (!page) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }

  let body: { title?: unknown; order?: unknown; tags?: unknown; content?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: { title?: string; order?: number; tags?: string[]; content?: any } = {};

  // content is an arbitrary Tiptap JSON object — accept any object or null
  if ('content' in body && (body.content === null || (typeof body.content === 'object' && !Array.isArray(body.content)))) {
    updates.content = body.content;
  }

  if (typeof body.title === 'string') {
    const trimmed = body.title.trim();
    if (trimmed) updates.title = trimmed;
  }
  if (typeof body.order === 'number' && Number.isInteger(body.order)) {
    updates.order = body.order;
  }
  if (Array.isArray(body.tags)) {
    updates.tags = (body.tags as unknown[])
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.toLowerCase().trim())
      .filter(Boolean);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
  }

  if (updates.title) {
    const [siblingPages, siblingFolders] = await Promise.all([
      prisma.page.findMany({
        where: {
          ownerId: auth.userId,
          folderId: page.folderId,
          id: { not: page.id },
        },
        select: { title: true },
      }),
      prisma.folder.findMany({
        where: { ownerId: auth.userId, parentId: page.folderId },
        select: { name: true },
      }),
    ]);

    const targetTitle = normalizeName(updates.title);
    const hasDuplicatePage = siblingPages.some((p) => normalizeName(p.title) === targetTitle);
    const hasDuplicateFolder = siblingFolders.some((f) => normalizeName(f.name) === targetTitle);
    if (hasDuplicatePage || hasDuplicateFolder) {
      return NextResponse.json(
        { error: 'Name already exists in this folder', code: 'DUPLICATE_NAME' },
        { status: 409 },
      );
    }
  }

  try {
    const updated = await prisma.page.update({
      where: { id: pageId },
      data: updates,
      include: { blocks: { orderBy: { order: 'asc' } } },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[PUT /api/pages/[pageId]]', err);
    return NextResponse.json({ error: 'Failed to update page' }, { status: 500 });
  }
}

// ─── DELETE /api/pages/[pageId] ───────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { pageId } = await params;
  const page = await getOwnedPage(pageId, auth.userId);
  if (!page) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }

  try {
    // Emit PAGE_DELETED event before deleting (page still exists at this point)
    void prisma.contentEvent.create({
      data: { userId: auth.userId, type: 'PAGE_DELETED', pageId, folderId: page.folderId ?? null },
    }).catch(() => {});

    // Blocks cascade-delete via the onDelete: Cascade relation
    await prisma.page.delete({ where: { id: pageId } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('[DELETE /api/pages/[pageId]]', err);
    return NextResponse.json({ error: 'Failed to delete page' }, { status: 500 });
  }
}
