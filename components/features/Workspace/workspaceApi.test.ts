import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  WorkspaceApiError,
  apiBlockToBlock,
  apiPageToPage,
  createBlock,
  createFolder,
  createPage,
  deleteBlock,
  deleteFolder,
  deletePage,
  fetchFolders,
  fetchPages,
  moveFolder,
  movePage,
  reorderBlocks,
  savePageContent,
  updateBlock,
  updateFolder,
  updatePage,
} from './workspaceApi';

const mockFetch = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('workspaceApi', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('converts API block/page shapes to app models', () => {
    const apiBlock = {
      id: 'b1',
      type: 'text',
      order: 1,
      colSpan: 3,
      tags: undefined,
      content: { text: 'hello' },
      pageId: 'p1',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-02',
    } as const;

    const mappedBlock = apiBlockToBlock(apiBlock);
    expect(mappedBlock.colSpan).toBe(2);
    expect(mappedBlock.tags).toEqual([]);

    const mappedPage = apiPageToPage({
      id: 'p1',
      title: 'Page',
      order: 1,
      tags: undefined,
      folderId: null,
      ownerId: 'u1',
      blocks: [apiBlock],
      content: null,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-02',
    });

    expect(mappedPage.id).toBe('p1');
    expect(mappedPage.tags).toEqual([]);
    expect(mappedPage.blocks).toHaveLength(1);
  });

  it('handles page endpoints success paths', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse([{ id: 'p1' }]))
      .mockResolvedValueOnce(jsonResponse({ id: 'p2' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'p3' }))
      .mockResolvedValueOnce(jsonResponse({}, 204))
      .mockResolvedValueOnce(jsonResponse({ id: 'p4' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'p5' }));

    await expect(fetchPages()).resolves.toEqual([{ id: 'p1' }]);
    await expect(createPage('New', null)).resolves.toEqual({ id: 'p2' });
    await expect(updatePage('p1', { title: 'T' })).resolves.toEqual({ id: 'p3' });
    await expect(deletePage('p1')).resolves.toBeUndefined();
    await expect(savePageContent('p1', { type: 'doc', content: [] })).resolves.toEqual({ id: 'p4' });
    await expect(movePage('p1', { folderId: 'f1', order: 1 })).resolves.toEqual({ id: 'p5' });

    expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/pages');
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      '/api/pages',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      '/api/pages/p1',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      4,
      '/api/pages/p1',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      5,
      '/api/pages/p1',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      6,
      '/api/pages/p1/move',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('handles block endpoints success paths', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ id: 'b1' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'b2' }))
      .mockResolvedValueOnce(jsonResponse({}, 204))
      .mockResolvedValueOnce(jsonResponse({}, 204));

    await expect(
      createBlock(
        'p1',
        {
          type: 'text',
          content: { type: 'doc', content: [] },
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
          colSpan: 1,
          tags: ['x'],
        },
        2,
      ),
    ).resolves.toEqual({ id: 'b1' });
    await expect(updateBlock('p1', 'b1', { colSpan: 2 })).resolves.toEqual({ id: 'b2' });
    await expect(deleteBlock('p1', 'b1')).resolves.toBeUndefined();
    await expect(reorderBlocks('p1', [{ id: 'b1', order: 1 }])).resolves.toBeUndefined();

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      '/api/pages/p1/blocks',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      '/api/pages/p1/blocks/b1',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      '/api/pages/p1/blocks/b1',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      4,
      '/api/pages/p1/blocks',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('handles folder endpoints success paths', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse([{ id: 'f1' }]))
      .mockResolvedValueOnce(jsonResponse({ id: 'f2' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'f3' }))
      .mockResolvedValueOnce(jsonResponse({}, 204))
      .mockResolvedValueOnce(jsonResponse({ id: 'f4' }));

    await expect(fetchFolders()).resolves.toEqual([{ id: 'f1' }]);
    await expect(createFolder('Folder', null)).resolves.toEqual({ id: 'f2' });
    await expect(updateFolder('f2', { name: 'Renamed' })).resolves.toEqual({ id: 'f3' });
    await expect(deleteFolder('f2')).resolves.toBeUndefined();
    await expect(moveFolder('f2', { parentId: 'root' })).resolves.toEqual({ id: 'f4' });

    expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/folders');
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      '/api/folders',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      '/api/folders/f2',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      4,
      '/api/folders/f2',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      5,
      '/api/folders/f2/move',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('throws WorkspaceApiError with API payload details', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: 'No access', code: 'FORBIDDEN' }, 403),
    );

    await expect(fetchPages()).rejects.toMatchObject<Partial<WorkspaceApiError>>({
      name: 'WorkspaceApiError',
      message: 'No access',
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('falls back to default message for non-json server errors', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('upstream unavailable', {
        status: 502,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    await expect(fetchFolders()).rejects.toMatchObject<Partial<WorkspaceApiError>>({
      name: 'WorkspaceApiError',
      message: 'GET /api/folders → 502',
      status: 502,
      code: undefined,
    });
  });
});
