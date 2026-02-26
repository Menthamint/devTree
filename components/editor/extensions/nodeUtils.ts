/**
 * nodeUtils — shared configuration constants for Tiptap atom block nodes.
 *
 * All eight custom block types (Canvas, Code, Checklist, Table, Audio, Video,
 * Image, LinkCard) share identical low-level Tiptap node settings.
 * Centralising them here prevents drift when the spec changes and makes each
 * extension file shorter and easier to read.
 */

/** Tailwind className applied to every block NodeViewWrapper. */
export const BLOCK_NODE_WRAPPER_CLASS =
  'my-2 rounded-xl border border-border bg-card overflow-hidden';

/**
 * Shared Tiptap node spec properties common to all custom atom block nodes.
 * Spread into `Node.create({ name: '…', ...BLOCK_ATOM_SPEC, … })`.
 */
export const BLOCK_ATOM_SPEC = {
  group: 'block',
  atom: true,
  draggable: false,
  selectable: true,
} as const;

/**
 * stopEvent handler used by every ReactNodeViewRenderer.
 *
 * Returns `false` for drag events so ProseMirror can handle block reordering
 * via the global drag handle. Returns `true` for all other native events,
 * preventing them from leaking into the editor's key/click handlers.
 */
export const blockStopEvent = ({ event }: { event: Event }): boolean =>
  !event.type.startsWith('drag');
