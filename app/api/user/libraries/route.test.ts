/**
 * Tests for /api/user/libraries
 *
 * We mock Prisma and next-auth so no database connection is needed.
 * Tests verify:
 *   - GET returns merged library items for the user.
 *   - POST creates a new library (or reuses an existing one) and links the user.
 *   - Unauthenticated requests receive 401.
 *   - Invalid POST bodies receive 400.
 */
import { NextRequest } from 'next/server';

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Route handlers under test ────────────────────────────────────────────────

import { GET, PATCH, POST } from './route';

// ─── Mock next-auth/jwt ───────────────────────────────────────────────────────

const mockGetToken = vi.hoisted(() => vi.fn());
vi.mock('next-auth/jwt', () => ({ getToken: mockGetToken }));

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  userLibrary: {
    findMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
  excalidrawLibrary: {
    upsert: vi.fn(),
  },
  user: {
    findUnique: vi.fn().mockResolvedValue({ localLibraryItems: [] }),
    update: vi.fn().mockResolvedValue({}),
  },
}));
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/user/libraries', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/user/libraries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    mockGetToken.mockResolvedValue(null);
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(401);
  });

  it('returns empty libraries array when user has none', async () => {
    mockGetToken.mockResolvedValue({ sub: 'user1' });
    mockPrisma.userLibrary.findMany.mockResolvedValue([]);
    mockPrisma.user.findUnique.mockResolvedValue({ localLibraryItems: [] });

    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.libraries).toEqual([]);
    expect(data.localItems).toEqual([]);
  });

  it('returns library entries with items', async () => {
    mockGetToken.mockResolvedValue({ sub: 'user1' });
    mockPrisma.userLibrary.findMany.mockResolvedValue([
      {
        addedAt: new Date('2024-01-01'),
        library: {
          id: 'lib1',
          sourceUrl: 'https://example.com/lib.excalidrawlib',
          name: 'Test Library',
          items: [{ id: 'item1' }],
        },
      },
    ]);
    mockPrisma.user.findUnique.mockResolvedValue({
      localLibraryItems: [{ id: 'local1', elements: [] }],
    });

    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.libraries).toHaveLength(1);
    expect(data.libraries[0].name).toBe('Test Library');
    expect(data.libraries[0].items).toHaveLength(1);
    expect(data.libraries[0].sourceUrl).toBe('https://example.com/lib.excalidrawlib');
    expect(data.localItems).toHaveLength(1);
    expect(data.localItems[0].id).toBe('local1');
  });
});

describe('POST /api/user/libraries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    mockGetToken.mockResolvedValue(null);
    const res = await POST(
      makeRequest('POST', { sourceUrl: 'https://example.com/a.excalidrawlib', items: [] }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when body is missing sourceUrl', async () => {
    mockGetToken.mockResolvedValue({ sub: 'user1' });
    const res = await POST(makeRequest('POST', { items: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when items is not an array', async () => {
    mockGetToken.mockResolvedValue({ sub: 'user1' });
    const res = await POST(
      makeRequest('POST', { sourceUrl: 'https://example.com/a.excalidrawlib', items: 'bad' }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when sourceUrl is empty string', async () => {
    mockGetToken.mockResolvedValue({ sub: 'user1' });
    const res = await POST(makeRequest('POST', { sourceUrl: '  ', items: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when sourceUrl is not a valid http(s) URL', async () => {
    mockGetToken.mockResolvedValue({ sub: 'user1' });
    const res = await POST(
      // eslint-disable-next-line sonarjs/no-clear-text-protocols -- intentional test input to verify javascript: URLs are rejected
      makeRequest('POST', { sourceUrl: 'javascript:alert(1)', items: [] }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/valid http/i);
  });

  it('returns 400 when sourceUrl uses a non-http protocol', async () => {
    mockGetToken.mockResolvedValue({ sub: 'user1' });
    const res = await POST(
      makeRequest('POST', { sourceUrl: 'ftp://example.com/lib.excalidrawlib', items: [] }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when items array exceeds 500 entries', async () => {
    mockGetToken.mockResolvedValue({ sub: 'user1' });
    const hugeItems = Array.from({ length: 501 }, (_, i) => ({ id: `item${i}` }));
    const res = await POST(
      makeRequest('POST', { sourceUrl: 'https://example.com/lib.excalidrawlib', items: hugeItems }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/500/);
  });

  it('creates or reuses the library and links the user (201)', async () => {
    mockGetToken.mockResolvedValue({ sub: 'user1' });
    const fakeLib = {
      id: 'lib1',
      sourceUrl: 'https://example.com/lib.excalidrawlib',
      name: 'lib',
      items: [{ id: 'item1' }],
    };
    mockPrisma.excalidrawLibrary.upsert.mockResolvedValue(fakeLib);
    mockPrisma.userLibrary.upsert.mockResolvedValue({});

    const res = await POST(
      makeRequest('POST', {
        sourceUrl: 'https://example.com/lib.excalidrawlib',
        items: [{ id: 'item1' }],
        name: 'lib',
      }),
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe('lib1');
    expect(data.sourceUrl).toBe('https://example.com/lib.excalidrawlib');

    // Prisma upsert called for library
    expect(mockPrisma.excalidrawLibrary.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sourceUrl: 'https://example.com/lib.excalidrawlib' } }),
    );
    // Prisma upsert called for user link
    expect(mockPrisma.userLibrary.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_libraryId: { userId: 'user1', libraryId: 'lib1' } },
      }),
    );
  });

  it('trims whitespace from sourceUrl', async () => {
    mockGetToken.mockResolvedValue({ sub: 'user1' });
    const fakeLib = {
      id: 'lib2',
      sourceUrl: 'https://example.com/trimmed.excalidrawlib',
      name: '',
      items: [],
    };
    mockPrisma.excalidrawLibrary.upsert.mockResolvedValue(fakeLib);
    mockPrisma.userLibrary.upsert.mockResolvedValue({});

    await POST(
      makeRequest('POST', {
        sourceUrl: '  https://example.com/trimmed.excalidrawlib  ',
        items: [],
      }),
    );

    expect(mockPrisma.excalidrawLibrary.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceUrl: 'https://example.com/trimmed.excalidrawlib' },
      }),
    );
  });
});

describe('PATCH /api/user/libraries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    mockGetToken.mockResolvedValue(null);
    const res = await PATCH(makeRequest('PATCH', { items: [] }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when items is missing', async () => {
    mockGetToken.mockResolvedValue({ sub: 'user1' });
    const res = await PATCH(makeRequest('PATCH', {}));
    expect(res.status).toBe(400);
  });

  it('returns 400 when an item is missing required fields', async () => {
    mockGetToken.mockResolvedValue({ sub: 'user1' });
    const res = await PATCH(
      makeRequest('PATCH', { items: [{ id: 'x' }] }), // missing elements array
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when items exceed 500 entries', async () => {
    mockGetToken.mockResolvedValue({ sub: 'user1' });
    const hugeItems = Array.from({ length: 501 }, (_, i) => ({ id: `i${i}`, elements: [] }));
    const res = await PATCH(makeRequest('PATCH', { items: hugeItems }));
    expect(res.status).toBe(400);
  });

  it('saves valid local items and returns 200', async () => {
    mockGetToken.mockResolvedValue({ sub: 'user1' });
    const localItems = [{ id: 'li1', elements: [{ type: 'rectangle' }], status: 'published' }];
    mockPrisma.user.update.mockResolvedValue({});

    const res = await PATCH(makeRequest('PATCH', { items: localItems }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.localItems).toEqual(localItems);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user1' } }),
    );
  });
});
