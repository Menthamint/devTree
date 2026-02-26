'use client';

/**
 * useTreeOperations — all tree-mutation callbacks for the workspace sidebar.
 *
 * Extracted from `Workspace.tsx` to reduce its size and isolate all
 * create/delete/drag/rename logic. The hook is purely concerned with the
 * sidebar tree; it has NO save or dirty-tracking concerns.
 *
 * Responsibilities:
 *   - createFile: optimistic page creation, API call, id reconciliation.
 *   - createFolder: optimistic folder creation, API call, rename sync.
 *   - handleDeleteNode: open the delete-confirmation dialog.
 *   - handleConfirmDelete: apply deletion locally and call the API.
 *   - handleDocumentDrag: move a node via drag-and-drop.
 *   - handleRenameFolder: rename a folder with duplicate-name guard.
 *
 * Error handling: API errors show a toast via `showErrorToast`; optimistic
 * folder creation also reverts the local tree on failure.
 */

import { useState, useCallback } from 'react';
import type { Page, Block } from '@/components/MainContent';
import type { TreeRoot } from '../treeTypes';
import { ROOT_DROP_TARGET_ID } from '../treeTypes';
import type { TreeDataItem } from '@/components/ui/tree-view';
import {
  addFileUnder,
  addFolderUnder,
  collectPageIdsInSubtree,
  countDescendants,
  findNodeInRoot,
  generateUniqueNameInScope,
  getParentId,
  isNameTakenInScope,
  moveNode,
  newFolderId,
  newPageId,
  removeNode,
  renameNode,
  replaceNodeId,
} from '../treeUtils';
import {
  createPage as apiCreatePage,
  deletePage as apiDeletePage,
  createFolder as apiCreateFolder,
  updateFolder as apiUpdateFolder,
  deleteFolder as apiDeleteFolder,
  movePage as apiMovePage,
  moveFolder as apiMoveFolder,
  WorkspaceApiError,
} from '../workspaceApi';
import type { JSONContent } from '@tiptap/react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeleteDialogState = {
  nodeId: string;
  title: string;
  description: string;
} | null;

export type TreeOperationsParams = {
  treeRoot: TreeRoot;
  treeRootRef: React.MutableRefObject<TreeRoot>;
  setTreeRoot: React.Dispatch<React.SetStateAction<TreeRoot>>;
  pages: Page[];
  setPages: React.Dispatch<React.SetStateAction<Page[]>>;
  dbFolderIds: React.MutableRefObject<Map<string, string>>;
  serverBlocksRef: React.MutableRefObject<Map<string, Block[]>>;
  serverPagesRef: React.MutableRefObject<Map<string, Page>>;
  showErrorToast: (message: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  /**
   * Called just after a new page is optimistically created in the tree.
   * Workspace.tsx uses this to set activePageId, isEditMode, and the
   * justCreatedPageRef flag.
   */
  onFileCreated: (pageId: string, page: Page) => void;
  /**
   * Called when the API resolves and the temp page ID is replaced by the real DB ID.
   * Workspace.tsx uses this to update activePageId without resetting edit mode.
   */
  onPageIdReplaced: (oldId: string, newId: string) => void;
  /** Called so delete can clear the active page if it was deleted. */
  setActivePageId: React.Dispatch<React.SetStateAction<string | null>>;
};

export type TreeOperationsResult = {
  createFile: (parentId: string) => void;
  createFolder: (parentId: string) => void;
  handleDeleteNode: (nodeId: string) => void;
  handleConfirmDelete: () => void;
  handleDocumentDrag: (source: TreeDataItem, target: TreeDataItem) => void;
  handleRenameFolder: (folderId: string, name: string) => boolean;
  deleteDialog: DeleteDialogState;
  setDeleteDialog: React.Dispatch<React.SetStateAction<DeleteDialogState>>;
  editingFolderId: string | null;
  setEditingFolderId: React.Dispatch<React.SetStateAction<string | null>>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTreeOperations({
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
  onFileCreated,
  onPageIdReplaced,
  setActivePageId,
}: TreeOperationsParams): TreeOperationsResult {
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);

  // ── createFolder ───────────────────────────────────────────────────────────

  const createFolder = useCallback(
    (parentId: string) => {
      const localFolderId = newFolderId();
      const folderName = generateUniqueNameInScope(treeRoot, parentId, t('tree.newFolder'));

      // Optimistic update
      setTreeRoot((root) => addFolderUnder(root, parentId, folderName, localFolderId));

      const dbParentId = dbFolderIds.current.has(parentId) ? parentId : null;

      void apiCreateFolder(folderName, dbParentId)
        .then((created) => {
          const latestNode = findNodeInRoot(treeRootRef.current, localFolderId);
          const latestName = latestNode?.name?.trim();

          setTreeRoot((root) => replaceNodeId(root, localFolderId, created.id));
          dbFolderIds.current.set(created.id, created.id);

          // Sync rename if the user renamed the folder before the API responded.
          if (latestName && latestName !== created.name) {
            void apiUpdateFolder(created.id, { name: latestName }).catch((err) => {
              console.error('[createFolder:syncRename]', err);
              if (err instanceof WorkspaceApiError && (err.status === 409 || err.code === 'DUPLICATE_NAME')) {
                showErrorToast(t('tree.duplicateNameError'));
              }
            });
          }
        })
        .catch((err) => {
          console.error('[createFolder]', err);
          if (err instanceof WorkspaceApiError && (err.status === 409 || err.code === 'DUPLICATE_NAME')) {
            showErrorToast(t('tree.duplicateNameError'));
          }
          // Revert the optimistic folder by removing the local node.
          setTreeRoot((root) => removeNode(root, localFolderId).root);
        });
    },
    [showErrorToast, t, treeRoot, treeRootRef, setTreeRoot, dbFolderIds],
  );

  // ── createFile ─────────────────────────────────────────────────────────────

  const createFile = useCallback(
    (parentId: string) => {
      const localPageId = newPageId();
      const fileTitle = generateUniqueNameInScope(treeRoot, parentId, 'Untitled');
      const emptyDoc: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };
      const newPage: Page = { id: localPageId, title: fileTitle, blocks: [], content: emptyDoc };

      // Optimistic updates
      setPages((prev) => [...prev, newPage]);
      setTreeRoot((root) => addFileUnder(root, parentId, localPageId, newPage.title));
      serverBlocksRef.current.set(localPageId, []);
      serverPagesRef.current.set(localPageId, newPage);

      // Tell Workspace to activate the new page and enter edit mode.
      onFileCreated(localPageId, newPage);

      const dbFolderId = dbFolderIds.current.has(parentId) ? parentId : null;

      void apiCreatePage(fileTitle, dbFolderId)
        .then((created) => {
          const createdPage: Page = { id: created.id, title: created.title, blocks: [], content: emptyDoc };
          setPages((prev) => prev.map((p) => (p.id === localPageId ? { ...p, id: created.id } : p)));
          setTreeRoot((root) => replaceNodeId(root, localPageId, created.id));
          serverBlocksRef.current.set(created.id, []);
          serverBlocksRef.current.delete(localPageId);
          serverPagesRef.current.set(created.id, createdPage);
          serverPagesRef.current.delete(localPageId);
          // Notify Workspace to update activePageId without resetting edit mode.
          onPageIdReplaced(localPageId, created.id);
        })
        .catch((err) => {
          console.error('[createFile]', err);
          if (err instanceof WorkspaceApiError && (err.status === 409 || err.code === 'DUPLICATE_NAME')) {
            showErrorToast(t('tree.duplicateNameError'));
          }
        });
    },
    [showErrorToast, t, treeRoot, setTreeRoot, setPages, dbFolderIds, serverBlocksRef, serverPagesRef, onFileCreated, onPageIdReplaced],
  );

  // ── handleDeleteNode (open dialog) ─────────────────────────────────────────

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      const node = findNodeInRoot(treeRoot, nodeId);
      if (!node) return;

      const isFile = node.pageId != null;
      const count = countDescendants(node);

      const title = isFile ? t('delete.pageTitle') : t('delete.folderTitle');
      let description: string;
      if (isFile) {
        description = t('delete.pageDescription', { name: node.name });
      } else if (count > 1) {
        description = t('delete.folderDescription', { name: node.name, count: count - 1 });
      } else {
        description = t('delete.folderDescriptionOnly', { name: node.name });
      }

      setDeleteDialog({ nodeId, title, description });
    },
    [treeRoot, t],
  );

  // ── handleConfirmDelete ────────────────────────────────────────────────────

  const handleConfirmDelete = useCallback(() => {
    if (!deleteDialog) return;
    const { nodeId } = deleteDialog;

    const { root: nextRoot, removed } = removeNode(treeRoot, nodeId);
    if (!removed) return;
    const pageIdsToRemove = collectPageIdsInSubtree(removed);

    // Optimistic update
    setTreeRoot(nextRoot);
    setPages((prevPages) => prevPages.filter((p) => !pageIdsToRemove.includes(p.id)));
    setActivePageId((current) => (pageIdsToRemove.includes(current ?? '') ? null : current));
    for (const pageId of pageIdsToRemove) {
      serverBlocksRef.current.delete(pageId);
      serverPagesRef.current.delete(pageId);
    }
    setDeleteDialog(null);

    const isFolder = dbFolderIds.current.has(nodeId);
    if (isFolder) {
      void apiDeleteFolder(nodeId).catch((err) => console.error('[deleteFolder]', err));
    } else {
      for (const pid of pageIdsToRemove) {
        void apiDeletePage(pid).catch((err) => console.error('[deletePage]', err));
      }
    }
  }, [deleteDialog, treeRoot, setTreeRoot, setPages, setActivePageId, serverBlocksRef, serverPagesRef, dbFolderIds]);

  // ── handleDocumentDrag ─────────────────────────────────────────────────────

  const handleDocumentDrag = useCallback(
    (sourceItem: TreeDataItem, targetItem: TreeDataItem) => {
      setTreeRoot((root) => {
        const isTargetRoot = targetItem.id === ROOT_DROP_TARGET_ID;
        const targetId = isTargetRoot
          ? targetItem.id
          : (() => {
              const node = findNodeInRoot(root, targetItem.id);
              if (node?.pageId != null) return getParentId(root, targetItem.id);
              return targetItem.id;
            })();

        const nextRoot = moveNode(root, sourceItem.id, targetId);

        const sourceNode = findNodeInRoot(root, sourceItem.id);
        const isPage = sourceNode?.pageId != null;
        const resolvedFolderId =
          isTargetRoot || targetId === ROOT_DROP_TARGET_ID ? null : targetId;

        const siblings = isTargetRoot
          ? nextRoot.children
          : (findNodeInRoot(nextRoot, targetId)?.children ?? []);
        const order = siblings.findIndex((c) => c.id === sourceItem.id);

        if (isPage) {
          void apiMovePage(sourceItem.id, { folderId: resolvedFolderId, order }).catch(
            (err) => console.error('[movePage]', err),
          );
        } else {
          void apiMoveFolder(sourceItem.id, { parentId: resolvedFolderId, order }).catch(
            (err) => console.error('[moveFolder]', err),
          );
        }

        return nextRoot;
      });
    },
    [setTreeRoot],
  );

  // ── handleRenameFolder ─────────────────────────────────────────────────────

  const handleRenameFolder = useCallback(
    (folderId: string, name: string): boolean => {
      const parentId = getParentId(treeRoot, folderId);
      if (isNameTakenInScope(treeRoot, parentId, name, folderId)) {
        showErrorToast(t('tree.duplicateNameError'));
        return false;
      }

      setTreeRoot((root) => renameNode(root, folderId, name));
      setEditingFolderId(null);

      if (!dbFolderIds.current.has(folderId)) return true;

      void apiUpdateFolder(folderId, { name }).catch((err) => {
        console.error('[renameFolder]', err);
        if (err instanceof WorkspaceApiError && (err.status === 409 || err.code === 'DUPLICATE_NAME')) {
          showErrorToast(t('tree.duplicateNameError'));
        }
      });
      return true;
    },
    [showErrorToast, t, treeRoot, setTreeRoot, dbFolderIds],
  );

  return {
    createFile,
    createFolder,
    handleDeleteNode,
    handleConfirmDelete,
    handleDocumentDrag,
    handleRenameFolder,
    deleteDialog,
    setDeleteDialog,
    editingFolderId,
    setEditingFolderId,
  };
}
