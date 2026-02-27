/** @vitest-environment happy-dom */
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EditorBubbleMenu } from './EditorBubbleMenu';

vi.mock('motion/react', () => {
  return {
    AnimatePresence: ({ children }: { children: unknown }) => <>{children}</>,
    motion: {
      div: ({ children, ...props }: Record<string, unknown>) => (
        <div {...props}>{children}</div>
      ),
    },
    useReducedMotion: () => false,
  };
});

type ActiveMap = Record<string, boolean>;

function createEditorMock(active: ActiveMap = {}, selectionEmpty = false) {
  const eventHandlers = new Map<string, () => void>();
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
        to: 6,
      },
      doc: {
        textBetween: vi.fn(() => 'Selected text for bookmark'),
      },
    },
    view: {
      coordsAtPos: vi.fn((pos: number) => ({ left: 100 + pos, top: 200 + pos })),
      dom: {
        getBoundingClientRect: vi.fn(() => ({ left: 0, right: 1200, top: 0, bottom: 800 })),
      },
    },
    on: vi.fn((event: string, cb: () => void) => {
      eventHandlers.set(event, cb);
    }),
    off: vi.fn((event: string) => {
      eventHandlers.delete(event);
    }),
    isActive: vi.fn((name: string) => !!active[name]),
    getAttributes: vi.fn((name: string) => {
      if (name === 'link') return { href: 'https://example.com' };
      if (name === 'comment') return { commentText: 'note' };
      if (name === 'inlineTag') return { tag: 'tagged' };
      if (name === 'highlight') return { color: active.highlight ? '#fef08a' : '' };
      return {};
    }),
    chain: vi.fn(() => {
      chainCalls.push({ name: 'chain', args: [] });
      return chainProxy;
    }),
  };

  return { editor, chainCalls, eventHandlers };
}

describe('EditorBubbleMenu', () => {
  it('stays hidden for empty selection', () => {
    const { editor } = createEditorMock({}, true);

    render(<EditorBubbleMenu editor={editor as never} />);

    expect(screen.queryByTitle('Bold')).not.toBeInTheDocument();
  });

  it('shows menu for text selection and toggles bold', async () => {
    const { editor, chainCalls } = createEditorMock();

    render(<EditorBubbleMenu editor={editor as never} />);

    const boldButton = await screen.findByTitle('Bold');
    fireEvent.mouseDown(boldButton);

    expect(chainCalls.map((c) => c.name)).toEqual(
      expect.arrayContaining(['chain', 'focus', 'toggleBold', 'run']),
    );
  });

  it('adds bookmark when not active and removes when active', async () => {
    const inactive = createEditorMock({ bookmark: false });
    const { unmount } = render(<EditorBubbleMenu editor={inactive.editor as never} />);
    const addButton = await screen.findByTitle('Add bookmark');
    fireEvent.mouseDown(addButton);
    expect(inactive.chainCalls).toContainEqual({ name: 'setBookmark', args: [expect.any(Object)] });
    unmount();

    const active = createEditorMock({ bookmark: true });
    render(<EditorBubbleMenu editor={active.editor as never} />);
    const removeButton = await screen.findByTitle('Remove bookmark');
    fireEvent.mouseDown(removeButton);
    expect(active.chainCalls.map((c) => c.name)).toEqual(
      expect.arrayContaining(['unsetBookmark', 'run']),
    );
  });

  it('closes on outside pointer down', async () => {
    const { editor } = createEditorMock();
    render(<EditorBubbleMenu editor={editor as never} />);

    await screen.findByTitle('Bold');
    fireEvent.pointerDown(document.body);

    await waitFor(() => {
      expect(screen.queryByTitle('Bold')).not.toBeInTheDocument();
    });
  });
});
