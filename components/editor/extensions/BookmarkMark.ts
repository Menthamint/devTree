/**
 * BookmarkMark — custom Tiptap Mark for in-document bookmarks.
 *
 * Renders as <span data-bookmark-id="..." data-bookmark-label="..."> with a
 * visual indicator via CSS. Bookmarks can be navigated via the BookmarksPanel.
 */

import { Mark, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    bookmarkMark: {
      setBookmark: (attrs: { id: string; label: string }) => ReturnType;
      unsetBookmark: () => ReturnType;
    };
  }
}

export const BookmarkMark = Mark.create({
  name: 'bookmark',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.dataset.bookmarkId ?? null,
        renderHTML: (attrs) => (attrs.id ? { 'data-bookmark-id': attrs.id } : {}),
      },
      label: {
        default: '',
        parseHTML: (el) => el.dataset.bookmarkLabel ?? '',
        renderHTML: (attrs) => ({ 'data-bookmark-label': attrs.label ?? '' }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-bookmark-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const bookmarkLabel = typeof HTMLAttributes['data-bookmark-label'] === 'string'
      ? HTMLAttributes['data-bookmark-label']
      : '';
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'tiptap-bookmark',
        title: bookmarkLabel,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setBookmark:
        (attrs) =>
        ({ commands }) => {
          return commands.setMark(this.name, attrs);
        },
      unsetBookmark:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },
});
