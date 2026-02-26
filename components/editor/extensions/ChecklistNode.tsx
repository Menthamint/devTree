'use client';

/**
 * ChecklistNode — interactive checklist / agenda as a Tiptap node.
 *
 * Attrs: title (string), items ({ id, text, checked }[]), tags (string[])
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { useEditable } from '../EditableContext';
import { CheckSquare, GripVertical, Plus, Trash2 } from 'lucide-react';
import { BlockTagChips } from '../BlockTagChips';
import { BLOCK_ATOM_SPEC, BLOCK_NODE_WRAPPER_CLASS, blockStopEvent } from './nodeUtils';
import { cn } from '@/lib/utils';

type CheckItem = { id: string; text: string; checked: boolean };

// ─── Node View ────────────────────────────────────────────────────────────────

function ChecklistNodeView({ node, updateAttributes }: ReactNodeViewProps) {
  const { title, items, tags } = node.attrs as { title: string; items: CheckItem[]; tags: string[] };
  const isEditable = useEditable();
  const safeItems: CheckItem[] = Array.isArray(items) ? items : [];

  const total = safeItems.length;
  const done = safeItems.filter((i) => i.checked).length;

  const updateItems = (next: CheckItem[]) => updateAttributes({ items: next });

  const toggleItem = (id: string) =>
    updateItems(safeItems.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));

  const addItem = () =>
    updateItems([...safeItems, { id: crypto.randomUUID(), text: '', checked: false }]);

  const deleteItem = (id: string) => updateItems(safeItems.filter((i) => i.id !== id));

  const updateText = (id: string, text: string) =>
    updateItems(safeItems.map((i) => (i.id === id ? { ...i, text } : i)));

  return (
    <NodeViewWrapper className={BLOCK_NODE_WRAPPER_CLASS}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-1.5">
        <CheckSquare size={13} className="text-muted-foreground" />
        {isEditable ? (
          <input
            type="text"
            value={title ?? ''}
            placeholder="Checklist title…"
            className="flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/50"
            onChange={(e) => updateAttributes({ title: e.target.value })}
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 text-sm font-medium text-foreground">{title || 'Checklist'}</span>
        )}
        {total > 0 && (
          <span className="text-xs text-muted-foreground">{done}/{total}</span>
        )}
      </div>

      {/* Tags */}
      <BlockTagChips
        tags={tags ?? []}
        isEditable={isEditable}
        onChange={(t) => updateAttributes({ tags: t })}
        showEmpty={isEditable}
      />

      {/* Progress bar */}
      {total > 0 && (
        <div className="h-1 w-full bg-muted">
          <div
            className="h-1 bg-indigo-500 transition-all"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
      )}

      {/* Items */}
      <div className="divide-y divide-border" onMouseDown={(e) => e.stopPropagation()}>
        {safeItems.map((item) => (
          <div key={item.id} className="flex items-center gap-2 px-3 py-2">
            {isEditable && <GripVertical size={13} className="shrink-0 cursor-grab text-muted-foreground/40" />}
            <input
              type="checkbox"
              checked={item.checked}
              onChange={() => toggleItem(item.id)}
              className="h-4 w-4 shrink-0 rounded accent-indigo-600"
            />
            {isEditable ? (
              <input
                type="text"
                value={item.text}
                placeholder="Item…"
                className={cn(
                  'flex-1 bg-transparent text-sm outline-none',
                  item.checked ? 'text-muted-foreground line-through' : 'text-foreground',
                )}
                onChange={(e) => updateText(item.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addItem(); }
                  if (e.key === 'Backspace' && item.text === '') { e.preventDefault(); deleteItem(item.id); }
                }}
              />
            ) : (
              <span className={cn('flex-1 text-sm', item.checked ? 'text-muted-foreground line-through' : 'text-foreground')}>
                {item.text}
              </span>
            )}
            {isEditable && (
              <button type="button" onClick={() => deleteItem(item.id)}
                className="shrink-0 text-muted-foreground/40 hover:text-destructive">
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add item footer */}
      {isEditable && (
        <div className="border-t border-border px-3 py-1.5">
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Plus size={12} /> Add item
          </button>
        </div>
      )}
    </NodeViewWrapper>
  );
}

// ─── Node Definition ──────────────────────────────────────────────────────────

export const ChecklistNode = Node.create({
  name: 'checklistNode',
  ...BLOCK_ATOM_SPEC,

  addAttributes() {
    return {
      title: { default: '' },
      items: { default: [] },
      tags: { default: [] },
    };
  },

  parseHTML() { return [{ tag: 'div[data-type="checklistNode"]' }]; },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'checklistNode' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ChecklistNodeView, {
      stopEvent: blockStopEvent,
    });
  },
});
