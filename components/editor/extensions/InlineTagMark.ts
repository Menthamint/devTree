/**
 * InlineTagMark — applies a coloured tag label to selected text.
 *
 * Rendered as <span data-inline-tag="tagname"> with a pill-style appearance
 * via CSS (see PageEditor.css). Tags are read back from the document JSON
 * to drive the per-page BlockTagFilter.
 *
 * Commands:
 *   editor.commands.setInlineTag({ tag: 'important' })
 *   editor.commands.unsetInlineTag()
 *   editor.commands.toggleInlineTag({ tag: 'important' })
 */

import { Mark, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    inlineTag: {
      /** Wrap the selection in an inline tag mark. */
      setInlineTag: (attrs: { tag: string }) => ReturnType;
      /** Remove an inline tag mark from the selection. */
      unsetInlineTag: () => ReturnType;
      /** Toggle an inline tag mark on the selection. */
      toggleInlineTag: (attrs: { tag: string }) => ReturnType;
    };
  }
}

export const InlineTagMark = Mark.create({
  name: 'inlineTag',

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      tag: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).dataset.inlineTag ?? null,
        renderHTML: (attrs) =>
          attrs.tag ? { 'data-inline-tag': attrs.tag } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-inline-tag]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'inline-tag-mark',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setInlineTag:
        (attrs) =>
        ({ commands }) =>
          commands.setMark(this.name, attrs),

      unsetInlineTag:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),

      toggleInlineTag:
        (attrs) =>
        ({ commands }) =>
          commands.toggleMark(this.name, attrs),
    };
  },
});
