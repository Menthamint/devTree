'use client';

/**
 * SlashCommand — typing "/" on an empty line opens a block-picker menu.
 *
 * Uses @tiptap/suggestion under the hood. Each item in the list calls editor
 * commands to insert the appropriate node at the cursor position.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';
import {
  CheckSquare,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Palette,
  Quote,
  Table,
  Type,
  Video,
  Volume2,
} from 'lucide-react';

import { cn } from '@/lib/utils';

// ─── Slash item definitions ───────────────────────────────────────────────────

export type SlashCommandItem = {
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  /**
   * `command` is used by the slash-command suggestion flow: it runs on the already-
   * focused cursor position and uses `clearNodes()` to replace the current line.
   */
  command: (editor: Editor) => void;
  /**
   * `insertSpec` is the Tiptap JSONContent used by block pickers when inserting
   * at a specific position WITHOUT a pre-inserted placeholder paragraph.
   * This avoids the layout jump caused by inserting a paragraph, then replacing it.
   */
  insertSpec: Record<string, unknown>;
};

export const SLASH_ITEMS: SlashCommandItem[] = [
  {
    title: 'Paragraph',
    description: 'Plain text paragraph',
    icon: Type,
    insertSpec: { type: 'paragraph' },
    command: (editor) => editor.chain().focus().clearNodes().setParagraph().run(),
  },
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: Heading1,
    insertSpec: { type: 'heading', attrs: { level: 1 } },
    command: (editor) => editor.chain().focus().clearNodes().setHeading({ level: 1 }).run(),
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: Heading2,
    insertSpec: { type: 'heading', attrs: { level: 2 } },
    command: (editor) => editor.chain().focus().clearNodes().setHeading({ level: 2 }).run(),
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: Heading3,
    insertSpec: { type: 'heading', attrs: { level: 3 } },
    command: (editor) => editor.chain().focus().clearNodes().setHeading({ level: 3 }).run(),
  },
  {
    title: 'Bullet List',
    description: 'Unordered list with bullet points',
    icon: List,
    insertSpec: {
      type: 'bulletList',
      content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
    },
    command: (editor) => editor.chain().focus().clearNodes().toggleBulletList().run(),
  },
  {
    title: 'Numbered List',
    description: 'Ordered list with numbers',
    icon: ListOrdered,
    insertSpec: {
      type: 'orderedList',
      content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
    },
    command: (editor) => editor.chain().focus().clearNodes().toggleOrderedList().run(),
  },
  {
    title: 'Blockquote',
    description: 'Indented quote block',
    icon: Quote,
    insertSpec: { type: 'blockquote', content: [{ type: 'paragraph' }] },
    command: (editor) => editor.chain().focus().clearNodes().toggleBlockquote().run(),
  },
  {
    title: 'Divider',
    description: 'Horizontal rule divider',
    icon: Minus,
    insertSpec: { type: 'horizontalRule' },
    command: (editor) => editor.chain().focus().clearNodes().setHorizontalRule().run(),
  },
  {
    title: 'Code Block',
    description: 'Monaco code editor block',
    icon: Code2,
    insertSpec: { type: 'codeBlockNode' },
    command: (editor) =>
      editor.chain().focus().clearNodes().insertContent({ type: 'codeBlockNode' }).run(),
  },
  {
    title: 'Checklist',
    description: 'Interactive checklist / agenda',
    icon: CheckSquare,
    insertSpec: { type: 'checklistNode' },
    command: (editor) =>
      editor.chain().focus().clearNodes().insertContent({ type: 'checklistNode' }).run(),
  },
  {
    title: 'Canvas',
    description: 'Excalidraw drawing canvas',
    icon: Palette,
    insertSpec: { type: 'canvasNode' },
    command: (editor) =>
      editor.chain().focus().clearNodes().insertContent({ type: 'canvasNode' }).run(),
  },
  {
    title: 'Audio',
    description: 'Audio player block',
    icon: Volume2,
    insertSpec: { type: 'audioNode' },
    command: (editor) =>
      editor.chain().focus().clearNodes().insertContent({ type: 'audioNode' }).run(),
  },
  {
    title: 'Video',
    description: 'YouTube or video embed',
    icon: Video,
    insertSpec: { type: 'videoNode' },
    command: (editor) =>
      editor.chain().focus().clearNodes().insertContent({ type: 'videoNode' }).run(),
  },
  {
    title: 'Image',
    description: 'Image with optional caption',
    icon: Image,
    insertSpec: { type: 'imageNode' },
    command: (editor) =>
      editor.chain().focus().clearNodes().insertContent({ type: 'imageNode' }).run(),
  },
  {
    title: 'Link Card',
    description: 'Link with label',
    icon: LinkIcon,
    insertSpec: { type: 'linkCardNode' },
    command: (editor) =>
      editor.chain().focus().clearNodes().insertContent({ type: 'linkCardNode' }).run(),
  },
  {
    title: 'Table',
    description: 'Spreadsheet-style table',
    icon: Table,
    insertSpec: {
      type: 'tableBlockNode',
      attrs: { headers: ['Column 1', 'Column 2'], rows: [['', '']] },
    },
    command: (editor) =>
      editor
        .chain()
        .focus()
        .clearNodes()
        .insertContent({
          type: 'tableBlockNode',
          attrs: {
            headers: ['Column 1', 'Column 2'],
            rows: [['', '']],
          },
        })
        .run(),
  },
];

// ─── SlashCommandList component ───────────────────────────────────────────────

type SlashListProps = {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
};

export type SlashListHandle = {
  onKeyDown: (event: KeyboardEvent) => boolean;
};

const SlashCommandList = forwardRef<SlashListHandle, SlashListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- calling setState in useEffect is valid React
    setSelectedIndex(0);
  }, [props.items]);

  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  useImperativeHandle(ref, () => ({
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((i) => (i - 1 + props.items.length) % props.items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((i) => (i + 1) % props.items.length);
        return true;
      }
      if (event.key === 'Enter') {
        const item = props.items[selectedIndex];
        if (item) props.command(item);
        return true;
      }
      return false;
    },
  }));

  if (props.items.length === 0) {
    return (
      <div className="border-border bg-popover min-w-60 rounded-xl border p-2 shadow-lg">
        <p className="text-muted-foreground px-2 py-1.5 text-xs">No results</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="tiptap-slash-list border-border bg-popover max-h-80 min-w-60 overflow-y-auto rounded-xl border p-1 shadow-lg"
    >
      {props.items.map((item, index) => {
        const Icon = item.icon;
        return (
          <button
            key={item.title}
            type="button"
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            className={cn(
              'motion-interactive flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors',
              index === selectedIndex
                ? 'bg-accent text-accent-foreground'
                : 'text-foreground hover:bg-accent/50',
            )}
            onClick={() => props.command(item)}
          >
            <span className="motion-surface border-border bg-card flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border">
              <Icon size={14} />
            </span>
            <div>
              <div className="text-sm font-medium">{item.title}</div>
              <div className="text-muted-foreground text-xs">{item.description}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
});
SlashCommandList.displayName = 'SlashCommandList';

// ─── Suggestion options builder ───────────────────────────────────────────────

function buildSuggestionOptions(): Omit<SuggestionOptions, 'editor'> {
  return {
    char: '/',
    allowSpaces: false,
    startOfLine: false,

    items: ({ query }: { query: string }) => {
      const q = query.toLowerCase().trim();
      if (!q) return SLASH_ITEMS;
      return SLASH_ITEMS.filter(
        (item) =>
          item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q),
      );
    },

    render: () => {
      let reactRenderer: ReactRenderer<SlashListHandle> | null = null;
      let popupEl: HTMLDivElement | null = null;
      let removeOutsideListener: (() => void) | null = null;

      const cleanup = () => {
        if (removeOutsideListener) {
          removeOutsideListener();
          removeOutsideListener = null;
        }
        if (popupEl) {
          popupEl.remove();
          popupEl = null;
        }
        reactRenderer?.destroy();
        reactRenderer = null;
      };

      return {
        onStart(props) {
          // Create a DOM container for the portal
          popupEl = document.createElement('div');
          popupEl.style.position = 'fixed';
          popupEl.style.zIndex = '9999';
          document.body.appendChild(popupEl);

          reactRenderer = new ReactRenderer(SlashCommandList, {
            props: { ...props, popupEl },
            editor: props.editor,
          });

          // Append renderer DOM into the container
          if (reactRenderer.element) {
            popupEl.appendChild(reactRenderer.element);
          }

          // Position below the cursor
          if (props.clientRect) {
            const rect = props.clientRect();
            if (rect) {
              popupEl.style.top = `${rect.bottom + 4}px`;
              popupEl.style.left = `${rect.left}px`;
            }
          }

          const onPointerDownOutside = (event: PointerEvent) => {
            const target = event.target as Node | null;
            if (!popupEl || popupEl.contains(target)) return;
            props.editor.commands.blur();
          };
          document.addEventListener('pointerdown', onPointerDownOutside, true);
          removeOutsideListener = () =>
            document.removeEventListener('pointerdown', onPointerDownOutside, true);
        },

        onUpdate(props) {
          reactRenderer?.updateProps({ ...props, popupEl });
          if (!props.clientRect) return;
          const rect = props.clientRect();
          if (rect && popupEl) {
            popupEl.style.top = `${rect.bottom + 4}px`;
            popupEl.style.left = `${rect.left}px`;
          }
        },

        onKeyDown(props) {
          if (props.event.key === 'Escape') {
            props.editor.commands.blur();
            return true;
          }
          return reactRenderer?.ref?.onKeyDown(props.event) ?? false;
        },

        onExit() {
          cleanup();
        },
      };
    },

    command: ({ editor, range, props }) => {
      // Delete the slash + query text before inserting the block
      editor.chain().focus().deleteRange(range).run();
      (props as SlashCommandItem).command(editor);
    },
  };
}

// ─── Extension ────────────────────────────────────────────────────────────────

const SlashCommand = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: buildSuggestionOptions(),
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
