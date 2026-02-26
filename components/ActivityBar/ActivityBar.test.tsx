/** @vitest-environment happy-dom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/statistics',
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/components/SettingsDialog/useSettingsDialog', () => ({
  useSettingsDialog: () => ({ openSettings: vi.fn() }),
}));

vi.mock('@/lib/statsStore', () => ({
  useStatsStore: () => ({ enabled: true }),
}));

import { ActivityBar } from './ActivityBar';

describe('ActivityBar', () => {
  beforeEach(() => {
    pushMock.mockReset();
    globalThis.localStorage.clear();
  });

  it('opens notebook with last-opened page query when memory exists', async () => {
    globalThis.localStorage.setItem('devtree:lastNotebookPageId', 'page-123');
    const user = userEvent.setup();

    render(<ActivityBar />);
    await user.click(screen.getByRole('button', { name: 'Notebook' }));

    expect(pushMock).toHaveBeenCalledWith('/notebook?page=page-123');
  });

  it('opens plain notebook route when no last-opened page is stored', async () => {
    const user = userEvent.setup();

    render(<ActivityBar />);
    await user.click(screen.getByRole('button', { name: 'Notebook' }));

    expect(pushMock).toHaveBeenCalledWith('/notebook');
  });
});
