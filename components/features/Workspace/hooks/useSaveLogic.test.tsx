/** @vitest-environment happy-dom */
import '@testing-library/jest-dom/vitest';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Page } from '@/components/features/MainContent';
import type { TreeRoot } from '@/components/features/Workspace/treeTypes';

import { useSaveLogic } from './useSaveLogic';
import {
  updatePage as apiUpdatePage,
  savePageContent as apiSavePageContent,
  WorkspaceApiError,
} from '../workspaceApi';

vi.mock('../workspaceApi', async () => {
  const actual = await vi.importActual<typeof import('../workspaceApi')>('../workspaceApi');
  return {
    ...actual,
    createBlock: vi.fn(),
    deleteBlock: vi.fn(),
    reorderBlocks: vi.fn(),
    savePageContent: vi.fn(),
    updateBlock: vi.fn(),
    updatePage: vi.fn(),
  };
});

const mockedUpdatePage = vi.mocked(apiUpdatePage);
const mockedSavePageContent = vi.mocked(apiSavePageContent);

function flushMicrotasks() {
  return new Promise<void>((resolve) => queueMicrotask(resolve));
}

function makePage(overrides: Partial<Page> = {}): Page {
  return {
    id: 'p1',
    title: 'Page 1',
    blocks: [],
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
    tags: ['a'],
    ...overrides,
  };
}

function createHarness(options?: { page?: Page; treeRoot?: TreeRoot }) {
  const state: { pages: Page[]; treeRoot: TreeRoot; activePageId: string | null; mobileOpen: boolean } = {
    pages: [options?.page ?? makePage()],
    treeRoot: options?.treeRoot ?? {
      id: 'root',
      name: 'Root',
      children: [{ id: 'p1', name: 'Page 1', pageId: 'p1' }],
    },
    activePageId: 'p1',
    mobileOpen: true,
  };

  const serverBlocksRef = { current: new Map() };
  const serverPagesRef = { current: new Map<string, Page>([['p1', makePage()]]) };

  const setPages = vi.fn((value: Page[] | ((prev: Page[]) => Page[])) => {
    state.pages = typeof value === 'function' ? (value as (prev: Page[]) => Page[])(state.pages) : value;
  });

  const setTreeRoot = vi.fn((value: TreeRoot | ((prev: TreeRoot) => TreeRoot)) => {
    state.treeRoot =
      typeof value === 'function' ? (value as (prev: TreeRoot) => TreeRoot)(state.treeRoot) : value;
  });

  const setActivePageId = vi.fn((value: string | null | ((prev: string | null) => string | null)) => {
    state.activePageId =
      typeof value === 'function'
        ? (value as (prev: string | null) => string | null)(state.activePageId)
        : value;
  });

  const setMobileSidebarOpen = vi.fn(
    (value: boolean | ((prev: boolean) => boolean)) => {
      state.mobileOpen =
        typeof value === 'function' ? (value as (prev: boolean) => boolean)(state.mobileOpen) : value;
    },
  );

  const showErrorToast = vi.fn();

  const hook = renderHook(() =>
    useSaveLogic({
      activePageId: state.activePageId,
      pages: state.pages,
      setPages,
      treeRoot: state.treeRoot,
      setTreeRoot,
      serverBlocksRef,
      serverPagesRef,
      showErrorToast,
      t: (key) => key,
      setActivePageId,
      setMobileSidebarOpen,
    }),
  );

  return {
    state,
    hook,
    showErrorToast,
    setActivePageId,
    setMobileSidebarOpen,
    setPages,
    setTreeRoot,
    serverPagesRef,
  };
}

describe('useSaveLogic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('saves unified content path, clears dirty flag, and exits edit mode', async () => {
    mockedSavePageContent.mockResolvedValueOnce({ id: 'p1' } as never);
    mockedUpdatePage.mockResolvedValueOnce({ id: 'p1' } as never);

    const h = createHarness();

    act(() => {
      h.hook.result.current.setIsEditMode(true);
      h.hook.result.current.handleContentChange({ type: 'doc', content: [{ type: 'paragraph' }] });
    });
    expect(h.hook.result.current.isDirty).toBe(true);

    await act(async () => {
      await h.hook.result.current.handleSave();
    });

    expect(mockedSavePageContent).toHaveBeenCalledWith('p1', expect.any(Object));
    expect(mockedUpdatePage).toHaveBeenCalledWith('p1', { title: 'Page 1', tags: ['a'] });
    expect(h.hook.result.current.isDirty).toBe(false);
    expect(h.hook.result.current.isEditMode).toBe(false);
  });

  it('handles save-and-leave to pending page and closes mobile sidebar', async () => {
    mockedSavePageContent.mockResolvedValueOnce({ id: 'p1' } as never);
    mockedUpdatePage.mockResolvedValueOnce({ id: 'p1' } as never);

    const h = createHarness();

    act(() => {
      h.hook.result.current.setPendingNavId('p2');
    });

    await act(async () => {
      await h.hook.result.current.handleSaveAndLeave();
    });

    expect(h.state.activePageId).toBe('p2');
    expect(h.state.mobileOpen).toBe(false);
    expect(h.hook.result.current.pendingNavId).toBeNull();
  });

  it('leave-without in cancel-edit mode restores server snapshot and exits edit mode', () => {
    const h = createHarness({ page: makePage({ title: 'Draft' }) });
    h.serverPagesRef.current.set('p1', makePage({ title: 'Server Title' }));

    act(() => {
      h.hook.result.current.setIsEditMode(true);
      h.hook.result.current.setIsDirty(true);
    });
    act(() => {
      h.hook.result.current.setPendingNavId('__cancel_edit__');
    });
    act(() => {
      h.hook.result.current.handleLeaveWithout();
    });

    expect(h.hook.result.current.isEditMode).toBe(false);
    expect(h.hook.result.current.isDirty).toBe(false);
    expect(h.hook.result.current.pendingNavId).toBeNull();
    expect(h.setPages).toHaveBeenCalled();
    expect(h.setTreeRoot).toHaveBeenCalled();
  });

  it('blocks exiting edit mode when dirty by opening cancel pending id', () => {
    const h = createHarness();

    act(() => {
      h.hook.result.current.setIsEditMode(true);
    });
    act(() => {
      h.hook.result.current.setIsDirty(true);
    });
    act(() => {
      h.hook.result.current.handleEditModeChange(false);
    });

    expect(h.hook.result.current.pendingNavId).toBe('__cancel_edit__');
    expect(h.hook.result.current.isEditMode).toBe(true);
  });

  it('title blur rejects duplicate name and raises toast', () => {
    const h = createHarness({
      treeRoot: {
        id: 'root',
        name: 'Root',
        children: [
          { id: 'p1', name: 'Page 1', pageId: 'p1' },
          { id: 'p2', name: 'Page 1', pageId: 'p2' },
        ],
      },
    });

    act(() => {
      h.hook.result.current.handleTitleBlur();
    });

    expect(h.hook.result.current.titleHasError).toBe(true);
    expect(h.showErrorToast).toHaveBeenCalledWith('tree.duplicateNameError');
  });

  it('tags change debounces API sync and updates server snapshot', async () => {
    vi.useFakeTimers();
    mockedUpdatePage.mockResolvedValueOnce({ id: 'p1' } as never);
    const h = createHarness();

    act(() => {
      h.hook.result.current.handleTagsChange(['x', 'y']);
    });

    expect(mockedUpdatePage).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(800);
      await flushMicrotasks();
    });

    expect(mockedUpdatePage).toHaveBeenCalledWith('p1', { tags: ['x', 'y'] });
    expect(h.serverPagesRef.current.get('p1')?.tags).toEqual(['x', 'y']);
    vi.useRealTimers();
  });

  it('title blur API conflict sets error and toast after debounce', async () => {
    vi.useFakeTimers();
    mockedUpdatePage.mockRejectedValueOnce(new WorkspaceApiError('dup', 409, 'DUPLICATE_NAME'));
    const h = createHarness({ treeRoot: { id: 'root', name: 'Root', children: [{ id: 'p1', name: 'Page 1', pageId: 'p1' }] } });

    act(() => {
      h.hook.result.current.setIsDirty(false);
      h.hook.result.current.handleTitleBlur();
    });

    await act(async () => {
      vi.advanceTimersByTime(100);
      await flushMicrotasks();
      await flushMicrotasks();
    });

    expect(h.hook.result.current.titleHasError).toBe(true);
    expect(h.showErrorToast).toHaveBeenCalledWith('tree.duplicateNameError');
    vi.useRealTimers();
  });
});
