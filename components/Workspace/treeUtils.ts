/**
 * treeUtils — pure functions for immutable tree manipulation.
 *
 * ─── DATA MODEL ───────────────────────────────────────────────────────────────
 *
 * The sidebar file explorer uses a tree structure:
 *
 *   TreeRoot  { id, name, children: TreeNode[] }
 *   TreeNode  { id, name, pageId?, children?: TreeNode[] }
 *
 * A node is a FOLDER if `Array.isArray(node.children)` (even if empty).
 * A node is a FILE (page leaf) if `node.pageId !== undefined`.
 *
 * WHY this shape instead of a flat list with parentId references?
 *   A nested tree makes recursive render trivial (just map over children).
 *   Flat lists with parentId are easier to query by id but harder to render
 *   without extra processing. For a UI tree with ≤ 1000 nodes the nested
 *   approach is simpler and fast enough.
 *
 * ─── IMMUTABILITY PATTERN ─────────────────────────────────────────────────────
 *
 * Every function returns a NEW root object instead of mutating the existing one.
 * This is required because React state updates must replace (not mutate) state
 * for change detection to work. We use spread (`{ ...node, children: [...] }`)
 * to create shallow copies along the path to the modified node — a technique
 * called "path copying" or "structural sharing".
 *
 * Example: renaming a deeply nested node only copies objects along the path
 * from the root to that node. Nodes on other branches are shared by reference.
 *
 * ─── IMPROVEMENT IDEAS ────────────────────────────────────────────────────────
 *   - Replace linear `findNode` with an id-indexed Map for O(1) lookups in
 *     very large trees.
 *   - Add `sortChildren(root, compareFn)` for alphabetical ordering.
 *   - Add a `duplicateNode` function for copying pages.
 */

import type { TreeRoot, TreeNode } from './treeTypes';
import { ROOT_ID, ROOT_DROP_TARGET_ID } from './treeTypes';

// ─── API-to-tree builders ─────────────────────────────────────────────────────

/** Shape of a raw page record returned by GET /api/pages or GET /api/folders. */
type ApiPageStub = {
  id: string;
  title: string;
  folderId?: string | null;
};

/** Shape of a raw folder record returned by GET /api/folders. */
type ApiFolderStub = {
  id: string;
  name: string;
  parentId?: string | null;
};

function buildFolderNode(
  folder: ApiFolderStub,
  allFolders: ApiFolderStub[],
  allPages: ApiPageStub[],
): TreeNode {
  const childFolders = allFolders
    .filter((f) => f.parentId === folder.id)
    .map((f) => buildFolderNode(f, allFolders, allPages));

  const folderPages = allPages
    .filter((p) => p.folderId === folder.id)
    .map((p) => ({ id: p.id, name: p.title, pageId: p.id }));

  return {
    id: folder.id,
    name: folder.name,
    children: [...childFolders, ...folderPages],
  };
}

/**
 * Build a `TreeRoot` from the raw API response arrays.
 *
 * Extracted from `Workspace.tsx` so it can be unit-tested independently and
 * reused by the `useWorkspaceData` hook.
 *
 * @param folders - All folder records from GET /api/folders
 * @param pages   - All page stubs from GET /api/pages
 */
export function buildTreeRootFromApi(
  folders: ApiFolderStub[],
  pages: ApiPageStub[],
): TreeRoot {
  const rootPages = pages.filter((p) => !p.folderId);
  const folderNodes = folders
    .filter((f) => !f.parentId)
    .map((f) => buildFolderNode(f, folders, pages));

  return {
    id: ROOT_ID,
    name: 'My workspace',
    children: [
      ...folderNodes,
      ...rootPages.map((p) => ({ id: p.id, name: p.title, pageId: p.id })),
    ],
  };
}

/** Blank initial tree shown while data is loading. */
export const emptyTreeRoot: TreeRoot = { id: ROOT_ID, name: 'My workspace', children: [] };

/** Generate a unique id for folders (not used as page id) */
export function newFolderId(): string {
  return `folder-${crypto.randomUUID?.() ?? Date.now()}`;
}

/** Generate a unique id for pages */
export function newPageId(): string {
  return `page-${crypto.randomUUID?.() ?? Date.now()}`;
}

/**
 * Add a new folder as a child of the given parent. Returns new root (immutable).
 */
export function addFolderUnder(
  root: TreeRoot,
  parentId: string,
  name: string,
  folderId?: string,
): TreeRoot {
  const newFolder: TreeNode = {
    id: folderId ?? newFolderId(),
    name: name.trim() || 'New folder',
    children: [],
  };

  function addIn(nodes: TreeNode[], parent: string): TreeNode[] {
    return nodes.map((node) => {
      if (node.id === parent) {
        const children = Array.isArray(node.children) ? [...node.children] : [];
        return { ...node, children: [...children, newFolder] };
      }
      if (Array.isArray(node.children)) {
        return { ...node, children: addIn(node.children, parent) };
      }
      return node;
    });
  }

  if (parentId === root.id) {
    return {
      ...root,
      children: [...root.children, newFolder],
    };
  }
  return {
    ...root,
    children: addIn(root.children, parentId),
  };
}

/**
 * Add a new file (page) as a child of the given parent. Returns new root (immutable).
 * The new node's id and pageId will both be the given pageId.
 */
export function addFileUnder(
  root: TreeRoot,
  parentId: string,
  pageId: string,
  name: string,
): TreeRoot {
  const newFile: TreeNode = {
    id: pageId,
    name: name.trim() || 'Untitled',
    pageId,
  };

  function addIn(nodes: TreeNode[], parent: string): TreeNode[] {
    return nodes.map((node) => {
      if (node.id === parent) {
        const children = Array.isArray(node.children) ? [...node.children] : [];
        return { ...node, children: [...children, newFile] };
      }
      if (Array.isArray(node.children)) {
        return { ...node, children: addIn(node.children, parent) };
      }
      return node;
    });
  }

  if (parentId === root.id) {
    return {
      ...root,
      children: [...root.children, newFile],
    };
  }
  return {
    ...root,
    children: addIn(root.children, parentId),
  };
}

/**
 * Update a node's name (folder or file) by id. Returns new root.
 */
export function renameNode(
  root: TreeRoot,
  nodeId: string,
  name: string,
): TreeRoot {
  function renameIn(nodes: TreeNode[]): TreeNode[] {
    return nodes.map((node) => {
      if (node.id === nodeId) {
        return { ...node, name: name.trim() || node.name };
      }
      if (Array.isArray(node.children)) {
        return { ...node, children: renameIn(node.children) };
      }
      return node;
    });
  }
  return { ...root, children: renameIn(root.children) };
}

/**
 * Remove a node by id from the tree. Returns new root and the removed node (or null).
 */
export function findAndRemoveNode(
  root: TreeRoot,
  nodeId: string,
): { root: TreeRoot; node: TreeNode | null } {
  let removed: TreeNode | null = null;

  function removeFrom(nodes: TreeNode[]): TreeNode[] {
    const result: TreeNode[] = [];
    for (const node of nodes) {
      if (node.id === nodeId) {
        removed = node;
        continue;
      }
      if (Array.isArray(node.children)) {
        result.push({
          ...node,
          children: removeFrom(node.children),
        });
      } else {
        result.push(node);
      }
    }
    return result;
  }

  const newRoot = {
    ...root,
    children: removeFrom(root.children),
  };
  return { root: newRoot, node: removed };
}

/**
 * Insert a node as a child of the given parent. parentId can be root id or folder id.
 */
export function insertNodeUnder(
  root: TreeRoot,
  parentId: string,
  node: TreeNode,
): TreeRoot {
  function insertIn(nodes: TreeNode[], parent: string): TreeNode[] {
    return nodes.map((n) => {
      if (n.id === parent) {
        const children = Array.isArray(n.children) ? [...n.children] : [];
        return { ...n, children: [...children, node] };
      }
      if (Array.isArray(n.children)) {
        return { ...n, children: insertIn(n.children, parent) };
      }
      return n;
    });
  }

  if (parentId === root.id) {
    return {
      ...root,
      children: [...root.children, node],
    };
  }
  return {
    ...root,
    children: insertIn(root.children, parentId),
  };
}

/** Normalize drop target: empty string, 'parent_div', or root drop constant means root. */
export function normalizeDropTargetId(
  targetId: string,
  rootId: string,
): string {
  if (
    targetId === '' ||
    targetId === 'parent_div' ||
    targetId === ROOT_DROP_TARGET_ID
  ) {
    return rootId;
  }
  return targetId;
}

function addSubtreeIds(node: TreeNode, out: string[]): void {
  out.push(node.id);
  if (Array.isArray(node.children)) {
    for (const c of node.children) addSubtreeIds(c, out);
  }
}

function findNode(nodes: TreeNode[], nodeId: string): TreeNode | null {
  for (const n of nodes) {
    if (n.id === nodeId) return n;
    if (Array.isArray(n.children)) {
      const found = findNode(n.children, nodeId);
      if (found) return found;
    }
  }
  return null;
}

/** Returns true if targetId is sourceNodeId or inside the subtree of sourceNodeId (would create a cycle). */
function wouldCreateCycle(
  root: TreeRoot,
  sourceNodeId: string,
  targetId: string,
): boolean {
  const source = findNode(root.children, sourceNodeId);
  if (!source) return false;
  const ids: string[] = [];
  addSubtreeIds(source, ids);
  return ids.includes(targetId);
}

/**
 * Move a node from its current position to under targetParentId.
 * targetParentId can be root id, or use normalizeDropTargetId for tree view drop zone.
 * Prevents moving a node into itself or into one of its descendants.
 */
export function moveNode(
  root: TreeRoot,
  sourceNodeId: string,
  targetParentId: string,
): TreeRoot {
  const targetId = normalizeDropTargetId(targetParentId, root.id);
  if (sourceNodeId === targetId) return root;

  if (wouldCreateCycle(root, sourceNodeId, targetId)) return root;

  const { root: rootAfterRemove, node } = findAndRemoveNode(root, sourceNodeId);
  if (!node) return root;

  return insertNodeUnder(rootAfterRemove, targetId, node);
}

/**
 * Collect all page ids (file nodes) in the subtree of the given node.
 * Used when deleting a folder to also remove its pages from state.
 */
export function collectPageIdsInSubtree(node: TreeNode): string[] {
  const ids: string[] = [];
  if (node.pageId != null) {
    ids.push(node.pageId);
  }
  if (Array.isArray(node.children)) {
    for (const c of node.children) {
      ids.push(...collectPageIdsInSubtree(c));
    }
  }
  return ids;
}

/**
 * Remove a node by id. Returns new root and the removed node (if any).
 * Does not re-insert; use for delete.
 */
export function removeNode(
  root: TreeRoot,
  nodeId: string,
): { root: TreeRoot; removed: TreeNode | null } {
  const result = findAndRemoveNode(root, nodeId);
  return { root: result.root, removed: result.node };
}

/**
 * Find a node by id in the tree. Returns null if not found.
 */
export function findNodeInRoot(root: TreeRoot, nodeId: string): TreeNode | null {
  return findNode(root.children, nodeId);
}

/**
 * Count all nodes in the subtree (for confirmation message).
 */
export function countDescendants(node: TreeNode): number {
  let n = 1;
  if (Array.isArray(node.children)) {
    for (const c of node.children) n += countDescendants(c);
  }
  return n;
}

/**
 * Get the list of ancestor (folder) ids from root down to the node containing nodeId.
 * Does not include the nodeId itself. Used to highlight the path to the selected file.
 */
export function getAncestorPath(root: TreeRoot, nodeId: string): string[] {
  const path: string[] = [];

  function walk(nodes: TreeNode[], targetId: string): boolean {
    for (const n of nodes) {
      if (n.id === targetId) return true;
      if (Array.isArray(n.children)) {
        path.push(n.id);
        if (walk(n.children, targetId)) return true;
        path.pop();
      }
    }
    return false;
  }

  walk(root.children, nodeId);
  return path;
}

/**
 * Get the parent id of a node. Returns root.id if the node is at root level.
 * Used when dropping onto a file so we move as sibling (under same parent) instead of under the file.
 */
export function getParentId(root: TreeRoot, nodeId: string): string {
  const path = getAncestorPath(root, nodeId);
  return path.at(-1) ?? root.id;
}

/**
 * Replace a node's id (and pageId for leaf nodes) throughout the tree.
 *
 * Used after an optimistic page creation to reconcile the local temporary id
 * with the server-assigned id returned by POST /api/pages.
 */
export function replaceNodeId(root: TreeRoot, oldId: string, newId: string): TreeRoot {
  function replaceInChildren(children: TreeNode[]): TreeNode[] {
    return children.map((node) => {
      if (node.id === oldId) {
        const isLeaf = node.pageId !== undefined;
        return isLeaf
          ? { ...node, id: newId, pageId: newId }
          : { ...node, id: newId };
      }
      if (node.children !== undefined) {
        return { ...node, children: replaceInChildren(node.children) };
      }
      return node;
    });
  }
  return { ...root, children: replaceInChildren(root.children) };
}

/** Normalize a name for duplicate checks in a scope (trim + case-insensitive). */
export function normalizeScopeName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

/** Get direct children for a parent scope (folder id or root id). */
export function getScopeChildren(root: TreeRoot, parentId: string): TreeNode[] {
  if (parentId === root.id) return root.children;
  const parent = findNodeInRoot(root, parentId);
  if (!parent || !Array.isArray(parent.children)) return [];
  return parent.children;
}

/** Get normalized sibling names in a scope (excluding optional node id). */
export function getNormalizedSiblingNames(
  root: TreeRoot,
  parentId: string,
  excludeNodeId?: string,
): Set<string> {
  const names = new Set<string>();
  for (const child of getScopeChildren(root, parentId)) {
    if (excludeNodeId && child.id === excludeNodeId) continue;
    names.add(normalizeScopeName(child.name));
  }
  return names;
}

/** True when candidate name already exists among siblings in scope. */
export function isNameTakenInScope(
  root: TreeRoot,
  parentId: string,
  candidateName: string,
  excludeNodeId?: string,
): boolean {
  const normalized = normalizeScopeName(candidateName);
  if (!normalized) return false;
  return getNormalizedSiblingNames(root, parentId, excludeNodeId).has(normalized);
}

/** Generate a unique display name in scope using pattern: Base, Base 2, Base 3... */
export function generateUniqueNameInScope(
  root: TreeRoot,
  parentId: string,
  baseName: string,
): string {
  const base = baseName.trim() || 'Untitled';
  const normalizedSiblings = getNormalizedSiblingNames(root, parentId);
  if (!normalizedSiblings.has(normalizeScopeName(base))) return base;

  let index = 2;
  while (true) {
    const candidate = `${base} ${index}`;
    if (!normalizedSiblings.has(normalizeScopeName(candidate))) return candidate;
    index += 1;
  }
}

/** Find the first page id inside a node subtree (depth-first), or null if none. */
export function findFirstPageIdInSubtree(node: TreeNode): string | null {
  if (node.pageId) return node.pageId;
  if (!Array.isArray(node.children)) return null;
  for (const child of node.children) {
    const pageId = findFirstPageIdInSubtree(child);
    if (pageId) return pageId;
  }
  return null;
}
