/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/lib/i18n';

import { SettingsDialog } from './SettingsDialog';

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, update: vi.fn() }),
}));

function Wrapper({ children }: Readonly<{ children: React.ReactNode }>) {
  return <I18nProvider>{children}</I18nProvider>;
}

describe('SettingsDialog', () => {
  it('renders when open with tabbed layout and Account section', () => {
    render(
      <Wrapper>
        <SettingsDialog open onOpenChange={() => {}} />
      </Wrapper>,
    );
    expect(screen.getByRole('dialog', { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /account/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /appearance/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /features/i })).toBeInTheDocument();
    expect(screen.getByText(/profile/i)).toBeInTheDocument();
  });

  it('shows theme and language when Appearance tab is selected', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <SettingsDialog open onOpenChange={() => {}} />
      </Wrapper>,
    );
    await user.click(screen.getByRole('button', { name: /appearance/i }));
    expect(screen.getByText('Theme')).toBeInTheDocument();
    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
    expect(screen.getByText('Language')).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('Ukrainian')).toBeInTheDocument();
  });

  it('shows recording start sound toggle in Features tab', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <SettingsDialog open onOpenChange={() => {}} />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: /features/i }));

    expect(screen.getByText('Recording start sound')).toBeInTheDocument();
  });

  it('shows statistics toggles in Statistics tab', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <SettingsDialog open onOpenChange={() => {}} />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: /statistics/i }));

    expect(screen.getByText('Enable statistics')).toBeInTheDocument();
    expect(screen.getByText('Track session time')).toBeInTheDocument();
    expect(screen.getByText('Track time per page')).toBeInTheDocument();
    expect(screen.getByText('Track content changes')).toBeInTheDocument();
  });

  it('uses scrollable mobile tabs with screen-reader labels', () => {
    render(
      <Wrapper>
        <SettingsDialog open onOpenChange={() => {}} />
      </Wrapper>,
    );

    const tabNav = screen.getByRole('navigation', { name: /settings/i });
    expect(tabNav).toHaveClass('overflow-x-auto');

    const tabButtons = screen.getAllByRole('button', {
      name: /account|appearance|features|statistics/i,
    });
    expect(tabButtons.length).toBe(4);

    for (const button of tabButtons) {
      expect(button).toHaveClass('shrink-0');
      const label = button.querySelector('span.sr-only');
      expect(label).toBeInTheDocument();
    }
  });

  it('does not render when closed', () => {
    render(
      <Wrapper>
        <SettingsDialog open={false} onOpenChange={() => {}} />
      </Wrapper>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
