'use client';

import '@excalidraw/excalidraw/index.css';

/**
 * CanvasNode — Excalidraw drawing canvas as a Tiptap node.
 *
 * Attrs: data (string — JSON-serialised Excalidraw elements + appState), tags (string[])
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useEditable } from '../EditableContext';
import { Palette, Maximize2, Minimize2 } from 'lucide-react';
import { BlockTagChips } from '../BlockTagChips';
import { BlockHeader } from '../BlockHeader';
import { BLOCK_ATOM_SPEC, BLOCK_NODE_WRAPPER_CLASS, blockStopEvent } from './nodeUtils';

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((m) => ({ default: m.Excalidraw })),
  { ssr: false },
);

// ─── Node View ────────────────────────────────────────────────────────────────

function CanvasNodeView({ node, updateAttributes }: ReactNodeViewProps) {
  const { data, tags } = node.attrs as { data: string; tags: string[] };

  // ── Track editable state via React context ────────────────────────────────
  // PageEditor provides EditableContext; tiptap-react uses createPortal so
  // context propagates correctly into all node views without extra wiring.
  const isEditable = useEditable();
  const { resolvedTheme } = useTheme();
  const canvasTheme = resolvedTheme === 'light' ? 'light' : 'dark';

  const [fullscreen, setFullscreen] = useState(false);
  // Key incremented on each fullscreen toggle so Excalidraw remounts with
  // fresh initialData from the persisted `data` attr.
  const [excalidrawKey, setExcalidrawKey] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const excalidrawRef = useRef<any>(null);

  // Ref for the canvas container that is currently in the editor DOM (not the
  // fullscreen portal). Used for the drag-prevention effect below.
  const editorCanvasRef = useRef<HTMLDivElement>(null);

  // ── Prevent drag-ghost when painting inside Excalidraw ──────────────────
  // The drag handle makes the whole block draggable. If the user draws inside
  // the canvas with pointer-down → pointermove, the browser misreads it as a
  // block-drag and fires dragstart on the .drag-handle element.
  //
  // Fix: track WHERE the last pointerdown landed. If it was inside our canvas
  // div, cancel the dragstart in CAPTURE phase before any other listener runs.
  // BlockControls handles the ghost replacement for real handle-drags.
  useEffect(() => {
    let downInsideCanvas = false;

    const onPointerDown = (e: PointerEvent) => {
      const el = editorCanvasRef.current;
      downInsideCanvas = !!(el && e.target instanceof Element && el.contains(e.target));
    };
    const onDragStart = (e: DragEvent) => {
      if (downInsideCanvas) e.preventDefault();
    };
    const onPointerUp = () => { downInsideCanvas = false; };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('dragstart', onDragStart, true); // capture — fires before BlockControls
    document.addEventListener('pointerup', onPointerUp);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('dragstart', onDragStart, true);
      document.removeEventListener('pointerup', onPointerUp);
    };
  }, []);

  // Stable ref so we can read the latest value in handleChange without
  // recreating the callback (which would re-sub Excalidraw's onChange).
  const updateAttributesRef = useRef(updateAttributes);
  updateAttributesRef.current = updateAttributes;
  const isEditableRef = useRef(isEditable);
  isEditableRef.current = isEditable;

  /** Debounce timer – flush canvas data at most once per 300 ms. */
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (elements: readonly any[], appState: any) => {
      if (!isEditableRef.current) return;
      // Exclude `collaborators` — it's a Map and JSON.stringify maps it to
      // `{}`, which then makes Excalidraw crash on `collaborators.forEach`.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { collaborators: _c, ...persistableState } = appState as Record<string, unknown>;
      const serialised = JSON.stringify({ elements, appState: persistableState });
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        updateAttributesRef.current({ data: serialised });
      }, 300);
    },
    [],
  );

  /**
   * Parse initial data for Excalidraw.
   *
   * Re-evaluated only when `excalidrawKey` changes (i.e. on fullscreen toggle),
   * NOT on every `data` update — that would compete with Excalidraw's internal
   * state and cause the "collaborators.forEach is not a function" crash.
   *
   * We ALWAYS override collaborators with a fresh Map. Excalidraw v0.18 merges
   * initialData.appState via object spread; if collaborators is undefined/{}
   * the default `new Map()` gets overridden, causing the forEach crash.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stableInitialData = useMemo<any>(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed: any = data ? JSON.parse(data) : {};
      if (
        parsed.appState?.collaborators != null &&
        !(parsed.appState.collaborators instanceof Map)
      ) {
        parsed.appState.collaborators = new Map(
          Object.entries(parsed.appState.collaborators as Record<string, unknown>),
        );
      }
      return { ...parsed, appState: { ...(parsed.appState ?? {}), collaborators: new Map() } };
    } catch {
      return { appState: { collaborators: new Map() } };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excalidrawKey]); // intentionally ignore `data` — see comment above

  const handleFullscreenToggle = useCallback(() => {
    // Flush any pending save so the persisted `data` attr is current before remount.
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    // Remount Excalidraw with fresh initialData sourced from the now-current attr.
    setExcalidrawKey((k) => k + 1);
    setFullscreen((v) => !v);
  }, [saveTimerRef]);

  const excalidrawInstance = (
    <Excalidraw
      key={excalidrawKey}
      excalidrawAPI={(api) => { excalidrawRef.current = api; }}
      initialData={stableInitialData}
      onChange={isEditable ? handleChange : undefined}
      viewModeEnabled={!isEditable}
      gridModeEnabled={false}
      zenModeEnabled={false}
      theme={canvasTheme}
      UIOptions={{ canvasActions: { export: false, loadScene: false } }}
    />
  );

  const toggleBtn = (
    <button
      type="button"
      onClick={handleFullscreenToggle}
      aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      data-testid="canvas-fullscreen-toggle"
      className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    >
      {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
    </button>
  );

  return (
    <NodeViewWrapper
      className={BLOCK_NODE_WRAPPER_CLASS}
    >
      {fullscreen ? (
        // Placeholder shown in the doc while the fullscreen portal is active.
        <div
          className="flex items-center justify-center text-muted-foreground text-sm"
          style={{ height: 480 }}
        >
          Canvas open in fullscreen
        </div>
      ) : (
        <>
          <BlockHeader
            icon={<Palette size={13} className="text-muted-foreground" />}
            title="Canvas"
            actions={toggleBtn}
          />
          {/* Tags */}
          <BlockTagChips
            tags={tags ?? []}
            isEditable={isEditable}
            onChange={(t) => updateAttributes({ tags: t })}
            showEmpty={isEditable}
          />
          {/* Canvas — ref used by drag-prevention effect */}
          <div
            ref={editorCanvasRef}
            className="relative"
            style={{ height: 480 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {excalidrawInstance}
          </div>
        </>
      )}

      {/*
       * Fullscreen portal — rendered at document.body level so it escapes any
       * CSS transform/will-change stacking context that would break
       * `position: fixed` when rendered inside the editor subtree.
       */}
      {isMounted && fullscreen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-card flex flex-col" data-testid="canvas-fullscreen-overlay">
          <BlockHeader
            icon={<Palette size={13} className="text-muted-foreground" />}
            title="Canvas"
            actions={toggleBtn}
          />
          {/* Tags */}
          <BlockTagChips
            tags={tags ?? []}
            isEditable={isEditable}
            onChange={(t) => updateAttributes({ tags: t })}
            showEmpty={isEditable}
          />
          {/* Canvas */}
          <div
            className="relative flex-1"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {excalidrawInstance}
          </div>
        </div>,
        document.body,
      )}
    </NodeViewWrapper>
  );
}

// ─── Node Definition ──────────────────────────────────────────────────────────

export const CanvasNode = Node.create({
  name: 'canvasNode',
  ...BLOCK_ATOM_SPEC,

  addAttributes() {
    return {
      data: { default: '' },
      tags: { default: [] },
    };
  },

  parseHTML() { return [{ tag: 'div[data-type="canvasNode"]' }]; },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'canvasNode' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CanvasNodeView, {
      stopEvent: blockStopEvent,
    });
  },
});
