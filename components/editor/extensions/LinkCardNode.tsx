'use client';

/**
 * LinkCardNode — URL link card as a Tiptap node.
 *
 * Attrs: url (string), label (string), tags (string[])
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { useEditable } from '../EditableContext';
import { ExternalLink } from 'lucide-react';
import { BlockTagChips } from '../BlockTagChips';
import { BLOCK_ATOM_SPEC, BLOCK_NODE_WRAPPER_CLASS, blockStopEvent } from './nodeUtils';

// ─── Node View ────────────────────────────────────────────────────────────────

function LinkCardNodeView({ node, updateAttributes }: ReactNodeViewProps) {
  const { url, label, tags } = node.attrs as { url: string; label: string; tags: string[] };
  const isEditable = useEditable();
  const displayLabel = label || url || 'Link';

  return (
    <NodeViewWrapper className={BLOCK_NODE_WRAPPER_CLASS}>
      {/* Tags */}
      <BlockTagChips
        tags={tags ?? []}
        isEditable={isEditable}
        onChange={(t) => updateAttributes({ tags: t })}
        showEmpty={isEditable}
      />

      {isEditable ? (
        <div className="flex flex-col gap-2 p-3" onMouseDown={(e) => e.stopPropagation()}>
          <input
            type="url"
            value={url ?? ''}
            placeholder="URL…"
            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
            onChange={(e) => updateAttributes({ url: e.target.value })}
          />
          <input
            type="text"
            value={label ?? ''}
            placeholder="Label (optional)…"
            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
            onChange={(e) => updateAttributes({ label: e.target.value })}
          />
        </div>
      ) : url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-3 hover:bg-accent/30 transition-colors"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
            <ExternalLink size={14} className="text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">{displayLabel}</div>
            {label && <div className="truncate text-xs text-muted-foreground">{url}</div>}
          </div>
          <ExternalLink size={13} className="shrink-0 text-muted-foreground" />
        </a>
      ) : (
        <div className="p-3 text-sm text-muted-foreground">No URL set</div>
      )}
    </NodeViewWrapper>
  );
}

// ─── Node Definition ──────────────────────────────────────────────────────────

export const LinkCardNode = Node.create({
  name: 'linkCardNode',
  ...BLOCK_ATOM_SPEC,

  addAttributes() {
    return {
      url: { default: '' },
      label: { default: '' },
      tags: { default: [] },
    };
  },

  parseHTML() { return [{ tag: 'div[data-type="linkCardNode"]' }]; },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'linkCardNode' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(LinkCardNodeView, {
      stopEvent: blockStopEvent,
    });
  },
});
