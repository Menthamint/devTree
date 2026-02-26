'use client';

/**
 * useWorkspaceData — owns the raw server-fetched data for the workspace.
 *
 * Responsibilities:
 *   - Load pages and folders from the server on mount (single `useEffect`).
 *   - Keep `treeRootRef` in sync with `treeRoot` state.
 *   - Expose the server-snapshot refs (`serverBlocksRef`, `serverPagesRef`)
 *     needed by the save logic for diffing.
 *   - Expose `dbFolderIds` ref used by drag-and-drop move operations.
 *
 * Everything returned here can be mutated by `useTreeOperations` and
 * `useSaveLogic`; Workspace.tsx wires the three hooks together.
 */

import { useState, useRef, useEffect } from 'react';

import type { Block, Page } from '@/components/MainContent';
import type { TreeRoot } from '../treeTypes';
import { buildTreeRootFromApi, emptyTreeRoot } from '../treeUtils';
import {
  fetchPages,
  fetchFolders,
  apiPageToPage,
} from '../workspaceApi';

export type WorkspaceData = {
  loading: boolean;
  pages: Page[];
  setPages: React.Dispatch<React.SetStateAction<Page[]>>;
  treeRoot: TreeRoot;
  setTreeRoot: React.Dispatch<React.SetStateAction<TreeRoot>>;
  treeRootRef: React.MutableRefObject<TreeRoot>;
  /** DB id → DB id map for every known folder. Used to detect folder vs page nodes. */
  dbFolderIds: React.MutableRefObject<Map<string, string>>;
  /** Server-side block snapshot per page (for save-diff logic). */
  serverBlocksRef: React.MutableRefObject<Map<string, Block[]>>;
  /** Server-side full-page snapshot per page (for discard / dirty-diff logic). */
  serverPagesRef: React.MutableRefObject<Map<string, Page>>;
};

export function useWorkspaceData(): WorkspaceData {
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState<Page[]>([]);
  const [treeRoot, setTreeRoot] = useState<TreeRoot>(emptyTreeRoot);

  const treeRootRef = useRef<TreeRoot>(emptyTreeRoot);
  const dbFolderIds = useRef<Map<string, string>>(new Map());
  const serverBlocksRef = useRef<Map<string, Block[]>>(new Map());
  const serverPagesRef = useRef<Map<string, Page>>(new Map());

  // Keep treeRootRef in sync so callbacks that capture the ref always see
  // the latest tree without needing to list it as a dependency.
  useEffect(() => {
    treeRootRef.current = treeRoot;
  }, [treeRoot]);

  // Load pages and folders once on mount.
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const [apiPages, apiFolders] = await Promise.all([fetchPages(), fetchFolders()]);
        if (cancelled) return;

        const uiPages = apiPages.map(apiPageToPage);
        setPages(uiPages);

        // Snapshot server state so handleSave can diff correctly later.
        for (const p of uiPages) {
          serverBlocksRef.current.set(p.id, [...p.blocks]);
          serverPagesRef.current.set(p.id, {
            ...p,
            blocks: [...p.blocks],
            tags: p.tags ? [...p.tags] : undefined,
          });
        }

        // Build folder id lookup for drag-and-drop move operations.
        dbFolderIds.current = new Map(apiFolders.map((f) => [f.id, f.id]));

        setTreeRoot(buildTreeRootFromApi(apiFolders, apiPages));
      } catch (err) {
        console.error('[Workspace] Failed to load data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    loading,
    pages,
    setPages,
    treeRoot,
    setTreeRoot,
    treeRootRef,
    dbFolderIds,
    serverBlocksRef,
    serverPagesRef,
  };
}
