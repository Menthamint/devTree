'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import Heading from '@tiptap/extension-heading';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { type EditorState, Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { type Extensions, Extension } from '@tiptap/core';
import { type Editor, EditorContent, type JSONContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Plus } from 'lucide-react';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';

import { CommentMark } from '@/components/features/editor/extensions/CommentMark';
import { useI18n } from '@/lib/i18n';

import { BlockControls, BlockPickerMenu } from './BlockControls';
import { EditableContext } from './EditableContext';
import { EditorBubbleMenu } from './EditorBubbleMenu';
import { AudioNode } from './extensions/AudioNode';
import { BookmarkMark } from './extensions/BookmarkMark';
import { CanvasNode } from './extensions/CanvasNode';
import { ChecklistNode } from './extensions/ChecklistNode';
import { CodeBlockNode } from './extensions/CodeBlockNode';
import { EmojiSuggestion } from './extensions/EmojiSuggestion';
import { ImageNode } from './extensions/ImageNode';
import { InlineTagMark } from './extensions/InlineTagMark';
import { LinkCardNode } from './extensions/LinkCardNode';
import { SlashCommand } from './extensions/SlashCommand';
import { TableBlockNode } from './extensions/TableBlockNode';
import { FontFamily, FontSize } from './extensions/Typography';
import { VideoNode } from './extensions/VideoNode';
import './PageEditor.css';

// A small extension derived from the built-in heading which allows us to
// carry through an arbitrary `contenteditable` attribute.  Tiptap's default
// heading extension only knows about the `level` attribute, so any extra attr
// would be discarded when rendering.  We need the DOM property in order to
// prevent the browser from ever placing the caret inside a template heading.
const isProtectedAttr = (attrs: unknown) =>
  (attrs as Record<string, unknown> | undefined)?.contenteditable === 'false';

const TemplateHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      contenteditable: {
        default: null,
        parseHTML: (element) => element.getAttribute('contenteditable'),
        renderHTML: (attributes) => {
          if (attributes.contenteditable == null) return {};
          return { contenteditable: attributes.contenteditable };
        },
      },
    };
  },

  // prevent any mutation (typing or deletion) when a heading is marked
  // non-editable by the template helper.  The `contenteditable=false` attr
  // already stops the browser from putting a caret inside the node, but users
  // could still select it and hit backspace/delete or navigate through it with
  // arrow keys.  We intercept the relevant key events and the generic before-
  // input DOM event to swallow them.
  addKeyboardShortcuts() {
    const isProtected = (state: EditorState) => {
      const { selection } = state;
      const { $from, $to, node } = selection as typeof selection & { node?: ProseMirrorNode };
      if (isProtectedAttr(node?.attrs)) return true;
      if (isProtectedAttr($from.parent.attrs)) return true;
      let protectedFound = false;
      state.doc.nodesBetween($from.pos, $to.pos, (n: ProseMirrorNode) => {
        if (isProtectedAttr(n.attrs)) {
          protectedFound = true;
          return false;
        }
      });
      return protectedFound;
    };

    return {
      Backspace: ({ editor }) => {
        return isProtected(editor.state);
      },
      Delete: ({ editor }) => {
        return isProtected(editor.state);
      },
    };
  },

  addProseMirrorPlugins() {
    const plugin = new Plugin({
      key: new PluginKey('templateHeading'),
      props: {
        handleDOMEvents: {
          beforeinput: (view: EditorView, event: InputEvent) => {
            const { inputType } = event;
            if (
              inputType.startsWith('delete') ||
              inputType === 'insertText' ||
              inputType === 'insertParagraph'
            ) {
              const { selection } = view.state;
              const { $from, $to, node } = selection as typeof selection & { node?: ProseMirrorNode };
              if (isProtectedAttr(node?.attrs) || isProtectedAttr($from.parent.attrs)) {
                event.preventDefault();
                return true;
              }
              let blocked = false;
              view.state.doc.nodesBetween($from.pos, $to.pos, (n: ProseMirrorNode) => {
                if (isProtectedAttr(n.attrs)) {
                  blocked = true;
                  return false;
                }
              });
              if (blocked) {
                event.preventDefault();
                return true;
              }
            }
            return false;
          },
        },
      },
    });
    return [plugin];
  },
});

// Adds the `contenteditable` attribute to paragraph (and other inline block)
// nodes so that Tiptap preserves and renders it when template content is applied.
// The editing-prevention logic lives in TemplateHeading's keyboard shortcuts and
// ProseMirror plugin, which now check any node type (not just headings).
const TemplateNodeAttrs = Extension.create({
  name: 'templateNodeAttrs',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'blockquote', 'bulletList', 'orderedList', 'listItem'],
        attributes: {
          contenteditable: {
            default: null,
            parseHTML: (element: Element) => element.getAttribute('contenteditable'),
            renderHTML: (attributes: Record<string, unknown>) => {
              if (!attributes.contenteditable) return {};
              return { contenteditable: attributes.contenteditable };
            },
          },
        },
      },
    ];
  },
});

// ── Tag-filter helper ─────────────────────────────────────────────────────────
// Returns true if the given top-level Tiptap node matches at least one of the
// active filter tags.  Checks both atom-node attrs.tags and inline-tag marks.
function nodeMatchesFilter(node: ProseMirrorNode, activeTags: string[]): boolean {
  if (activeTags.length === 0) return true;
  const blockTags: string[] = Array.isArray(node.attrs?.tags) ? node.attrs.tags : [];
  if (blockTags.some((t: string) => activeTags.includes(t))) return true;
  let inlineMatch = false;
  node.descendants((child: ProseMirrorNode) => {
    if (inlineMatch) return false;
    for (const mark of child.marks) {
      if (mark.type.name === 'inlineTag' && activeTags.includes(mark.attrs.tag as string)) {
        inlineMatch = true;
        return false;
      }
    }
  });
  return inlineMatch;
}

// ── Apply or clear per-block display filtering ────────────────────────────────
function applyBlockFilter(editor: Editor, activeTags: string[]) {
  const editorDom = editor.view.dom;
  const root = editorDom.classList.contains('ProseMirror')
    ? editorDom
    : editorDom.querySelector('.ProseMirror');
  if (!root) return;

  if (activeTags.length === 0) {
    for (const child of Array.from(root.children)) {
      const el = child as HTMLElement;
      el.style.display = '';
      delete el.dataset.filterHidden;
    }
    return;
  }

  let index = 0;
  editor.state.doc.forEach((node: ProseMirrorNode) => {
    const domNode = root.children.item(index) as HTMLElement | null;
    index += 1;
    if (!domNode) return;
    const visible = nodeMatchesFilter(node, activeTags);
    domNode.style.display = visible ? '' : 'none';
    domNode.toggleAttribute('data-filter-hidden', !visible);
  });
}

const CUSTOM_NODE_NAMES = [
  'codeBlockNode',
  'checklistNode',
  'canvasNode',
  'audioNode',
  'videoNode',
  'imageNode',
  'linkCardNode',
  'tableBlockNode',
] as const;

type Props = {
  content: JSONContent | null;
  editable: boolean;
  mode?: 'notebook' | 'diary';
  onChange?: (json: JSONContent) => void;
  pageId?: string;
  /** Called once the Tiptap Editor instance is ready (or null on destroy). */
  onEditorReady?: (editor: Editor | null) => void;
  /**
   * When non-empty, only top-level blocks whose tags (attrs.tags) or inline
   * tag marks contain at least one of these tags are shown. Empty = show all.
   */
  activeFilterTags?: string[];
};

export function PageEditor({
  content,
  editable,
  mode = 'notebook',
  onChange,
  pageId,
  onEditorReady,
  activeFilterTags = [],
}: Readonly<Props>) {
  const isNotebookMode = mode === 'notebook';
  const { t } = useI18n();
  /**
   * Tracks the last JSON content string that was emitted via onChange.
   * Used to prevent the "sync from outside" useEffect from resetting the editor
   * when the new content prop is just the echo of our own last change (which
   * would cause a feedback loop killing interactive node views like Monaco).
   */
  const lastLocalContentRef = useRef<string | null>(null);

  /**
   * Snapshot of the document JSON taken when we enter edit mode.
   * Tiptap fires a spurious `onUpdate` when `setEditable(true)` is called, even
   * though no content has changed.  We suppress that initial fire by comparing
   * the incoming JSON against the snapshot; once the user makes a real edit
   * (different JSON), the snapshot is cleared and all subsequent changes flow
   * through normally.
   */
  const cleanContentRef = useRef<string | null>(null);

  // compute the placeholder text once; changing the locale should
  // force a recalculation via the `t` dependency.
  const placeholderText = useMemo(
    () => (isNotebookMode ? t('editor.placeholderNotebook') : t('editor.placeholderDiary')),
    [isNotebookMode, t],
  );

  // memoize the extensions array so that it remains referentially stable
  // across renders.  Without this `useEditor` will attempt to reconfigure the
  // editor when the component rerenders (for example, due to a locale change),
  // which can trigger "/keyed plugin" errors in our unit tests.
  const editorExtensions = useMemo(() => {
    const base: Extensions = [
      // ── Built-in / community extensions ──────────────────────────────────
      StarterKit.configure({
        // Disable built-in code block only in notebook mode where custom Monaco node is used
        // StarterKit expects `false | Partial<CodeBlockOptions> | undefined`
        codeBlock: isNotebookMode ? false : undefined,
        // Disable extensions we configure explicitly below (to avoid Tiptap
        // "duplicate extension names" warning in StarterKit v3 which bundles them).
        link: false,
        underline: false,
        heading: false, // we'll supply a customized heading extension below
      }),
      // our customized heading that supports `contenteditable` attr
      TemplateHeading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
      // global attr extension that preserves `contenteditable` on paragraph and other nodes
      TemplateNodeAttrs,
      Placeholder.configure({ placeholder: placeholderText }),
      Underline,
      Link.configure({ openOnClick: !editable, autolink: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,

      // ── Custom marks ──────────────────────────────────────────────────────
      CommentMark,
      BookmarkMark,
      InlineTagMark,
      SlashCommand,
      EmojiSuggestion,
    ];

    if (isNotebookMode) {
      base.push(
        CodeBlockNode,
        ChecklistNode,
        CanvasNode,
        AudioNode,
        VideoNode,
        ImageNode,
        LinkCardNode,
        TableBlockNode,
        GlobalDragHandle.configure({
          customNodes: CUSTOM_NODE_NAMES,
        }),
      );
    }

    return base;
  }, [isNotebookMode, placeholderText, editable]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: editorExtensions,

    content: content ?? undefined,

    editable,

    onUpdate({ editor: e }) {
      const json = e.getJSON();
      const jsonStr = JSON.stringify(json);
      // Record this JSON so the "sync from outside" effect can skip it
      lastLocalContentRef.current = jsonStr;
      // Don't propagate changes when the editor isn't editable (view mode
      // can issue setContent calls that should never mark the page dirty).
      if (!e.isEditable) return;
      // Suppress the spurious onUpdate that Tiptap fires when setEditable(true)
      // is called without any real content change.  We detect this by comparing
      // against the snapshot taken just before entering edit mode.
      if (cleanContentRef.current !== null) {
        if (jsonStr === cleanContentRef.current) return; // no real change yet
        cleanContentRef.current = null; // first real edit
      }
      onChange?.(json);
    },

    editorProps: {
      attributes: {
        class: 'page-editor-content prose prose-sm dark:prose-invert max-w-none focus:outline-none',
        'data-page-id': pageId ?? '',
      },
    },
  });

  // ── Snapshot doc content when entering edit mode ─────────────────────────
  // This runs before the setEditable effect (effects run in declaration order),
  // so we capture the "clean" state before Tiptap's setEditable(true) fires its
  // spurious onUpdate.
  useEffect(() => {
    if (!editor) return;
    if (editable) {
      cleanContentRef.current = JSON.stringify(editor.getJSON());
    } else {
      cleanContentRef.current = null;
    }
  }, [editor, editable]);

  // ── Keep editable in sync with prop changes ───────────────────────────────
  useEffect(() => {
    if (!editor) return;
    if (editor.isEditable !== editable) editor.setEditable(editable);
  }, [editor, editable]);

  // ── Replace document when content prop changes from the outside ───────────
  useEffect(() => {
    if (!editor) return;
    const incoming = JSON.stringify(content);
    // Skip if this is just the echo of the last onChange we emitted — prevents
    // a reset loop that would destroy interactive node views (Monaco, Excalidraw).
    if (incoming && incoming === lastLocalContentRef.current) return;
    // Also skip if editor already has this content (e.g. initial load).
    const current = JSON.stringify(editor.getJSON());
    if (incoming && incoming !== current) {
      // Defer setContent with queueMicrotask to avoid `flushSync` being called
      // inside a React lifecycle (which triggers a React warning and can crash).
      queueMicrotask(() => {
        if (!editor.isDestroyed) {
          editor.commands.setContent(content ?? '');
        }
      });
    }
  }, [editor, content]);

  // ── Notify parent when editor instance is ready (used by toolbar, overlays)
  useEffect(() => {
    if (!editor) return;
    onEditorReady?.(editor);
    return () => {
      onEditorReady?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // ── Block-level tag filter ────────────────────────────────────────────────
  // When activeFilterTags is non-empty, hide every top-level block that doesn't
  // carry a matching tag (attrs.tags on atom nodes, or inlineTag marks on text).
  // Re-run after any document change so newly-added blocks react immediately.
  useEffect(() => {
    if (!editor) return;
    const apply = () => applyBlockFilter(editor, activeFilterTags);
    apply();
    if (activeFilterTags.length === 0) return;
    editor.on('update', apply);
    return () => {
      editor.off('update', apply);
    };
  }, [editor, activeFilterTags]);

  if (!editor) return null;

  return (
    <EditableContext.Provider value={editable}>
      <div className="page-editor-root flex flex-col">
        <div className="page-editor-body relative flex-1 px-6 py-4">
          <EditorBubbleMenu editor={editor} />
          {editable && isNotebookMode && <BlockControls editor={editor} />}
          <EditorContent editor={editor} />
        </div>
        {editable && isNotebookMode && <AddBlockButton editor={editor} />}
      </div>
    </EditableContext.Provider>
  );
}

// ── AddBlockButton ────────────────────────────────────────────────────────────

function AddBlockButton({ editor }: Readonly<{ editor: Editor }>) {
  const [anchor, setAnchor] = useState<{ x: number; y: number; insertAt: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const handleClick = () => {
    if (anchor) {
      setAnchor(null);
      return;
    }

    // Remember the end-of-document insertion point but do NOT insert anything
    // yet — inserting before the user picks would cause a visible layout jump.
    const insertAt = editor.state.doc.content.size;

    // Anchor the picker above the button
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const PICKER_W = 260;
    const PICKER_H = 380;
    const x = Math.min(rect.left, window.innerWidth - PICKER_W - 8);
    const y = Math.max(rect.top - PICKER_H - 8, 8);
    setAnchor({ x, y, insertAt });
  };

  // Close on outside click
  useEffect(() => {
    if (!anchor) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (btnRef.current?.contains(target)) return;
      if (pickerRef.current?.contains(target)) return; // click inside picker → let onSelect handle it
      setAnchor(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAnchor(null);
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [anchor]);

  return (
    <>
      <div className="px-6 pt-2 pb-6">
        <button
          ref={btnRef}
          type="button"
          aria-label="Add block"
          onClick={handleClick}
          className="motion-interactive border-border text-muted-foreground flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed py-3 text-sm transition-colors hover:border-indigo-400 hover:bg-indigo-50/50 hover:text-indigo-600 dark:hover:bg-indigo-950/30 dark:hover:text-indigo-400"
        >
          <Plus size={16} />
          Add block
        </button>
      </div>
      {anchor &&
        createPortal(
          <BlockPickerMenu
            ref={pickerRef}
            x={anchor.x}
            y={anchor.y}
            onSelect={(item) => {
              const pos = anchor.insertAt;
              setAnchor(null);
              editor.chain().insertContentAt(pos, item.insertSpec).focus().run();
            }}
            onClose={() => setAnchor(null)}
          />,
          document.body,
        )}
    </>
  );
}
