'use client';

/**
 * AudioNode — audio player block as a Tiptap node.
 *
 * Attrs: url (string), caption (string), tags (string[])
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { useEditable } from '../EditableContext';
import { Volume2 } from 'lucide-react';
import { BlockTagChips } from '../BlockTagChips';
import { BlockHeader } from '../BlockHeader';
import { BLOCK_ATOM_SPEC, BLOCK_NODE_WRAPPER_CLASS, blockStopEvent } from './nodeUtils';

// ─── Node View ────────────────────────────────────────────────────────────────

function AudioNodeView({ node, updateAttributes }: ReactNodeViewProps) {
  const { url, caption, tags } = node.attrs as { url: string; caption: string; tags: string[] };
  const isEditable = useEditable();

  return (
    <NodeViewWrapper className={BLOCK_NODE_WRAPPER_CLASS}>
      <BlockHeader icon={<Volume2 size={13} className="text-muted-foreground" />} title="Audio" />

      {/* Tags */}
      <BlockTagChips
        tags={tags ?? []}
        isEditable={isEditable}
        onChange={(t) => updateAttributes({ tags: t })}
        showEmpty={isEditable}
      />

      <div className="p-4" onMouseDown={(e) => e.stopPropagation()}>
        {/* URL input (edit mode) */}
        {isEditable && (
          <input
            type="url"
            value={url ?? ''}
            placeholder="Audio URL (mp3, ogg, etc.)…"
            className="mb-3 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
            onChange={(e) => updateAttributes({ url: e.target.value })}
          />
        )}

        {/* Player */}
        {url ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <audio controls className="w-full" src={url} />
        ) : (
          <div className="flex h-16 items-center justify-center rounded-lg border-2 border-dashed border-border">
            <p className="text-sm text-muted-foreground">Enter an audio URL above</p>
          </div>
        )}

        {/* Caption */}
        {isEditable && (
          <input
            type="text"
            value={caption ?? ''}
            placeholder="Caption (optional)…"
            className="mt-2 w-full bg-transparent text-xs text-muted-foreground outline-none placeholder:text-muted-foreground/50"
            onChange={(e) => updateAttributes({ caption: e.target.value })}
          />
        )}
        {!isEditable && caption && (
          <p className="mt-2 text-xs text-muted-foreground">{caption}</p>
        )}
      </div>
    </NodeViewWrapper>
  );
}

// ─── Node Definition ──────────────────────────────────────────────────────────

export const AudioNode = Node.create({
  name: 'audioNode',
  ...BLOCK_ATOM_SPEC,

  addAttributes() {
    return {
      url: { default: '' },
      caption: { default: '' },
      tags: { default: [] },
    };
  },

  parseHTML() { return [{ tag: 'div[data-type="audioNode"]' }]; },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'audioNode' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(AudioNodeView, {
      stopEvent: blockStopEvent,
    });
  },
});
