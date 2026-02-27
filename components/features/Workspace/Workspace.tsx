'use client';

/**
 * Workspace — top-level application shell.
 *
 * Layout:
 * ┌─────────────┬────────────────────────────────────────────────────┐
 * │   Sidebar   │               MainContent                          │
 * │  (w-64)     │  Header | Editor | Stats footer                   │
 * └─────────────┴────────────────────────────────────────────────────┘
 *
 * On mobile (<768 px) the sidebar is a full-screen overlay drawer.
 *
 * STATE OWNERSHIP
 *   useWorkspaceData  — server-fetched pages/tree, server snapshots
 *   useSaveLogic      — dirty state, edit mode, all save callbacks
 *   useTreeOperations — sidebar tree CRUD (create / delete / rename / drag)
 *   Workspace.tsx     — activePageId, search, tag filter, layout flags
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight, FilePlus, FolderPlus, Search, X } from 'lucide-react';

import { FileExplorer } from '@/components/features/FileExplorer/FileExplorer';
import { MainContent } from '@/components/features/MainContent';
import type { TreeDataItem } from '@/components/shared/ui/tree-view';
import { useI18n } from '@/lib/i18n';
import { getLastNotebookPageId, setLastNotebookPageId } from '@/lib/notebookPageMemory';
import { useSettingsStore } from '@/lib/settingsStore';
import { usePageTracking } from '@/lib/usePageTracking';
import { useWritingTracking } from '@/lib/hooks/useWritingTracking';
import { cn } from '@/lib/utils';

import { buildTreeDataWithActions } from './buildTreeData';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { FolderRenameRow } from './FolderRenameRow';
import { useSaveLogic } from './hooks/useSaveLogic';
import { useTreeOperations } from './hooks/useTreeOperations';
import { useWorkspaceData } from './hooks/useWorkspaceData';
import { ROOT_ID } from './treeTypes';
import { findFirstPageIdInSubtree, findNodeInRoot, getAncestorPath } from './treeUtils';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';

const I18N_CLEAR_TAG_FILTER = 'sidebar.clearTagFilter';
const MIN_PAGE_TRANSITION_MS = 150;

type WorkspaceProps = Readonly<{
  initialRoutePageId?: string;
}>;

// eslint-disable-next-line sonarjs/cognitive-complexity -- top-level workspace container coordinates routing, tree, and save workflows
export function Workspace({ initialRoutePageId }: WorkspaceProps) {
  // ─── Layout / search / filter state ─────────────────────────────────────
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [leftPanelHidden, setLeftPanelHidden] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isPageTransitioning, setIsPageTransitioning] = useState(false);
  const [transitionStartedAt, setTransitionStartedAt] = useState<number | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastHandledRoutePageIdRef = useRef<string | null>(null);
  const transitionTargetPageIdRef = useRef<string | null>(null);
  const isTransitioningRef = useRef(false);

  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const tagsPerPageEnabled = useSettingsStore((s) => s.tagsPerPageEnabled);
  const router = useRouter();
  const routePageId = useMemo(() => initialRoutePageId || null, [initialRoutePageId]);
  const showErrorToast = useCallback((msg: string) => setErrorToast(msg), []);
  const startPageTransition = useCallback((targetPageId: string | null = null) => {
    if (isTransitioningRef.current && transitionTargetPageIdRef.current === targetPageId) return;

    transitionTargetPageIdRef.current = targetPageId;
    isTransitioningRef.current = true;
    setTransitionStartedAt(Date.now());
    setIsPageTransitioning(true);
  }, []);

  // ─── Data hook ───────────────────────────────────────────────────────────
  const {
    loading,
    pages,
    setPages,
    treeRoot,
    setTreeRoot,
    treeRootRef,
    dbFolderIds,
    serverBlocksRef,
    serverPagesRef,
  } = useWorkspaceData();

  // ─── Save / edit-mode hook ───────────────────────────────────────────────
  const saveLogic = useSaveLogic({
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
  });
  const setTitleHasError = saveLogic.setTitleHasError;

  // ─── Tree operations hook ────────────────────────────────────────────────
  const treeOps = useTreeOperations({
    treeRoot,
    treeRootRef,
    setTreeRoot,
    pages,
    setPages,
    dbFolderIds,
    serverBlocksRef,
    serverPagesRef,
    showErrorToast,
    t,
    setActivePageId,
    onFileCreated: (pageId) => {
      // Cancel any debounced title-blur save for the page we're leaving.
      // Without this, clicking "New page" while the title input is focused
      // would first blur the input (saving the draft title to the DB) and
      // then navigate away — corrupting the old page's title in the database.
      saveLogic.cancelTitleBlurSave();
      saveLogic.justCreatedPageRef.current = true;
      startPageTransition(pageId);
      setActivePageId(pageId);
      saveLogic.setIsEditMode(true);
    },
    onPageIdReplaced: (oldId, newId) => {
      // When the API returns the real DB ID for a newly created page, we need to
      // update activePageId without triggering the edit-mode reset in useSaveLogic.
      // Setting justCreatedPageRef to true prevents the reset.
      saveLogic.justCreatedPageRef.current = true;
      startPageTransition(newId);
      setActivePageId((current) => (current === oldId ? newId : current));
    },
  });

  // ─── Page time tracking ──────────────────────────────────────────────────
  const activeFolderIdForTracking = useMemo(
    () =>
      activePageId ? (pages.find((p) => p.id === activePageId)?.folderId ?? undefined) : undefined,

    [activePageId, pages],
  );
  usePageTracking({ pageId: activePageId ?? undefined, folderId: activeFolderIdForTracking });
  useWritingTracking({
    isEditMode: saveLogic.isEditMode,
    pageId: activePageId ?? undefined,
    folderId: activeFolderIdForTracking,
  });

  // ─── Derived values ──────────────────────────────────────────────────────
  const activePage = useMemo(
    () => (activePageId ? (pages.find((p) => p.id === activePageId) ?? null) : null),
    [pages, activePageId],
  );

  const isActivePageDataReady = useMemo(() => {
    if (loading) return false;
    if (!activePageId) return true;
    return activePage !== null;
  }, [loading, activePageId, activePage]);

  const ancestorPathIds = useMemo(
    () => (activePageId ? getAncestorPath(treeRoot, activePageId) : []),
    [treeRoot, activePageId],
  );

  const breadcrumbs = useMemo(() => {
    if (!activePageId || !activePage)
      return [] as Array<{ id: string; label: string; isCurrent: boolean }>;
    const folderCrumbs = ancestorPathIds
      .map((id) => {
        const node = findNodeInRoot(treeRoot, id);
        if (!node) return null;
        return { id: node.id, label: node.name, isCurrent: false };
      })
      .filter((x): x is { id: string; label: string; isCurrent: boolean } => x !== null);
    return [...folderCrumbs, { id: activePage.id, label: activePage.title, isCurrent: true }];
  }, [activePageId, activePage, ancestorPathIds, treeRoot]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const p of pages) for (const tag of p.tags ?? []) s.add(tag);
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [pages]);

  const toggleTag = useCallback(
    (tag: string) =>
      setActiveTags((prev) =>
        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
      ),
    [],
  );

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const hasQuery = q.length > 0;
    const hasTagFilter = activeTags.length > 0;
    if (!hasQuery && !hasTagFilter) return null;

    return pages.filter((page) => {
      if (hasTagFilter) {
        const pageTags = page.tags ?? [];
        if (!activeTags.every((t) => pageTags.includes(t))) return false;
      }
      if (hasQuery) {
        if (page.title.toLowerCase().includes(q)) return true;
        if ((page.tags ?? []).some((tag) => tag.toLowerCase().includes(q))) return true;
        if (page.content != null) return JSON.stringify(page.content).toLowerCase().includes(q);
        return page.blocks.some((block) => {
          if (typeof block.content === 'string') {
            // Use DOMParser to safely extract text — no regex, no ReDoS risk
            const doc = new DOMParser().parseFromString(block.content, 'text/html');
            return (doc.body.textContent ?? '').toLowerCase().includes(q);
          }
          return JSON.stringify(block.content).toLowerCase().includes(q);
        });
      }
      return true;
    });
  }, [pages, searchQuery, activeTags]);

  const treeData: TreeDataItem[] = useMemo(
    () =>
      buildTreeDataWithActions({
        root: treeRoot,
        onCreateFile: treeOps.createFile,
        onCreateFolder: treeOps.createFolder,
        onDelete: treeOps.handleDeleteNode,
        selectedPageId: activePageId,
        ancestorPathIds,
        t,
        editingFolderId: treeOps.editingFolderId,
        setEditingFolderId: treeOps.setEditingFolderId,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [treeRoot, activePageId, ancestorPathIds, t, treeOps.editingFolderId],
  );

  // ─── Callbacks ───────────────────────────────────────────────────────────
  const handleSelect = useCallback(
    (pageId: string) => {
      if (pageId === activePageId) return;
      if (saveLogic.isDirty && saveLogic.isEditMode) {
        saveLogic.setPendingNavId(pageId);
        return;
      }
      setTitleHasError(false);
      startPageTransition(pageId);
      setActivePageId(pageId);
      setMobileSidebarOpen(false);
    },
    [activePageId, saveLogic, setTitleHasError, startPageTransition],
  );

  const handleTreeSelect = useCallback(
    (item: TreeDataItem | undefined) => {
      if (!item) return;
      if (!pages.some((p) => p.id === item.id)) return;
      handleSelect(item.id);
    },
    [handleSelect, pages],
  );

  const handleBreadcrumbClick = useCallback(
    (nodeId: string) => {
      const node = findNodeInRoot(treeRoot, nodeId);
      if (!node) return;
      if (node.pageId) {
        handleSelect(node.pageId);
        return;
      }
      const nextPageId = findFirstPageIdInSubtree(node);
      if (nextPageId) handleSelect(nextPageId);
    },
    [handleSelect, treeRoot],
  );

  const renderTreeItem = useCallback(
    (params: {
      item: TreeDataItem;
      isLeaf: boolean;
      isSelected: boolean;
      hasChildren: boolean;
    }) => (
      <FolderRenameRow
        item={params.item}
        isLeaf={params.isLeaf}
        isSelected={params.isSelected}
        onRenameFolder={treeOps.handleRenameFolder}
        editingFolderId={treeOps.editingFolderId}
        setEditingFolderId={treeOps.setEditingFolderId}
      />
    ),
    [treeOps.editingFolderId, treeOps.handleRenameFolder, treeOps.setEditingFolderId],
  );

  // ─── Effects ─────────────────────────────────────────────────────────────

  // Clear tag filter when tags feature is disabled.
  useEffect(() => {
    if (!tagsPerPageEnabled) setActiveTags([]);
  }, [tagsPerPageEnabled]);

  // Auto-dismiss error toast after 3 s.
  useEffect(() => {
    if (!errorToast) return;
    const timer = setTimeout(() => setErrorToast(null), 3000);
    return () => clearTimeout(timer);
  }, [errorToast]);

  // URL → state sync (deep-linking, browser back/forward).
  useEffect(() => {
    if (!routePageId) {
      lastHandledRoutePageIdRef.current = null;
      return;
    }
    if (loading || !routePageId) return;

    // When navigation originated from in-app page selection, activePageId is
    // already set before router updates ?page=. Do not re-trigger transition.
    if (activePageId === routePageId) {
      lastHandledRoutePageIdRef.current = routePageId;
      return;
    }

    if (lastHandledRoutePageIdRef.current === routePageId) return;
    if (pages.some((p) => p.id === routePageId)) {
      lastHandledRoutePageIdRef.current = routePageId;
      startPageTransition(routePageId);
      setActivePageId(routePageId);
      setTitleHasError(false);
    }
  }, [loading, routePageId, pages, activePageId, setTitleHasError, startPageTransition]);

  // Restore last opened notebook page when route has no ?page= parameter.
  useEffect(() => {
    if (loading || routePageId || activePageId) return;
    const lastOpenPageId = getLastNotebookPageId();
    if (!lastOpenPageId) return;
    if (!pages.some((p) => p.id === lastOpenPageId)) return;
    startPageTransition(lastOpenPageId);
    setActivePageId(lastOpenPageId);
    setTitleHasError(false);
  }, [loading, routePageId, activePageId, pages, setTitleHasError, startPageTransition]);

  // State → URL sync (bookmarkable pages).
  useEffect(() => {
    if (loading || !activePageId) return;
    const current = new URLSearchParams(globalThis.location.search).get('page');
    if (current !== activePageId) {
      router.push(`/notebook?page=${encodeURIComponent(activePageId)}`, { scroll: false });
    }
  }, [activePageId, loading, router]);

  // Persist the last actively opened page for cross-tab (Notebook/Statistics) return.
  useEffect(() => {
    if (!activePageId) return;
    setLastNotebookPageId(activePageId);
  }, [activePageId]);

  // End transition only when selected-page data is available and minimum
  // skeleton visibility has elapsed.
  useEffect(() => {
    if (!isPageTransitioning || !isActivePageDataReady) return;

    const startedAt = transitionStartedAt ?? Date.now();
    const elapsed = Date.now() - startedAt;
    const remaining = MIN_PAGE_TRANSITION_MS - elapsed;

    if (remaining <= 0) {
      isTransitioningRef.current = false;
      transitionTargetPageIdRef.current = null;
      setIsPageTransitioning(false);
      setTransitionStartedAt(null);
      return;
    }

    const timer = setTimeout(() => {
      isTransitioningRef.current = false;
      transitionTargetPageIdRef.current = null;
      setIsPageTransitioning(false);
      setTransitionStartedAt(null);
    }, remaining);
    return () => clearTimeout(timer);
  }, [isPageTransitioning, isActivePageDataReady, transitionStartedAt]);

  // Keyboard shortcut: Cmd/Ctrl+K → focus search input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setMobileSidebarOpen(true);
      }
    };
    globalThis.addEventListener('keydown', onKey);
    return () => globalThis.removeEventListener('keydown', onKey);
  }, []);

  // Track viewport mode (desktop vs mobile) for responsive motion behavior.
  useEffect(() => {
    const media = globalThis.matchMedia?.('(min-width: 768px)');
    if (!media) return;
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  // Mobile drawer UX: lock body scroll while open and allow Escape to close.
  useEffect(() => {
    if (!mobileSidebarOpen || isDesktop) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileSidebarOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isDesktop, mobileSidebarOpen]);

  // ─── Render ──────────────────────────────────────────────────────────────
  const isCollapsedDesktop = isDesktop && leftPanelHidden;
  const sidebarWidth = isCollapsedDesktop ? 40 : 256;
  const showSidebar = isDesktop || mobileSidebarOpen;
  let sidebarTransition:
    | { duration: number }
    | { duration: number; ease: [number, number, number, number] };
  if (reducedMotion) {
    sidebarTransition = { duration: 0.01 };
  } else if (isDesktop) {
    sidebarTransition = { duration: 0.34, ease: [0.22, 1, 0.36, 1] };
  } else {
    sidebarTransition = { duration: 0.26, ease: [0.22, 1, 0.36, 1] };
  }

  return (
    <div className="bg-background text-foreground flex h-full overflow-hidden font-sans">
      {/* Loading overlay */}
      {loading && (
        <div className="bg-background/80 fixed inset-0 z-50 flex animate-in fade-in-0 items-center justify-center backdrop-blur-sm duration-300 motion-reduce:animate-none motion-reduce:duration-0">
          <div className="text-muted-foreground flex flex-col items-center gap-3">
            <div className="border-border border-t-primary h-8 w-8 animate-spin rounded-full border-4" />
            <span className="text-sm">{t('app.loading')}</span>
          </div>
        </div>
      )}

      {/* Mobile backdrop */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            key="mobile-sidebar-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.01 : 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            aria-hidden="true"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ─── Sidebar ───────────────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {showSidebar && (
          <motion.aside
            key={isDesktop ? 'desktop-sidebar' : 'mobile-sidebar'}
            className={cn(
              'alive-surface border-border bg-card flex shrink-0 flex-col border-r shadow-sm overflow-hidden',
              isDesktop
                ? 'relative z-auto'
                : 'fixed inset-y-0 left-0 z-50',
            )}
            initial={isDesktop ? false : { x: '-100%' }}
            animate={isDesktop ? { width: sidebarWidth, x: 0 } : { width: '100vw', x: 0 }}
            exit={isDesktop ? undefined : { x: '-100%' }}
            transition={sidebarTransition}
          >
        <div className={cn('flex h-full flex-col', isDesktop ? 'w-64 min-w-64' : 'w-screen min-w-screen')}>
          {/* Sidebar header */}
          <div className="border-border flex items-center justify-between border-b px-4 py-3">
            <h1 className="text-primary text-xl font-semibold tracking-tight">{t('app.title')}</h1>
            <button
              type="button"
              aria-label={isDesktop ? t('sidebar.hide') : 'Close sidebar'}
              className="motion-interactive icon-pop-hover text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded p-1.5 transition-colors"
              onClick={() => {
                if (isDesktop) setLeftPanelHidden(true);
                else setMobileSidebarOpen(false);
              }}
            >
              {isDesktop ? <ChevronLeft size={20} /> : <X size={20} />}
            </button>
          </div>

          {/* New page / folder buttons */}
          <div className="border-border flex gap-2 border-b px-3 py-2.5">
            <button
              type="button"
              aria-label={t('sidebar.newPage')}
              data-testid="sidebar-new-page"
              className="motion-interactive border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors sm:gap-2 sm:px-3 sm:text-sm"
              onClick={() => treeOps.createFile(ROOT_ID)}
            >
              <FilePlus size={16} className="shrink-0" />
              <span className="truncate">{t('sidebar.newPage')}</span>
            </button>
            <button
              type="button"
              aria-label={t('sidebar.newFolder')}
              data-testid="sidebar-new-folder"
              className="motion-interactive border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors sm:gap-2 sm:px-3 sm:text-sm"
              onClick={() => treeOps.createFolder(ROOT_ID)}
            >
              <FolderPlus size={16} className="shrink-0" />
              <span className="truncate">{t('sidebar.newFolder')}</span>
            </button>
          </div>

          {/* Search input */}
          <div className="border-border border-b px-3 py-2">
            <div className="border-border bg-background flex items-center gap-2 rounded-lg border px-3 py-1.5">
              <Search size={14} className="text-muted-foreground shrink-0" />
              <input
                ref={searchInputRef}
                data-testid="sidebar-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('sidebar.search')}
                className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="motion-interactive icon-spin-hover text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                  data-testid="sidebar-clear-search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Tag cloud */}
          {tagsPerPageEnabled && allTags.length > 0 && (
            <div className="border-border border-b px-3 py-2">
              <div className="flex flex-wrap gap-1">
                {activeTags.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTags([])}
                    className="motion-interactive flex items-center gap-1 rounded-full border border-indigo-300 px-2 py-0.5 text-xs text-indigo-600 transition-colors hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-900/30"
                    title={t(I18N_CLEAR_TAG_FILTER)}
                  >
                    <X size={9} />
                    {t(I18N_CLEAR_TAG_FILTER)}
                  </button>
                )}
                {allTags.map((tag) => {
                  const isActive = activeTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        'motion-interactive rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
                        isActive
                          ? 'border-indigo-400 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500'
                          : 'border-border bg-muted/40 text-muted-foreground hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300',
                      )}
                      title={isActive ? t(I18N_CLEAR_TAG_FILTER) : t('sidebar.filterByTag')}
                      aria-pressed={isActive}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tree / search results */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {searchResults === null ? (
              <>
                <p className="text-muted-foreground px-3 pt-3 text-xs font-medium tracking-wider uppercase">
                  {t('sidebar.pages')}
                </p>
                <FileExplorer
                  data={treeData}
                  onSelect={handleTreeSelect}
                  onDocumentDrag={treeOps.handleDocumentDrag}
                  renderItem={renderTreeItem}
                  selectedItemId={activePageId ?? undefined}
                  expandedItemIds={ancestorPathIds}
                  rootDropLabel={t('tree.dropToRoot')}
                />
              </>
            ) : (
              <div className="flex-1 overflow-y-auto px-2 py-2">
                {searchResults.length === 0 ? (
                  <p className="text-muted-foreground px-2 py-3 text-xs">
                    {t('sidebar.noResults', { query: searchQuery })}
                  </p>
                ) : (
                  searchResults.map((page) => (
                    <button
                      key={page.id}
                      type="button"
                      className={cn(
                        'motion-interactive flex w-full flex-col items-start rounded-md px-3 py-2 text-left text-sm transition-colors',
                        page.id === activePageId
                          ? 'bg-accent text-accent-foreground'
                          : 'text-foreground hover:bg-accent/50',
                      )}
                      onClick={() => {
                        handleSelect(page.id);
                        setSearchQuery('');
                        setActiveTags([]);
                      }}
                    >
                      <span className="truncate font-medium">{page.title}</span>
                      {(page.tags ?? []).length > 0 && (
                        <span className="mt-0.5 flex flex-wrap gap-1">
                          {(page.tags ?? []).map((tag) => (
                            <span
                              key={tag}
                              className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <motion.div
          className="border-border bg-card absolute inset-y-0 left-0 z-10 hidden w-10 items-start justify-center border-r py-3 md:flex"
          initial={false}
          animate={{ opacity: isCollapsedDesktop ? 1 : 0 }}
          transition={
            reducedMotion
              ? { duration: 0.01 }
              : {
                  duration: isCollapsedDesktop ? 0.16 : 0.1,
                  delay: isCollapsedDesktop ? 0.18 : 0,
                  ease: [0.22, 1, 0.36, 1],
                }
          }
          style={{ pointerEvents: isCollapsedDesktop ? 'auto' : 'none' }}
          aria-hidden={!isCollapsedDesktop}
        >
          <button
            type="button"
            aria-label={t('sidebar.show')}
            className="motion-interactive icon-pop-hover text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded p-1.5 transition-colors"
            onClick={() => setLeftPanelHidden(false)}
          >
            <ChevronRight size={20} />
          </button>
        </motion.div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ─── Main content ───────────────────────────────────────────────────── */}
      <MainContent
        page={activePage}
        isPageLoading={loading || isPageTransitioning}
        breadcrumbs={breadcrumbs}
        onBreadcrumbClick={handleBreadcrumbClick}
        onSave={saveLogic.handleSave}
        saved={saveLogic.saveFeedback}
        isDirty={saveLogic.isDirty}
        onTitleChange={saveLogic.handleTitleChange}
        onTitleBlur={saveLogic.handleTitleBlur}
        titleHasError={saveLogic.titleHasError}
        onTagsChange={saveLogic.handleTagsChange}
        allTagSuggestions={allTags}
        onMobileSidebarToggle={() => setMobileSidebarOpen((v) => !v)}
        isEditMode={saveLogic.isEditMode}
        onEditModeChange={saveLogic.handleEditModeChange}
        onContentChange={saveLogic.handleContentChange}
      />

      {/* Error toast */}
      {errorToast && (
        <div className="border-destructive/30 bg-destructive text-destructive-foreground pointer-events-none fixed right-4 bottom-4 z-50 rounded-md border px-4 py-2 text-sm font-medium shadow-lg">
          {errorToast}
        </div>
      )}

      <DeleteConfirmDialog
        open={treeOps.deleteDialog !== null}
        onOpenChange={(open) => {
          if (!open) treeOps.setDeleteDialog(null);
        }}
        title={treeOps.deleteDialog?.title ?? ''}
        description={treeOps.deleteDialog?.description ?? ''}
        onConfirm={treeOps.handleConfirmDelete}
      />

      <UnsavedChangesDialog
        open={saveLogic.pendingNavId !== null}
        onSaveAndLeave={saveLogic.handleSaveAndLeave}
        onLeaveWithout={saveLogic.handleLeaveWithout}
        onCancel={saveLogic.handleCancelPendingNav}
      />
    </div>
  );
}
