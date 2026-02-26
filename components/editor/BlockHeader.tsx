'use client';

/**
 * BlockHeader — standard header row shared by all block node types.
 *
 * Renders: [icon] [title ── flex-1 ──] [optional actions]
 *
 * Used by: AudioNode, VideoNode, ImageNode, CodeBlockNode, TableBlockNode,
 * CanvasNode.  Checklist has a custom header (editable title input + counter).
 * LinkCard has no header.
 */

import type { ReactNode } from 'react';

type Props = {
  /** Icon element displayed on the left of the header. */
  icon: ReactNode;
  /** Human-readable block type label. */
  title: string;
  /** Optional right-side content: action buttons, selects, etc. */
  actions?: ReactNode;
};

export function BlockHeader({ icon, title, actions }: Readonly<Props>) {
  return (
    <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-1.5">
      {icon}
      <span className="flex-1 text-xs font-medium text-muted-foreground">{title}</span>
      {actions}
    </div>
  );
}
