'use client';

/**
 * useSaveLogic — all edit-mode, dirty-state, and save callbacks.
 *
 * Extracted from `Workspace.tsx` to isolate the save/discard/dirty concerns.
 *
 * Responsibilities:
 *   - Track `isDirty` and `isEditMode` state.
 *   - Implement `handleSave` (unified Tiptap path + legacy block-diff path).
 *   - Guard navigation away from dirty pages via `pendingNavId`.
 *   - Handle title, tags, blocks, and content (Tiptap JSON) local-state updates.
 *   - Reset `isEditMode` when `activePageId` changes (with `justCreatedPageRef`
 *     guard to skip the reset on new-page creation).
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Block, Page } from '@/components/MainContent';
import type { TreeRoot } from '../treeTypes';
import { getParentId, isNameTakenInScope, renameNode } from '../treeUtils';
import {
  updatePage as apiUpdatePage,
  savePageContent as apiSavePageContent,
  createBlock as apiCreateBlock,
  updateBlock as apiUpdateBlock,
  deleteBlock as apiDeleteBlock,
  reorderBlocks as apiReorderBlocks,
  WorkspaceApiError,
} from '../workspaceApi';
import type { JSONContent } from '@tiptap/react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SaveLogicParams = {
  activePageId: string | null;
  pages: Page[];
  setPages: React.Dispatch<React.SetStateAction<Page[]>>;
  treeRoot: TreeRoot;
  setTreeRoot: React.Dispatch<React.SetStateAction<TreeRoot>>;
  serverBlocksRef: React.MutableRefObject<Map<string, Block[]>>;
  serverPagesRef: React.MutableRefObject<Map<string, Page>>;
  showErrorToast: (message: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Called when save-and-leave / leave-without needs to switch to a new page. */
  setActivePageId: React.Dispatch<React.SetStateAction<string | null>>;
  /** Called after a dirty-save navigation to close the mobile sidebar. */
  setMobileSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export type SaveLogicResult = {
  isDirty: boolean;
  setIsDirty: React.Dispatch<React.SetStateAction<boolean>>;
  isEditMode: boolean;
  setIsEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  /** `null` = no pending nav; `'__cancel_edit__'` = user clicked Cancel. */
  pendingNavId: string | null;
  saveFeedback: boolean;
  /** Pending Tiptap JSON to be persisted on save. */
  pendingContentRef: React.MutableRefObject<JSONContent | null>;
  /**
   * Set to `true` just before creating a new page so the activePageId
   * change effect does not immediately reset `isEditMode` back to false.
   */
  justCreatedPageRef: React.MutableRefObject<boolean>;
  handleSave: () => Promise<void>;
  handleSaveAndLeave: () => Promise<void>;
  handleLeaveWithout: () => void;
  handleCancelPendingNav: () => void;
  handleEditModeChange: (next: boolean) => void;
  handleTitleChange: (title: string) => void;
  handleTitleBlur: () => void;
  /** Cancel a pending debounced title-blur save (called by onFileCreated). */
  cancelTitleBlurSave: () => void;
  handleTagsChange: (tags: string[]) => void;
  handleBlocksChange: (blocks: Block[]) => void;
  handleContentChange: (json: JSONContent) => void;
  titleHasError: boolean;
  setTitleHasError: React.Dispatch<React.SetStateAction<boolean>>;
  /** Expose so Workspace.tsx can build `handleSelect` (dirty-nav guard). */
  setPendingNavId: React.Dispatch<React.SetStateAction<string | null>>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSaveLogic({
  activePageId,
  pages,
  setPages,
  treeRoot,
  setTreeRoot,
  serverBlocksRef,
  serverPagesRef,
  showErrorToast,
  t,
  setActivePageId,
  setMobileSidebarOpen,
}: SaveLogicParams): SaveLogicResult {
  const [isDirty, setIsDirty] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [pendingNavId, setPendingNavId] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState(false);
  const [titleHasError, setTitleHasError] = useState(false);

  const pendingContentRef = useRef<JSONContent | null>(null);
  const justCreatedPageRef = useRef(false);
  const tagsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset edit mode whenever the active page changes — unless we just created
  // a new page (justCreatedPageRef prevents the reset for that case).
  // Also cancel any pending title-blur save for the page we are leaving so
  // that navigating away (via unsaved-changes dialog, new-page creation, etc.)
  // never persists a draft title to the wrong page.
  useEffect(() => {
    if (titleBlurTimerRef.current) {
      clearTimeout(titleBlurTimerRef.current);
      titleBlurTimerRef.current = null;
    }
    if (justCreatedPageRef.current) {
      justCreatedPageRef.current = false;
      return;
    }
    setIsEditMode(false);
    setIsDirty(false);
    pendingContentRef.current = null;
  }, [activePageId]);

  // ── Save feedback timer ────────────────────────────────────────────────────

  useEffect(() => {
    if (!saveFeedback) return;
    const timer = setTimeout(() => setSaveFeedback(false), 2000);
    return () => clearTimeout(timer);
  }, [saveFeedback]);

  // ── handleSave ─────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!activePageId) return;
    const page = pages.find((p) => p.id === activePageId);
    if (!page) return;

    // ── Unified Tiptap path ────────────────────────────────────────────────
    if (page.content !== null || pendingContentRef.current !== null) {
      const contentToSave = pendingContentRef.current ?? page.content ?? { type: 'doc', content: [] };
      await apiSavePageContent(activePageId, contentToSave as JSONContent).catch((err) =>
        console.error('[save:content]', err),
      );
      await apiUpdatePage(activePageId, { title: page.title, tags: page.tags }).catch((err) =>
        console.error('[save:meta]', err),
      );
      serverPagesRef.current.set(activePageId, { ...page, content: contentToSave as JSONContent });
      setIsDirty(false);
      setSaveFeedback(true);
      setIsEditMode(false);
      return;
    }

    // ── Legacy block-diff path ─────────────────────────────────────────────
    const serverBlocks = serverBlocksRef.current.get(activePageId) ?? [];
    const localBlocks = page.blocks;
    const serverIdSet = new Set(serverBlocks.map((b) => b.id));
    const localIdSet = new Set(localBlocks.map((b) => b.id));

    // 1. Delete removed blocks
    const toDelete = serverBlocks.filter((b) => !localIdSet.has(b.id));
    await Promise.all(
      toDelete.map((b) =>
        apiDeleteBlock(activePageId, b.id).catch((err) =>
          console.error('[save:delete]', b.id, err),
        ),
      ),
    );

    // 2. Create new blocks sequentially so order is preserved
    const idMap = new Map<string, string>();
    for (const b of localBlocks) {
      if (!serverIdSet.has(b.id)) {
        const order = localBlocks.indexOf(b);
        try {
          const created = await apiCreateBlock(activePageId, b, order);
          idMap.set(b.id, created.id);
        } catch (err) {
          console.error('[save:create]', b.id, err);
        }
      }
    }

    // 3. Update changed existing blocks
    await Promise.all(
      localBlocks
        .filter((b) => serverIdSet.has(b.id))
        .map((b) => {
          const old = serverBlocks.find((s) => s.id === b.id);
          const changed =
            JSON.stringify(b.content) !== JSON.stringify(old?.content) ||
            b.colSpan !== old?.colSpan ||
            JSON.stringify(b.tags) !== JSON.stringify(old?.tags);
          if (!changed) return Promise.resolve();
          return apiUpdateBlock(activePageId, b.id, {
            content: b.content,
            colSpan: b.colSpan,
            tags: b.tags,
          }).catch((err) => console.error('[save:update]', b.id, err));
        }),
    );

    // 4. Reconcile local ids with server-assigned ids
    const reconciledBlocks = localBlocks.map((b) =>
      idMap.has(b.id) ? { ...b, id: idMap.get(b.id)! } : b,
    );
    if (idMap.size > 0) {
      setPages((prev) =>
        prev.map((p) =>
          p.id === activePageId ? { ...p, blocks: reconciledBlocks } : p,
        ),
      );
    }

    // 5. Bulk reorder
    if (reconciledBlocks.length > 0) {
      await apiReorderBlocks(
        activePageId,
        reconciledBlocks.map((b, i) => ({ id: b.id, order: i })),
      ).catch((err) => console.error('[save:reorder]', err));
    }

    // 6. Update server snapshot
    serverBlocksRef.current.set(activePageId, reconciledBlocks);
    serverPagesRef.current.set(activePageId, {
      ...page,
      blocks: reconciledBlocks,
      tags: page.tags ? [...page.tags] : undefined,
    });

    setIsDirty(false);
    setSaveFeedback(true);
    setIsEditMode(false);
  }, [activePageId, pages, setPages, serverBlocksRef, serverPagesRef]);

  // ── handleSaveAndLeave ─────────────────────────────────────────────────────

  const handleSaveAndLeave = useCallback(async () => {
    await handleSave();
    if (pendingNavId === '__cancel_edit__') {
      setIsEditMode(false);
      setIsDirty(false);
      setPendingNavId(null);
      return;
    }
    if (pendingNavId) {
      setActivePageId(pendingNavId);
      setMobileSidebarOpen(false);
      setPendingNavId(null);
    }
  }, [handleSave, pendingNavId, setActivePageId, setMobileSidebarOpen]);

  // ── handleLeaveWithout ─────────────────────────────────────────────────────

  const handleLeaveWithout = useCallback(() => {
    if (pendingNavId === '__cancel_edit__') {
      const pageSnap = serverPagesRef.current.get(activePageId ?? '');
      if (pageSnap && activePageId) {
        setPages((prev) => prev.map((p) => (p.id === activePageId ? { ...pageSnap } : p)));
        setTreeRoot((root) => renameNode(root, activePageId, pageSnap.title));
      }
      pendingContentRef.current = null;
      setIsEditMode(false);
      setIsDirty(false);
      setPendingNavId(null);
      return;
    }
    if (pendingNavId) {
      const pageSnap = serverPagesRef.current.get(activePageId ?? '');
      if (pageSnap && activePageId) {
        const restored: Page = {
          ...pageSnap,
          blocks: [...pageSnap.blocks],
          tags: pageSnap.tags ? [...pageSnap.tags] : undefined,
        };
        setPages((prev) => prev.map((p) => (p.id === activePageId ? restored : p)));
        setTreeRoot((root) => renameNode(root, activePageId, restored.title));
      } else {
        const snap = serverBlocksRef.current.get(activePageId ?? '') ?? [];
        setPages((prev) =>
          prev.map((p) => (p.id === activePageId ? { ...p, blocks: snap } : p)),
        );
      }
      setIsDirty(false);
      setActivePageId(pendingNavId);
      setMobileSidebarOpen(false);
      setPendingNavId(null);
    }
  }, [
    pendingNavId,
    activePageId,
    setPages,
    setTreeRoot,
    serverPagesRef,
    serverBlocksRef,
    setActivePageId,
    setMobileSidebarOpen,
  ]);

  // ── handleCancelPendingNav ─────────────────────────────────────────────────

  const handleCancelPendingNav = useCallback(() => {
    setPendingNavId(null);
  }, []);

  // ── handleEditModeChange ───────────────────────────────────────────────────

  const handleEditModeChange = useCallback(
    (next: boolean) => {
      if (!next && isDirty && activePageId) {
        setPendingNavId('__cancel_edit__');
      } else {
        setIsEditMode(next);
        if (!next) setIsDirty(false);
      }
    },
    [isDirty, activePageId],
  );

  // ── handleTitleChange ──────────────────────────────────────────────────────

  const handleTitleChange = useCallback(
    (title: string) => {
      if (!activePageId) return;
      setTitleHasError(false);
      setPages((prev) =>
        prev.map((p) => (p.id === activePageId ? { ...p, title } : p)),
      );
      setTreeRoot((root) => renameNode(root, activePageId, title));
      setIsDirty(true);
    },
    [activePageId, setPages, setTreeRoot],
  );

  // ── handleTitleBlur ────────────────────────────────────────────────────────

  const handleTitleBlur = useCallback(() => {
    if (!activePageId) return;
    const page = pages.find((p) => p.id === activePageId);
    if (!page) return;

    const parentId = getParentId(treeRoot, activePageId);
    if (isNameTakenInScope(treeRoot, parentId, page.title, activePageId)) {
      setTitleHasError(true);
      showErrorToast(t('tree.duplicateNameError'));
      return;
    }

    setTitleHasError(false);

    // When content is dirty the unsaved-changes dialog will handle the full
    // save (title + content) or discard.  Starting a standalone title save
    // here would race the "Leave without saving" path and corrupt the DB.
    if (isDirty) return;

    // Debounce the actual API call so that onFileCreated (triggered by a
    // simultaneous "New page" click) can cancel it before it fires.  The blur
    // event always precedes the click event in the same interaction, so a
    // timer of even 0 ms would be enough — 100 ms gives comfortable headroom.
    if (titleBlurTimerRef.current) clearTimeout(titleBlurTimerRef.current);
    const capturedPageId = activePageId;
    const capturedTitle = page.title;
    titleBlurTimerRef.current = setTimeout(() => {
      titleBlurTimerRef.current = null;
      void apiUpdatePage(capturedPageId, { title: capturedTitle })
        .then(() => {
          const oldSnap = serverPagesRef.current.get(capturedPageId);
          serverPagesRef.current.set(
            capturedPageId,
            oldSnap ? { ...oldSnap, title: capturedTitle } : { ...page, blocks: [...page.blocks] },
          );
        })
        .catch((err) => {
          console.error('[titleBlur]', err);
          if (err instanceof WorkspaceApiError && (err.status === 409 || err.code === 'DUPLICATE_NAME')) {
            setTitleHasError(true);
            showErrorToast(t('tree.duplicateNameError'));
          }
        });
    }, 100);
  }, [activePageId, isDirty, pages, showErrorToast, t, treeRoot, serverPagesRef, titleBlurTimerRef]);

  const cancelTitleBlurSave = useCallback(() => {
    if (titleBlurTimerRef.current) {
      clearTimeout(titleBlurTimerRef.current);
      titleBlurTimerRef.current = null;
    }
  }, []);

  // ── handleTagsChange ───────────────────────────────────────────────────────

  const handleTagsChange = useCallback(
    (tags: string[]) => {
      if (!activePageId) return;
      setPages((prev) =>
        prev.map((p) => (p.id === activePageId ? { ...p, tags } : p)),
      );
      if (tagsDebounceRef.current) clearTimeout(tagsDebounceRef.current);
      tagsDebounceRef.current = setTimeout(() => {
        void apiUpdatePage(activePageId, { tags })
          .then(() => {
            const oldSnap = serverPagesRef.current.get(activePageId);
            if (!oldSnap) return;
            serverPagesRef.current.set(activePageId, { ...oldSnap, tags: [...tags] });
          })
          .catch((err) => console.error('[tagsChange]', err));
      }, 800);
    },
    [activePageId, setPages, serverPagesRef],
  );

  // ── handleBlocksChange ─────────────────────────────────────────────────────

  const handleBlocksChange = useCallback(
    (blocks: Block[]) => {
      if (!activePageId) return;
      setPages((pages) =>
        pages.map((p) => (p.id === activePageId ? { ...p, blocks } : p)),
      );
      setIsDirty(true);
    },
    [activePageId, setPages],
  );

  // ── handleContentChange ────────────────────────────────────────────────────

  const handleContentChange = useCallback(
    (json: JSONContent) => {
      if (!activePageId) return;
      pendingContentRef.current = json;
      setPages((prev) =>
        prev.map((p) => (p.id === activePageId ? { ...p, content: json } : p)),
      );
      setIsDirty(true);
    },
    [activePageId, setPages],
  );

  return {
    isDirty,
    setIsDirty,
    isEditMode,
    setIsEditMode,
    pendingNavId,
    saveFeedback,
    pendingContentRef,
    justCreatedPageRef,
    handleSave,
    handleSaveAndLeave,
    handleLeaveWithout,
    handleCancelPendingNav,
    handleEditModeChange,
    handleTitleChange,
    handleTitleBlur,
    cancelTitleBlurSave,
    handleTagsChange,
    handleBlocksChange,
    handleContentChange,
    titleHasError,
    setTitleHasError,
    setPendingNavId,
  };
}
