/** @vitest-environment happy-dom */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Extension } from '@tiptap/core';

import { PageEditor } from './PageEditor';

vi.mock('./BlockControls', () => ({
  BlockControls: () => null,
  BlockPickerMenu: () => null,
}));

vi.mock('./EditorBubbleMenu', () => ({
  EditorBubbleMenu: () => null,
}));

vi.mock('tiptap-extension-global-drag-handle', () => ({
  __esModule: true,
  default: Extension.create({ name: 'mockGlobalDragHandle' }),
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

vi.mock('@excalidraw/excalidraw', () => ({
  Excalidraw: () => <div data-testid="mock-excalidraw" />,
}));

vi.mock('next/dynamic', () => ({
  default: () => {
    function MockDynamic() {
      return <div data-testid="mock-excalidraw" />;
    }
    return MockDynamic;
  },
}));

describe('PageEditor canvas block', () => {
  it('opens and closes fullscreen overlay from canvas block toggle', async () => {
    const user = userEvent.setup();

    if (typeof document.elementsFromPoint !== 'function') {
      document.elementsFromPoint = () => [];
    }

    render(
      <PageEditor
        editable
        content={{
          type: 'doc',
          content: [
            {
              type: 'canvasNode',
              attrs: { data: '', tags: [] },
            },
          ],
        }}
      />,
    );

    const toggle = await screen.findByTestId('canvas-fullscreen-toggle');
    await user.click(toggle);

    expect(screen.getByTestId('canvas-fullscreen-overlay')).toBeInTheDocument();

    await user.click(screen.getByTestId('canvas-fullscreen-toggle'));

    expect(screen.queryByTestId('canvas-fullscreen-overlay')).not.toBeInTheDocument();
  });
});
