/**
 * Custom Tiptap Mark for inline comments (no Tiptap comment extension used).
 *
 * Renders as <span data-comment-id="..." data-comment-text="..."> so comments
 * are stored in the document HTML and can be shown in a tooltip on hover.
 * Comment text is escaped for safe use in HTML attributes.
 */

import { Mark, mergeAttributes } from '@tiptap/core';

/** Escape comment text for safe use in HTML data attributes (so it can be read back from dataset in the tooltip). */
function escapeCommentForAttr(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('\n', ' ');
}

/** Reverse escapeCommentForAttr when parsing from the DOM (e.g. in parseHTML). */
function unescapeCommentFromAttr(text: string): string {
  return text
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<');
}

/** Module augmentation so editor.chain().setComment(...) and .unsetComment() are typed in TypeScript. */
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    commentMark: {
      setComment: (attributes: { id: string; commentText: string }) => ReturnType;
      unsetComment: () => ReturnType;
    };
  }
}

export const CommentMark = Mark.create({
  name: 'comment',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.dataset.commentId ?? null,
        renderHTML: (attrs) => (attrs.id ? { 'data-comment-id': attrs.id } : {}),
      },
      commentText: {
        default: '',
        parseHTML: (el) => {
          const raw = el.dataset.commentText;
          return raw ? unescapeCommentFromAttr(raw) : '';
        },
        renderHTML: (attrs) =>
          attrs.commentText != null && attrs.commentText !== ''
            ? { 'data-comment-text': escapeCommentForAttr(attrs.commentText) }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }]; // Match our span so pasted/loaded HTML is recognized as comment marks.
  },

  renderHTML({ HTMLAttributes }) {
    const commentText = typeof HTMLAttributes['data-comment-text'] === 'string'
      ? unescapeCommentFromAttr(HTMLAttributes['data-comment-text'])
      : '';
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'tiptap-comment', // Styled in globals.css (underline + background) so comment spans are visible.
        title: commentText,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setComment:
        (attrs) =>
        ({ commands }) =>
          commands.setMark(this.name, attrs),
      unsetComment:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
