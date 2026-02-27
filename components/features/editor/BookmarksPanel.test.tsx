/** @vitest-environment happy-dom */
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BookmarksPanel } from './BookmarksPanel';

type BookmarkSeed = Array<{ id: string; label?: string; pos: number }>;

function createEditor(bookmarks: BookmarkSeed) {
  const handlers = new Map<string, () => void>();
  const run = vi.fn();
  const setTextSelection = vi.fn(() => ({ run }));
  const focus = vi.fn(() => ({ setTextSelection }));
  const chain = vi.fn(() => ({ focus }));
  const scrollIntoView = vi.fn();

  const editor = {
    state: {
      doc: {
        descendants: (visitor: (node: { marks: Array<{ type: { name: string }; attrs: { id: string; label?: string } }> }, pos: number) => void) => {
          for (const bm of bookmarks) {
            visitor(
              {
                marks: [
                  {
                    type: { name: 'bookmark' },
                    attrs: { id: bm.id, label: bm.label },
                  },
                ],
              },
              bm.pos,
            );
          }
        },
      },
    },
    on: vi.fn((event: string, cb: () => void) => {
      handlers.set(event, cb);
    }),
    off: vi.fn((event: string) => {
      handlers.delete(event);
    }),
    chain,
    view: {
      domAtPos: vi.fn(() => ({ node: { scrollIntoView } })),
    },
  };

  return { editor, handlers, chain, focus, setTextSelection, run, scrollIntoView };
}

describe('BookmarksPanel', () => {
  it('renders empty state and closes via header button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { editor } = createEditor([]);

    render(<BookmarksPanel editor={editor as never} onClose={onClose} />);

    expect(screen.getByText(/No bookmarks/i)).toBeInTheDocument();

    await user.click(screen.getAllByRole('button')[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders bookmarks and jumps to selected position', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const setup = createEditor([
      { id: 'bm-1', label: 'Intro', pos: 3 },
      { id: 'bm-2', pos: 8 },
    ]);

    render(<BookmarksPanel editor={setup.editor as never} onClose={onClose} />);

    expect(screen.getByText('Intro')).toBeInTheDocument();
    expect(screen.getByText('Bookmark')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Intro/i }));

    expect(setup.chain).toHaveBeenCalledTimes(1);
    expect(setup.focus).toHaveBeenCalledTimes(1);
    expect(setup.setTextSelection).toHaveBeenCalledWith(3);
    expect(setup.run).toHaveBeenCalledTimes(1);
    expect(setup.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });

  it('subscribes to editor update events and unsubscribes on unmount', () => {
    const { editor } = createEditor([{ id: 'bm-1', label: 'Intro', pos: 3 }]);

    const { unmount } = render(<BookmarksPanel editor={editor as never} onClose={() => {}} />);

    expect(editor.on).toHaveBeenCalledWith('update', expect.any(Function));
    unmount();
    expect(editor.off).toHaveBeenCalledWith('update', expect.any(Function));
  });
});
