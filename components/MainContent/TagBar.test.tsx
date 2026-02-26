/** @vitest-environment happy-dom */
/**
 * TagBar unit tests.
 *
 * TagBar is defined inside MainContent.tsx but we test its behaviour through
 * the public `MainContent` component by passing an `onTagsChange` prop and a
 * page with existing tags.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import { ConfirmationProvider } from '@/lib/confirmationContext';

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Test', email: 'test@example.com' } }, status: 'authenticated' }),
}));

vi.mock('@/lib/pageUtils', () => ({
  computePageStats: () => ({ wordCount: 0, readingTimeMin: 1, blockCount: 0 }),
  downloadMarkdown: vi.fn(),
  extractInlineTagsFromContent: () => [],
}));

import { MainContent } from './MainContent';
import type { Page } from './types';

function Wrapper({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <I18nProvider>
      <ConfirmationProvider>{children}</ConfirmationProvider>
    </I18nProvider>
  );
}

const pageWithTags: Page = {
  id: 'p1',
  title: 'Test Page',
  blocks: [],
  tags: ['react', 'hooks'],
};

const pageNoTags: Page = {
  id: 'p2',
  title: 'Empty Tags Page',
  blocks: [],
  tags: [],
};

describe('TagBar (via MainContent)', () => {
  it('renders page skeleton and hides page content while switching pages', () => {
    render(
      <Wrapper>
        <MainContent page={pageWithTags} onTagsChange={vi.fn()} isPageLoading />
      </Wrapper>,
    );

    expect(screen.getByTestId('main-content-header-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('main-content-page-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('page-header-title')).not.toBeInTheDocument();
  });

  it('renders existing tags as chips in read-only mode', () => {
    render(
      <Wrapper>
        <MainContent page={pageWithTags} onTagsChange={vi.fn()} />
      </Wrapper>,
    );
    expect(screen.getByText('react')).toBeInTheDocument();
    expect(screen.getByText('hooks')).toBeInTheDocument();
  });

  it('shows the add-tag placeholder input when no tags present and in edit mode', () => {
    render(
      <Wrapper>
        <MainContent page={pageNoTags} onTagsChange={vi.fn()} isEditMode />
      </Wrapper>,
    );
    const input = screen.getByPlaceholderText(/add tag/i);
    expect(input).toBeInTheDocument();
  });

  it('calls onTagsChange with new tag when Enter is pressed', async () => {
    const onTagsChange = vi.fn();
    const user = userEvent.setup();

    render(
      <Wrapper>
        <MainContent page={pageNoTags} onTagsChange={onTagsChange} isEditMode />
      </Wrapper>,
    );

    // Use aria-label to find the tag input specifically (PageTitle also has a textbox)
    const input = screen.getByRole('textbox', { name: /add tag/i });
    await user.type(input, 'typescript');
    await user.keyboard('{Enter}');

    expect(onTagsChange).toHaveBeenCalledWith(['typescript']);
  });

  it('calls onTagsChange with comma-separated tags', async () => {
    const onTagsChange = vi.fn();
    const user = userEvent.setup();

    render(
      <Wrapper>
        <MainContent page={pageNoTags} onTagsChange={onTagsChange} isEditMode />
      </Wrapper>,
    );

    const input = screen.getByRole('textbox', { name: /add tag/i });
    await user.type(input, 'react');
    fireEvent.keyDown(input, { key: ',' });

    expect(onTagsChange).toHaveBeenCalledWith(['react']);
  });

  it('removes a tag when its × button is clicked', async () => {
    const onTagsChange = vi.fn();
    const user = userEvent.setup();

    render(
      <Wrapper>
        <MainContent page={pageWithTags} onTagsChange={onTagsChange} isEditMode />
      </Wrapper>,
    );

    const removeReact = screen.getByRole('button', { name: /remove tag react/i });
    await user.click(removeReact);

    expect(onTagsChange).toHaveBeenCalledWith(['hooks']);
  });

  it('does not add duplicate tags', async () => {
    const onTagsChange = vi.fn();
    const user = userEvent.setup();

    render(
      <Wrapper>
        <MainContent page={pageWithTags} onTagsChange={onTagsChange} isEditMode />
      </Wrapper>,
    );

    // aria-label is always "Add tag" regardless of whether tags exist
    const input = screen.getByRole('textbox', { name: /add tag/i });
    await user.type(input, 'react');
    await user.keyboard('{Enter}');

    // "react" already exists → onTagsChange should not be called
    expect(onTagsChange).not.toHaveBeenCalled();
  });

  it('normalises tags to lowercase', async () => {
    const onTagsChange = vi.fn();
    const user = userEvent.setup();

    render(
      <Wrapper>
        <MainContent page={pageNoTags} onTagsChange={onTagsChange} isEditMode />
      </Wrapper>,
    );

    const input = screen.getByRole('textbox', { name: /add tag/i });
    await user.type(input, 'TypeScript');
    await user.keyboard('{Enter}');

    expect(onTagsChange).toHaveBeenCalledWith(['typescript']);
  });

  it('removes last tag when Backspace is pressed on empty input', async () => {
    const onTagsChange = vi.fn();
    const user = userEvent.setup();

    render(
      <Wrapper>
        <MainContent page={pageWithTags} onTagsChange={onTagsChange} isEditMode />
      </Wrapper>,
    );

    // aria-label targets the tag input specifically
    const input = screen.getByRole('textbox', { name: /add tag/i });
    await user.click(input);
    await user.keyboard('{Backspace}');

    expect(onTagsChange).toHaveBeenCalledWith(['react']);
  });

  it('shows tags as read-only chips when not in edit mode', () => {
    render(
      <Wrapper>
        {/* No isEditMode prop → read-only mode; tags are visible but not editable */}
        <MainContent page={pageWithTags} onTagsChange={vi.fn()} />
      </Wrapper>,
    );
    // Tags are visible as chips in read-only mode
    expect(screen.getByText('react')).toBeInTheDocument();
    expect(screen.getByText('hooks')).toBeInTheDocument();
    // But the editable input and remove buttons must NOT be present
    expect(screen.queryByRole('textbox', { name: /add tag/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove tag/i })).not.toBeInTheDocument();
  });
});
