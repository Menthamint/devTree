import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { PageTitle } from './PageTitle';
import type { Page } from './types';

const page: Page = {
  id: 'p1',
  title: 'My Page',
  blocks: [],
};

describe('PageTitle (read-only mode)', () => {
  it('renders a heading with the page title', () => {
    render(<PageTitle page={page} />);
    // In read-only mode we render a <h1>, not an interactive input
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('My Page');
  });

  it('renders "(Untitled)" placeholder when title is empty', () => {
    render(<PageTitle page={{ ...page, title: '' }} />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Untitled')).toBeInTheDocument();
  });
});

describe('PageTitle (edit mode)', () => {
  it('renders an editable input with accessible label', () => {
    render(<PageTitle page={page} readOnly={false} />);
    const input = screen.getByRole('textbox', { name: /page title/i });
    expect(input).toHaveValue('My Page');
    expect(input).not.toHaveAttribute('readOnly');
  });

  it('calls onTitleChange when user types', async () => {
    const user = userEvent.setup();
    const onTitleChange = vi.fn();
    render(
      <PageTitle page={page} readOnly={false} onTitleChange={onTitleChange} />,
    );
    const input = screen.getByRole('textbox', { name: /page title/i });
    await user.clear(input);
    await user.type(input, 'New Title');
    expect(onTitleChange).toHaveBeenCalled();
  });
});
