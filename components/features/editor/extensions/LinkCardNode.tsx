'use client';

/**
 * LinkCardNode — URL link card as a Tiptap node.
 *
 * Attrs: url (string), label (string), tags (string[])
 */
import { mergeAttributes, Node } from '@tiptap/core';
import { NodeViewWrapper, type ReactNodeViewProps, ReactNodeViewRenderer } from '@tiptap/react';
import { ExternalLink } from 'lucide-react';

import { BlockTagChips } from '../BlockTagChips';
import { useEditable } from '../EditableContext';
import { BLOCK_ATOM_SPEC, BLOCK_NODE_WRAPPER_CLASS, blockStopEvent } from './nodeUtils';

// ─── Node View ────────────────────────────────────────────────────────────────

function LinkCardNodeView({ node, updateAttributes }: ReactNodeViewProps) {
  const { url, label, tags } = node.attrs as { url: string; label: string; tags: string[] };
  const isEditable = useEditable();
  const displayLabel = label || url || 'Link';

  const readonlyContent = url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="motion-interactive hover:bg-accent/30 flex items-center gap-3 p-3 transition-colors"
    >
      <div className="border-border bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border">
        <ExternalLink size={14} className="text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-foreground truncate text-sm font-medium">{displayLabel}</div>
        {label && <div className="text-muted-foreground truncate text-xs">{url}</div>}
      </div>
      <ExternalLink size={13} className="text-muted-foreground shrink-0" />
    </a>
  ) : (
    <div className="text-muted-foreground p-3 text-sm">No URL set</div>
  );

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
            className="border-border bg-background text-foreground focus:ring-ring w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-1"
            onChange={(e) => updateAttributes({ url: e.target.value })}
          />
          <input
            type="text"
            value={label ?? ''}
            placeholder="Label (optional)…"
            className="border-border bg-background text-foreground focus:ring-ring w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-1"
            onChange={(e) => updateAttributes({ label: e.target.value })}
          />
        </div>
      ) : (
        readonlyContent
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

  parseHTML() {
    return [{ tag: 'div[data-type="linkCardNode"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'linkCardNode' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(LinkCardNodeView, {
      stopEvent: blockStopEvent,
    });
  },
});
