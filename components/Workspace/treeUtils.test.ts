/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';

import {
  addFileUnder,
  addFolderUnder,
  buildTreeRootFromApi,
  collectPageIdsInSubtree,
  countDescendants,
  emptyTreeRoot,
  findFirstPageIdInSubtree,
  findNodeInRoot,
  generateUniqueNameInScope,
  getNormalizedSiblingNames,
  getAncestorPath,
  getParentId,
  isNameTakenInScope,
  moveNode,
  newFolderId,
  newPageId,
  normalizeScopeName,
  removeNode,
  renameNode,
} from './treeUtils';
import type { TreeNode, TreeRoot } from './treeTypes';
import { ROOT_ID } from './treeTypes';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const root: TreeRoot = {
  id: ROOT_ID,
  name: 'root',
  children: [
    { id: 'p1', name: 'Page 1', pageId: 'p1' },
    {
      id: 'f1',
      name: 'Folder 1',
      children: [
        { id: 'p2', name: 'Page 2', pageId: 'p2' },
        {
          id: 'f2',
          name: 'Folder 2',
          children: [{ id: 'p3', name: 'Page 3', pageId: 'p3' }],
        },
      ],
    },
    { id: 'p4', name: 'Page 4', pageId: 'p4' },
  ],
};

function folderNode(id: string): TreeNode {
  const node = findNodeInRoot(root, id);
  if (!node) throw new Error(`Node ${id} not found`);
  return node;
}

// ─── ID generators ────────────────────────────────────────────────────────────

describe('newPageId / newFolderId', () => {
  it('newPageId returns a string starting with "page-"', () => {
    expect(newPageId()).toMatch(/^page-/);
  });

  it('newFolderId returns a string starting with "folder-"', () => {
    expect(newFolderId()).toMatch(/^folder-/);
  });

  it('generates unique IDs each call', () => {
    expect(newPageId()).not.toBe(newPageId());
  });
});

// ─── findNodeInRoot ────────────────────────────────────────────────────────────

describe('findNodeInRoot', () => {
  it('finds a root-level page', () => {
    expect(findNodeInRoot(root, 'p1')?.name).toBe('Page 1');
  });

  it('finds a nested page inside a folder', () => {
    expect(findNodeInRoot(root, 'p2')?.name).toBe('Page 2');
  });

  it('finds a deeply nested page', () => {
    expect(findNodeInRoot(root, 'p3')?.name).toBe('Page 3');
  });

  it('finds a folder by id', () => {
    expect(findNodeInRoot(root, 'f1')?.name).toBe('Folder 1');
  });

  it('returns null for a non-existent id', () => {
    expect(findNodeInRoot(root, 'nonexistent')).toBeNull();
  });
});

// ─── getAncestorPath ───────────────────────────────────────────────────────────

describe('getAncestorPath', () => {
  it('returns empty array for a root-level node', () => {
    expect(getAncestorPath(root, 'p1')).toEqual([]);
  });

  it('returns [folderId] for a node directly inside a folder', () => {
    expect(getAncestorPath(root, 'p2')).toEqual(['f1']);
  });

  it('returns [f1, f2] for a deeply nested node', () => {
    expect(getAncestorPath(root, 'p3')).toEqual(['f1', 'f2']);
  });

  it('returns empty array for unknown node', () => {
    expect(getAncestorPath(root, 'unknown')).toEqual([]);
  });
});

// ─── getParentId ──────────────────────────────────────────────────────────────

describe('getParentId', () => {
  it('returns ROOT_ID for a root-level node', () => {
    expect(getParentId(root, 'p1')).toBe(ROOT_ID);
  });

  it('returns folder id for a directly nested node', () => {
    expect(getParentId(root, 'p2')).toBe('f1');
  });

  it('returns inner folder id for a deeply nested node', () => {
    expect(getParentId(root, 'p3')).toBe('f2');
  });
});

// ─── countDescendants ─────────────────────────────────────────────────────────

// Note: countDescendants counts the node itself (returns 1 for a leaf,
// and 1 + all descendants for a folder).
describe('countDescendants', () => {
  it('returns 1 for a leaf node (counts itself)', () => {
    expect(countDescendants(folderNode('p1'))).toBe(1);
  });

  it('returns correct count for a shallow folder', () => {
    // f2 itself (1) + p3 (1) = 2
    expect(countDescendants(folderNode('f2'))).toBe(2);
  });

  it('returns correct count for a deep folder', () => {
    // f1 (1) + p2 (1) + f2 (1) + p3 (1) = 4
    expect(countDescendants(folderNode('f1'))).toBe(4);
  });
});

// ─── collectPageIdsInSubtree ──────────────────────────────────────────────────

describe('collectPageIdsInSubtree', () => {
  it('returns the pageId of a single leaf', () => {
    expect(collectPageIdsInSubtree(folderNode('p1'))).toEqual(['p1']);
  });

  it('returns all pageIds inside a folder', () => {
    const ids = collectPageIdsInSubtree(folderNode('f1'));
    expect([...ids].toSorted((a, b) => a.localeCompare(b))).toEqual(['p2', 'p3']);
  });

  it('returns empty array for a folder with no pages', () => {
    const emptyFolder: TreeNode = { id: 'empty', name: 'Empty Folder', children: [] };
    expect(collectPageIdsInSubtree(emptyFolder)).toEqual([]);
  });
});

// ─── renameNode ───────────────────────────────────────────────────────────────

describe('renameNode', () => {
  it('renames a root-level node', () => {
    const updated = renameNode(root, 'p1', 'Renamed Page');
    expect(findNodeInRoot(updated, 'p1')?.name).toBe('Renamed Page');
  });

  it('renames a nested node', () => {
    const updated = renameNode(root, 'p2', 'Nested Rename');
    expect(findNodeInRoot(updated, 'p2')?.name).toBe('Nested Rename');
  });

  it('keeps old name when new name is empty', () => {
    const updated = renameNode(root, 'p1', '');
    expect(findNodeInRoot(updated, 'p1')?.name).toBe('Page 1');
  });

  it('does not mutate the original root', () => {
    renameNode(root, 'p1', 'Changed');
    expect(findNodeInRoot(root, 'p1')?.name).toBe('Page 1');
  });
});

// ─── removeNode ───────────────────────────────────────────────────────────────

describe('removeNode', () => {
  it('removes a root-level node', () => {
    const { root: updated } = removeNode(root, 'p1');
    expect(findNodeInRoot(updated, 'p1')).toBeNull();
    expect(updated.children).toHaveLength(2); // f1 + p4 remain
  });

  it('removes a nested node', () => {
    const { root: updated } = removeNode(root, 'p2');
    expect(findNodeInRoot(updated, 'p2')).toBeNull();
  });

  it('removes a folder and all its children', () => {
    const { root: updated } = removeNode(root, 'f1');
    expect(findNodeInRoot(updated, 'f1')).toBeNull();
    expect(findNodeInRoot(updated, 'p2')).toBeNull();
    expect(findNodeInRoot(updated, 'p3')).toBeNull();
  });

  it('returns the removed node', () => {
    const { removed } = removeNode(root, 'p1');
    expect(removed?.name).toBe('Page 1');
  });

  it('returns null as removed when node is not found', () => {
    const { removed } = removeNode(root, 'nonexistent');
    expect(removed).toBeNull();
  });

  it('does not mutate the original root', () => {
    removeNode(root, 'p1');
    expect(findNodeInRoot(root, 'p1')).not.toBeNull();
  });
});

// ─── addFileUnder ─────────────────────────────────────────────────────────────

describe('addFileUnder', () => {
  it('adds a page under the root', () => {
    const updated = addFileUnder(root, ROOT_ID, 'new-page', 'New Page');
    expect(findNodeInRoot(updated, 'new-page')?.name).toBe('New Page');
  });

  it('adds a page inside a folder', () => {
    const updated = addFileUnder(root, 'f1', 'nested-page', 'Nested Page');
    const node = findNodeInRoot(updated, 'nested-page');
    expect(node?.name).toBe('Nested Page');
    // It should be a child of f1
    const f1 = findNodeInRoot(updated, 'f1') as TreeNode & { children: TreeNode[] };
    expect(f1.children.some((c) => c.id === 'nested-page')).toBe(true);
  });

  it('uses "Untitled" when name is empty', () => {
    const updated = addFileUnder(root, ROOT_ID, 'no-name', '');
    expect(findNodeInRoot(updated, 'no-name')?.name).toBe('Untitled');
  });
});

// ─── addFolderUnder ───────────────────────────────────────────────────────────

describe('addFolderUnder', () => {
  it('adds a folder under root', () => {
    const updated = addFolderUnder(root, ROOT_ID, 'New Folder');
    // The folder uses a generated id, find by name
    const folder = updated.children.find((c) => c.name === 'New Folder');
    expect(folder).toBeDefined();
    expect(Array.isArray(folder?.children)).toBe(true);
  });

  it('adds a folder inside another folder', () => {
    const updated = addFolderUnder(root, 'f1', 'Sub Folder');
    const f1 = findNodeInRoot(updated, 'f1') as TreeNode & { children: TreeNode[] };
    const sub = f1.children.find((c) => c.name === 'Sub Folder');
    expect(sub).toBeDefined();
  });

  it('uses "New folder" when name is empty', () => {
    const updated = addFolderUnder(root, ROOT_ID, '');
    const folder = updated.children.find((c) => c.name === 'New folder');
    expect(folder).toBeDefined();
  });
});

// ─── moveNode ─────────────────────────────────────────────────────────────────

describe('moveNode', () => {
  it('moves a page into a folder', () => {
    const updated = moveNode(root, 'p1', 'f1');
    const f1 = findNodeInRoot(updated, 'f1') as TreeNode & { children: TreeNode[] };
    expect(f1.children.some((c) => c.id === 'p1')).toBe(true);
    // Should no longer be at root level
    expect(updated.children.some((c) => c.id === 'p1')).toBe(false);
  });

  it('does not duplicate the node', () => {
    const updated = moveNode(root, 'p2', ROOT_ID);
    const allIds: string[] = [];
    const walk = (nodes: TreeNode[]) => {
      nodes.forEach((n) => {
        allIds.push(n.id);
        if (Array.isArray(n.children)) walk(n.children);
      });
    };
    walk(updated.children);
    const p2Count = allIds.filter((id) => id === 'p2').length;
    expect(p2Count).toBe(1);
  });

  it('returns original root when moving a node to itself', () => {
    const updated = moveNode(root, 'p1', 'p1');
    expect(updated).toBe(root);
  });
});

describe('name scope helpers', () => {
  it('normalizes names with trim + lowercase', () => {
    expect(normalizeScopeName('  My Name  ')).toBe('my name');
  });

  it('detects duplicate names at root scope', () => {
    expect(isNameTakenInScope(root, ROOT_ID, ' page 1 ')).toBe(true);
  });

  it('detects duplicate names in nested folder scope', () => {
    expect(isNameTakenInScope(root, 'f1', 'page 2')).toBe(true);
  });

  it('ignores the excluded node id while checking duplicates', () => {
    expect(isNameTakenInScope(root, ROOT_ID, 'Page 1', 'p1')).toBe(false);
  });

  it('returns normalized sibling names set', () => {
    const names = getNormalizedSiblingNames(root, ROOT_ID);
    expect(names.has('page 1')).toBe(true);
    expect(names.has('folder 1')).toBe(true);
  });

  it('generates unique names with numeric suffix', () => {
    const duplicateRoot: TreeRoot = {
      id: ROOT_ID,
      name: 'root',
      children: [
        { id: 'a', name: 'Untitled', pageId: 'a' },
        { id: 'b', name: 'Untitled 2', pageId: 'b' },
      ],
    };
    expect(generateUniqueNameInScope(duplicateRoot, ROOT_ID, 'Untitled')).toBe('Untitled 3');
  });
});

describe('findFirstPageIdInSubtree', () => {
  it('returns first nested page id in depth-first order', () => {
    const node = findNodeInRoot(root, 'f1');
    expect(node).not.toBeNull();
    expect(findFirstPageIdInSubtree(node!)).toBe('p2');
  });

  it('returns null when subtree has no pages', () => {
    const emptyFolder: TreeNode = { id: 'empty', name: 'Empty', children: [] };
    expect(findFirstPageIdInSubtree(emptyFolder)).toBeNull();
  });
});

// ─── buildTreeRootFromApi ─────────────────────────────────────────────────────

describe('buildTreeRootFromApi', () => {
  it('returns emptyTreeRoot structure when given no folders/pages', () => {
    const result = buildTreeRootFromApi([], []);
    expect(result).toEqual(emptyTreeRoot);
  });

  it('places root-level pages directly under the root', () => {
    const pages = [
      { id: 'p1', title: 'Page 1' },
      { id: 'p2', title: 'Page 2' },
    ];
    const result = buildTreeRootFromApi([], pages);
    expect(result.children).toHaveLength(2);
    expect(result.children[0]).toMatchObject({ id: 'p1', name: 'Page 1', pageId: 'p1' });
    expect(result.children[1]).toMatchObject({ id: 'p2', name: 'Page 2', pageId: 'p2' });
  });

  it('nests pages under their folder', () => {
    const pages = [{ id: 'p1', title: 'Inside', folderId: 'f1' }];
    const folders = [{ id: 'f1', name: 'Folder A' }];
    const result = buildTreeRootFromApi(folders, pages);
    const folderNode = result.children.find((c) => c.id === 'f1');
    expect(folderNode).toBeDefined();
    expect(folderNode?.children).toHaveLength(1);
    expect(folderNode?.children?.[0]).toMatchObject({ id: 'p1', name: 'Inside', pageId: 'p1' });
    // Root should have no direct pages
    const rootPage = result.children.find((c) => c.id === 'p1');
    expect(rootPage).toBeUndefined();
  });

  it('handles nested folders (parent/child)', () => {
    const folders = [
      { id: 'parent', name: 'Parent' },
      { id: 'child', name: 'Child', parentId: 'parent' },
    ];
    const pages = [{ id: 'p1', title: 'Deep', folderId: 'child' }];
    const result = buildTreeRootFromApi(folders, pages);
    const parent = result.children.find((c) => c.id === 'parent');
    const child = parent?.children?.find((c) => c.id === 'child');
    expect(child).toBeDefined();
    expect(child?.children?.[0]).toMatchObject({ id: 'p1', pageId: 'p1' });
  });

  it('silently drops a page whose folderId references an unknown folder', () => {
    const pages = [{ id: 'p1', title: 'Orphan', folderId: 'non-existent' }];
    const result = buildTreeRootFromApi([], pages);
    // Page has a non-null folderId but no matching folder exists — it is dropped.
    expect(result.children).toHaveLength(0);
  });

  it('mixes root pages and folders in one result', () => {
    const folders = [{ id: 'f1', name: 'FolderX' }];
    const pages = [
      { id: 'p1', title: 'Root page' },
      { id: 'p2', title: 'Folder page', folderId: 'f1' },
    ];
    const result = buildTreeRootFromApi(folders, pages);
    const ids = result.children.map((c) => c.id);
    expect(ids).toContain('f1');
    expect(ids).toContain('p1');
    expect(ids).not.toContain('p2'); // nested, not at root
  });
});
