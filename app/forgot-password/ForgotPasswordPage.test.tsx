/** @vitest-environment happy-dom */
import { useSearchParams } from 'next/navigation';

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ForgotPasswordPage from './page';

vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(),
}));

function mockSearchParams(params?: Record<string, string>) {
  const map = new URLSearchParams(params);
  return {
    get: (name: string) => map.get(name),
  } as ReturnType<typeof useSearchParams>;
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  it('renders request reset form when token is missing', () => {
    vi.mocked(useSearchParams).mockReturnValue(mockSearchParams());

    render(<ForgotPasswordPage />);

    expect(screen.getByRole('heading', { name: /forgot your password/i })).toBeInTheDocument();
    expect(screen.getByTestId('forgot-email')).toBeInTheDocument();
    expect(screen.getByTestId('forgot-submit')).toBeInTheDocument();
  });

  it('renders reset form when token and email are present', () => {
    vi.mocked(useSearchParams).mockReturnValue(
      mockSearchParams({ token: 'demo-token', email: 'user@example.com' }),
    );

    render(<ForgotPasswordPage />);

    expect(screen.getByRole('heading', { name: /set a new password/i })).toBeInTheDocument();
    expect(screen.getByTestId('reset-email')).toHaveValue('user@example.com');
    expect(screen.getByTestId('reset-submit')).toBeInTheDocument();
  });

  it('submits forgot-password request and shows success notice', async () => {
    vi.mocked(useSearchParams).mockReturnValue(mockSearchParams());
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByTestId('forgot-email'), 'user@example.com');
    await user.click(screen.getByTestId('forgot-submit'));

    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/forgot-password',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(screen.getByTestId('forgot-password-notice')).toBeInTheDocument();
  });
});
