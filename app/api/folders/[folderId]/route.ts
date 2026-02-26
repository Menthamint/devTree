import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { requireAuth } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

type Params = { params: Promise<{ folderId: string }> };

async function getOwnedFolder(folderId: string, userId: string) {
  const folder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (!folder || folder.ownerId !== userId) return null;
  return folder;
}

function collectDescendantFolderIds(
  rootFolderId: string,
  allFolders: Array<{ id: string; parentId: string | null }>,
): string[] {
  const byParent = new Map<string | null, string[]>();
  for (const folder of allFolders) {
    const siblings = byParent.get(folder.parentId) ?? [];
    siblings.push(folder.id);
    byParent.set(folder.parentId, siblings);
  }

  const queue = [rootFolderId];
  const result: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    result.push(current);
    const children = byParent.get(current) ?? [];
    queue.push(...children);
  }

  return result;
}

// ─── PUT /api/folders/[folderId] ──────────────────────────────────────────────
// Rename or reorder a folder. Body: { name?: string; order?: number }

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { folderId } = await params;
  const folder = await getOwnedFolder(folderId, auth.userId);
  if (!folder) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
  }

  let body: { name?: unknown; order?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const updates: { name?: string; order?: number } = {};
  if (typeof body.name === 'string' && body.name.trim()) {
    updates.name = body.name.trim();
  }
  if (typeof body.order === 'number' && Number.isInteger(body.order)) {
    updates.order = body.order;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  if (updates.name) {
    const [siblingFolders, siblingPages] = await Promise.all([
      prisma.folder.findMany({
        where: {
          ownerId: auth.userId,
          parentId: folder.parentId,
          id: { not: folder.id },
        },
        select: { name: true },
      }),
      prisma.page.findMany({
        where: { ownerId: auth.userId, folderId: folder.parentId },
        select: { title: true },
      }),
    ]);

    const targetName = normalizeName(updates.name);
    const hasDuplicateFolder = siblingFolders.some((f) => normalizeName(f.name) === targetName);
    const hasDuplicatePage = siblingPages.some((p) => normalizeName(p.title) === targetName);
    if (hasDuplicateFolder || hasDuplicatePage) {
      return NextResponse.json(
        { error: 'Name already exists in this folder', code: 'DUPLICATE_NAME' },
        { status: 409 },
      );
    }
  }

  try {
    const updated = await prisma.folder.update({ where: { id: folderId }, data: updates });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[PUT /api/folders/[folderId]]', err);
    return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 });
  }
}

// ─── DELETE /api/folders/[folderId] ───────────────────────────────────────────
// Deletes a folder and all nested descendants (folders, pages, and page content).

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { folderId } = await params;
  const folder = await getOwnedFolder(folderId, auth.userId);
  if (!folder) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
  }

  try {
    const allUserFolders = await prisma.folder.findMany({
      where: { ownerId: auth.userId },
      select: { id: true, parentId: true },
    });
    const folderIdsToDelete = collectDescendantFolderIds(folderId, allUserFolders);

    await prisma.$transaction([
      prisma.page.deleteMany({
        where: {
          ownerId: auth.userId,
          folderId: { in: folderIdsToDelete },
        },
      }),
      prisma.folder.deleteMany({
        where: {
          ownerId: auth.userId,
          id: { in: folderIdsToDelete },
        },
      }),
    ]);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('[DELETE /api/folders/[folderId]]', err);
    return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
  }
}
