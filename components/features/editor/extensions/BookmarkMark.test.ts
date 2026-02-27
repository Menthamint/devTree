import { describe, expect, it, vi } from 'vitest';

import { BookmarkMark } from './BookmarkMark';

describe('BookmarkMark', () => {
  it('defines parse and render rules for id/label attributes', () => {
    const config = (BookmarkMark as unknown as { config: Record<string, unknown> }).config;
    const addAttributes = config.addAttributes as () => Record<string, unknown>;
    const parseHTML = config.parseHTML as () => Array<{ tag: string }>;

    const attrs = addAttributes();
    const idAttr = attrs.id as { parseHTML: (el: HTMLElement) => string | null; renderHTML: (attrs: Record<string, unknown>) => Record<string, unknown> };
    const labelAttr = attrs.label as { parseHTML: (el: HTMLElement) => string; renderHTML: (attrs: Record<string, unknown>) => Record<string, unknown> };

    const el = document.createElement('span');
    el.dataset.bookmarkId = 'bm-1';
    el.dataset.bookmarkLabel = 'Label';

    expect(idAttr.parseHTML(el)).toBe('bm-1');
    expect(labelAttr.parseHTML(el)).toBe('Label');
    expect(idAttr.renderHTML({ id: 'bm-2' })).toEqual({ 'data-bookmark-id': 'bm-2' });
    expect(labelAttr.renderHTML({ label: 'L2' })).toEqual({ 'data-bookmark-label': 'L2' });
    expect(parseHTML()).toEqual([{ tag: 'span[data-bookmark-id]' }]);
  });

  it('renders html with class and title from bookmark label', () => {
    const config = (BookmarkMark as unknown as { config: Record<string, unknown> }).config;
    const renderHTML = config.renderHTML as (this: { options: { HTMLAttributes: Record<string, unknown> } }, args: { HTMLAttributes: Record<string, unknown> }) => unknown[];

    const rendered = renderHTML.call(
      { options: { HTMLAttributes: { 'data-test': 'x' } } },
      { HTMLAttributes: { 'data-bookmark-label': 'Bookmark label' } },
    );

    expect(rendered[0]).toBe('span');
    expect(rendered[1]).toMatchObject({
      class: 'tiptap-bookmark',
      title: 'Bookmark label',
      'data-test': 'x',
    });
    expect(rendered[2]).toBe(0);
  });

  it('wires set/unset commands to tiptap command api', () => {
    const config = (BookmarkMark as unknown as { config: Record<string, unknown> }).config;
    const addCommands = config.addCommands as (this: { name: string }) => Record<string, unknown>;
    const commandsApi = {
      setMark: vi.fn(() => true),
      unsetMark: vi.fn(() => true),
    };

    const commands = addCommands.call({ name: 'bookmark' }) as {
      setBookmark: (attrs: { id: string; label: string }) => (ctx: { commands: typeof commandsApi }) => boolean;
      unsetBookmark: () => (ctx: { commands: typeof commandsApi }) => boolean;
    };

    const setResult = commands.setBookmark({ id: 'bm-1', label: 'L' })({ commands: commandsApi });
    const unsetResult = commands.unsetBookmark()({ commands: commandsApi });

    expect(setResult).toBe(true);
    expect(unsetResult).toBe(true);
    expect(commandsApi.setMark).toHaveBeenCalledWith('bookmark', { id: 'bm-1', label: 'L' });
    expect(commandsApi.unsetMark).toHaveBeenCalledWith('bookmark');
  });
});
