/** @vitest-environment happy-dom */
import '@testing-library/jest-dom/vitest';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Block, Page } from '@/components/features/MainContent';
import type { TreeRoot } from '@/components/features/Workspace/treeTypes';

import { useTreeOperations } from './useTreeOperations';
import {
  createFolder as apiCreateFolder,
  createPage as apiCreatePage,
  updateFolder as apiUpdateFolder,
  WorkspaceApiError,
} from '../workspaceApi';

vi.mock('../workspaceApi', async () => {
  const actual = await vi.importActual<typeof import('../workspaceApi')>('../workspaceApi');
  return {
    ...actual,
    createFolder: vi.fn(),
    createPage: vi.fn(),
    deleteFolder: vi.fn(() => Promise.resolve()),
    deletePage: vi.fn(() => Promise.resolve()),
    moveFolder: vi.fn(),
    movePage: vi.fn(),
    updateFolder: vi.fn(),
  };
});

const mockedCreateFolder = vi.mocked(apiCreateFolder);
const mockedCreatePage = vi.mocked(apiCreatePage);
const mockedUpdateFolder = vi.mocked(apiUpdateFolder);

function flushMicrotasks() {
  return new Promise<void>((resolve) => queueMicrotask(resolve));
}

function createHarness(initialRoot: TreeRoot, initialPages: Page[] = []) {
  const state: { root: TreeRoot; pages: Page[]; activePageId: string | null } = {
    root: initialRoot,
    pages: initialPages,
    activePageId: null,
  };

  const treeRootRef = { current: state.root };
  const dbFolderIds = { current: new Map<string, string>() };
  const serverBlocksRef = { current: new Map<string, Block[]>() };
  const serverPagesRef = { current: new Map<string, Page>() };

  const showErrorToast = vi.fn();
  const onFileCreated = vi.fn();
  const onPageIdReplaced = vi.fn();

  const setTreeRoot = vi.fn(
    (value: TreeRoot | ((prev: TreeRoot) => TreeRoot)) => {
      state.root = typeof value === 'function' ? (value as (prev: TreeRoot) => TreeRoot)(state.root) : value;
      treeRootRef.current = state.root;
    },
  );

  const setPages = vi.fn((value: Page[] | ((prev: Page[]) => Page[])) => {
    state.pages = typeof value === 'function' ? (value as (prev: Page[]) => Page[])(state.pages) : value;
  });

  const setActivePageId = vi.fn(
    (value: string | null | ((prev: string | null) => string | null)) => {
      state.activePageId =
        typeof value === 'function'
          ? (value as (prev: string | null) => string | null)(state.activePageId)
          : value;
    },
  );

  const hook = renderHook(() =>
    useTreeOperations({
      treeRoot: state.root,
      treeRootRef,
      setTreeRoot,
      pages: state.pages,
      setPages,
      dbFolderIds,
      serverBlocksRef,
      serverPagesRef,
      showErrorToast,
      t: (key) => key,
      onFileCreated,
      onPageIdReplaced,
      setActivePageId,
    }),
  );

  return {
    state,
    hook,
    dbFolderIds,
    serverBlocksRef,
    serverPagesRef,
    showErrorToast,
    onFileCreated,
    onPageIdReplaced,
    setActivePageId,
  };
}

describe('useTreeOperations', () => {
  it('creates file optimistically and reconciles local id with API id', async () => {
    mockedCreatePage.mockResolvedValueOnce({
      id: 'page-db-1',
      title: 'Untitled',
      order: 0,
      tags: [],
      folderId: null,
      ownerId: 'u1',
      blocks: [],
      content: null,
      createdAt: '',
      updatedAt: '',
    });

    const h = createHarness({ id: 'root', name: 'Root', children: [] });

    act(() => {
      h.hook.result.current.createFile('root');
    });

    expect(h.onFileCreated).toHaveBeenCalledTimes(1);
    expect(h.state.pages.length).toBe(1);
    const localId = h.state.pages[0].id;
    expect(localId).toMatch(/^page[-_]/);
    expect(h.serverPagesRef.current.has(localId)).toBe(true);

    await flushMicrotasks();

    expect(h.state.pages[0].id).toBe('page-db-1');
    expect(h.serverPagesRef.current.has('page-db-1')).toBe(true);
    expect(h.serverPagesRef.current.has(localId)).toBe(false);
    expect(h.onPageIdReplaced).toHaveBeenCalledWith(localId, 'page-db-1');
  });

  it('reverts optimistic folder create and shows duplicate toast on conflict', async () => {
    mockedCreateFolder.mockRejectedValueOnce(new WorkspaceApiError('dup', 409, 'DUPLICATE_NAME'));

    const h = createHarness({ id: 'root', name: 'Root', children: [] });

    act(() => {
      h.hook.result.current.createFolder('root');
    });

    expect(h.state.root.children.length).toBe(1);

    await flushMicrotasks();

    expect(h.state.root.children.length).toBe(0);
    expect(h.showErrorToast).toHaveBeenCalledWith('tree.duplicateNameError');
  });

  it('opens delete dialog and confirms page deletion with active page reset', () => {
    const h = createHarness(
      {
        id: 'root',
        name: 'Root',
        children: [{ id: 'n1', name: 'Doc', pageId: 'p1' }],
      },
      [{ id: 'p1', title: 'Doc', blocks: [] }],
    );
    h.state.activePageId = 'p1';

    act(() => {
      h.hook.result.current.handleDeleteNode('n1');
    });

    expect(h.hook.result.current.deleteDialog).not.toBeNull();

    act(() => {
      h.hook.result.current.handleConfirmDelete();
    });

    expect(h.state.root.children).toHaveLength(0);
    expect(h.state.pages).toHaveLength(0);
    expect(h.state.activePageId).toBeNull();
  });

  it('guards against duplicate folder rename and syncs valid db-backed rename', async () => {
    mockedUpdateFolder.mockResolvedValueOnce({
      id: 'f1',
      name: 'Renamed',
      order: 0,
      parentId: null,
      ownerId: 'u1',
      pages: [],
      createdAt: '',
      updatedAt: '',
    });

    const h = createHarness({
      id: 'root',
      name: 'Root',
      children: [
        { id: 'f1', name: 'Folder A', children: [] },
        { id: 'f2', name: 'Folder B', children: [] },
      ],
    });
    h.dbFolderIds.current.set('f1', 'f1');

    const duplicate = h.hook.result.current.handleRenameFolder('f1', 'Folder B');
    expect(duplicate).toBe(false);
    expect(h.showErrorToast).toHaveBeenCalledWith('tree.duplicateNameError');

    const renamed = h.hook.result.current.handleRenameFolder('f1', 'Renamed');
    expect(renamed).toBe(true);
    expect(h.state.root.children.find((x) => x.id === 'f1')?.name).toBe('Renamed');

    await flushMicrotasks();
    expect(mockedUpdateFolder).toHaveBeenCalledWith('f1', { name: 'Renamed' });
  });
});
