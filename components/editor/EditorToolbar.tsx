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
import {
  Bold, Italic, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Code, CodeSquare, Minus,
  Underline as UnderlineIcon, Link as LinkIcon, MessageSquare,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Highlighter, Undo2, Redo2, Bookmark,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { useI18n, type Locale } from '@/lib/i18n';
import { VoiceDictationButton } from '@/components/MainContent/blocks/VoiceDictationButton';
import { VoiceDictationLanguageButton } from '@/components/MainContent/blocks/VoiceDictationLanguageButton';
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
    if (!text) { setPos(null); return; }
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
      className="pointer-events-none fixed z-50 rounded-md border border-border bg-card/90 px-2 py-1 text-xs text-muted-foreground shadow-md backdrop-blur"
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
        'flex h-7 w-7 items-center justify-center rounded text-sm transition-colors',
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

type EditorToolbarProps = {
  editor: Editor;
  blockId?: string;
};

export function EditorToolbar({ editor, blockId }: EditorToolbarProps) {
  const { locale } = useI18n();

  const linkInputRef = useRef<HTMLInputElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const [linkOpen, setLinkOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [dictationLanguage, setDictationLanguage] = useState<Locale>(locale);
  const [interimText, setInterimText] = useState('');

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
      (editor.chain().focus() as unknown as {
        setComment: (a: { id: string; commentText: string }) => { run: () => boolean };
      }).setComment({ id, commentText: text }).run();
    }
    setCommentOpen(false);
  }, [editor]);

  const removeComment = useCallback(() => {
    (editor.chain().focus() as unknown as {
      unsetComment: () => { run: () => boolean };
    }).unsetComment?.().run();
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

  const handleVoiceText = (text: string) => {
    setInterimText('');
    const cur = editor.getHTML();
    editor.chain().focus('end').insertContent(cur === '<p></p>' ? text : ` ${text}`).run();
  };

  const handleInterim = (text: string) => setInterimText(text);

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-card px-2 py-1.5">
      {/* Headings */}
      <ToolbarButton title="Heading 1" active={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 size={14} />
      </ToolbarButton>
      <ToolbarButton title="Heading 2" active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 size={14} />
      </ToolbarButton>
      <ToolbarButton title="Heading 3" active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 size={14} />
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-border" />

      {/* Text formatting */}
      <ToolbarButton title="Bold (Ctrl+B)" active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold size={14} />
      </ToolbarButton>
      <ToolbarButton title="Italic (Ctrl+I)" active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic size={14} />
      </ToolbarButton>
      <ToolbarButton title="Underline (Ctrl+U)" active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon size={14} />
      </ToolbarButton>
      <ToolbarButton title="Strikethrough" active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough size={14} />
      </ToolbarButton>
      <ToolbarButton title="Inline code" active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code size={14} />
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-border" />

      {/* Alignment */}
      <ToolbarButton title="Align left" active={editor.isActive({ textAlign: 'left' })}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}>
        <AlignLeft size={14} />
      </ToolbarButton>
      <ToolbarButton title="Align center" active={editor.isActive({ textAlign: 'center' })}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}>
        <AlignCenter size={14} />
      </ToolbarButton>
      <ToolbarButton title="Align right" active={editor.isActive({ textAlign: 'right' })}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}>
        <AlignRight size={14} />
      </ToolbarButton>
      <ToolbarButton title="Justify" active={editor.isActive({ textAlign: 'justify' })}
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}>
        <AlignJustify size={14} />
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-border" />

      {/* Lists & blockquote */}
      <ToolbarButton title="Bullet list" active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List size={14} />
      </ToolbarButton>
      <ToolbarButton title="Ordered list" active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered size={14} />
      </ToolbarButton>
      <ToolbarButton title="Blockquote" active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote size={14} />
      </ToolbarButton>
      <ToolbarButton title="Horizontal rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus size={14} />
      </ToolbarButton>
      <ToolbarButton title="Code block (fenced)" active={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <CodeSquare size={14} />
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-border" />

      {/* Text colour */}
      <div className="relative">
        <ToolbarButton title="Text colour"
          onClick={() => { setColorOpen((v) => !v); setHighlightOpen(false); setLinkOpen(false); }}>
          <span className="inline-block h-4 w-4 rounded border border-border"
            style={{ backgroundColor: editor.getAttributes('textStyle').color || 'currentColor' }} />
        </ToolbarButton>
        {colorOpen && (
          <>
            <div className="fixed inset-0 z-10" aria-hidden onClick={() => setColorOpen(false)} />
            <div className="absolute left-0 top-full z-20 mt-1 w-40 rounded-lg border border-border bg-popover p-2 shadow-lg">
              {TEXT_COLORS.map(({ name, value }) => (
                <button key={name} type="button"
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (value) editor.chain().focus().setColor(value).run();
                    else editor.chain().focus().unsetColor().run();
                    setColorOpen(false);
                  }}>
                  <span className="h-4 w-4 rounded border border-border"
                    style={{ backgroundColor: value || 'transparent' }} />
                  {name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Highlight */}
      <div className="relative">
        <ToolbarButton title="Highlight" active={!!editor.getAttributes('highlight').color}
          onClick={() => { setHighlightOpen((v) => !v); setColorOpen(false); setLinkOpen(false); }}>
          <Highlighter size={14} />
        </ToolbarButton>
        {highlightOpen && (
          <>
            <div className="fixed inset-0 z-10" aria-hidden onClick={() => setHighlightOpen(false)} />
            <div className="absolute left-0 top-full z-20 mt-1 w-40 rounded-lg border border-border bg-popover p-2 shadow-lg">
              {HIGHLIGHT_COLORS.map(({ name, value }) => (
                <button key={name} type="button"
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (value) editor.chain().focus().toggleHighlight({ color: value }).run();
                    else editor.chain().focus().unsetHighlight().run();
                    setHighlightOpen(false);
                  }}>
                  <span className="h-4 w-4 rounded border border-border"
                    style={{ backgroundColor: value || 'transparent' }} />
                  {name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Link */}
      <div className="relative">
        <ToolbarButton title={editor.isActive('link') ? 'Edit link' : 'Add link'}
          active={editor.isActive('link')}
          onClick={() => { setLinkOpen((v) => !v); setColorOpen(false); setHighlightOpen(false); }}>
          <LinkIcon size={14} />
        </ToolbarButton>
        {linkOpen && (
          <>
            <div className="fixed inset-0 z-10" aria-hidden onClick={() => setLinkOpen(false)} />
            <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-border bg-popover p-2 shadow-lg">
              <input
                ref={linkInputRef}
                type="url"
                placeholder="https://"
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
                defaultValue={editor.getAttributes('link').href || ''}
                onKeyDown={(e) => { if (e.key === 'Enter') setLink(); if (e.key === 'Escape') setLinkOpen(false); }}
                onMouseDown={(e) => e.stopPropagation()}
              />
              <div className="mt-2 flex gap-1">
                <button type="button"
                  className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:opacity-90"
                  onMouseDown={(e) => { e.preventDefault(); setLink(); }}>
                  Apply
                </button>
                {editor.isActive('link') && (
                  <button type="button"
                    className="rounded border border-border px-2 py-1 text-xs hover:bg-accent"
                    onMouseDown={(e) => { e.preventDefault(); unsetLink(); }}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Comment */}
      <div className="relative">
        <ToolbarButton title={editor.isActive('comment') ? 'Edit comment' : 'Add comment'}
          active={editor.isActive('comment')}
          onClick={() => {
            setCommentOpen((v) => !v); setColorOpen(false); setHighlightOpen(false); setLinkOpen(false);
            if (!commentOpen) {
              const attrs = editor.getAttributes('comment');
              setTimeout(() => {
                if (commentInputRef.current) {
                  commentInputRef.current.value = attrs.commentText || '';
                }
              }, 0);
            }
          }}>
          <MessageSquare size={14} />
        </ToolbarButton>
        {commentOpen && (
          <>
            <div className="fixed inset-0 z-10" aria-hidden onClick={() => setCommentOpen(false)} />
            <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-lg border border-border bg-popover p-2 shadow-lg">
              <label htmlFor="editor-comment-input" className="text-xs font-medium text-muted-foreground">
                Comment text
              </label>
              <textarea
                id="editor-comment-input"
                ref={commentInputRef}
                placeholder="Add a note…"
                rows={3}
                className="mt-1 w-full resize-y rounded border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                onKeyDown={(e) => { if (e.key === 'Escape') setCommentOpen(false); }}
                onMouseDown={(e) => e.stopPropagation()}
              />
              <div className="mt-2 flex gap-1">
                <button type="button"
                  className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:opacity-90"
                  onMouseDown={(e) => { e.preventDefault(); applyComment(); }}>
                  Apply
                </button>
                {editor.isActive('comment') && (
                  <button type="button"
                    className="rounded border border-border px-2 py-1 text-xs hover:bg-accent"
                    onMouseDown={(e) => { e.preventDefault(); removeComment(); }}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bookmark */}
      <div className="relative">
        <ToolbarButton
          title="Bookmarks"
          active={editor.isActive('bookmark')}
          onClick={() => {
            if (editor.isActive('bookmark')) {
              removeBookmark();
            } else if (!editor.state.selection.empty) {
              addBookmark();
            } else {
              setBookmarksOpen((v) => !v);
            }
            closeAll();
          }}
        >
          <Bookmark size={14} />
        </ToolbarButton>
        {bookmarksOpen && (
          <>
            <div className="fixed inset-0 z-10" aria-hidden onClick={() => setBookmarksOpen(false)} />
            <div className="absolute right-0 top-full z-20 mt-1">
              <BookmarksPanel editor={editor} onClose={() => setBookmarksOpen(false)} />
            </div>
          </>
        )}
      </div>

      <span className="mx-1 h-5 w-px bg-border" />

      {/* Voice dictation */}
      <VoiceDictationButton
        onTextRecognized={handleVoiceText}
        onInterimText={handleInterim}
        language={dictationLanguage}
        blockId={blockId ?? 'page-editor'}
      />
      <VoiceDictationLanguageButton onLanguageChange={setDictationLanguage} />

      <span className="mx-1 h-5 w-px bg-border" />

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
