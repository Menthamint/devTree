/**
 * types.ts — Data model for the block editor.
 *
 * This file defines the shape of every piece of data that the editor stores.
 * Keeping types in a dedicated file (rather than scattered across components)
 * has several advantages:
 *   - Single source of truth: change a type here and TypeScript will flag every
 *     component that needs updating.
 *   - Easier persistence: these types map directly to what you'd store in a
 *     database or serialize to JSON.
 *   - Cleaner imports: components import exactly the types they need.
 *
 * ─── DESIGN DECISIONS ─────────────────────────────────────────────────────────
 *
 * WHY a discriminated union for BlockContent instead of a single object type?
 *   Each block type has a completely different content shape (a text block stores
 *   HTML string; a code block stores { code, language }). A union models this
 *   accurately and allows TypeScript to narrow the type in component render logic.
 *
 * WHY are type guards functions (isTextBlockContent, etc.) instead of `instanceof`?
 *   The content types are plain objects / primitives — they don't have class
 *   constructors, so `instanceof` can't be used. Runtime key-presence checks
 *   (the `'code' in content` pattern) are the idiomatic JavaScript alternative.
 *
 * WHY pass `type: BlockType` to the type guards?
 *   Without the `type` parameter, `'code' in content` alone can't distinguish a
 *   CodeBlockContent from a DiagramBlockContent (both have a `code` key). The
 *   block's `type` field is the authoritative discriminant.
 *
 * IMPROVEMENT IDEAS:
 *   - Add a `createdAt: number` / `updatedAt: number` to Block for history tracking.
 *   - Add a `tags: string[]` to Page for categorisation.
 *   - Add a `VideoBlockContent` with url + captions.
 *   - Consider using a schema validation library (Zod) to parse untrusted data
 *     (e.g. from a database or API) into these types safely.
 */
import type { JSONContent } from '@tiptap/core';

// ─── Block types ──────────────────────────────────────────────────────────────

/**
 * All supported block varieties.
 *
 * When adding a new block type:
 *   1. Add the string literal here.
 *   2. Define a `XXXBlockContent` type below.
 *   3. Add it to the `BlockContent` union.
 *   4. Write an `isXXXBlockContent` type guard.
 *   5. Wire creation/insert logic in the unified editor slash/toolbar menus.
 *   6. Add rendering logic in the corresponding editor node/view implementation.
 *   7. Ensure any picker/menu metadata includes the new type.
 */
export type BlockType =
  | 'text'
  | 'code'
  | 'link'
  | 'table'
  | 'agenda'
  | 'image'
  | 'diagram'
  | 'video'
  | 'whiteboard'
  | 'audio';

// ─── Content shapes ───────────────────────────────────────────────────────────

/**
 * TextBlockContent — HTML string produced by the Tiptap rich-text editor.
 *
 * WHY HTML string instead of a structured AST?
 *   Tiptap's output is HTML. Storing it directly avoids a serialisation step.
 *   The trade-off: HTML is harder to search and manipulate programmatically
 *   than a JSON AST. For a production app consider storing Tiptap's JSON
 *   representation (`editor.getJSON()`) for easier migration between editor
 *   versions.
 */
// eslint-disable-next-line sonarjs/redundant-type-aliases -- named alias improves readability at call sites
export type TextBlockContent = string;

/**
 * CodeBlockContent — source code with its language.
 *
 * `language` is optional for backwards compatibility with older stored data
 * that might not have the field. Components should default to 'javascript'.
 */
export type CodeBlockContent = {
  code: string;
  language?: string;
};

/**
 * LinkBlockContent — a URL with an optional human-readable label.
 *
 * WHY `label?: string` instead of `label: string`?
 *   When a user pastes a URL, we may not have a label yet. Making it optional
 *   allows the component to show the URL as the label until one is provided.
 */
export type LinkBlockContent = {
  url: string;
  label?: string;
};

/**
 * TableBlockContent — a simple spreadsheet-like table.
 *
 * WHY `headers: string[]` + `rows: string[][]` instead of `columns: Column[]`?
 *   This flat structure maps naturally to HTML <table> and is easy to serialise.
 *   A richer schema (column types, cell references) would be needed for a full
 *   spreadsheet but adds significant complexity for a note-taking use case.
 *
 * Invariant: each row must have the same number of cells as `headers`.
 *   This is enforced in TableBlock.tsx when adding/removing columns.
 */
export type TableBlockContent = {
  headers: string[];
  rows: string[][];
};

/** A single item in an agenda / checklist. */
export type AgendaItem = {
  /** Unique id used as React key and DnD item identifier. */
  id: string;
  text: string;
  checked: boolean;
};

/**
 * AgendaBlockContent — a titled list of checkable to-do items.
 *
 * The `title` is optional because a checklist without a heading is a common
 * pattern (e.g. a simple shopping list embedded in a page).
 */
export type AgendaBlockContent = {
  title?: string;
  items: AgendaItem[];
};

/**
 * ImageBlockContent — an image embedded by URL.
 *
 * WHY URL-based instead of file upload?
 *   File uploads require server-side storage (S3, Cloudinary, etc.). URL-based
 *   embedding works without any backend infrastructure, making it simpler for
 *   a learning project. A production app would add upload support.
 */
export type ImageBlockContent = {
  url: string;
  /** Alt text for accessibility screen readers. */
  alt?: string;
  /** Caption shown below the image. */
  caption?: string;
};

/**
 * DiagramBlockContent — Mermaid.js diagram source code.
 *
 * WHY store raw Mermaid syntax instead of a rendered SVG?
 *   Storing the source allows the diagram to be edited and re-rendered. SVG
 *   strings are large, hard to read, and would make search/export of page
 *   content much noisier.
 */
export type DiagramBlockContent = {
  code: string;
};

/**
 * VideoBlockContent — embeddable video URL.
 *
 * Currently supports YouTube URLs for inline embedding.
 * The raw URL is stored so future provider support can be added without data
 * migration.
 */
export type VideoBlockContent = {
  url: string;
};

/**
 * WhiteboardBlockContent — freehand drawing canvas.
 *
 * The canvas is serialized to a base64 PNG data URL after each stroke.
 * Storing PNG is simple and universally renderable (via <img> or <canvas>).
 *
 * WHY not store SVG path data?
 *   PNG is trivial to implement and works well for sketchy notes.
 *   Migrating to path data in the future would allow undo/redo and re-theming;
 *   the `dataUrl` field can be replaced with a `strokes` array without breaking
 *   the rest of the data model since we only add a new type to the union.
 *
 * `dataUrl` is `''` when the canvas is blank (never undefined, to simplify
 * null-checks in the component).
 */
export type WhiteboardBlockContent = {
  dataUrl: string;
};

/**
 * AudioBlockContent — an audio file embedded by external URL.
 *
 * WHY URL-only and not file upload?
 *   File uploads require server-side storage (S3, Cloudinary, etc.). Embedding
 *   by URL works for any publicly hosted MP3/OGG/WAV/M4A without additional
 *   infrastructure. Common sources: podcast feeds, lecture recordings, CDN-
 *   hosted sound files, SoundCloud direct audio links.
 */
export type AudioBlockContent = {
  url: string;
  /** Short description shown below the player. */
  caption?: string;
};

/**
 * The full union of all possible block content types.
 *
 * WHY a union instead of `Record<string, unknown>`?
 *   The union gives TypeScript the information it needs to narrow the type
 *   based on a runtime check (type guard). Using `Record<string, unknown>`
 *   would require `as` casts everywhere, losing type safety.
 */
export type BlockContent =
  | TextBlockContent
  | CodeBlockContent
  | LinkBlockContent
  | TableBlockContent
  | AgendaBlockContent
  | ImageBlockContent
  | DiagramBlockContent
  | VideoBlockContent
  | WhiteboardBlockContent
  | AudioBlockContent;

/**
 * A single content block on a page.
 *
 * `colSpan?: 1 | 2`
 *   Controls how many columns the block occupies in the two-column grid:
 *   1 = half-width, 2 = full-width (default). Using `1 | 2` instead of
 *   `boolean` maps directly to the CSS `grid-column: span <n>` value, making
 *   the rendering logic straightforward.
 *
 * `tags?: string[]`
 *   Optional labels attached to an individual block (e.g. "important", "task",
 *   "review"). Block tags complement page-level tags: page tags categorise the
 *   whole page, while block tags annotate specific sections within a page.
 *   Stored as lowercase, deduplicated strings (same constraints as page tags).
 */
export type Block = {
  id: string;
  type: BlockType;
  content: BlockContent;
  /** 1 = half width, 2 = full width (default) */
  colSpan?: 1 | 2;
  /** Optional labels annotating this block */
  tags?: string[];
  /** Transient flag: set to true only for newly created blocks (creation-only) */
  createdNow?: boolean;
  /** ISO datetime string from the server — when the block was created. */
  createdAt?: string;
  /** ISO datetime string from the server — when the block was last saved. */
  updatedAt?: string;
};

/**
 * A page containing an ordered list of blocks.
 *
 * WHY keep `blocks` as an ordered array?
 *   Drag-and-drop reordering relies on index-based operations (arrayMove).
 *   An unordered map (id → Block) would require an explicit `order` field
 *   and more complex reordering logic.
 *
 * `tags?: string[]`
 *   Optional free-form labels for a page (e.g. "react", "algorithms").
 *   Used to filter pages in the sidebar tag cloud and in search.
 *   Stored as lowercase, deduplicated strings.
 *   Optional (not required) so existing pages without tags are valid.
 */
export type Page = {
  id: string;
  title: string;
  blocks: Block[];
  tags?: string[];
  folderId?: string | null;
  /** ISO datetime string from the server — when the page was created. */
  createdAt?: string;
  /** ISO datetime string from the server — when the page was last saved. */
  updatedAt?: string;
  /** Unified Tiptap JSONContent document. Present when the page uses the new
   *  unified editor; null/undefined for pages still using legacy blocks. */
  content?: JSONContent | null;
};

// ─── Type guards ─────────────────────────────────────────────────────────────

/**
 * Type guards narrow the `BlockContent` union to a specific member at runtime.
 *
 * Pattern: each guard checks BOTH the `type` field AND the runtime shape of
 * `content`. This double check is important because:
 *   - `type` alone is the canonical discriminant but is user-supplied data.
 *   - Checking the content shape catches corrupted or migrated data.
 *
 * All guards accept `(content: BlockContent, type: BlockType)` so they can be
 * called in a single if-statement:
 *   if (type === 'text' && isTextBlockContent(content, type)) { ... }
 *                                                ^^^^^^
 *   The redundant type===... is kept for readability — it makes the intent
 *   obvious at the call site without reading the guard implementation.
 */

export function isTextBlockContent(
  content: BlockContent,
  type: BlockType,
): content is TextBlockContent {
  return type === 'text' && typeof content === 'string';
}

/**
 * Code blocks have a `code` key. We do NOT check for `language` because it is
 * optional — old data may not have it.
 */
export function isCodeBlockContent(
  content: BlockContent,
  type: BlockType,
): content is CodeBlockContent {
  return type === 'code' && typeof content === 'object' && content !== null && 'code' in content;
}

/** Link blocks are identified by the `url` key. */
export function isLinkBlockContent(
  content: BlockContent,
  type: BlockType,
): content is LinkBlockContent {
  return type === 'link' && typeof content === 'object' && content !== null && 'url' in content;
}

/** Table blocks carry a `headers` array as a reliable discriminant. */
export function isTableBlockContent(
  content: BlockContent,
  type: BlockType,
): content is TableBlockContent {
  return (
    type === 'table' &&
    typeof content === 'object' &&
    content !== null &&
    'headers' in content &&
    Array.isArray(content.headers)
  );
}

/** Agenda blocks carry an `items` array as a reliable discriminant. */
export function isAgendaBlockContent(
  content: BlockContent,
  type: BlockType,
): content is AgendaBlockContent {
  return (
    type === 'agenda' &&
    typeof content === 'object' &&
    content !== null &&
    'items' in content &&
    Array.isArray(content.items)
  );
}

/**
 * Image blocks have `url` but NOT `code` or `headers` or `items`.
 *
 * WHY the negative checks?
 *   Both LinkBlockContent and ImageBlockContent have a `url` key. The negative
 *   checks (`!('code' in content)` etc.) ensure we only match the image variant
 *   when combined with `type === 'image'`. The `type` check makes the negatives
 *   technically redundant, but they serve as defensive programming against
 *   unexpected data shapes.
 */
export function isImageBlockContent(
  content: BlockContent,
  type: BlockType,
): content is ImageBlockContent {
  return (
    type === 'image' &&
    typeof content === 'object' &&
    content !== null &&
    'url' in content &&
    !('code' in content) &&
    !('headers' in content) &&
    !('items' in content)
  );
}

/**
 * Diagram blocks have `code` but NOT `language`.
 *
 * WHY check `!('language' in content)`?
 *   CodeBlockContent also has a `code` key. The absence of `language` (which
 *   code blocks use for syntax highlighting) differentiates a diagram from a
 *   code block at the content level.
 *
 * NOTE: A code block with `language: undefined` (not set) would pass this
 * guard. The outer `type === 'diagram'` check is the primary discriminant;
 * the content-shape checks are a safety net.
 */
export function isDiagramBlockContent(
  content: BlockContent,
  type: BlockType,
): content is DiagramBlockContent {
  return (
    type === 'diagram' &&
    typeof content === 'object' &&
    content !== null &&
    'code' in content &&
    !('language' in content)
  );
}

/** Video blocks have a URL; provider support is resolved in the component. */
export function isVideoBlockContent(
  content: BlockContent,
  type: BlockType,
): content is VideoBlockContent {
  return type === 'video' && typeof content === 'object' && content !== null && 'url' in content;
}

/** Audio blocks have a URL (external audio source). The type discriminant is the primary check. */
export function isAudioBlockContent(
  content: BlockContent,
  type: BlockType,
): content is AudioBlockContent {
  return type === 'audio' && typeof content === 'object' && content !== null && 'url' in content;
}
