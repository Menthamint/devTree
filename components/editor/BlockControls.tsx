'use client';

/**
 * BlockControls — drag grip + block-action menu + "+" block-picker launcher.
 *
 * HOW IT WORKS
 * ─────────────
 * `tiptap-extension-global-drag-handle` creates its own `.drag-handle` div and
 * appends it to `editor.view.dom.parentElement`. It moves the div and shows/
 * hides it by manipulating `style.left/top` and the `.hide` CSS class.
 *
 * We find that element AFTER the editor mounts and portal our React buttons
 * INTO it (createPortal). The library retains full control of position and
 * visibility while we own the inner UI.
 *
 * Layout (column): [ ⠿ ]   ← grip / block-action menu
 *                  [ + ]   ← block-picker popup
 *
 * ⠿  → draggable (drag-and-drop) OR click to open block-action dropdown.
 * +  → inserts a paragraph below and opens a block-picker popup.
 *      The picker shows all block types; selecting one replaces the paragraph.
 *      No "/" is inserted into the document.
 *
 * Both dropdowns auto-flip above when near viewport bottom; close on outside
 * pointer-down (capture phase) or Escape.
 */

import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/core';
import { ArrowUp, ArrowDown, Copy, Plus, Search, Trash2, GripVertical, X } from 'lucide-react';

import { SLASH_ITEMS, type SlashCommandItem } from './extensions/SlashCommand';
import { cn } from '@/lib/utils';

const MENU_WIDTH = 192;
const MENU_HEIGHT_ESTIMATE = 172;
const PICKER_WIDTH = 260;
const PICKER_HEIGHT_ESTIMATE = 380;

// Human-readable label for each block type — used in the drag ghost pill.
function nodeTypeToLabel(typeName: string): string {
  const map: Record<string, string> = {
    paragraph: 'Text', heading: 'Heading', bulletList: 'List',
    orderedList: 'List', blockquote: 'Quote', codeBlock: 'Code',
    horizontalRule: 'Divider', codeBlockNode: 'Code', checklistNode: 'Checklist',
    canvasNode: 'Canvas', audioNode: 'Audio', videoNode: 'Video',
    imageNode: 'Image', linkCardNode: 'Link', tableBlockNode: 'Table',
  };
  return map[typeName] ?? 'Block';
}

// ── Types ─────────────────────────────────────────────────────────────────────

type MenuAnchor = {
  /** Fixed viewport x-coordinate for the menu */
  x: number;
  /** Fixed viewport y-coordinate for the menu */
  y: number;
  /** ProseMirror position of the hovered block */
  nodePos: number;
  /** Open above the anchor (true) or below (false) */
  openAbove: boolean;
};

type BlockPickerAnchor = {
  x: number;
  y: number;
  openAbove: boolean;
  /** ProseMirror position where the chosen block will be inserted. */
  insertAt: number;
};

type Props = { editor: Editor };

// ── Helper — resolve top-level node pos ──────────────────────────────────────

function resolveNodePos(editor: Editor, probeX: number, probeY: number): number | null {
  const pmPos = editor.view.posAtCoords({ left: probeX, top: probeY });
  if (pmPos == null) return null;
  const $pos = editor.state.doc.resolve(pmPos.pos);
  return $pos.depth > 0 ? $pos.before(1) : pmPos.pos;
}

function resolveNodePosFromHandle(editor: Editor, handle: HTMLElement): number | null {
  const rect = handle.getBoundingClientRect();
  return resolveNodePos(editor, rect.right + 50, rect.top + rect.height / 2);
}

// ── Main component ────────────────────────────────────────────────────────────

export function BlockControls({ editor }: Props) {
  /** The .drag-handle element created by the GlobalDragHandle plugin. */
  const [handleEl, setHandleEl] = useState<HTMLElement | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const [pickerAnchor, setPickerAnchor] = useState<BlockPickerAnchor | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const menuAnchorRef = useRef<MenuAnchor | null>(null);
  menuAnchorRef.current = menuAnchor;

  // Find the .drag-handle element the plugin appends to view.dom.parentElement.
  useEffect(() => {
    if (!editor) return;
    const wrapper = editor.view.dom.parentElement;
    if (!wrapper) return;
    const el = wrapper.querySelector('.drag-handle') as HTMLElement | null;
    if (!el) return;
    setHandleEl(el);
  }, [editor]);

  // Hide the drag handle while the page scrolls so it doesn't appear to float
  // in place while block content moves beneath it. The library repositions it
  // correctly on the next mousemove after scroll ends.
  useEffect(() => {
    if (!handleEl) return;
    // Find the closest scrollable ancestor of the editor DOM node
    const editorDom = editor.view.dom as HTMLElement;
    let scrollEl: HTMLElement | null = editorDom.parentElement;
    while (scrollEl && scrollEl !== document.body) {
      const overflow = globalThis.getComputedStyle(scrollEl).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') break;
      scrollEl = scrollEl.parentElement;
    }
    const target = scrollEl ?? globalThis;
    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      handleEl.classList.add('hide');
      clearTimeout(timer);
      timer = setTimeout(() => handleEl.classList.remove('hide'), 300);
    };
    target.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      target.removeEventListener('scroll', onScroll);
      clearTimeout(timer);
    };
  }, [editor, handleEl]);

  // The library's hideHandleOnEditorOut fires on 'mouseout' from the editor
  // parent and hides the handle when relatedTarget lacks the 'drag-handle'
  // class. Our inner buttons don't have that class, so moving the mouse TO
  // a button triggers a hide, setting pointer-events:none and breaking drag.
  //
  // Fix: intercept the mouseout in CAPTURE phase (fires before the library's
  // bubble-phase listener) and cancel it when relatedTarget is inside our handle.
  useEffect(() => {
    if (!handleEl) return;
    const parentEl = editor.view.dom.parentElement;
    if (!parentEl) return;
    const interceptMouseout = (e: MouseEvent) => {
      const rel = e.relatedTarget as Node | null;
      if (rel && handleEl.contains(rel)) {
        e.stopImmediatePropagation();
      }
    };
    parentEl.addEventListener('mouseout', interceptMouseout, true); // capture
    return () => parentEl.removeEventListener('mouseout', interceptMouseout, true);
  }, [editor, handleEl]);

  // ── Grip click → toggle block-action dropdown ────────────────────────────

  const handleGripClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (menuAnchorRef.current) { setMenuAnchor(null); return; }
    if (!handleEl) return;

    const nodePos = resolveNodePosFromHandle(editor, handleEl);
    if (nodePos == null) return;

    const rect = handleEl.getBoundingClientRect();
    const openAbove = (window.innerHeight - rect.bottom) < MENU_HEIGHT_ESTIMATE + 8;
    const x = Math.min(rect.right + 6, window.innerWidth - MENU_WIDTH - 8);
    const y = openAbove ? Math.max(rect.top - MENU_HEIGHT_ESTIMATE, 8) : rect.bottom + 4;

    setMenuAnchor({ x, y, nodePos, openAbove });
  }, [editor, handleEl]);

  // ── + button → open block-picker popup at the position after current block ─

  const handlePlus = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!handleEl) return;

    // Toggle: close if already open
    if (pickerAnchor) { setPickerAnchor(null); return; }

    const nodePos = resolveNodePosFromHandle(editor, handleEl);
    let insertAt: number;
    if (nodePos != null) {
      const node = editor.state.doc.nodeAt(nodePos);
      insertAt = node ? nodePos + node.nodeSize : nodePos + 1;
    } else {
      insertAt = editor.state.doc.content.size;
    }

    // Position the picker to the right of the drag handle, near the + button.
    const rect = handleEl.getBoundingClientRect();
    const openAbove = (window.innerHeight - rect.bottom) < PICKER_HEIGHT_ESTIMATE + 8;
    const x = Math.min(rect.right + 6, window.innerWidth - PICKER_WIDTH - 8);
    const y = openAbove
      ? Math.max(rect.top - PICKER_HEIGHT_ESTIMATE, 8)
      : rect.bottom + 4;

    setPickerAnchor({ x, y, openAbove, insertAt });
  }, [editor, handleEl, pickerAnchor]);

  // ── Override drag-ghost for all block types ───────────────────────────────
  // The global-drag-handle library makes `.drag-handle` draggable and calls
  // setDragImage(NodeViewWrapper, 0, 0) — which snaps a screenshot of the full
  // block (or the entire visible editor for large blocks like Canvas).
  //
  // We listen at document level in BUBBLE phase → fires AFTER the library's
  // listener on the `.drag-handle` element → our setDragImage wins.
  //
  // We skip cancelled drags (e.defaultPrevented = true) which happen when the
  // CanvasNode paint-prevention capture listener fires first.
  useEffect(() => {
    if (!handleEl) return;
    const onDragStart = (e: DragEvent) => {
      // Only handle drags that started from OUR drag handle element.
      if (!handleEl.contains(e.target as Element | null)) return;
      // Skip if already cancelled (e.g. CanvasNode paint-prevention).
      if (e.defaultPrevented) return;

      // Resolve block type for the ghost label.
      const nodePos = resolveNodePosFromHandle(editor, handleEl);
      let label = 'Block';
      if (nodePos != null) {
        const n = editor.state.doc.nodeAt(nodePos);
        if (n) label = nodeTypeToLabel(n.type.name);
      }

      // Build a tiny pill element, append off-screen, hand to the browser,
      // then remove it the next frame (browser only needs it at dragstart).
      const ghost = document.createElement('div');
      ghost.textContent = label;
      ghost.style.cssText = [
        'position:fixed', 'top:-1000px', 'left:-1000px',
        'padding:4px 10px',
        'background:var(--card,#1e1e1e)',
        'color:var(--foreground,#fff)',
        'border:1px solid var(--border,#444)',
        'border-radius:6px',
        'font-size:12px',
        'font-family:inherit',
        'white-space:nowrap',
        'pointer-events:none',
      ].join(';');
      document.body.appendChild(ghost);
      e.dataTransfer?.setDragImage(ghost, 20, 14);
      requestAnimationFrame(() => ghost.remove());
    };
    // Bubble phase — fires after the library's listener on handleEl.
    document.addEventListener('dragstart', onDragStart);
    return () => document.removeEventListener('dragstart', onDragStart);
  }, [editor, handleEl]);

  // ── Close menu on outside pointer-down (capture) or Escape ───────────────

  useEffect(() => {
    if (!menuAnchor) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuAnchor(null); };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (menuRef.current?.contains(target)) return;
      if (handleEl?.contains(target)) return;
      setMenuAnchor(null);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [menuAnchor, handleEl]);

  // ── Close block-picker on outside pointer-down or Escape ────────────────

  useEffect(() => {
    if (!pickerAnchor) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setPickerAnchor(null); };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (pickerRef.current?.contains(target)) return;
      if (handleEl?.contains(target)) return;
      setPickerAnchor(null);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [pickerAnchor, handleEl]);

  // ── Block-action helpers ──────────────────────────────────────────────────

  const withNode = useCallback(
    (fn: (pos: number) => void) => {
      const anchor = menuAnchorRef.current;
      if (!anchor) return;
      setMenuAnchor(null);
      fn(anchor.nodePos);
      requestAnimationFrame(() => editor.view.focus());
    },
    [editor],
  );

  const insertAbove = useCallback(() =>
    withNode((pos) => {
      editor.chain().insertContentAt(pos, { type: 'paragraph' }).run();
    }), [withNode, editor]);

  const insertBelow = useCallback(() =>
    withNode((pos) => {
      const node = editor.state.doc.nodeAt(pos);
      const at = node ? pos + node.nodeSize : pos + 1;
      editor.chain().insertContentAt(at, { type: 'paragraph' }).run();
    }), [withNode, editor]);

  const duplicate = useCallback(() =>
    withNode((pos) => {
      const node = editor.state.doc.nodeAt(pos);
      if (!node) return;
      editor.chain().insertContentAt(pos + node.nodeSize, node.toJSON()).run();
    }), [withNode, editor]);

  const deleteBlock = useCallback(() =>
    withNode((pos) => {
      const node = editor.state.doc.nodeAt(pos);
      if (!node) return;
      editor.chain().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
    }), [withNode, editor]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (!handleEl) return null;
  return (
    <>
      {/* Buttons rendered INSIDE the library's .drag-handle element */}
      {createPortal(
        <div className="block-controls-inner">
          <button
            type="button"
            aria-label="Block actions"
            className="block-ctrl-btn block-ctrl-grip"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={handleGripClick}
          >
            <GripVertical size={14} strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="Insert block"
            className="block-ctrl-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handlePlus}
          >
            <Plus size={12} strokeWidth={2.5} />
          </button>
        </div>,
        handleEl,
      )}

      {/* Context menu portalled to body */}
      {menuAnchor && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label="Block actions menu"
          className="block-action-menu"
          style={{ left: menuAnchor.x, top: menuAnchor.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <ActionItem icon={<ArrowUp size={13} />}   label="Insert above" onClick={insertAbove} />
          <ActionItem icon={<ArrowDown size={13} />} label="Insert below" onClick={insertBelow} />
          <ActionItem icon={<Copy size={13} />}      label="Duplicate"    onClick={duplicate} />
          <div className="block-action-menu-sep" />
          <ActionItem icon={<Trash2 size={13} />}    label="Delete block" onClick={deleteBlock} danger />
        </div>,
        document.body,
      )}

      {/* Block-picker portalled to body */}
      {pickerAnchor && createPortal(
        <BlockPickerMenu
          ref={pickerRef}
          x={pickerAnchor.x}
          y={pickerAnchor.y}
          onSelect={(item) => {
            const pos = pickerAnchor.insertAt;
            setPickerAnchor(null);
            editor.chain().insertContentAt(pos, item.insertSpec).focus().run();
          }}
          onClose={() => setPickerAnchor(null)}
        />,
        document.body,
      )}
    </>
  );
}

// ── ActionItem ────────────────────────────────────────────────────────────────

function ActionItem({
  icon,
  label,
  onClick,
  danger = false,
}: Readonly<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}>) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`block-action-item${danger ? ' block-action-item--danger' : ''}`}
      onPointerDown={(e) => {
        e.preventDefault();  // keep editor focus
        e.stopPropagation(); // don't trigger outside-click listener
        onClick();
      }}
    >
      {icon}
      {label}
    </button>
  );
}

// ── BlockPickerMenu ───────────────────────────────────────────────────────────

export type BlockPickerMenuProps = {
  x: number;
  y: number;
  onSelect: (item: SlashCommandItem) => void;
  onClose: () => void;
};

export const BlockPickerMenu = forwardRef<HTMLDivElement, BlockPickerMenuProps>(
  function BlockPickerMenu({ x, y, onSelect, onClose }, ref) {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const filtered = query.trim()
      ? SLASH_ITEMS.filter(
          (item) =>
            item.title.toLowerCase().includes(query.toLowerCase()) ||
            item.description.toLowerCase().includes(query.toLowerCase()),
        )
      : SLASH_ITEMS;

    // Reset selection when filter changes
    useEffect(() => { setSelectedIndex(0); }, [query]);

    // Auto-focus the search input when the menu mounts
    useEffect(() => {
      requestAnimationFrame(() => inputRef.current?.focus());
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[selectedIndex];
        if (item) onSelect(item);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    return (
      <div
        ref={ref}
        role="menu"
        aria-label="Insert block"
        className="block-action-menu flex flex-col"
        style={{ left: x, top: y, width: PICKER_WIDTH, maxHeight: '22rem' }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
          <Search size={12} className="shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            aria-label="Search block types"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              className="shrink-0 text-muted-foreground hover:text-foreground"
              onPointerDown={(e) => { e.preventDefault(); setQuery(''); }}
            >
              <X size={11} />
            </button>
          )}
        </div>

        {/* Block list */}
        <div className="overflow-y-auto py-1" style={{ maxHeight: '18rem' }}>
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No results</p>
          ) : (
            filtered.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.title}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left transition-colors',
                    index === selectedIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'text-foreground hover:bg-accent/60',
                  )}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect(item);
                  }}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-card">
                    <Icon size={13} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-medium leading-tight">{item.title}</div>
                    <div className="truncate text-[10px] text-muted-foreground">{item.description}</div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  },
);
