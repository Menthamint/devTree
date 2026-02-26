'use client';

/**
 * VideoNode — YouTube/video embed as a Tiptap node.
 *
 * Attrs: url (string), tags (string[])
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { useEditable } from '../EditableContext';
import { Video } from 'lucide-react';
import { BlockTagChips } from '../BlockTagChips';
import { BlockHeader } from '../BlockHeader';
import { BLOCK_ATOM_SPEC, BLOCK_NODE_WRAPPER_CLASS, blockStopEvent } from './nodeUtils';

/** Convert YouTube watch URL to an embed URL; pass through other URLs unchanged. */
function toEmbedUrl(url: string): string {
  try {
    const u = new URL(url);
    const allowedYouTubeHosts = new Set([
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
      'youtu.be',
    ]);
    if (allowedYouTubeHosts.has(u.hostname)) {
      const videoId =
        u.searchParams.get('v') ??
        (u.hostname === 'youtu.be' ? u.pathname.slice(1) : null);
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }
    return url;
  } catch {
    return url;
  }
}

// ─── Node View ────────────────────────────────────────────────────────────────

function VideoNodeView({ node, updateAttributes }: ReactNodeViewProps) {
  const { url, tags } = node.attrs as { url: string; tags: string[] };
  const isEditable = useEditable();
  const embedUrl = url ? toEmbedUrl(url) : '';

  return (
    <NodeViewWrapper className={BLOCK_NODE_WRAPPER_CLASS}>
      <BlockHeader icon={<Video size={13} className="text-muted-foreground" />} title="Video" />

      {/* Tags */}
      <BlockTagChips
        tags={tags ?? []}
        isEditable={isEditable}
        onChange={(t) => updateAttributes({ tags: t })}
        showEmpty={isEditable}
      />

      <div className="p-4" onMouseDown={(e) => e.stopPropagation()}>
        {isEditable && (
          <input
            type="url"
            value={url ?? ''}
            placeholder="YouTube or video URL…"
            className="mb-3 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
            onChange={(e) => updateAttributes({ url: e.target.value })}
          />
        )}
        {embedUrl ? (
          <div className="relative overflow-hidden rounded-lg" style={{ paddingBottom: '56.25%' }}>
            <iframe
              src={embedUrl}
              title="Video"
              data-testid="video-block-iframe"
              className="absolute inset-0 h-full w-full"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-border">
            <p className="text-sm text-muted-foreground">Enter a video URL above</p>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

// ─── Node Definition ──────────────────────────────────────────────────────────

export const VideoNode = Node.create({
  name: 'videoNode',
  ...BLOCK_ATOM_SPEC,

  addAttributes() {
    return {
      url: { default: '' },
      tags: { default: [] },
    };
  },

  parseHTML() { return [{ tag: 'div[data-type="videoNode"]' }]; },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'videoNode' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(VideoNodeView, {
      stopEvent: blockStopEvent,
    });
  },
});
