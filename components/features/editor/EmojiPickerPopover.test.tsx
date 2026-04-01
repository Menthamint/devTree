/** @vitest-environment happy-dom */
import type { ReactNode } from 'react';

import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Import component after mocks ─────────────────────────────────────────────

import { EmojiPickerPopover } from './EmojiPickerPopover';

// ─── Capture onEmojiSelect from the Picker mock ───────────────────────────────
// vi.mock factories are hoisted above all imports/let declarations, so
// mockPickerRef.onEmojiSelect would be in the TDZ when the factory runs.
// vi.hoisted creates a value that is available before hoisting takes place.

const mockPickerRef = vi.hoisted(() => ({
  onEmojiSelect: null as ((e: { native: string }) => void) | null,
}));

vi.mock('@emoji-mart/react', () => ({
  default: (props: { onEmojiSelect: (e: { native: string }) => void }) => {
    mockPickerRef.onEmojiSelect = props.onEmojiSelect;
    return null;
  },
}));

vi.mock('@emoji-mart/data', () => ({ default: {} }));

vi.mock('./ToolbarButton', () => ({
  ToolbarButton: ({
    onClick,
    children,
    title,
    active: _active,
  }: {
    onClick: () => void;
    children: ReactNode;
    title: string;
    active?: boolean;
  }) => (
    <button type="button" onClick={onClick} title={title}>
      {children}
    </button>
  ),
}));

// motion/react is used inside EmojiPickerPopover via AnimatePresence / motion.div
vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      children,
      initial: _i,
      animate: _a,
      exit: _e,
      transition: _t,
      ...props
    }: { children?: React.ReactNode } & Record<string, unknown>) => (
      <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
    ),
  },
  useReducedMotion: () => false,
}));

// ─── Fake editor ──────────────────────────────────────────────────────────────

function buildFakeEditor() {
  const run = vi.fn();
  const fakeEditor = {
    run,
    chain: () => fakeEditor,
    focus: () => fakeEditor,
    insertContent: () => fakeEditor,
  };
  return fakeEditor;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EmojiPickerPopover', () => {
  beforeEach(() => {
    mockPickerRef.onEmojiSelect = null;
  });

  it('renders the Emoji toolbar button', () => {
    const fakeEditor = buildFakeEditor();

    render(
      <EmojiPickerPopover
        editor={fakeEditor as never}
        open={false}
        onOpen={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTitle('Emoji')).toBeInTheDocument();
  });

  it('calls onOpen when the Emoji button is clicked', () => {
    const fakeEditor = buildFakeEditor();
    const onOpen = vi.fn();

    render(
      <EmojiPickerPopover
        editor={fakeEditor as never}
        open={false}
        onOpen={onOpen}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle('Emoji'));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('does not render the picker content when closed', () => {
    const fakeEditor = buildFakeEditor();

    render(
      <EmojiPickerPopover
        editor={fakeEditor as never}
        open={false}
        onOpen={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // The mocked Picker sets mockPickerRef.onEmojiSelect only when rendered;
    // if the picker is not rendered, the captured callback stays null.
    expect(mockPickerRef.onEmojiSelect).toBeNull();
  });

  it('renders the picker when open is true', async () => {
    const fakeEditor = buildFakeEditor();

    render(
      <EmojiPickerPopover
        editor={fakeEditor as never}
        open={true}
        onOpen={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(mockPickerRef.onEmojiSelect).not.toBeNull();
    });
  });

  it('calls onClose and runs editor command when an emoji is selected', async () => {
    const fakeEditor = buildFakeEditor();
    const onClose = vi.fn();

    render(
      <EmojiPickerPopover
        editor={fakeEditor as never}
        open={true}
        onOpen={vi.fn()}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(mockPickerRef.onEmojiSelect).not.toBeNull();
    });

    act(() => {
      mockPickerRef.onEmojiSelect?.({ native: '😊' });
    });

    expect(onClose).toHaveBeenCalledOnce();
    expect(fakeEditor.run).toHaveBeenCalledOnce();
  });

  it('inserts the selected emoji native character into the editor', async () => {
    const fakeEditor = buildFakeEditor();
    const insertContent = vi.fn(() => fakeEditor);
    fakeEditor.insertContent = insertContent;

    render(
      <EmojiPickerPopover
        editor={fakeEditor as never}
        open={true}
        onOpen={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(mockPickerRef.onEmojiSelect).not.toBeNull();
    });

    act(() => {
      mockPickerRef.onEmojiSelect?.({ native: '🔥' });
    });

    expect(insertContent).toHaveBeenCalledWith('🔥');
  });
});
