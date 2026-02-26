/**
 * MainContent stories.
 *
 * These stories demonstrate the different states of the MainContent panel:
 *   - WithPage: a rich page with various block types, page stats, and export button.
 *   - MobileViewport: the same page at a 375px viewport to verify mobile layout.
 *   - EmptyState: no page selected (shows the empty-state prompt).
 *   - PageWithoutBlocks: a page with no blocks (stats footer hidden).
 *   - SavedState: the "Saved!" feedback button state.
 *   - WithMobileSidebarToggle: shows the hamburger menu button on narrow viewports.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';

import { MainContent } from '@/components/MainContent';
import type { Page } from '@/components/MainContent';

/** A rich page used across multiple stories. */
const pageWithBlocks: Page = {
  id: 'p1',
  title: 'React Hooks',
  createdAt: '2026-01-10T09:00:00.000Z',
  updatedAt: '2026-02-20T14:30:00.000Z',
  blocks: [
    {
      id: 'b1',
      type: 'text',
      content:
        '<h2>React Hooks</h2><p>React Hooks allow you to use <strong>state</strong> and other React features without writing a class.</p>',
      colSpan: 2,
      createdAt: '2026-01-10T09:00:00.000Z',
      updatedAt: '2026-02-20T14:30:00.000Z',
    },
    {
      id: 'b2',
      type: 'code',
      content: {
        code: 'const [count, setCount] = useState(0);\nuseEffect(() => { document.title = count; }, [count]);',
        language: 'javascript',
      },
      colSpan: 2,
      createdAt: '2026-01-10T09:05:00.000Z',
      updatedAt: '2026-01-10T09:05:00.000Z',
    },
    {
      id: 'b3',
      type: 'link',
      content: { url: 'https://react.dev', label: 'React Docs' },
      colSpan: 1,
    },
    {
      id: 'b4',
      type: 'agenda',
      content: {
        title: 'Topics to cover',
        items: [
          { id: 'i1', text: 'useState', checked: true },
          { id: 'i2', text: 'useEffect', checked: false },
          { id: 'i3', text: 'useCallback', checked: false },
        ],
      },
      colSpan: 1,
    },
    {
      id: 'b5',
      type: 'table',
      content: {
        headers: ['Hook', 'Purpose'],
        rows: [
          ['useState', 'Local component state'],
          ['useEffect', 'Side effects & subscriptions'],
          ['useCallback', 'Memoised callbacks'],
        ],
      },
      colSpan: 2,
    },
    {
      id: 'b6',
      type: 'diagram',
      content: {
        code: `flowchart TD
  Component -->|useState| State
  Component -->|useEffect| Effect
  Effect -->|cleanup| Component`,
      },
      colSpan: 2,
    },
  ],
};

const meta: Meta<typeof MainContent> = {
  title: 'Components/MainContent',
  component: MainContent,
  parameters: { layout: 'fullscreen' },
  argTypes: {
    onSave: { action: 'save' },
    onTitleChange: { action: 'titleChange' },
    onBlocksChange: { action: 'blocksChange' },
    onMobileSidebarToggle: { action: 'mobileSidebarToggle' },
  },
};

export default meta;

type Story = StoryObj<typeof MainContent>;

/** Full page with all block types, page stats footer, and export button. */
export const WithPage: Story = {
  args: {
    page: pageWithBlocks,
    onSave: fn(),
    onTitleChange: fn(),
    onBlocksChange: fn(),
    onMobileSidebarToggle: fn(),
  },
};

/**
 * Mobile viewport simulation.
 *
 * Set the viewport to 375×812 (iPhone size) to verify:
 *   - Hamburger menu button appears
 *   - Grid stacks to single column
 *   - Block corner controls are visible without hover
 */
export const MobileViewport: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1', // 320×568 in Storybook defaults
    },
  },
  args: {
    page: pageWithBlocks,
    onSave: fn(),
    onTitleChange: fn(),
    onBlocksChange: fn(),
    onMobileSidebarToggle: fn(),
  },
};

/** No page selected — shows the empty-state dashed-border card. */
export const EmptyState: Story = {
  args: {
    page: null,
    onSave: fn(),
    onMobileSidebarToggle: fn(),
  },
};

/** A page exists but has no blocks — stats footer should be hidden. */
export const PageWithoutBlocks: Story = {
  args: {
    page: { id: 'empty', title: 'Empty page', blocks: [] },
    onSave: fn(),
    onTitleChange: fn(),
    onBlocksChange: fn(),
  },
};

/**
 * "Saved!" button state (disabled with different label).
 *
 * Simulate the 2-second feedback window after the user saves.
 */
export const SavedState: Story = {
  args: {
    page: pageWithBlocks,
    saved: true,
    onSave: fn(),
    onTitleChange: fn(),
    onBlocksChange: fn(),
  },
};

/** Loading skeleton state shown immediately while switching notebook pages. */
export const LoadingState: Story = {
  args: {
    page: pageWithBlocks,
    isPageLoading: true,
    onSave: fn(),
    onTitleChange: fn(),
    onBlocksChange: fn(),
    onMobileSidebarToggle: fn(),
  },
};
