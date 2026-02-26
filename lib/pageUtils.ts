/**
 * pageUtils — utilities for analysing and exporting page content.
 *
 * WHY a separate utility file?
 *   Keeping pure functions (no React, no DOM) in a dedicated `lib/` file makes
 *   them easy to test in isolation (Node.js, no happy-dom needed), reusable
 *   across components, and straightforward to move to a backend/API route later.
 *
 * IMPROVEMENT IDEAS:
 *   - Add `importFromMarkdown()` to parse Markdown back into blocks.
 *   - Support export to JSON (round-trip format) or plain text.
 *   - Persist page stats to a database for "recently read" / progress tracking.
 */
import type {
  AgendaBlockContent,
  AudioBlockContent,
  Block,
  CodeBlockContent,
  DiagramBlockContent,
  ImageBlockContent,
  LinkBlockContent,
  Page,
  TableBlockContent,
} from '@/components/features/MainContent/types';

// ─── Page stats ───────────────────────────────────────────────────────────────

/**
 * Statistics derived from a page's content.
 *
 * `wordCount`      — approximate number of words across all text blocks.
 * `readingTimeMin` — estimated minutes to read (at 200 wpm — standard for
 *                    technical content; non-technical text uses ~250 wpm).
 * `blockCount`     — total number of content blocks on the page.
 */
export type PageStats = {
  wordCount: number;
  readingTimeMin: number;
  blockCount: number;
};

/**
 * Compute reading statistics for a page.
 *
 * WHY 200 wpm?
 *   Technical content (code, diagrams, tables) demands slower reading. 200 wpm
 *   is a conservative baseline that produces realistic estimates for developer
 *   notes. A news reader would use 250–300 wpm.
 *
 * IMPROVEMENT: Separate `codeReadingTime` from `textReadingTime` so users can
 * distinguish "5 min reading + 10 min coding practice" time estimates.
 */
export function computePageStats(page: Page): PageStats {
  let wordCount = 0;

  for (const block of page.blocks) {
    wordCount += countWordsInBlock(block);
  }

  // Never show "0 min" — even a single-word page deserves at least 1 minute.
  const readingTimeMin = Math.max(1, Math.round(wordCount / 200));

  return { wordCount, readingTimeMin, blockCount: page.blocks.length };
}

/**
 * Estimate the word count contribution of a single block.
 *
 * Different block types need different counting strategies:
 *   - Text   → strip HTML tags, split on whitespace.
 *   - Code   → count non-empty lines (each line ≈ a unit of cognitive effort).
 *   - Table  → count cell contents.
 *   - Agenda → count words in item texts.
 *   - Others → fixed small estimate (constant time to glance at).
 */
function countWordsInBlock(block: Block): number {
  const { type, content } = block;

  if (type === 'text' && typeof content === 'string') {
    /**
     * Strip HTML tags with a simple regex. This is "good enough" for counting
     * — we don't need perfect HTML parsing, just word boundaries.
     *
     * IMPROVEMENT: Use DOMParser for more accurate HTML stripping in the browser
     * (e.g. `document.createElement('div').textContent`).
     */
    // `[^>]+` is bounded by `>` so cannot backtrack super-linearly.
    // eslint-disable-next-line sonarjs/slow-regex -- bounded pattern, safe
    const plainText = content.replaceAll(/<[^>]+>/g, ' ');
    return plainText.split(/\s+/).filter(Boolean).length;
  }

  if (type === 'code') {
    const c = content as CodeBlockContent;
    // Count non-empty lines — blank lines contribute 0 reading effort.
    return c.code.split('\n').filter((l) => l.trim().length > 0).length;
  }

  if (type === 'table') {
    const c = content as TableBlockContent;
    const allCells = [...c.headers, ...c.rows.flat()];
    return allCells.reduce((sum, cell) => sum + cell.split(/\s+/).filter(Boolean).length, 0);
  }

  if (type === 'agenda') {
    const c = content as AgendaBlockContent;
    const titleWords = (c.title ?? '').split(/\s+/).filter(Boolean).length;
    const itemWords = c.items.reduce(
      (sum, item) => sum + item.text.split(/\s+/).filter(Boolean).length,
      0,
    );
    return titleWords + itemWords;
  }

  // Link, image, diagram — a quick glance; estimate 5 words of reading effort.
  return 5;
}

// ─── Markdown export ───────────────────────────────────────────────────────────

/**
 * Export a full page to Markdown string.
 *
 * WHY Markdown?
 *   Markdown is the most widely accepted plain-text format for developer notes.
 *   It can be pasted into GitHub, Notion, Obsidian, or a static-site generator
 *   without further conversion.
 *
 * The export is intentionally lossy: some rich-text formatting (e.g. text colour,
 * font size) does not have a Markdown equivalent. The goal is a useful, readable
 * plain-text representation — not a perfect round-trip.
 *
 * IMPROVEMENT:
 *   - Use a proper HTML-to-Markdown library (e.g. `turndown`) for the text block.
 *   - Add YAML front-matter with page metadata (id, createdAt, tags).
 */
export function exportPageToMarkdown(page: Page): string {
  const sections: string[] = [`# ${page.title}`, ''];

  // Include tags as YAML-like front-matter comment so they are searchable
  // in the exported file while keeping the Markdown valid and renderable.
  if (page.tags && page.tags.length > 0) {
    const tagList = page.tags.map((t) => '`' + t + '`').join(' · ');
    sections.push(`> **Tags:** ${tagList}`, '');
  }

  for (const block of page.blocks) {
    const md = blockToMarkdown(block);
    if (md.trim()) {
      sections.push(md, '');
    }
  }

  return sections.join('\n');
}

/** Convert a single block to its Markdown representation. */
function blockToMarkdown(block: Block): string {
  const { type, content } = block;

  switch (type) {
    case 'text':
      return htmlToMarkdown(content as string);

    case 'code': {
      const c = content as CodeBlockContent;
      // GitHub-Flavoured Markdown fenced code block with language hint
      return `\`\`\`${c.language ?? ''}\n${c.code}\n\`\`\``;
    }

    case 'table': {
      const c = content as TableBlockContent;
      // GFM table syntax: header row | separator | data rows
      const header = `| ${c.headers.join(' | ')} |`;
      const divider = `| ${c.headers.map(() => '---').join(' | ')} |`;
      const rows = c.rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
      return [header, divider, rows].filter(Boolean).join('\n');
    }

    case 'link': {
      const c = content as LinkBlockContent;
      return `[${c.label ?? c.url}](${c.url})`;
    }

    case 'agenda': {
      const c = content as AgendaBlockContent;
      const titleLine = c.title ? `**${c.title}**\n` : '';
      // GFM task list syntax
      const items = c.items.map((i) => `- [${i.checked ? 'x' : ' '}] ${i.text}`).join('\n');
      return titleLine + items;
    }

    case 'image': {
      const c = content as ImageBlockContent;
      const img = `![${c.alt ?? ''}](${c.url})`;
      return c.caption ? `${img}\n\n*${c.caption}*` : img;
    }

    case 'diagram': {
      const c = content as DiagramBlockContent;
      // Mermaid diagrams are embedded as fenced code blocks with 'mermaid' language
      return `\`\`\`mermaid\n${c.code}\n\`\`\``;
    }

    case 'audio': {
      const c = content as AudioBlockContent;
      const link = `[🎵 Audio](${c.url})`;
      return c.caption ? `${link}\n\n*${c.caption}*` : link;
    }

    default:
      return '';
  }
}

/**
 * Convert Tiptap HTML output to Markdown using regex substitutions.
 *
 * WHY regex instead of a library?
 *   Avoiding an extra dependency for a straightforward subset of HTML. Tiptap
 *   produces clean, well-structured HTML so we can rely on predictable patterns.
 *
 * Limitations:
 *   - Nested lists are flattened to one level.
 *   - Table cells inside paragraphs are not handled.
 *   - Some edge cases (e.g. attributes with special chars) may break patterns.
 *
 * IMPROVEMENT: Replace with the `turndown` library for production-grade
 * conversion: `npm install turndown @types/turndown`.
 */
function htmlToMarkdown(html: string): string {
  // Phase 1: structured HTML → Markdown equivalents
  const partial = html
    // Block-level elements — order matters: headings before paragraphs
    .replaceAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1')
    .replaceAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1')
    .replaceAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1')
    .replaceAll(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '> $1')
    .replaceAll(/<hr[^>]*\/?>/gi, '\n---\n')
    // Inline formatting
    .replaceAll(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replaceAll(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replaceAll(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    .replaceAll(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
    .replaceAll(/<s[^>]*>([\s\S]*?)<\/s>/gi, '~~$1~~')
    .replaceAll(/<del[^>]*>([\s\S]*?)<\/del>/gi, '~~$1~~')
    .replaceAll(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    // List items (simplified — no nesting depth)
    .replaceAll(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1')
    .replaceAll(/<\/?[ou]l[^>]*>/gi, '')
    // Paragraphs and line breaks. Regexes are bounded (safe from backtracking).
    .replaceAll(/<br[^>]*\/?>/gi, '\n')
    .replaceAll(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n');

  // Phase 2 & 3: use DOMParser to safely strip remaining tags and decode HTML entities.
  // DOMParser handles both in one pass without regex, avoiding ReDoS risk entirely.
  const doc = new DOMParser().parseFromString(partial, 'text/html');
  return (
    (doc.body.textContent ?? '')
      // Normalise whitespace: collapse 3+ newlines → 2
      .replaceAll(/\n{3,}/g, '\n\n')
      .trim()
  );
}

/**
 * Trigger a browser file download for a Markdown export.
 *
 * WHY a Blob + anchor click?
 *   This is the standard cross-browser technique for generating files in the
 *   browser without a server round-trip. The Blob holds the text, the anchor
 *   tag's `download` attribute triggers the save dialog.
 *
 * IMPROVEMENT: Support streaming large files via the File System Access API
 * (navigator.showSaveFilePicker) for a better native OS experience in modern
 * browsers.
 */
export function downloadMarkdown(page: Page): void {
  const markdown = exportPageToMarkdown(page);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  // Sanitise the page title for use as a filename
  anchor.download = `${page.title.replaceAll(/[^a-z0-9\s-]/gi, '').trim() || 'page'}.md`;
  anchor.click();
  // Revoke the object URL after a tick to free memory
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// ─── Tiptap content helpers ───────────────────────────────────────────────────

/**
 * Walk a Tiptap JSONContent tree and collect all unique inline-tag values.
 *
 * Tiptap JSON shape:
 *   { type: 'doc', content: [{ type: 'paragraph', content: [
 *     { type: 'text', marks: [{ type: 'inlineTag', attrs: { tag: 'important' } }], text: '...' }
 *   ]}]}
 */
export function extractInlineTagsFromContent(
  node: Record<string, unknown> | null | undefined,
): string[] {
  if (!node) return [];
  const tags = new Set<string>();

  // eslint-disable-next-line sonarjs/cognitive-complexity, @typescript-eslint/no-explicit-any -- deep recursive tree walk with multiple node types
  function walk(n: any): void {
    if (!n || typeof n !== 'object') return;
    // Block-level tags stored in custom node attrs (ChecklistNode, CodeBlockNode, etc.)
    if (n.attrs && Array.isArray(n.attrs.tags)) {
      for (const tag of n.attrs.tags) {
        if (typeof tag === 'string' && tag) tags.add(tag);
      }
    }
    // Inline text marks (inlineTag mark applied via bubble menu)
    if (Array.isArray(n.marks)) {
      for (const mark of n.marks) {
        if (mark?.type === 'inlineTag' && typeof mark?.attrs?.tag === 'string' && mark.attrs.tag) {
          tags.add(mark.attrs.tag);
        }
      }
    }
    // Recurse into content
    if (Array.isArray(n.content)) {
      for (const child of n.content) walk(child);
    }
  }

  walk(node);
  return Array.from(tags).sort();
}
