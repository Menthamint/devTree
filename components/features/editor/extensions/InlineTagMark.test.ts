import { describe, expect, it, vi } from 'vitest';

import { InlineTagMark } from './InlineTagMark';

describe('InlineTagMark', () => {
  it('parses and renders inline-tag html attributes', () => {
    const config = (InlineTagMark as unknown as { config: Record<string, unknown> }).config;
    const addAttributes = config.addAttributes as () => Record<string, unknown>;
    const parseHTML = config.parseHTML as () => Array<{ tag: string }>;

    const attrs = addAttributes();
    const tagAttr = attrs.tag as {
      parseHTML: (el: HTMLElement) => string | null;
      renderHTML: (attrs: Record<string, unknown>) => Record<string, unknown>;
    };

    const el = document.createElement('span');
    el.dataset.inlineTag = 'important';

    expect(tagAttr.parseHTML(el)).toBe('important');
    expect(tagAttr.renderHTML({ tag: 'review' })).toEqual({ 'data-inline-tag': 'review' });
    expect(parseHTML()).toEqual([{ tag: 'span[data-inline-tag]' }]);
  });

  it('renders merged HTML attributes with inline-tag class', () => {
    const config = (InlineTagMark as unknown as { config: Record<string, unknown> }).config;
    const renderHTML = config.renderHTML as (this: { options: { HTMLAttributes: Record<string, unknown> } }, args: { HTMLAttributes: Record<string, unknown> }) => unknown[];

    const rendered = renderHTML.call(
      { options: { HTMLAttributes: { 'data-test': 'x' } } },
      { HTMLAttributes: { 'data-inline-tag': 'important' } },
    );

    expect(rendered[0]).toBe('span');
    expect(rendered[1]).toMatchObject({
      class: 'inline-tag-mark',
      'data-test': 'x',
      'data-inline-tag': 'important',
    });
    expect(rendered[2]).toBe(0);
  });

  it('maps set/unset/toggle commands to mark commands api', () => {
    const config = (InlineTagMark as unknown as { config: Record<string, unknown> }).config;
    const addCommands = config.addCommands as (this: { name: string }) => Record<string, unknown>;
    const commandsApi = {
      setMark: vi.fn(() => true),
      unsetMark: vi.fn(() => true),
      toggleMark: vi.fn(() => true),
    };

    const commands = addCommands.call({ name: 'inlineTag' }) as {
      setInlineTag: (attrs: { tag: string }) => (ctx: { commands: typeof commandsApi }) => boolean;
      unsetInlineTag: () => (ctx: { commands: typeof commandsApi }) => boolean;
      toggleInlineTag: (attrs: { tag: string }) => (ctx: { commands: typeof commandsApi }) => boolean;
    };

    expect(commands.setInlineTag({ tag: 'important' })({ commands: commandsApi })).toBe(true);
    expect(commands.unsetInlineTag()({ commands: commandsApi })).toBe(true);
    expect(commands.toggleInlineTag({ tag: 'review' })({ commands: commandsApi })).toBe(true);

    expect(commandsApi.setMark).toHaveBeenCalledWith('inlineTag', { tag: 'important' });
    expect(commandsApi.unsetMark).toHaveBeenCalledWith('inlineTag');
    expect(commandsApi.toggleMark).toHaveBeenCalledWith('inlineTag', { tag: 'review' });
  });
});
