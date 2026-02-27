/**
 * workspaceApi.ts — API client helpers for the workspace data layer.
 *
 * All functions return typed results or throw on network/server errors.
 * Call sites do optimistic state updates and revert on error.
 */
import type { JSONContent } from '@tiptap/react';

import type { Block, Page } from '@/components/features/MainContent';

export class WorkspaceApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'WorkspaceApiError';
    this.status = status;
    this.code = code;
  }
}

async function assertOk(res: Response, fallbackMessage: string): Promise<void> {
  if (res.ok) return;
  let message = fallbackMessage;
  let code: string | undefined;
  try {
    const payload = (await res.json()) as { error?: unknown; code?: unknown };
    if (typeof payload.error === 'string' && payload.error.trim()) {
      message = payload.error;
    }
    if (typeof payload.code === 'string' && payload.code.trim()) {
      code = payload.code;
    }
  } catch {
    // ignore non-JSON errors
  }
  throw new WorkspaceApiError(message, res.status, code);
}

// ─── Shape of data returned from the server ───────────────────────────────────

export type ApiBlock = {
  id: string;
  type: string;
  order: number;
  colSpan: number;
  tags: string[];
  content: unknown;
  pageId: string;
  createdAt: string;
  updatedAt: string;
};

export type ApiPage = {
  id: string;
  title: string;
  order: number;
  tags: string[];
  folderId: string | null;
  ownerId: string;
  blocks: ApiBlock[];
  /** Unified Tiptap JSON document. Null for pages still using the legacy block format. */
  content: JSONContent | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiFolder = {
  id: string;
  name: string;
  order: number;
  parentId: string | null;
  ownerId: string;
  pages: Pick<ApiPage, 'id' | 'title' | 'order' | 'tags' | 'folderId'>[];
  createdAt: string;
  updatedAt: string;
};

// ─── Converters ───────────────────────────────────────────────────────────────

export function apiBlockToBlock(b: ApiBlock): Block {
  return {
    id: b.id,
    type: b.type as Block['type'],
    content: b.content as Block['content'],
    colSpan: b.colSpan === 1 ? 1 : 2,
    tags: b.tags ?? [],
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

export function apiPageToPage(p: ApiPage): Page {
  return {
    id: p.id,
    title: p.title,
    blocks: (p.blocks ?? []).map(apiBlockToBlock),
    tags: p.tags ?? [],
    content: p.content ?? null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

// ─── Pages ────────────────────────────────────────────────────────────────────

export async function fetchPages(): Promise<ApiPage[]> {
  const res = await fetch('/api/pages');
  await assertOk(res, `GET /api/pages → ${res.status}`);
  return res.json() as Promise<ApiPage[]>;
}

export async function createPage(title: string, folderId: string | null): Promise<ApiPage> {
  const res = await fetch('/api/pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, folderId }),
  });
  await assertOk(res, `POST /api/pages → ${res.status}`);
  return res.json() as Promise<ApiPage>;
}

export async function updatePage(
  pageId: string,
  data: { title?: string; order?: number; tags?: string[]; content?: JSONContent | null },
): Promise<ApiPage> {
  const res = await fetch(`/api/pages/${pageId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  await assertOk(res, `PUT /api/pages/${pageId} → ${res.status}`);
  return res.json() as Promise<ApiPage>;
}

export async function deletePage(pageId: string): Promise<void> {
  const res = await fetch(`/api/pages/${pageId}`, { method: 'DELETE' });
  await assertOk(res, `DELETE /api/pages/${pageId} → ${res.status}`);
}

/** Save just the unified Tiptap JSON content for a page (convenience wrapper). */
export async function savePageContent(pageId: string, content: JSONContent): Promise<ApiPage> {
  return updatePage(pageId, { content });
}

export async function movePage(
  pageId: string,
  data: { folderId?: string | null; order?: number },
): Promise<ApiPage> {
  const res = await fetch(`/api/pages/${pageId}/move`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  await assertOk(res, `PUT /api/pages/${pageId}/move → ${res.status}`);
  return res.json() as Promise<ApiPage>;
}

// ─── Blocks ───────────────────────────────────────────────────────────────────

export async function createBlock(
  pageId: string,
  block: Omit<Block, 'id'> & { id?: string },
  order: number,
): Promise<ApiBlock> {
  const res = await fetch(`/api/pages/${pageId}/blocks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: block.type,
      content: block.content,
      colSpan: block.colSpan ?? 2,
      order,
      tags: block.tags ?? [],
    }),
  });
  await assertOk(res, `POST /api/pages/${pageId}/blocks → ${res.status}`);
  return res.json() as Promise<ApiBlock>;
}

export async function updateBlock(
  pageId: string,
  blockId: string,
  data: { content?: unknown; colSpan?: 1 | 2; tags?: string[] },
): Promise<ApiBlock> {
  const res = await fetch(`/api/pages/${pageId}/blocks/${blockId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  await assertOk(res, `PUT /api/pages/${pageId}/blocks/${blockId} → ${res.status}`);
  return res.json() as Promise<ApiBlock>;
}

export async function deleteBlock(pageId: string, blockId: string): Promise<void> {
  const res = await fetch(`/api/pages/${pageId}/blocks/${blockId}`, { method: 'DELETE' });
  await assertOk(res, `DELETE /api/pages/${pageId}/blocks/${blockId} → ${res.status}`);
}

export async function reorderBlocks(
  pageId: string,
  entries: Array<{ id: string; order: number }>,
): Promise<void> {
  const res = await fetch(`/api/pages/${pageId}/blocks`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entries),
  });
  await assertOk(res, `PUT /api/pages/${pageId}/blocks (reorder) → ${res.status}`);
}

// ─── Folders ──────────────────────────────────────────────────────────────────

export async function fetchFolders(): Promise<ApiFolder[]> {
  const res = await fetch('/api/folders');
  await assertOk(res, `GET /api/folders → ${res.status}`);
  return res.json() as Promise<ApiFolder[]>;
}

export async function createFolder(name: string, parentId: string | null): Promise<ApiFolder> {
  const res = await fetch('/api/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parentId }),
  });
  await assertOk(res, `POST /api/folders → ${res.status}`);
  return res.json() as Promise<ApiFolder>;
}

export async function updateFolder(
  folderId: string,
  data: { name?: string; order?: number },
): Promise<ApiFolder> {
  const res = await fetch(`/api/folders/${folderId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  await assertOk(res, `PUT /api/folders/${folderId} → ${res.status}`);
  return res.json() as Promise<ApiFolder>;
}

export async function deleteFolder(folderId: string): Promise<void> {
  const res = await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
  await assertOk(res, `DELETE /api/folders/${folderId} → ${res.status}`);
}

export async function moveFolder(
  folderId: string,
  data: { parentId?: string | null; order?: number },
): Promise<ApiFolder> {
  const res = await fetch(`/api/folders/${folderId}/move`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  await assertOk(res, `PUT /api/folders/${folderId}/move → ${res.status}`);
  return res.json() as Promise<ApiFolder>;
}
