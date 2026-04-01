'use client';

import { lazy, Suspense, useEffect, useRef, useState } from 'react';

import type { JSONContent } from '@tiptap/core';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Highlighter,
  Italic,
  Minus,
  Smile,
  Strikethrough,
  Underline as UnderlineIcon,
} from 'lucide-react';

import { ColorPickerDropdown } from '@/components/features/editor/ColorPickerDropdown';
import { EmojiSuggestion } from '@/components/features/editor/extensions/EmojiSuggestion';
import { HighlightPickerDropdown } from '@/components/features/editor/HighlightPickerDropdown';
import { ToolbarButton } from '@/components/features/editor/ToolbarButton';
import { cn } from '@/lib/utils';

const EmojiMartPicker = lazy(() =>
  import('@emoji-mart/react').then((mod) => ({ default: mod.default })),
);

// `object` is intentional — emoji-mart data type is not exported from the package
let emojiDataCache: object | null = null;

type Props = {
  content: JSONContent | null;
  onChange: (content: JSONContent) => void;
  placeholder?: string;
};

export function TemplateBodyEditor({ content, onChange, placeholder }: Readonly<Props>) {
  const [colorOpen, setColorOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiData, setEmojiData] = useState<object | null>(emojiDataCache);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);

  useEffect(() => {
    if (emojiDataCache) {
      setEmojiData(emojiDataCache);
      return;
    }
    (async () => {
      const m = await import('@emoji-mart/data');
      emojiDataCache = m.default as object;
      setEmojiData(emojiDataCache);
    })().catch(() => {});
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({
        placeholder: placeholder ?? 'Write your template…',
      }),
      EmojiSuggestion,
    ],
    content: content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
    onUpdate({ editor: e }) {
      isInternalChange.current = true;
      queueMicrotask(() => {
        isInternalChange.current = false;
      });
      onChange(e.getJSON());
    },
  });

  useEffect(() => {
    if (!editor || !content) return;
    if (isInternalChange.current) return;
    editor.commands.setContent(content);
  }, [content, editor]);

  if (!editor) return null;

  const currentColor = (editor.getAttributes('textStyle') as { color?: string }).color ?? '';
  const currentHighlight = (editor.getAttributes('highlight') as { color?: string }).color ?? '';

  const openEmojiPicker = () => {
    setColorOpen(false);
    setHighlightOpen(false);
    setEmojiOpen((v) => !v);
  };

  // em-emoji-picker is a shadow-DOM web component; Tailwind CSS variables cannot
  // reach into it, so we must read the theme from the document class list directly.
  const theme =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light';

  return (
    <div ref={wrapperRef} className="border-border relative rounded-md border">
      <div className="border-border flex flex-wrap items-center gap-0.5 border-b px-2 py-1">
        <button
          type="button"
          title="Heading 2"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn(
            'motion-interactive flex h-7 items-center justify-center rounded px-1.5 text-xs font-semibold transition-colors',
            editor.isActive('heading', { level: 2 })
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          )}
        >
          H2
        </button>
        <button
          type="button"
          title="Heading 3"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={cn(
            'motion-interactive flex h-7 items-center justify-center rounded px-1.5 text-xs font-semibold transition-colors',
            editor.isActive('heading', { level: 3 })
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          )}
        >
          H3
        </button>

        <span className="bg-border mx-1 h-4 w-px" aria-hidden />

        <ToolbarButton
          title="Bold"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={13} />
        </ToolbarButton>
        <ToolbarButton
          title="Italic"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={13} />
        </ToolbarButton>
        <ToolbarButton
          title="Underline"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon size={13} />
        </ToolbarButton>
        <ToolbarButton
          title="Strikethrough"
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough size={13} />
        </ToolbarButton>

        <span className="bg-border mx-1 h-4 w-px" aria-hidden />

        <div className="relative">
          <ToolbarButton
            title="Text color"
            onClick={() => {
              setHighlightOpen(false);
              setColorOpen((v) => !v);
            }}
          >
            <span
              className="border-border inline-block h-4 w-4 rounded border"
              style={{ backgroundColor: currentColor || 'currentColor' }}
            />
          </ToolbarButton>
          {colorOpen && (
            <ColorPickerDropdown
              currentColor={currentColor}
              onSelectColor={(hex) => {
                if (hex) editor.chain().focus().setColor(hex).run();
                else editor.chain().focus().unsetColor().run();
              }}
              onClose={() => setColorOpen(false)}
            />
          )}
        </div>

        <div className="relative">
          <ToolbarButton
            title="Highlight"
            active={!!currentHighlight}
            onClick={() => {
              setColorOpen(false);
              setHighlightOpen((v) => !v);
            }}
          >
            <Highlighter size={13} />
          </ToolbarButton>
          {highlightOpen && (
            <HighlightPickerDropdown
              currentHighlight={currentHighlight}
              onSelectHighlight={(hex) => {
                if (hex) editor.chain().focus().setHighlight({ color: hex }).run();
                else editor.chain().focus().unsetHighlight().run();
              }}
              onClose={() => setHighlightOpen(false)}
            />
          )}
        </div>

        <span className="bg-border mx-1 h-4 w-px" aria-hidden />

        <div className="relative">
          <ToolbarButton title="Emoji" active={emojiOpen} onClick={openEmojiPicker}>
            <Smile size={14} />
          </ToolbarButton>
        </div>

        <ToolbarButton
          title="Horizontal rule"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus size={13} />
        </ToolbarButton>
      </div>

      {emojiOpen && emojiData && (
        <>
          <div
            className="fixed inset-0 z-40"
            aria-hidden
            onClick={() => setEmojiOpen(false)}
          />
          <div className="absolute top-9.5 right-0 z-50 rounded-xl shadow-lg">
            <Suspense fallback={null}>
              <EmojiMartPicker
                data={emojiData}
                onEmojiSelect={(emoji: { native: string }) => {
                  editor.chain().focus().insertContent(emoji.native).run();
                  setEmojiOpen(false);
                }}
                theme={theme}
                autoFocus
              />
            </Suspense>
          </div>
        </>
      )}

      <div data-testid="template-body-editor">
        <EditorContent
          editor={editor}
          className="max-h-70 min-h-45 overflow-y-auto px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}
