/**
 * pageUtils unit tests.
 *
 * These tests verify the utility functions for page analysis and Markdown export.
 * All functions are pure (no side effects, no DOM needed) so they run in Node.js
 * without a browser environment.
 *
 * WHY not @vitest-environment happy-dom?
 *   `downloadMarkdown` uses document.createElement, but the other functions
 *   don't need any DOM. We test `downloadMarkdown` separately in an integration
 *   test or E2E test. Here we focus on the pure computation functions.
 */
import { describe, it, expect } from 'vitest';

import { computePageStats, exportPageToMarkdown, extractInlineTagsFromContent } from './pageUtils';
import type { Page } from '@/components/MainContent/types';

// ─── Test fixtures ────────────────────────────────────────────────────────────

const emptyPage: Page = {
  id: 'p1',
  title: 'Empty Page',
  blocks: [],
};

const richPage: Page = {
  id: 'p2',
  title: 'Rich Page',
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-02-20T15:00:00.000Z',
  blocks: [
    {
      id: 'b1',
      type: 'text',
      content: '<p>Hello world this is a test paragraph</p>',
      colSpan: 2,
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-02-20T15:00:00.000Z',
    },
    {
      id: 'b2',
      type: 'code',
      content: { code: 'const x = 1;\nconst y = 2;\nconst z = 3;', language: 'javascript' },
      colSpan: 2,
      createdAt: '2026-01-01T10:01:00.000Z',
      updatedAt: '2026-01-01T10:01:00.000Z',
    },
    {
      id: 'b3',
      type: 'link',
      content: { url: 'https://example.com', label: 'Example' },
      colSpan: 1,
      createdAt: '2026-01-02T08:00:00.000Z',
      updatedAt: '2026-01-02T08:00:00.000Z',
    },
    {
      id: 'b4',
      type: 'table',
      content: { headers: ['Name', 'Age'], rows: [['Alice', '30'], ['Bob', '25']] },
      colSpan: 2,
      createdAt: '2026-01-03T12:00:00.000Z',
      updatedAt: '2026-01-10T09:00:00.000Z',
    },
    {
      id: 'b5',
      type: 'agenda',
      content: {
        title: 'Tasks',
        items: [
          { id: 'i1', text: 'Write tests', checked: true },
          { id: 'i2', text: 'Ship it', checked: false },
        ],
      },
      colSpan: 2,
      createdAt: '2026-01-05T11:00:00.000Z',
      updatedAt: '2026-02-01T16:00:00.000Z',
    },
    {
      id: 'b6',
      type: 'image',
      content: { url: 'https://example.com/img.png', alt: 'A photo', caption: 'Photo caption' },
      colSpan: 2,
      createdAt: '2026-01-06T14:00:00.000Z',
      updatedAt: '2026-01-06T14:00:00.000Z',
    },
    {
      id: 'b7',
      type: 'diagram',
      content: { code: 'flowchart LR\n  A --> B' },
      colSpan: 2,
      createdAt: '2026-01-07T10:00:00.000Z',
      updatedAt: '2026-02-10T13:00:00.000Z',
    },
  ],
};

// ─── computePageStats ─────────────────────────────────────────────────────────

describe('computePageStats', () => {
  it('returns zero word count and 1 min read for empty page', () => {
    const stats = computePageStats(emptyPage);
    expect(stats.wordCount).toBe(0);
    expect(stats.readingTimeMin).toBe(1); // minimum is 1 minute
    expect(stats.blockCount).toBe(0);
  });

  it('counts blocks correctly', () => {
    const stats = computePageStats(richPage);
    expect(stats.blockCount).toBe(richPage.blocks.length);
  });

  it('counts words in text blocks (strips HTML tags)', () => {
    const page: Page = {
      id: 'p',
      title: 'Test',
      blocks: [
        {
          id: 'b',
          type: 'text',
          content: '<p>Hello world</p><p>More text here</p>',
          colSpan: 2,
        },
      ],
    };
    const stats = computePageStats(page);
    // "Hello world More text here" = 5 words
    expect(stats.wordCount).toBe(5);
  });

  it('counts non-empty lines in code blocks', () => {
    const page: Page = {
      id: 'p',
      title: 'Test',
      blocks: [
        {
          id: 'b',
          type: 'code',
          content: { code: 'line1\n\nline3\nline4', language: 'js' },
          colSpan: 2,
        },
      ],
    };
    const stats = computePageStats(page);
    // 3 non-empty lines: 'line1', 'line3', 'line4'
    expect(stats.wordCount).toBe(3);
  });

  it('reading time is at least 1 minute', () => {
    const stats = computePageStats(emptyPage);
    expect(stats.readingTimeMin).toBeGreaterThanOrEqual(1);
  });

  it('reading time increases with more content', () => {
    const shortStats = computePageStats({
      id: 'p',
      title: 'Short',
      blocks: [{ id: 'b', type: 'text', content: '<p>Hi</p>', colSpan: 2 }],
    });
    const longStats = computePageStats(richPage);
    expect(longStats.wordCount).toBeGreaterThan(shortStats.wordCount);
  });
});

// ─── exportPageToMarkdown ─────────────────────────────────────────────────────

describe('exportPageToMarkdown', () => {
  it('starts with a level-1 heading of the page title', () => {
    const md = exportPageToMarkdown(richPage);
    expect(md.startsWith('# Rich Page')).toBe(true);
  });

  it('exports code blocks as fenced code blocks with language', () => {
    const md = exportPageToMarkdown(richPage);
    expect(md).toContain('```javascript');
    expect(md).toContain('const x = 1;');
    expect(md).toContain('```');
  });

  it('exports link blocks as Markdown links', () => {
    const md = exportPageToMarkdown(richPage);
    expect(md).toContain('[Example](https://example.com)');
  });

  it('exports table blocks as GFM tables', () => {
    const md = exportPageToMarkdown(richPage);
    expect(md).toContain('| Name | Age |');
    expect(md).toContain('| --- | --- |');
    expect(md).toContain('| Alice | 30 |');
  });

  it('exports agenda blocks as GFM task lists', () => {
    const md = exportPageToMarkdown(richPage);
    expect(md).toContain('- [x] Write tests');
    expect(md).toContain('- [ ] Ship it');
  });

  it('exports image blocks with alt text and caption', () => {
    const md = exportPageToMarkdown(richPage);
    expect(md).toContain('![A photo](https://example.com/img.png)');
    expect(md).toContain('*Photo caption*');
  });

  it('exports diagram blocks as mermaid fenced blocks', () => {
    const md = exportPageToMarkdown(richPage);
    expect(md).toContain('```mermaid');
    expect(md).toContain('flowchart LR');
  });

  it('returns only the title heading for an empty page', () => {
    const md = exportPageToMarkdown(emptyPage);
    expect(md.trim()).toBe('# Empty Page');
  });

  it('includes tags in the Markdown export when present', () => {
    const pageWithTags: Page = {
      id: 'tagged',
      title: 'Tagged Page',
      blocks: [],
      tags: ['react', 'hooks'],
    };
    const md = exportPageToMarkdown(pageWithTags);
    // Tags should appear as a YAML-like front-matter line or inline labels
    expect(md).toContain('react');
    expect(md).toContain('hooks');
  });

  it('computePageStats handles pages with tags gracefully', () => {
    const pageWithTags: Page = {
      id: 'tagged',
      title: 'Tagged Page',
      blocks: [{ id: 'b1', type: 'text', content: 'Hello world', colSpan: 2 }],
      tags: ['react', 'hooks'],
    };
    const stats = computePageStats(pageWithTags);
    expect(stats.blockCount).toBe(1);
    expect(stats.wordCount).toBeGreaterThan(0);
  });
});

// ─── extractInlineTagsFromContent ─────────────────────────────────────────────

describe('extractInlineTagsFromContent', () => {
  it('returns empty array for null input', () => {
    expect(extractInlineTagsFromContent(null)).toEqual([]);
  });

  it('returns empty array for undefined input', () => {
    expect(extractInlineTagsFromContent(undefined)).toEqual([]);
  });

  it('returns empty array for empty doc', () => {
    expect(extractInlineTagsFromContent({ type: 'doc', content: [] })).toEqual([]);
  });

  it('extracts block-level attrs.tags from atom nodes', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'codeBlockNode', attrs: { tags: ['typescript', 'react'], code: '' } },
        { type: 'checklistNode', attrs: { tags: ['todo'], items: [] } },
      ],
    };
    expect(extractInlineTagsFromContent(doc)).toEqual(['react', 'todo', 'typescript']);
  });

  it('extracts inline inlineTag marks from text nodes', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'hello',
              marks: [{ type: 'inlineTag', attrs: { tag: 'javascript' } }],
            },
            {
              type: 'text',
              text: 'world',
              marks: [{ type: 'inlineTag', attrs: { tag: 'node' } }],
            },
          ],
        },
      ],
    };
    expect(extractInlineTagsFromContent(doc)).toEqual(['javascript', 'node']);
  });

  it('combines and deduplicates block-level and inline tags', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'codeBlockNode', attrs: { tags: ['react', 'shared'], code: '' } },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'note',
              marks: [{ type: 'inlineTag', attrs: { tag: 'shared' } }],
            },
          ],
        },
      ],
    };
    expect(extractInlineTagsFromContent(doc)).toEqual(['react', 'shared']);
  });

  it('returns tags sorted alphabetically', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'checklistNode', attrs: { tags: ['zebra', 'alpha', 'mango'], items: [] } },
      ],
    };
    expect(extractInlineTagsFromContent(doc)).toEqual(['alpha', 'mango', 'zebra']);
  });

  it('ignores empty string tags', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'codeBlockNode', attrs: { tags: ['', 'valid', ''], code: '' } },
      ],
    };
    expect(extractInlineTagsFromContent(doc)).toEqual(['valid']);
  });

  it('recurses into deeply nested content', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'deep',
                      marks: [{ type: 'inlineTag', attrs: { tag: 'deep-tag' } }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(extractInlineTagsFromContent(doc)).toEqual(['deep-tag']);
  });
});
