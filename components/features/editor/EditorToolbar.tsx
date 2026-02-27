'use client';

/**
 * EditorToolbar — top-of-editor formatting controls.
 *
 * Contains: headings, bold/italic/underline/strike/inline-code,
 * text alignment, lists, blockquote, hr, text colour, highlight,
 * link, comment, bookmark panel toggle, voice dictation, undo/redo.
 *
 * Extracted from the old TextBlock so it applies to the unified page editor.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { Editor } from '@tiptap/core';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Bookmark,
  Code,
  CodeSquare,
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
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react';

import { VoiceDictationButton } from '@/components/features/MainContent/voice-dictation/VoiceDictationButton';
import { VoiceDictationLanguageButton } from '@/components/features/MainContent/voice-dictation/VoiceDictationLanguageButton';
import { type Locale, useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

import { BookmarksPanel } from './BookmarksPanel';

// ─── Colors ───────────────────────────────────────────────────────────────────

const TEXT_COLORS = [
  { name: 'Default', value: '' },
  { name: 'Gray', value: '#6b7280' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Amber', value: '#d97706' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Purple', value: '#7c3aed' },
];

const HIGHLIGHT_COLORS = [
  { name: 'None', value: '' },
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Green', value: '#bbf7d0' },
  { name: 'Blue', value: '#bfdbfe' },
  { name: 'Pink', value: '#fbcfe8' },
  { name: 'Orange', value: '#fed7aa' },
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

// ─── ToolbarButton ────────────────────────────────────────────────────────────

type ToolbarButtonProps = Readonly<{
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}>;

export function ToolbarButton({ onClick, active, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault(); // keep editor focus
        onClick();
      }}
      className={cn(
        'motion-interactive flex h-7 w-7 items-center justify-center rounded text-sm transition-colors',
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      )}
    >
      {children}
    </button>
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

  const [linkOpen, setLinkOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [dictationLanguage, setDictationLanguage] = useState<Locale>(locale);
  const [interimText, setInterimText] = useState('');
  const dictationSelectionRef = useRef<{ from: number; to: number } | null>(null);

  const closeAll = () => {
    setLinkOpen(false);
    setColorOpen(false);
    setHighlightOpen(false);
    setCommentOpen(false);
  };

  // ─── Link ──────────────────────────────────────────────────────────────────

  const setLink = useCallback(() => {
    const url = linkInputRef.current?.value?.trim() ?? '';
    if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    setLinkOpen(false);
  }, [editor]);

  const unsetLink = useCallback(() => {
    editor.chain().focus().unsetLink().run();
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
      {/* Headings */}
      <ToolbarButton
        title="Heading 1"
        active={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Heading 2"
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Heading 3"
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 size={14} />
      </ToolbarButton>

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

      {/* Alignment */}
      <ToolbarButton
        title="Align left"
        active={editor.isActive({ textAlign: 'left' })}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
      >
        <AlignLeft size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Align center"
        active={editor.isActive({ textAlign: 'center' })}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
      >
        <AlignCenter size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Align right"
        active={editor.isActive({ textAlign: 'right' })}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
      >
        <AlignRight size={14} />
      </ToolbarButton>
      <ToolbarButton
        title="Justify"
        active={editor.isActive({ textAlign: 'justify' })}
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
      >
        <AlignJustify size={14} />
      </ToolbarButton>

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

      {/* Text colour */}
      <div className="relative">
        <ToolbarButton
          title="Text colour"
          onClick={() => {
            setColorOpen((v) => !v);
            setHighlightOpen(false);
            setLinkOpen(false);
          }}
        >
          <span
            className="border-border inline-block h-4 w-4 rounded border"
            style={{ backgroundColor: editor.getAttributes('textStyle').color || 'currentColor' }}
          />
        </ToolbarButton>
        <AnimatePresence>
          {colorOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: popupDuration, ease: [0.22, 1, 0.36, 1] }}
                className="fixed inset-0 z-10"
                aria-hidden
                onClick={() => setColorOpen(false)}
              />
              <motion.div
                initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.97 }}
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
                transition={{ duration: popupDuration, ease: [0.22, 1, 0.36, 1] }}
                className="border-border bg-popover absolute top-full left-0 z-20 mt-1 w-40 rounded-lg border p-2 shadow-lg"
              >
              {TEXT_COLORS.map(({ name, value }) => (
                <button
                  key={name}
                  type="button"
                  className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (value) editor.chain().focus().setColor(value).run();
                    else editor.chain().focus().unsetColor().run();
                    setColorOpen(false);
                  }}
                >
                  <span
                    className="border-border h-4 w-4 rounded border"
                    style={{ backgroundColor: value || 'transparent' }}
                  />
                  {name}
                </button>
              ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Highlight */}
      <div className="relative">
        <ToolbarButton
          title="Highlight"
          active={!!editor.getAttributes('highlight').color}
          onClick={() => {
            setHighlightOpen((v) => !v);
            setColorOpen(false);
            setLinkOpen(false);
          }}
        >
          <Highlighter size={14} />
        </ToolbarButton>
        <AnimatePresence>
          {highlightOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: popupDuration, ease: [0.22, 1, 0.36, 1] }}
                className="fixed inset-0 z-10"
                aria-hidden
                onClick={() => setHighlightOpen(false)}
              />
              <motion.div
                initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.97 }}
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
                transition={{ duration: popupDuration, ease: [0.22, 1, 0.36, 1] }}
                className="border-border bg-popover absolute top-full left-0 z-20 mt-1 w-40 rounded-lg border p-2 shadow-lg"
              >
              {HIGHLIGHT_COLORS.map(({ name, value }) => (
                <button
                  key={name}
                  type="button"
                  className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (value) editor.chain().focus().toggleHighlight({ color: value }).run();
                    else editor.chain().focus().unsetHighlight().run();
                    setHighlightOpen(false);
                  }}
                >
                  <span
                    className="border-border h-4 w-4 rounded border"
                    style={{ backgroundColor: value || 'transparent' }}
                  />
                  {name}
                </button>
              ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Link */}
      <div className="relative">
        <ToolbarButton
          title={editor.isActive('link') ? 'Edit link' : 'Add link'}
          active={editor.isActive('link')}
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
                className="fixed inset-0 z-10"
                aria-hidden
                onClick={() => setBookmarksOpen(false)}
              />
              <motion.div
                initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.97 }}
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
                transition={{ duration: popupDuration, ease: [0.22, 1, 0.36, 1] }}
                className="absolute top-full right-0 z-20 mt-1"
              >
                <BookmarksPanel editor={editor} onClose={() => setBookmarksOpen(false)} />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

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
