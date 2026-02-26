/** @vitest-environment happy-dom */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Extension, type JSONContent } from '@tiptap/core';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PageEditor } from './PageEditor';

vi.mock('./BlockControls', () => ({
  BlockControls: () => null,
  BlockPickerMenu: () => null,
}));

vi.mock('./EditorBubbleMenu', () => ({
  EditorBubbleMenu: () => null,
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

vi.mock('tiptap-extension-global-drag-handle', () => ({
  __esModule: true,
  default: Extension.create({ name: 'mockGlobalDragHandle' }),
}));

vi.mock('@excalidraw/excalidraw', () => ({
  Excalidraw: () => <div data-testid="mock-excalidraw" />,
}));

vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="mock-monaco" />,
}));

vi.mock('next/dynamic', () => ({
  default: () => {
    function MockDynamicComponent(props: Record<string, unknown>) {
      if ('language' in props) return <div data-testid="mock-monaco" />;
      return <div data-testid="mock-excalidraw" />;
    }
    return MockDynamicComponent;
  },
}));

async function renderWithSingleNode(node: JSONContent, editable = true) {
  const rendered = render(
    <PageEditor
      editable={editable}
      content={{
        type: 'doc',
        content: [node],
      }}
    />,
  );
  await act(async () => {
    await Promise.resolve();
  });
  return rendered;
}

describe('PageEditor unified block nodes', () => {
  beforeEach(() => {
    if (typeof document.elementsFromPoint !== 'function') {
      document.elementsFromPoint = () => [];
    }
  });

  it('renders code block with language control', async () => {
    await renderWithSingleNode({
      type: 'codeBlockNode',
      attrs: { code: 'const x = 1;', language: 'typescript', tags: [] },
    });

    expect(screen.getByText('Code')).toBeInTheDocument();
    expect(screen.getByDisplayValue('typescript')).toBeInTheDocument();
    expect(screen.getByTestId('mock-monaco')).toBeInTheDocument();
  });

  it('renders code language badge in read mode', async () => {
    await renderWithSingleNode(
      {
        type: 'codeBlockNode',
        attrs: { code: 'print(1)', language: 'python', tags: [] },
      },
      false,
    );

    expect(screen.getByText('python')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('python')).not.toBeInTheDocument();
  });

  it('allows adding checklist item in edit mode', async () => {
    const user = userEvent.setup();

    await renderWithSingleNode({
      type: 'checklistNode',
      attrs: { title: 'Tasks', items: [], tags: [] },
    });

    expect(screen.queryByPlaceholderText('Item…')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /add item/i }));
    expect(screen.getByPlaceholderText('Item…')).toBeInTheDocument();
  });

  it('shows checklist progress and toggles checkbox in read mode', async () => {
    const user = userEvent.setup();

    await renderWithSingleNode(
      {
        type: 'checklistNode',
        attrs: {
          title: 'Tasks',
          items: [
            { id: '1', text: 'First', checked: false },
            { id: '2', text: 'Second', checked: true },
          ],
          tags: [],
        },
      },
      false,
    );

    expect(screen.getByText('1/2')).toBeInTheDocument();
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    expect(screen.getByText('2/2')).toBeInTheDocument();
  });

  it('opens and closes canvas fullscreen overlay', async () => {
    const user = userEvent.setup();

    await renderWithSingleNode({
      type: 'canvasNode',
      attrs: { data: '', tags: [] },
    });

    await user.click(await screen.findByTestId('canvas-fullscreen-toggle'));
    expect(screen.getByTestId('canvas-fullscreen-overlay')).toBeInTheDocument();

    await user.click(screen.getByTestId('canvas-fullscreen-toggle'));
    expect(screen.queryByTestId('canvas-fullscreen-overlay')).not.toBeInTheDocument();
  });

  it('shows canvas placeholder text while fullscreen overlay is open', async () => {
    const user = userEvent.setup();

    await renderWithSingleNode({
      type: 'canvasNode',
      attrs: { data: '', tags: [] },
    });

    await user.click(await screen.findByTestId('canvas-fullscreen-toggle'));
    expect(screen.getByText('Canvas open in fullscreen')).toBeInTheDocument();
  });

  it('renders audio block edit inputs and empty hint', async () => {
    await renderWithSingleNode({
      type: 'audioNode',
      attrs: { url: '', caption: '', tags: [] },
    });

    expect(screen.getByText('Audio')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Audio URL (mp3, ogg, etc.)…')).toBeInTheDocument();
    expect(screen.getByText('Enter an audio URL above')).toBeInTheDocument();
  });

  it('renders audio player and caption in read mode', async () => {
    await renderWithSingleNode(
      {
        type: 'audioNode',
        attrs: {
          url: 'https://example.com/audio.mp3',
          caption: 'Demo audio',
          tags: [],
        },
      },
      false,
    );

    const audio = document.querySelector('audio');
    expect(audio).toBeInTheDocument();
    expect(audio?.getAttribute('src')).toBe('https://example.com/audio.mp3');
    expect(screen.getByText('Demo audio')).toBeInTheDocument();
  });

  it('renders video iframe in read mode for youtube url', async () => {
    await renderWithSingleNode(
      {
        type: 'videoNode',
        attrs: { url: 'about:blank', tags: [] },
      },
      false,
    );

    expect(screen.getByTestId('video-block-iframe')).toBeInTheDocument();
  });

  it('shows video empty hint when url is missing', async () => {
    await renderWithSingleNode(
      {
        type: 'videoNode',
        attrs: { url: '', tags: [] },
      },
      false,
    );

    expect(screen.getByText('Enter a video URL above')).toBeInTheDocument();
  });

  it('renders image and caption in read mode', async () => {
    await renderWithSingleNode(
      {
        type: 'imageNode',
        attrs: {
          url: 'https://example.com/image.png',
          alt: 'Preview',
          caption: 'Example caption',
          tags: [],
        },
      },
      false,
    );

    expect(screen.getByRole('img', { name: 'Preview' })).toBeInTheDocument();
    expect(screen.getByText('Example caption')).toBeInTheDocument();
  });

  it('shows image URL input in edit mode', async () => {
    await renderWithSingleNode({
      type: 'imageNode',
      attrs: { url: '', alt: '', caption: '', tags: [] },
    });

    expect(screen.getByPlaceholderText('Image URL…')).toBeInTheDocument();
    expect(screen.getByText('Enter an image URL above')).toBeInTheDocument();
  });

  it('renders link card anchor in read mode', async () => {
    await renderWithSingleNode(
      {
        type: 'linkCardNode',
        attrs: { url: 'https://example.com', label: 'Example', tags: [] },
      },
      false,
    );

    const link = screen.getByRole('link', { name: /example/i });
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('shows empty link-card state in read mode without url', async () => {
    await renderWithSingleNode(
      {
        type: 'linkCardNode',
        attrs: { url: '', label: '', tags: [] },
      },
      false,
    );

    expect(screen.getByText('No URL set')).toBeInTheDocument();
  });

  it('adds a table row in edit mode', async () => {
    const user = userEvent.setup();

    await renderWithSingleNode({
      type: 'tableBlockNode',
      attrs: { headers: ['A', 'B'], rows: [], tags: [] },
    });

    expect(screen.getAllByRole('row')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: /add row/i }));
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });

  it('adds a table column in edit mode', async () => {
    const user = userEvent.setup();

    await renderWithSingleNode({
      type: 'tableBlockNode',
      attrs: { headers: ['A'], rows: [['x']], tags: [] },
    });

    await user.click(screen.getByRole('button', { name: /add column/i }));
    expect(screen.getByDisplayValue('Column 2')).toBeInTheDocument();
  });

  it('adds block tag chips via comma separated input', async () => {
    const user = userEvent.setup();

    await renderWithSingleNode({
      type: 'codeBlockNode',
      attrs: { code: '', language: 'javascript', tags: [] },
    });

    const tagInput = screen.getByLabelText('Add tag');
    await user.type(tagInput, 'urgent,review{enter}');

    expect(screen.getByText('urgent')).toBeInTheDocument();
    expect(screen.getByText('review')).toBeInTheDocument();
  });
});
