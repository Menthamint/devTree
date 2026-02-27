import { describe, expect, it } from 'vitest';

import { SLASH_ITEMS } from './SlashCommand';

function makeEditorRecorder() {
  const calls: Array<{ name: string; args: unknown[] }> = [];

  const chainProxy = new Proxy(
    {},
    {
      get(_target, prop: string) {
        return (...args: unknown[]) => {
          calls.push({ name: prop, args });
          return chainProxy;
        };
      },
    },
  );

  const editor = {
    chain: () => {
      calls.push({ name: 'chain', args: [] });
      return chainProxy;
    },
  };

  return { editor, calls };
}

describe('SLASH_ITEMS', () => {
  it('contains expected block actions', () => {
    expect(SLASH_ITEMS.length).toBeGreaterThanOrEqual(16);
    expect(SLASH_ITEMS.map((item) => item.title)).toEqual(
      expect.arrayContaining([
        'Paragraph',
        'Heading 1',
        'Heading 2',
        'Heading 3',
        'Bullet List',
        'Numbered List',
        'Blockquote',
        'Divider',
        'Code Block',
        'Checklist',
        'Canvas',
        'Audio',
        'Video',
        'Image',
        'Link Card',
        'Table',
      ]),
    );
  });

  it('runs every command through focus -> clearNodes -> action -> run', () => {
    for (const item of SLASH_ITEMS) {
      const { editor, calls } = makeEditorRecorder();
      item.command(editor as never);

      const names = calls.map((c) => c.name);
      expect(names).toContain('chain');
      expect(names).toContain('focus');
      expect(names).toContain('clearNodes');
      expect(names.at(-1)).toBe('run');
    }
  });

  it('uses action-specific chain methods for representative items', () => {
    const byTitle = new Map(SLASH_ITEMS.map((item) => [item.title, item]));

    const paragraph = makeEditorRecorder();
    byTitle.get('Paragraph')?.command(paragraph.editor as never);
    expect(paragraph.calls.map((c) => c.name)).toContain('setParagraph');

    const heading1 = makeEditorRecorder();
    byTitle.get('Heading 1')?.command(heading1.editor as never);
    expect(heading1.calls).toContainEqual({ name: 'setHeading', args: [{ level: 1 }] });

    const numberedList = makeEditorRecorder();
    byTitle.get('Numbered List')?.command(numberedList.editor as never);
    expect(numberedList.calls.map((c) => c.name)).toContain('toggleOrderedList');

    const divider = makeEditorRecorder();
    byTitle.get('Divider')?.command(divider.editor as never);
    expect(divider.calls.map((c) => c.name)).toContain('setHorizontalRule');

    const table = makeEditorRecorder();
    byTitle.get('Table')?.command(table.editor as never);
    const insertCall = table.calls.find((c) => c.name === 'insertContent');
    expect(insertCall?.args[0]).toEqual({
      type: 'tableBlockNode',
      attrs: { headers: ['Column 1', 'Column 2'], rows: [['', '']] },
    });
  });

  it('keeps insertSpec aligned for special blocks', () => {
    const tableSpec = SLASH_ITEMS.find((x) => x.title === 'Table')?.insertSpec;
    expect(tableSpec).toEqual({
      type: 'tableBlockNode',
      attrs: { headers: ['Column 1', 'Column 2'], rows: [['', '']] },
    });

    const codeSpec = SLASH_ITEMS.find((x) => x.title === 'Code Block')?.insertSpec;
    expect(codeSpec).toEqual({ type: 'codeBlockNode' });
  });
});
