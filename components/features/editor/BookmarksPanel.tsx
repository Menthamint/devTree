'use client';

/**
 * BookmarksPanel — shows all bookmarks in the current document.
 *
 * Scans editor state for `bookmark` marks and displays them as a navigable
 * list. Clicking a bookmark scrolls its position into view.
 */
import { useEffect, useState } from 'react';

import type { Editor } from '@tiptap/core';
import { Bookmark, X } from 'lucide-react';

type BookmarkEntry = {
  id: string;
  label: string;
  pos: number;
};

function collectBookmarks(editor: Editor): BookmarkEntry[] {
  const bookmarks: BookmarkEntry[] = [];
  editor.state.doc.descendants((node, pos) => {
    node.marks.forEach((mark) => {
      if (mark.type.name === 'bookmark') {
        bookmarks.push({
          id: mark.attrs.id as string,
          label: (mark.attrs.label as string) || 'Bookmark',
          pos,
        });
      }
    });
  });
  return bookmarks;
}

type BookmarksPanelProps = Readonly<{
  editor: Editor;
  onClose: () => void;
}>;

export function BookmarksPanel({ editor, onClose }: BookmarksPanelProps) {
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);

  useEffect(() => {
    const update = () => setBookmarks(collectBookmarks(editor));
    update();
    editor.on('update', update);
    return () => {
      editor.off('update', update);
    };
  }, [editor]);

  const jumpTo = (pos: number) => {
    editor.chain().focus().setTextSelection(pos).run();
    const domResult = editor.view.domAtPos(pos);
    (domResult.node as HTMLElement | null)?.scrollIntoView?.({
      behavior: 'smooth',
      block: 'center',
    });
  };

  return (
    <div className="border-border bg-popover flex min-w-56 flex-col rounded-xl border shadow-lg">
      <div className="border-border flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Bookmark size={13} className="text-muted-foreground" />
          <span className="text-foreground text-xs font-medium">Bookmarks</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="motion-interactive icon-spin-hover text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded p-0.5"
        >
          <X size={13} />
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto p-1">
        {bookmarks.length === 0 ? (
          <p className="text-muted-foreground px-3 py-2 text-xs">
            No bookmarks. Select text and click 🔖 to add one.
          </p>
        ) : (
          bookmarks.map((bm) => (
            <button
              key={bm.id}
              type="button"
              onClick={() => jumpTo(bm.pos)}
              className="motion-interactive hover:bg-accent flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm"
            >
              <Bookmark size={12} className="shrink-0 text-amber-500" />
              <span className="text-foreground truncate">{bm.label}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
