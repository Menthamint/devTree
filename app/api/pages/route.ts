import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { requireAuth } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

// ─── GET /api/pages ─────────────────────────────────────────────────────────
// Returns all pages (with blocks) owned by the authenticated user, sorted by order.

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { userId } = auth;

  try {
    const pages = await prisma.page.findMany({
      where: { ownerId: userId },
      include: {
        blocks: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });

    return NextResponse.json(pages);
  } catch (err) {
    console.error('[GET /api/pages]', err);
    return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 });
  }
}

// ─── POST /api/pages ─────────────────────────────────────────────────────────
// Creates a new page. Body: { title: string; folderId?: string }

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { userId } = auth;

  let body: { title?: unknown; folderId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const folderId =
    typeof body.folderId === 'string' && body.folderId ? body.folderId : null;

  // Verify the folder belongs to this user (if provided)
  if (folderId) {
    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (folder?.ownerId !== userId) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }
  }

  // Place at the end by finding the current max order
  const maxOrder = await prisma.page.aggregate({
    where: { ownerId: userId },
    _max: { order: true },
  });
  const order = (maxOrder._max.order ?? -1) + 1;

  const [siblingPages, siblingFolders] = await Promise.all([
    prisma.page.findMany({
      where: { ownerId: userId, folderId },
      select: { title: true },
    }),
    prisma.folder.findMany({
      where: { ownerId: userId, parentId: folderId },
      select: { name: true },
    }),
  ]);

  const targetTitle = normalizeName(title);
  const hasDuplicatePage = siblingPages.some((p) => normalizeName(p.title) === targetTitle);
  const hasDuplicateFolder = siblingFolders.some((f) => normalizeName(f.name) === targetTitle);
  if (hasDuplicatePage || hasDuplicateFolder) {
    return NextResponse.json(
      { error: 'Name already exists in this folder', code: 'DUPLICATE_NAME' },
      { status: 409 },
    );
  }

  // All new pages start as unified Tiptap documents (empty doc JSON).
  // Legacy block-based pages keep content = null (existing rows unchanged).
  const emptyTiptapDoc = { type: 'doc', content: [] };

  try {
    const page = await prisma.page.create({
      data: {
        title,
        ownerId: userId,
        folderId,
        order,
        content: emptyTiptapDoc,
      },
      include: { blocks: true },
    });

    // Emit PAGE_CREATED content event (best-effort; failure is non-fatal)
    void prisma.contentEvent.create({
      data: { userId, type: 'PAGE_CREATED', pageId: page.id, folderId: folderId ?? null },
    }).catch(() => {});

    return NextResponse.json(page, { status: 201 });
  } catch (err) {
    console.error('[POST /api/pages]', err);
    return NextResponse.json({ error: 'Failed to create page' }, { status: 500 });
  }
}
