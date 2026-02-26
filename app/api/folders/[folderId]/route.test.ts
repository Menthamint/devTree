/** @vitest-environment node */
import { NextRequest, NextResponse } from 'next/server';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DELETE } from './route';

const requireAuthMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/apiAuth', () => ({ requireAuth: requireAuthMock }));

const prismaMock = vi.hoisted(() => ({
  folder: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  page: {
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
}));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

function makeDeleteRequest() {
  return new NextRequest('http://localhost/api/folders/f-root', { method: 'DELETE' });
}

describe('DELETE /api/folders/[folderId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue({ userId: 'user-1' });
    prismaMock.folder.findUnique.mockResolvedValue({ id: 'f-root', ownerId: 'user-1' });
    prismaMock.folder.findMany.mockResolvedValue([]);
    prismaMock.page.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.folder.deleteMany.mockResolvedValue({ count: 0 });
  });

  it('returns auth error when unauthenticated', async () => {
    requireAuthMock.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await DELETE(makeDeleteRequest(), { params: Promise.resolve({ folderId: 'f-root' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when folder is not found or not owned', async () => {
    prismaMock.folder.findUnique.mockResolvedValue(null);

    const res = await DELETE(makeDeleteRequest(), { params: Promise.resolve({ folderId: 'f-root' }) });
    expect(res.status).toBe(404);
  });

  it('deletes nested pages and all descendant folders recursively', async () => {
    prismaMock.folder.findMany.mockResolvedValue([
      { id: 'f-root', parentId: null },
      { id: 'f-child-1', parentId: 'f-root' },
      { id: 'f-child-2', parentId: 'f-root' },
      { id: 'f-grandchild', parentId: 'f-child-1' },
      { id: 'f-other', parentId: null },
    ]);

    const res = await DELETE(makeDeleteRequest(), { params: Promise.resolve({ folderId: 'f-root' }) });

    expect(res.status).toBe(204);
    expect(prismaMock.page.deleteMany).toHaveBeenCalledWith({
      where: {
        ownerId: 'user-1',
        folderId: { in: ['f-root', 'f-child-1', 'f-child-2', 'f-grandchild'] },
      },
    });
    expect(prismaMock.folder.deleteMany).toHaveBeenCalledWith({
      where: {
        ownerId: 'user-1',
        id: { in: ['f-root', 'f-child-1', 'f-child-2', 'f-grandchild'] },
      },
    });
  });
});