/** @vitest-environment happy-dom */
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EditorToolbar, ToolbarButton } from './EditorToolbar';

vi.mock('motion/react', () => {
  return {
    AnimatePresence: ({ children }: { children: unknown }) => <>{children}</>,
    motion: {
      div: ({ children, ...props }: Record<string, unknown>) => <div {...props}>{children}</div>,
    },
    useReducedMotion: () => false,
  };
});

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({ locale: 'en' }),
}));

vi.mock('@/components/features/MainContent/voice-dictation/VoiceDictationButton', () => ({
  VoiceDictationButton: () => <button type="button">Voice Dictation</button>,
}));

vi.mock('@/components/features/MainContent/voice-dictation/VoiceDictationLanguageButton', () => ({
  VoiceDictationLanguageButton: () => <button type="button">Dictation Language</button>,
}));

vi.mock('./BookmarksPanel', () => ({
  BookmarksPanel: () => <div data-testid="bookmarks-panel">Bookmarks</div>,
}));

type ActiveMap = Record<string, boolean>;

function createEditorMock(active: ActiveMap = {}, selectionEmpty = false) {
  const chainCalls: Array<{ name: string; args: unknown[] }> = [];

  const chainProxy = new Proxy(
    {},
    {
      get(_target, prop: string) {
        return (...args: unknown[]) => {
          chainCalls.push({ name: prop, args });
          return chainProxy;
        };
      },
    },
  );

  const editor = {
    state: {
      selection: {
        empty: selectionEmpty,
        from: 2,
        to: selectionEmpty ? 2 : 6,
      },
      doc: {
        content: { size: 100 },
        textBetween: vi.fn(() => 'Selected text'),
      },
    },
    view: {
      coordsAtPos: vi.fn(() => ({ left: 100, bottom: 160 })),
    },
    commands: {
      insertContentAt: vi.fn(),
    },
    getAttributes: vi.fn((name: string) => {
      if (name === 'link') return { href: '' };
      if (name === 'highlight') return { color: '' };
      if (name === 'textStyle') return { color: '' };
      if (name === 'comment') return { commentText: '' };
      return {};
    }),
    isActive: vi.fn((nameOrAttrs: string | Record<string, unknown>) => {
      if (typeof nameOrAttrs === 'string') return !!active[nameOrAttrs];
      return false;
    }),
    chain: vi.fn(() => {
      chainCalls.push({ name: 'chain', args: [] });
      return chainProxy;
    }),
  };

  return { editor, chainCalls };
}

describe('ToolbarButton', () => {
  it('calls onClick on mouse down', () => {
    const onClick = vi.fn();
    render(
      <ToolbarButton title="Bold" onClick={onClick}>
        B
      </ToolbarButton>,
    );

    fireEvent.mouseDown(screen.getByTitle('Bold'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('EditorToolbar', () => {
  it('applies selected text color and closes popup', async () => {
    const { editor, chainCalls } = createEditorMock();

    render(<EditorToolbar editor={editor as never} blockId="block-1" />);

    fireEvent.mouseDown(screen.getByTitle('Text colour'));
    fireEvent.mouseDown(await screen.findByRole('button', { name: 'Red' }));

    expect(chainCalls).toContainEqual({ name: 'setColor', args: ['#dc2626'] });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Red' })).not.toBeInTheDocument();
    });
  });

  it('applies link url from popup input', async () => {
    const { editor, chainCalls } = createEditorMock();

    render(<EditorToolbar editor={editor as never} blockId="block-2" />);

    fireEvent.mouseDown(screen.getByTitle('Add link'));

    const urlInput = await screen.findByPlaceholderText('https://');
    fireEvent.change(urlInput, { target: { value: 'https://example.com' } });
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Apply' }));

    expect(chainCalls).toContainEqual({
      name: 'setLink',
      args: [{ href: 'https://example.com' }],
    });
  });

  it('opens bookmarks panel when selection is empty', async () => {
    const { editor } = createEditorMock({}, true);

    render(<EditorToolbar editor={editor as never} blockId="block-3" />);
    fireEvent.mouseDown(screen.getByTitle('Bookmarks'));

    expect(await screen.findByTestId('bookmarks-panel')).toBeInTheDocument();
  });

  it('applies comment text from popup', async () => {
    const { editor, chainCalls } = createEditorMock();

    render(<EditorToolbar editor={editor as never} blockId="block-4" />);

    fireEvent.mouseDown(screen.getByTitle('Add comment'));
    const textarea = await screen.findByPlaceholderText('Add a note…');
    fireEvent.change(textarea, { target: { value: 'My editor note' } });
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Apply' }));

    expect(chainCalls).toContainEqual({
      name: 'setComment',
      args: [expect.objectContaining({ commentText: 'My editor note' })],
    });
  });

  it('adds bookmark on selected text', () => {
    const { editor, chainCalls } = createEditorMock({}, false);

    render(<EditorToolbar editor={editor as never} blockId="block-5" />);
    fireEvent.mouseDown(screen.getByTitle('Bookmarks'));

    expect(chainCalls).toContainEqual({
      name: 'setBookmark',
      args: [expect.objectContaining({ label: 'Selected text' })],
    });
  });
});
