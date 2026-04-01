'use client';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { Editor } from '@tiptap/core';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Bookmark,
  Code,
  CodeSquare,
  Heading,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  MessageSquare,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Text,
  Type,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import { VoiceDictationButton } from '@/components/features/MainContent/voice-dictation/VoiceDictationButton';
import { VoiceDictationLanguageButton } from '@/components/features/MainContent/voice-dictation/VoiceDictationLanguageButton';
import { type Locale, useI18n } from '@/lib/i18n';

export { ToolbarButton, type ToolbarButtonProps } from './ToolbarButton';
import { ToolbarButton } from './ToolbarButton';

import { BookmarksPanel } from './BookmarksPanel';
import { ColorPickerDropdown } from './ColorPickerDropdown';
import { EmojiPickerPopover } from './EmojiPickerPopover';
import { HighlightPickerDropdown } from './HighlightPickerDropdown';

const FONT_FAMILIES = [
  { name: 'Default', value: '' },
  { name: 'Arial', value: 'Arial, sans-serif' },
  { name: 'Helvetica', value: 'Helvetica, sans-serif' },
  { name: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { name: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
  { name: 'Trebuchet', value: 'Trebuchet MS, sans-serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Times', value: 'Times New Roman, Times, serif' },
  { name: 'Courier', value: 'Courier New, Courier, monospace' },
  { name: 'Lucida Console', value: 'Lucida Console, Monaco, monospace' },
  { name: 'Comic Sans', value: 'Comic Sans MS, cursive, sans-serif' },
  { name: 'Impact', value: 'Impact, Charcoal, sans-serif' },
  { name: 'Sans', value: 'var(--font-geist-sans)' },
  { name: 'Serif', value: 'Georgia, serif' },
  { name: 'Mono', value: 'var(--font-geist-mono)' },
];

const FONT_SIZES = [
  { name: 'Default', value: '' },
  { name: '8', value: '8px' },
  { name: '10', value: '10px' },
  { name: '12', value: '12px' },
  { name: '14', value: '14px' },
  { name: '16', value: '16px' },
  { name: '18', value: '18px' },
  { name: '20', value: '20px' },
  { name: '24', value: '24px' },
  { name: '28', value: '28px' },
  { name: '32', value: '32px' },
  { name: '36', value: '36px' },
  { name: '48', value: '48px' },
];

// ─── DictationOverlay ─────────────────────────────────────────────────────────

/**
 * Shows interim voice-dictation text as a floating ghost overlay just below
 * the active cursor position so it doesn't pollute the toolbar row.
 */
function DictationOverlay({ editor, text }: { editor: Editor; text: string }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!text) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- calling setState in useEffect is valid React
      setPos(null);
      return;
    }
    try {
      const { head } = editor.state.selection;
      const coords = editor.view.coordsAtPos(head);
      setPos({ top: coords.bottom + 6, left: coords.left });
    } catch {
      setPos(null);
    }
  }, [editor, text]);

  if (!text || !pos) return null;

  return createPortal(
    <div
      aria-live="polite"
      className="border-border bg-card/90 text-muted-foreground pointer-events-none fixed z-50 rounded-md border px-2 py-1 text-xs shadow-md backdrop-blur"
      style={{ top: pos.top, left: pos.left }}
    >
      {text}
    </div>,
    document.body,
  );
}

// ─── PortalDropdown ───────────────────────────────────────────────────────────
// Renders children in a fixed-position portal anchored below the given element.
// This avoids clipping by any scrollable ancestor of the toolbar.

function PortalDropdown({
  anchorRef,
  open,
  children,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const update = useCallback(() => {
    const a = anchorRef.current;
    if (!a) return;
    const r = a.getBoundingClientRect();
    const GAP = 4;
    setPos({ top: r.bottom + GAP, left: r.left });
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!open) return;
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, update]);

  if (!open) return null;
  return createPortal(
    <div style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 1000 }}>{children}</div>,
    document.body,
  );
}

// ─── EditorToolbar ────────────────────────────────────────────────────────────

type EditorToolbarProps = Readonly<{
  editor: Editor;
  blockId?: string;
}>;

// eslint-disable-next-line sonarjs/cognitive-complexity -- toolbar intentionally centralizes many formatting actions and popup flows
export function EditorToolbar({ editor, blockId }: EditorToolbarProps) {
  const { locale } = useI18n();
  const reducedMotion = useReducedMotion();
  const popupDuration = reducedMotion ? 0.01 : 0.16;

  const linkInputRef = useRef<HTMLInputElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const linkSelectionRef = useRef<{ from: number; to: number } | null>(null);

  // anchors for popup dropdowns that render via portal
  const fontBtnRef = useRef<HTMLButtonElement>(null);
  const fontSizeBtnRef = useRef<HTMLButtonElement>(null);
  const headingBtnRef = useRef<HTMLButtonElement>(null);
  const alignBtnRef = useRef<HTMLButtonElement>(null);

  const [linkOpen, setLinkOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [headingOpen, setHeadingOpen] = useState(false);
  const [alignOpen, setAlignOpen] = useState(false);
  const [fontFamilyOpen, setFontFamilyOpen] = useState(false);
  const [fontSizeOpen, setFontSizeOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

  // for display: determine which font/size is active at the selection (if any)
  const textStyleAttrs = editor?.getAttributes('textStyle') || {};
  const currentFontFamily = textStyleAttrs.fontFamily ?? 'Default';
  const currentFontSize = textStyleAttrs.fontSize ?? 'Default';
  const [dictationLanguage, setDictationLanguage] = useState<Locale>(locale);
  const [interimText, setInterimText] = useState('');
  const dictationSelectionRef = useRef<{ from: number; to: number } | null>(null);

  const closeAll = () => {
    setLinkOpen(false);
    setColorOpen(false);
    setHighlightOpen(false);
    setCommentOpen(false);
    setHeadingOpen(false);
    setAlignOpen(false);
    setFontFamilyOpen(false);
    setFontSizeOpen(false);
    setEmojiOpen(false);
  };

  // ─── Link ──────────────────────────────────────────────────────────────────

  const setLink = useCallback(() => {
    const url = linkInputRef.current?.value?.trim() ?? '';
    if (url) {
      // Prefer the selection that was captured when the toolbar button was
      // clicked, but fall back to the current editor selection.  Occasionally
      // the captured value is collapsed because the editor state hasn't caught
      // up with a quick keyboard shortcut (e.g. Cmd+A).  In that case we use
      // the real selection which still contains the text the user highlighted.
      let savedSelection = linkSelectionRef.current ?? editor.state.selection;
      const currentSel = editor.state.selection;
      if (savedSelection.from === savedSelection.to && currentSel.from !== currentSel.to) {
        savedSelection = currentSel;
      }

      if (savedSelection.from === savedSelection.to) {
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
      } else {
        editor
          .chain()
          .focus()
          .setTextSelection({ from: savedSelection.from, to: savedSelection.to })
          .extendMarkRange('link')
          .setLink({ href: url })
          .run();
      }
    }
    linkSelectionRef.current = null;
    setLinkOpen(false);
  }, [editor]);

  const unsetLink = useCallback(() => {
    editor.chain().focus().unsetLink().run();
    linkSelectionRef.current = null;
    setLinkOpen(false);
  }, [editor]);

  // ─── Comment ───────────────────────────────────────────────────────────────

  const applyComment = useCallback(() => {
    const text = commentInputRef.current?.value?.trim() ?? '';
    if (text) {
      const id = `comment-${crypto.randomUUID()}`;
      (
        editor.chain().focus() as unknown as {
          setComment: (a: { id: string; commentText: string }) => { run: () => boolean };
        }
      )
        .setComment({ id, commentText: text })
        .run();
    }
    setCommentOpen(false);
  }, [editor]);

  const removeComment = useCallback(() => {
    (
      editor.chain().focus() as unknown as {
        unsetComment: () => { run: () => boolean };
      }
    )
      .unsetComment?.()
      .run();
    setCommentOpen(false);
  }, [editor]);

  // ─── Bookmark ──────────────────────────────────────────────────────────────

  const addBookmark = useCallback(() => {
    const { from, to } = editor.state.selection;
    if (from === to) return;
    const text = editor.state.doc.textBetween(from, to, '').slice(0, 60);
    const id = `bm-${crypto.randomUUID()}`;
    editor.chain().focus().setBookmark({ id, label: text }).run();
  }, [editor]);

  const removeBookmark = useCallback(() => {
    editor.chain().focus().unsetBookmark().run();
  }, [editor]);

  // ─── Voice dictation ───────────────────────────────────────────────────────

  const handleVoiceStart = useCallback(() => {
    const { from, to } = editor.state.selection;
    dictationSelectionRef.current = { from, to };
  }, [editor]);

  const handleVoiceText = (text: string) => {
    setInterimText('');
    const trimmed = text.trim();
    if (!trimmed) return;

    const { from: currentFrom, to: currentTo } = editor.state.selection;
    const savedSelection = dictationSelectionRef.current ?? { from: currentFrom, to: currentTo };
    dictationSelectionRef.current = null;

    const maxPos = editor.state.doc.content.size;
    const safeFrom = Math.max(1, Math.min(savedSelection.from, maxPos));
    const safeTo = Math.max(safeFrom, Math.min(savedSelection.to, maxPos));

    const prevChar =
      safeFrom > 1 ? editor.state.doc.textBetween(safeFrom - 1, safeFrom, '\n', '\n') : '';

    const shouldPrefixSpace =
      safeFrom === safeTo &&
      safeFrom > 1 &&
      prevChar.length > 0 &&
      !/\s/.test(prevChar) &&
      !/^[,.;:!?)]/.test(trimmed);

    const contentToInsert = shouldPrefixSpace ? ` ${trimmed}` : trimmed;
    editor.commands.insertContentAt({ from: safeFrom, to: safeTo }, contentToInsert);
  };

  const handleInterim = (text: string) => setInterimText(text);

  return (
    <div className="border-border bg-card flex flex-wrap items-center gap-0.5 border-b px-2 py-1.5">
      {/* Headings dropdown */}
      <div className="relative">
        <ToolbarButton
          ref={headingBtnRef}
          title="Heading"
          active={[1, 2, 3, 4, 5, 6].some((l) => editor.isActive('heading', { level: l }))}
          onClick={() => {
            const opening = !headingOpen;
            closeAll();
            setHeadingOpen(opening);
          }}
        >
          {/* show current level or generic icon */}
          {(() => {
            const level = [1, 2, 3, 4, 5, 6].find((l) => editor.isActive('heading', { level: l }));
            switch (level) {
              case 1:
                return <Heading1 size={14} />;
              case 2:
                return <Heading2 size={14} />;
              case 3:
                return <Heading3 size={14} />;
              default:
                return <Heading size={14} />;
            }
          })()}
        </ToolbarButton>
        <PortalDropdown anchorRef={headingBtnRef} open={headingOpen}>
          <AnimatePresence>
            {headingOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: popupDuration, ease: [0.22, 1, 0.36, 1] }}
                  className="fixed inset-0 z-10"
                  aria-hidden
                  onClick={() => setHeadingOpen(false)}
                />
                <motion.div
                  initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.97 }}
                  animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
                  transition={{ duration: popupDuration, ease: [0.22, 1, 0.36, 1] }}
                  className="border-border bg-popover z-50 w-32 rounded-lg border p-2 shadow-lg"
                >
                  {[1, 2, 3].map((level) => (
                    <button
                      key={level}
                      type="button"
                      className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        editor
                          .chain()
                          .focus()
                          .toggleHeading({ level: level as 1 | 2 | 3 })
                          .run();
                        setHeadingOpen(false);
                      }}
                    >
                      {`H${level}`}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </PortalDropdown>
      </div>

      <span className="bg-border mx-1 h-5 w-px" />

      {/* Font family dropdown */}
      <div className="relative">
        <ToolbarButton
          ref={fontBtnRef}
          title="Font family"
          onClick={() => {
            const opening = !fontFamilyOpen;
            closeAll();
            setFontFamilyOpen(opening);
          }}
        >
          <Type size={14} />
          {/* show current selection or default */}
          {currentFontFamily && currentFontFamily !== 'Default' && (
            <span className="ml-1 max-w-16 truncate text-xs">
              {FONT_FAMILIES.find((f) => f.value === currentFontFamily)?.name || 'Custom'}
            </span>
          )}
        </ToolbarButton>
        <PortalDropdown anchorRef={fontBtnRef} open={fontFamilyOpen}>
          <AnimatePresence>
            {fontFamilyOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: popupDuration, ease: [0.22, 1, 0.36, 1] }}
                  className="fixed inset-0 z-10"
                  aria-hidden
                  onClick={() => setFontFamilyOpen(false)}
                />
                <motion.div
                  initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.97 }}
                  animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
                  transition={{ duration: popupDuration, ease: [0.22, 1, 0.36, 1] }}
                  className="border-border bg-popover z-50 max-h-60 w-40 overflow-auto rounded-lg border p-2 shadow-lg"
                >
                  {FONT_FAMILIES.map((font) => (
                    <button
                      key={font.name}
                      type="button"
                      className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (font.value) {
                          const { empty, from, to } = editor.state.selection;
                          if (empty) {
                            // apply to entire document then restore cursor
                            editor
                              .chain()
                              .focus()
                              .setTextSelection({ from: 1, to: editor.state.doc.content.size })
                              .setFontFamily(font.value)
                              .setTextSelection({ from, to })
                              .run();
                          } else {
                            editor.chain().focus().setFontFamily(font.value).run();
                          }
                        } else {
                          editor.chain().focus().unsetFontFamily().run();
                        }
                        setFontFamilyOpen(false);
                      }}
                    >
                      <span style={font.value ? { fontFamily: font.value } : undefined}>
                        {font.name}
                      </span>
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </PortalDropdown>
      </div>

      {/* Font size dropdown */}
      <div className="relative">
        <ToolbarButton
          ref={fontSizeBtnRef}
          title="Font size"
          onClick={() => {
            const opening = !fontSizeOpen;
            closeAll();
            setFontSizeOpen(opening);
          }}
        >
          <Text size={14} />
          {currentFontSize && currentFontSize !== 'Default' && (
            <span className="ml-1 max-w-12 truncate text-xs">{currentFontSize}</span>
          )}
        </ToolbarButton>
        <PortalDropdown anchorRef={fontSizeBtnRef} open={fontSizeOpen}>
          <AnimatePresence>
            {fontSizeOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: popupDuration, ease: [0.22, 1, 0.36, 1] }}
                  className="fixed inset-0 z-10"
                  aria-hidden
                  onClick={() => setFontSizeOpen(false)}
                />
                <motion.div
                  initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.97 }}
                  animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
                  transition={{ duration: popupDuration, ease: [0.22, 1, 0.36, 1] }}
                  className="border-border bg-popover z-50 max-h-60 w-32 overflow-auto rounded-lg border p-2 shadow-lg"
                >
                  {FONT_SIZES.map((size) => (
                    <button
                      key={size.name}
                      type="button"
                      className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (size.value) {
                          const { empty, from, to } = editor.state.selection;
                          if (empty) {
                            editor
                              .chain()
                              .focus()
                              .setTextSelection({ from: 1, to: editor.state.doc.content.size })
                              .setFontSize(size.value)
                              .setTextSelection({ from, to })
                              .run();
                          } else {
                            editor.chain().focus().setFontSize(size.value).run();
                          }
                        } else {
                          editor.chain().focus().unsetFontSize().run();
                        }
                        setFontSizeOpen(false);
                      }}
                    >
                      <span
                        style={size.value ? { fontSize: size.value } : undefined}
                        className="max-w-12 truncate"
                      >
                        {size.name}
                      </span>
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </PortalDropdown>
      </div>

      <span className="bg-border mx-1 h-5 w-px" />

      {/* Text formatting */}
      <ToolbarButton
        title="Bold (Ctrl+B)"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Italic (Ctrl+I)"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Underline (Ctrl+U)"
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Strikethrough"
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Inline code"
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code size={14} />
      </ToolbarButton>

      <span className="bg-border mx-1 h-5 w-px" />

      {/* Alignment dropdown */}
      <div className="relative">
        <ToolbarButton
          ref={alignBtnRef}
          title="Text alignment"
          active={['left', 'center', 'right', 'justify'].some((a) =>
            editor.isActive({ textAlign: a as any }),
          )}
          onClick={() => {
            const opening = !alignOpen;
            closeAll();
            setAlignOpen(opening);
          }}
        >
          {/* show current align or left icon */}
          {(() => {
            if (editor.isActive({ textAlign: 'center' })) return <AlignCenter size={14} />;
            if (editor.isActive({ textAlign: 'right' })) return <AlignRight size={14} />;
            if (editor.isActive({ textAlign: 'justify' })) return <AlignJustify size={14} />;
            return <AlignLeft size={14} />;
          })()}
        </ToolbarButton>
        <PortalDropdown anchorRef={alignBtnRef} open={alignOpen}>
          <AnimatePresence>
            {alignOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: popupDuration, ease: [0.22, 1, 0.36, 1] }}
                  className="fixed inset-0 z-10"
                  aria-hidden
                  onClick={() => setAlignOpen(false)}
                />
                <motion.div
                  initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.97 }}
                  animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
                  transition={{ duration: popupDuration, ease: [0.22, 1, 0.36, 1] }}
                  className="border-border bg-popover z-50 w-28 rounded-lg border p-2 shadow-lg"
                >
                  {[
                    { label: 'Left', icon: <AlignLeft size={14} />, value: 'left' },
                    { label: 'Center', icon: <AlignCenter size={14} />, value: 'center' },
                    { label: 'Right', icon: <AlignRight size={14} />, value: 'right' },
                    { label: 'Justify', icon: <AlignJustify size={14} />, value: 'justify' },
                  ].map(({ label, icon, value }) => (
                    <button
                      key={value}
                      type="button"
                      className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        editor
                          .chain()
                          .focus()
                          .setTextAlign(value as any)
                          .run();
                        setAlignOpen(false);
                      }}
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </PortalDropdown>
      </div>
      <span className="bg-border mx-1 h-5 w-px" />

      {/* Lists & blockquote */}
      <ToolbarButton
        title="Bullet list"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Ordered list"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Blockquote"
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Horizontal rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Code block (fenced)"
        active={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <CodeSquare size={14} />
      </ToolbarButton>

      <span className="bg-border mx-1 h-5 w-px" />

      {/* Text color */}
      <div className="relative">
        <ToolbarButton
          title="Text color"
          onClick={() => {
            const opening = !colorOpen;
            closeAll();
            setColorOpen(opening);
          }}
        >
          <span
            className="border-border inline-block h-4 w-4 rounded border"
            style={{ backgroundColor: editor.getAttributes('textStyle').color || 'currentColor' }}
          />
        </ToolbarButton>
        {colorOpen && (
          <ColorPickerDropdown
            currentColor={(editor.getAttributes('textStyle') as { color?: string }).color}
            onSelectColor={(hex) => {
              if (hex) editor.chain().focus().setColor(hex).run();
              else editor.chain().focus().unsetColor().run();
            }}
            onClose={() => setColorOpen(false)}
          />
        )}
      </div>

      {/* Highlight */}
      <div className="relative">
        <ToolbarButton
          title="Highlight"
          active={!!editor.getAttributes('highlight').color}
          onClick={() => {
            const opening = !highlightOpen;
            closeAll();
            setHighlightOpen(opening);
          }}
        >
          <Highlighter size={14} />
        </ToolbarButton>
        {highlightOpen && (
          <HighlightPickerDropdown
            currentHighlight={(editor.getAttributes('highlight') as { color?: string }).color}
            onSelectHighlight={(hex) => {
              if (hex) editor.chain().focus().toggleHighlight({ color: hex }).run();
              else editor.chain().focus().unsetHighlight().run();
            }}
            onClose={() => setHighlightOpen(false)}
          />
        )}
      </div>

      {/* Link */}
      <div className="relative">
        <ToolbarButton
          title={editor.isActive('link') ? 'Edit link' : 'Add link'}
          active={editor.isActive('link')}
          // capture selection on mouse down before the toolbar button steals focus
          onMouseDown={() => {
            const { from, to } = editor.state.selection;
            linkSelectionRef.current = { from, to };
          }}
          onClick={() => {
            setLinkOpen((v) => !v);
            setColorOpen(false);
            setHighlightOpen(false);
          }}
        >
          <LinkIcon size={14} />
        </ToolbarButton>
        <AnimatePresence>
          {linkOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: popupDuration, ease: [0.22, 1, 0.36, 1] }}
                className="fixed inset-0 z-10"
                aria-hidden
                onClick={() => setLinkOpen(false)}
              />
              <motion.div
                initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.97 }}
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
                transition={{ duration: popupDuration, ease: [0.22, 1, 0.36, 1] }}
                className="border-border bg-popover absolute top-full left-0 z-20 mt-1 w-64 rounded-lg border p-2 shadow-lg"
              >
                <input
                  ref={linkInputRef}
                  type="url"
                  placeholder="https://"
                  className="border-border bg-background focus:ring-ring w-full rounded border px-2 py-1.5 text-xs outline-none focus:ring-1"
                  defaultValue={editor.getAttributes('link').href || ''}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setLink();
                    }
                    if (e.key === 'Escape') {
                      setLinkOpen(false);
                    }
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                />
                <div className="mt-2 flex gap-1">
                  <button
                    type="button"
                    className="bg-primary text-primary-foreground rounded px-2 py-1 text-xs hover:opacity-90"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setLink();
                    }}
                  >
                    Apply
                  </button>
                  {editor.isActive('link') && (
                    <button
                      type="button"
                      className="border-border hover:bg-accent rounded border px-2 py-1 text-xs"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        unsetLink();
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Comment */}
      <div className="relative">
        <ToolbarButton
          title={editor.isActive('comment') ? 'Edit comment' : 'Add comment'}
          active={editor.isActive('comment')}
          onClick={() => {
            setCommentOpen((v) => !v);
            setColorOpen(false);
            setHighlightOpen(false);
            setLinkOpen(false);
            if (!commentOpen) {
              const attrs = editor.getAttributes('comment');
              setTimeout(() => {
                if (commentInputRef.current) {
                  commentInputRef.current.value = attrs.commentText || '';
                }
              }, 0);
            }
          }}
        >
          <MessageSquare size={14} />
        </ToolbarButton>
        <AnimatePresence>
          {commentOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: popupDuration, ease: [0.22, 1, 0.36, 1] }}
                className="fixed inset-0 z-10"
                aria-hidden
                onClick={() => setCommentOpen(false)}
              />
              <motion.div
                initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.97 }}
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
                transition={{ duration: popupDuration, ease: [0.22, 1, 0.36, 1] }}
                className="border-border bg-popover absolute top-full left-0 z-20 mt-1 w-72 rounded-lg border p-2 shadow-lg"
              >
                <label
                  htmlFor="editor-comment-input"
                  className="text-muted-foreground text-xs font-medium"
                >
                  Comment text
                </label>
                <textarea
                  id="editor-comment-input"
                  ref={commentInputRef}
                  placeholder="Add a note…"
                  rows={3}
                  className="border-border bg-background focus:ring-ring mt-1 w-full resize-y rounded border px-2 py-1.5 text-sm outline-none focus:ring-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setCommentOpen(false);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                />
                <div className="mt-2 flex gap-1">
                  <button
                    type="button"
                    className="bg-primary text-primary-foreground rounded px-2 py-1 text-xs hover:opacity-90"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applyComment();
                    }}
                  >
                    Apply
                  </button>
                  {editor.isActive('comment') && (
                    <button
                      type="button"
                      className="border-border hover:bg-accent rounded border px-2 py-1 text-xs"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        removeComment();
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Bookmark */}
      <div className="relative">
        <ToolbarButton
          title="Bookmarks"
          active={editor.isActive('bookmark')}
          onClick={() => {
            if (editor.isActive('bookmark')) {
              removeBookmark();
            } else if (editor.state.selection.empty) {
              setBookmarksOpen((v) => !v);
            } else {
              addBookmark();
            }
            closeAll();
          }}
        >
          <Bookmark size={14} />
        </ToolbarButton>
        <AnimatePresence>
          {bookmarksOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: popupDuration, ease: [0.22, 1, 0.36, 1] }}
                className="fixed inset-0 z-40"
                aria-hidden
                onClick={() => setBookmarksOpen(false)}
              />
              <motion.div
                initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.97 }}
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
                transition={{ duration: popupDuration, ease: [0.22, 1, 0.36, 1] }}
                className="absolute top-full right-0 z-50 mt-1"
              >
                <BookmarksPanel editor={editor} onClose={() => setBookmarksOpen(false)} />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <EmojiPickerPopover
        editor={editor}
        open={emojiOpen}
        onOpen={() => {
          const opening = !emojiOpen;
          closeAll();
          setEmojiOpen(opening);
        }}
        onClose={() => setEmojiOpen(false)}
      />

      <span className="bg-border mx-1 h-5 w-px" />

      {/* Voice dictation */}
      <VoiceDictationButton
        onTextRecognized={handleVoiceText}
        onInterimText={handleInterim}
        onRecordingStart={handleVoiceStart}
        language={dictationLanguage}
        blockId={blockId ?? 'page-editor'}
      />
      <VoiceDictationLanguageButton onLanguageChange={setDictationLanguage} />

      <span className="bg-border mx-1 h-5 w-px" />

      {/* Undo / Redo */}
      <ToolbarButton title="Undo" onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 size={14} />
      </ToolbarButton>
      <ToolbarButton title="Redo" onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 size={14} />
      </ToolbarButton>

      {/* Interim dictation text — shown as a floating overlay near the cursor */}
      <DictationOverlay editor={editor} text={interimText} />
    </div>
  );
}
