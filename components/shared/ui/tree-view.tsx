/**
 * tree-view.tsx — recursive file/folder tree with drag-and-drop support.
 *
 * Built on Radix UI Accordion for expand/collapse behaviour and native HTML5
 * drag-and-drop for reordering nodes.
 *
 * ─── LAYOUT MODEL ─────────────────────────────────────────────────────────────
 *
 * Each tree row has three zones:
 *
 *   [indent] [chevron OR spacer] [icon + name  ←→  flex-1] [actions on hover]
 *
 *   - Indent: AccordionContent adds `ml-4` per nesting level (via `border-l`).
 *   - Chevron (16px) is shown for folders; a same-size invisible spacer is shown
 *     for files so icon columns align across both types at the same depth.
 *   - Actions (create file, create folder, delete) appear on hover via the
 *     `group/row` Tailwind group.
 *
 * ─── HOVER HIGHLIGHT ──────────────────────────────────────────────────────────
 *
 * The row uses a CSS `::before` pseudo-element for the hover background instead
 * of `hover:bg-accent` on the row element itself. Why?
 *   `before:left-0 before:w-full` makes the highlight span the FULL container
 *   width (edge to edge), regardless of the row's own padding/indent. This
 *   matches VS Code's file-explorer highlight behaviour.
 *
 * ─── IMPROVEMENT IDEAS ────────────────────────────────────────────────────────
 *   - Add keyboard arrow-key navigation (↑/↓ move focus, ←/→ collapse/expand).
 *   - Add right-click context menu (rename, delete, duplicate).
 *   - Show item count badges on folder rows.
 *   - Add colour dots or emoji icons per page for quick visual scanning.
 */
import React from 'react';

import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

// ─── Shared row styles ────────────────────────────────────────────────────────

/**
 * Base classes applied to every tree row (both folders and files).
 *
 * `group/row` — scoped Tailwind group so `group-hover/row:` selectors activate
 *   only when THIS row is hovered, not a parent row.
 *
 * `before:` pseudo-element — full-width hover/select highlight that sits below
 *   the row content (`before:-z-10`) so icons and text remain visible.
 */
/**
 * `group` (unscoped) is kept alongside `group/row` (scoped) for backward
 * compatibility with child components that use `group-hover:` (unscoped).
 * The scoped `group/row` variant is used internally in tree-view for
 * `group-hover/row:flex` on the actions slot.
 */
const ROW_BASE =
  'motion-interactive group group/row relative flex w-full cursor-pointer items-center rounded-sm py-1 pl-2 pr-1 text-left text-sm ' +
  'before:absolute before:inset-y-0 before:left-0 before:right-0 before:-z-10 before:rounded-sm before:opacity-0 ' +
  'hover:before:bg-accent/70 hover:before:opacity-100 ' +
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

const ROW_SELECTED = 'before:bg-accent/70 before:opacity-100 text-accent-foreground font-medium';
const ROW_DRAG_OVER = 'ring-1 ring-primary/60 before:bg-primary/15 before:opacity-100';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface TreeDataItem {
  id: string;
  name: string;
  icon?: React.ComponentType<{ className?: string }>;
  selectedIcon?: React.ComponentType<{ className?: string }>;
  openIcon?: React.ComponentType<{ className?: string }>;
  children?: TreeDataItem[];
  actions?: React.ReactNode;
  onClick?: () => void;
  draggable?: boolean;
  droppable?: boolean;
  disabled?: boolean;
  className?: string;
}

export type TreeRenderItemParams = {
  item: TreeDataItem;
  level: number;
  isLeaf: boolean;
  isSelected: boolean;
  isOpen?: boolean;
  hasChildren: boolean;
};

type TreeProps = React.HTMLAttributes<HTMLDivElement> & {
  data: TreeDataItem[] | TreeDataItem;
  initialSelectedItemId?: string;
  selectedItemId?: string;
  expandedItemIds?: string[];
  onSelectChange?: (item: TreeDataItem | undefined) => void;
  expandAll?: boolean;
  defaultNodeIcon?: React.ComponentType<{ className?: string }>;
  defaultLeafIcon?: React.ComponentType<{ className?: string }>;
  onDocumentDrag?: (sourceItem: TreeDataItem, targetItem: TreeDataItem) => void;
  renderItem?: (params: TreeRenderItemParams) => React.ReactNode;
  rootDropLabel?: string;
};

// ─── TreeView (root) ──────────────────────────────────────────────────────────

export const TreeView = React.forwardRef<HTMLDivElement, TreeProps>(
  (
    {
      data,
      initialSelectedItemId,
      selectedItemId: controlledSelectedItemId,
      expandedItemIds: controlledExpandedItemIds,
      onSelectChange,
      expandAll,
      defaultLeafIcon,
      defaultNodeIcon,
      className,
      onDocumentDrag,
      renderItem,
      rootDropLabel = 'Drop here to move to root',
      ...props
    },
    ref,
  ) => {
    const [selectedItemId, setSelectedItemId] = React.useState<string | undefined>(
      controlledSelectedItemId ?? initialSelectedItemId,
    );
    const [draggedItem, setDraggedItem] = React.useState<TreeDataItem | null>(null);

    React.useEffect(() => {
      setSelectedItemId(controlledSelectedItemId ?? undefined);
    }, [controlledSelectedItemId]);

    const handleSelectChange = React.useCallback(
      (item: TreeDataItem | undefined) => {
        setSelectedItemId(item?.id);
        onSelectChange?.(item);
      },
      [onSelectChange],
    );

    const handleDragStart = React.useCallback((item: TreeDataItem) => {
      setDraggedItem(item);
    }, []);

    const handleDragEnd = React.useCallback(() => {
      setDraggedItem(null);
    }, []);

    const handleDrop = React.useCallback(
      (targetItem: TreeDataItem) => {
        if (draggedItem && onDocumentDrag && draggedItem.id !== targetItem.id) {
          onDocumentDrag(draggedItem, targetItem);
        }
        setDraggedItem(null);
      },
      [draggedItem, onDocumentDrag],
    );

    /**
     * Pre-compute which accordion items should be open on first render.
     *
     * Walks the tree to find the path to `initialSelectedItemId` and collects
     * all ancestor ids — these should be expanded to reveal the selected item.
     */
    const expandedItemIds = React.useMemo(() => {
      if (controlledExpandedItemIds) return controlledExpandedItemIds;
      if (!initialSelectedItemId) return [] as string[];
      const ids: string[] = [];

      function walk(items: TreeDataItem[] | TreeDataItem, targetId: string): boolean {
        if (Array.isArray(items)) {
          for (const item of items) {
            ids.push(item.id);
            if (walk(item, targetId) && !expandAll) return true;
            if (!expandAll) ids.pop();
          }
        } else if (!expandAll && items.id === targetId) {
          return true;
        } else if (items.children) {
          return walk(items.children, targetId);
        }
        return false;
      }

      walk(data, initialSelectedItemId);
      return ids;
    }, [controlledExpandedItemIds, data, expandAll, initialSelectedItemId]);

    return (
      <div className={cn('relative overflow-hidden p-2', draggedItem && 'is-dragging', className)}>
        <TreeItem
          data={data}
          ref={ref}
          selectedItemId={selectedItemId}
          handleSelectChange={handleSelectChange}
          expandedItemIds={expandedItemIds}
          defaultLeafIcon={defaultLeafIcon}
          defaultNodeIcon={defaultNodeIcon}
          handleDragStart={handleDragStart}
          handleDragEnd={handleDragEnd}
          handleDrop={handleDrop}
          draggedItem={draggedItem}
          renderItem={renderItem}
          level={0}
          {...props}
        />

        {/**
         * Root drop zone — visible (with dashed border + label) only while
         * dragging. Uses the `[.is-dragging_&]:` ancestor-state selector so
         * the zone only activates when a drag is in progress.
         */}
        <div
          data-drop-target="root"
          className="text-muted-foreground in-[.is-dragging]:border-primary/50 in-[.is-dragging]:bg-primary/10 in-[.is-dragging]:text-foreground mt-1 min-h-10 w-full rounded-md border-2 border-dashed border-transparent bg-transparent px-2 py-2 text-center text-xs transition-colors"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDrop({ id: '__root_drop__', name: 'Move to root' });
          }}
        >
          {draggedItem ? rootDropLabel : null}
        </div>
      </div>
    );
  },
);
TreeView.displayName = 'TreeView';

// ─── TreeItem (dispatcher) ────────────────────────────────────────────────────

type TreeItemProps = TreeProps & {
  selectedItemId?: string;
  handleSelectChange: (item: TreeDataItem | undefined) => void;
  expandedItemIds: string[];
  defaultNodeIcon?: React.ComponentType<{ className?: string }>;
  defaultLeafIcon?: React.ComponentType<{ className?: string }>;
  handleDragStart?: (item: TreeDataItem) => void;
  handleDragEnd?: () => void;
  handleDrop?: (item: TreeDataItem) => void;
  draggedItem: TreeDataItem | null;
  level?: number;
};

const TreeItem = React.forwardRef<HTMLDivElement, TreeItemProps>(
  (
    {
      className,
      data,
      selectedItemId,
      handleSelectChange,
      expandedItemIds,
      defaultNodeIcon,
      defaultLeafIcon,
      handleDragStart,
      handleDragEnd,
      handleDrop,
      draggedItem,
      renderItem,
      level,
      // Consume props that shouldn't be spread onto a DOM element
      onSelectChange: _onSelectChange,
      expandAll: _expandAll,
      initialSelectedItemId: _initialSelectedItemId,
      onDocumentDrag: _onDocumentDrag,
      rootDropLabel: _rootDropLabel,
      ...props
    },
    ref,
  ) => {
    const items = Array.isArray(data) ? data : [data];
    return (
      <div ref={ref} role="tree" className={className} {...props}>
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              {item.children ? (
                <TreeNode
                  item={item}
                  level={level ?? 0}
                  selectedItemId={selectedItemId}
                  expandedItemIds={expandedItemIds}
                  handleSelectChange={handleSelectChange}
                  defaultNodeIcon={defaultNodeIcon}
                  defaultLeafIcon={defaultLeafIcon}
                  handleDragStart={handleDragStart}
                  handleDragEnd={handleDragEnd}
                  handleDrop={handleDrop}
                  draggedItem={draggedItem}
                  renderItem={renderItem}
                />
              ) : (
                <TreeLeaf
                  item={item}
                  level={level ?? 0}
                  selectedItemId={selectedItemId}
                  handleSelectChange={handleSelectChange}
                  defaultLeafIcon={defaultLeafIcon}
                  handleDragStart={handleDragStart}
                  handleDragEnd={handleDragEnd}
                  handleDrop={handleDrop}
                  draggedItem={draggedItem}
                  renderItem={renderItem}
                />
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  },
);
TreeItem.displayName = 'TreeItem';

// ─── TreeNode (folder) ────────────────────────────────────────────────────────

const TreeNode = ({
  item,
  handleSelectChange,
  expandedItemIds,
  selectedItemId,
  defaultNodeIcon,
  defaultLeafIcon,
  handleDragStart,
  handleDragEnd,
  handleDrop,
  draggedItem,
  renderItem,
  level = 0,
}: {
  item: TreeDataItem;
  handleSelectChange: (item: TreeDataItem | undefined) => void;
  expandedItemIds: string[];
  selectedItemId?: string;
  defaultNodeIcon?: React.ComponentType<{ className?: string }>;
  defaultLeafIcon?: React.ComponentType<{ className?: string }>;
  handleDragStart?: (item: TreeDataItem) => void;
  handleDragEnd?: () => void;
  handleDrop?: (item: TreeDataItem) => void;
  draggedItem: TreeDataItem | null;
  renderItem?: (params: TreeRenderItemParams) => React.ReactNode;
  level?: number;
}) => {
  const [value, setValue] = React.useState(expandedItemIds.includes(item.id) ? [item.id] : []);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const hasChildren = !!item.children?.length;
  const isSelected = selectedItemId === item.id;
  const isOpen = value.includes(item.id);

  React.useEffect(() => {
    if (expandedItemIds.includes(item.id)) {
      setValue([item.id]);
    }
  }, [expandedItemIds, item.id]);

  const onDragStart = (e: React.DragEvent) => {
    if (!item.draggable) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', item.id);
    handleDragStart?.(item);
  };

  const onDragOver = (e: React.DragEvent) => {
    if (item.droppable !== false && draggedItem && draggedItem.id !== item.id) {
      e.preventDefault();
      setIsDragOver(true);
    }
  };

  return (
    <AccordionPrimitive.Root type="multiple" value={value} onValueChange={setValue}>
      <AccordionPrimitive.Item value={item.id} data-radix-accordion-item="">
        <AccordionPrimitive.Header>
          <AccordionPrimitive.Trigger
            className={cn(
              ROW_BASE,
              isSelected && ROW_SELECTED,
              isDragOver && ROW_DRAG_OVER,
              item.className,
            )}
            onClick={() => {
              handleSelectChange(item);
              item.onClick?.();
            }}
            draggable={!!item.draggable}
            onDragStart={onDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={onDragOver}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              handleDrop?.(item);
            }}
          >
            {/**
             * Chevron icon — rotates 90° when the accordion is open.
             *
             * WHY `data-[state=open]:rotate-90` on the svg?
             *   Radix Accordion sets `data-state="open"` on the Trigger element.
             *   We target the svg as a direct child with `[&>svg]:` and read the
             *   trigger's own data-state attribute. This is cleaner than the
             *   previous `first:[&[data-state=open]>svg]:first-of-type:rotate-90`
             *   selector which was fragile and didn't work reliably.
             */}
            <ChevronRight
              className={cn(
                'text-muted-foreground/60 mr-1 h-4 w-4 shrink-0 transition-transform duration-200 ease-out',
                isOpen && 'rotate-90',
              )}
            />
            {renderItem ? (
              renderItem({ item, level, isLeaf: false, isSelected, isOpen, hasChildren })
            ) : (
              <>
                <TreeIcon
                  item={item}
                  isOpen={isOpen}
                  isSelected={isSelected}
                  default={defaultNodeIcon}
                />
                <span className="flex-1 truncate text-sm">{item.name}</span>
                {item.actions && (
                  // `flex opacity-0 group-hover/row:opacity-100` keeps the actions in
                  // layout flow at all times so showing them on hover doesn't push
                  // the folder name left (no layout shift).
                  <span className="ml-auto flex shrink-0 opacity-0 transition-opacity group-hover/row:opacity-100">
                    {item.actions}
                  </span>
                )}
              </>
            )}
          </AccordionPrimitive.Trigger>
        </AccordionPrimitive.Header>

        <AccordionPrimitive.Content className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down motion-reduce:animate-none">
          {/**
           * Children container.
           *
           * `ml-3` indents the children relative to the parent row.
           * `border-l border-border/40` draws the vertical tree guide line.
           * `pl-1` gives a small gap between the guide line and child items.
           */}
          <div className="border-border/40 ml-3 border-l pb-1 pl-1">
            <TreeItem
              data={item.children ? item.children : item}
              selectedItemId={selectedItemId}
              handleSelectChange={handleSelectChange}
              expandedItemIds={expandedItemIds}
              defaultLeafIcon={defaultLeafIcon}
              defaultNodeIcon={defaultNodeIcon}
              handleDragStart={handleDragStart}
              handleDragEnd={handleDragEnd}
              handleDrop={handleDrop}
              draggedItem={draggedItem}
              renderItem={renderItem}
              level={level + 1}
            />
            {/* Empty folder hint */}
            {!hasChildren && (
              <p className="text-muted-foreground/50 py-1 pl-2 text-xs italic">Empty folder</p>
            )}
          </div>
        </AccordionPrimitive.Content>
      </AccordionPrimitive.Item>
    </AccordionPrimitive.Root>
  );
};

// ─── TreeLeaf (file/page) ─────────────────────────────────────────────────────

export const TreeLeaf = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    item: TreeDataItem;
    level: number;
    selectedItemId?: string;
    handleSelectChange: (item: TreeDataItem | undefined) => void;
    defaultLeafIcon?: React.ComponentType<{ className?: string }>;
    handleDragStart?: (item: TreeDataItem) => void;
    handleDragEnd?: () => void;
    handleDrop?: (item: TreeDataItem) => void;
    draggedItem: TreeDataItem | null;
    renderItem?: (params: TreeRenderItemParams) => React.ReactNode;
  }
>(
  (
    {
      className,
      item,
      level,
      selectedItemId,
      handleSelectChange,
      defaultLeafIcon,
      handleDragStart,
      handleDragEnd,
      handleDrop,
      draggedItem,
      renderItem,
      ...props
    },
    ref,
  ) => {
    const [isDragOver, setIsDragOver] = React.useState(false);
    const isSelected = selectedItemId === item.id;

    const onDragStart = (e: React.DragEvent) => {
      if (!item.draggable || item.disabled) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData('text/plain', item.id);
      handleDragStart?.(item);
    };

    const onDragOver = (e: React.DragEvent) => {
      if (item.droppable !== false && !item.disabled && draggedItem && draggedItem.id !== item.id) {
        e.preventDefault();
        setIsDragOver(true);
      }
    };

    return (
      <div
        ref={ref}
        role="treeitem"
        data-radix-accordion-item=""
        tabIndex={item.disabled ? -1 : 0}
        aria-selected={isSelected}
        className={cn(
          ROW_BASE,
          /**
           * WHY no ml-5 here?
           *   The previous code had `ml-5` hardcoded which shifted ALL file rows
           *   20 px right regardless of depth. At root level this misaligned files
           *   with folders (folders have no extra margin). At deeper levels it
           *   double-indented files (AccordionContent already adds ml-3).
           *
           *   Depth indentation comes from the parent AccordionContent's `ml-3`.
           *   Within the row itself, the spacer below provides the same horizontal
           *   offset as a folder's chevron, keeping icon columns aligned.
           */
          isSelected && ROW_SELECTED,
          isDragOver && ROW_DRAG_OVER,
          item.disabled && 'cursor-not-allowed opacity-50',
          item.className,
          className,
        )}
        onClick={() => {
          if (!item.disabled) {
            handleSelectChange(item);
            item.onClick?.();
          }
        }}
        draggable={!!item.draggable && !item.disabled}
        onDragStart={onDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={onDragOver}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          if (item.disabled) return;
          e.preventDefault();
          setIsDragOver(false);
          handleDrop?.(item);
        }}
        {...props}
      >
        {/**
         * Spacer — same size as the ChevronRight in `TreeNode`.
         *
         * WHY a spacer and not a chevron?
         *   Leaf nodes (files) don't expand, so showing a chevron would be
         *   misleading. An invisible spacer of identical width keeps the icon
         *   column aligned with folder rows at the same depth.
         */}
        <span className="mr-1 h-4 w-4 shrink-0" aria-hidden />

        {renderItem ? (
          renderItem({ item, level, isLeaf: true, isSelected, hasChildren: false })
        ) : (
          <>
            <TreeIcon item={item} isSelected={isSelected} default={defaultLeafIcon} />
            <span className="flex-1 truncate text-sm">{item.name}</span>
            {item.actions && (
              <span className="ml-auto flex shrink-0 opacity-0 transition-opacity group-hover/row:opacity-100">
                {item.actions}
              </span>
            )}
          </>
        )}
      </div>
    );
  },
);
TreeLeaf.displayName = 'TreeLeaf';

// ─── TreeIcon ─────────────────────────────────────────────────────────────────

/**
 * Renders the appropriate icon for a tree item based on its state.
 *
 * Priority: selectedIcon > openIcon > icon > defaultIcon.
 * Falls back to nothing if no icon is provided.
 */
const TreeIcon = ({
  item,
  isOpen,
  isSelected,
  default: DefaultIcon,
}: {
  item: TreeDataItem;
  isOpen?: boolean;
  isSelected?: boolean;
  default?: React.ComponentType<{ className?: string }>;
}) => {
  let Icon: React.ComponentType<{ className?: string }> | undefined = DefaultIcon;
  if (isSelected && item.selectedIcon) Icon = item.selectedIcon;
  else if (isOpen && item.openIcon) Icon = item.openIcon;
  else if (item.icon) Icon = item.icon;

  return Icon ? <Icon className="text-muted-foreground mr-2 h-4 w-4 shrink-0" /> : null;
};

export { TreeItem, TreeNode };
