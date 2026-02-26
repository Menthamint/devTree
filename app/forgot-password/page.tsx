'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function ForgotPasswordPage() {
  const searchParams = useSearchParams();
  const resetToken = searchParams.get('token')?.trim() ?? '';
  const emailFromQuery = searchParams.get('email')?.trim().toLowerCase() ?? '';
  const isResetMode = useMemo(() => Boolean(resetToken), [resetToken]);

  const [email, setEmail] = useState(emailFromQuery);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submitRequest = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!email) {
      setError('Enter your account email.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? 'Failed to send reset link. Please try again.');
        setSubmitting(false);
        return;
      }
      setNotice('If an account exists for this email, a reset link has been sent.');
    } catch {
      setError('Failed to send reset link. Please try again.');
    }
    setSubmitting(false);
  };

  const submitReset = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!emailFromQuery || !resetToken) {
      setError('Reset link is invalid.');
      return;
    }
    if (!newPassword || !confirmPassword) {
      setError('Enter and confirm your new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailFromQuery, token: resetToken, newPassword }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? 'Failed to reset password.');
        setSubmitting(false);
        return;
      }
      setNotice('Password updated. You can now sign in with your new password.');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setError('Failed to reset password.');
    }
    setSubmitting(false);
  };

  return (
    <div className="bg-muted/30 flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="motion-surface alive-shadow border-border bg-card w-full max-w-md rounded-2xl border p-6 shadow-lg sm:p-10">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="motion-interactive mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 text-lg font-bold text-white shadow-md"
          >
            LT
          </Link>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            {isResetMode ? 'Set a new password' : 'Forgot your password?'}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {isResetMode
              ? 'Use a strong password with at least 8 characters, upper/lower case, number, and special character.'
              : 'Enter your email and we will send you a secure reset link.'}
          </p>
        </div>

        {error && (
          <div
            className="border-destructive/30 bg-destructive/10 text-destructive mb-4 rounded-lg border px-4 py-3 text-sm"
            role="alert"
            data-testid="forgot-password-error"
          >
            {error}
          </div>
        )}
        {notice && (
          <output
            className="mb-4 block rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400"
            aria-live="polite"
            data-testid="forgot-password-notice"
          >
            {notice}
          </output>
        )}

        {isResetMode ? (
          <form onSubmit={submitReset} className="space-y-4">
            <div>
              <label
                className="text-foreground mb-1.5 block text-sm font-medium"
                htmlFor="reset-email"
              >
                Email
              </label>
              <input
                id="reset-email"
                data-testid="reset-email"
                value={emailFromQuery}
                readOnly
                className="border-border bg-muted text-muted-foreground w-full rounded-lg border px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label
                className="text-foreground mb-1.5 block text-sm font-medium"
                htmlFor="reset-password"
              >
                New password
              </label>
              <input
                id="reset-password"
                data-testid="reset-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="motion-interactive border-border bg-background text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-4 py-3 text-sm outline-none focus:ring-2"
                placeholder="Enter your new password"
              />
            </div>
            <div>
              <label
                className="text-foreground mb-1.5 block text-sm font-medium"
                htmlFor="reset-password-confirm"
              >
                Confirm new password
              </label>
              <input
                id="reset-password-confirm"
                data-testid="reset-password-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="motion-interactive border-border bg-background text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-4 py-3 text-sm outline-none focus:ring-2"
                placeholder="Confirm your new password"
              />
            </div>
            <button
              type="submit"
              data-testid="reset-submit"
              disabled={submitting}
              className="motion-interactive from-primary to-primary/85 text-primary-foreground hover:from-primary/95 hover:to-primary/80 focus:ring-ring focus:ring-offset-background flex h-11 w-full items-center justify-center rounded-lg bg-linear-to-r px-4 py-3 text-sm font-semibold shadow-md transition-all focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:opacity-60"
            >
              {submitting ? 'Updating...' : 'Update password'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitRequest} className="space-y-4">
            <div>
              <label
                className="text-foreground mb-1.5 block text-sm font-medium"
                htmlFor="forgot-email"
              >
                Email
              </label>
              <input
                id="forgot-email"
                data-testid="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="motion-interactive border-border bg-background text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-4 py-3 text-sm outline-none focus:ring-2"
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              data-testid="forgot-submit"
              disabled={submitting}
              className="motion-interactive from-primary to-primary/85 text-primary-foreground hover:from-primary/95 hover:to-primary/80 focus:ring-ring focus:ring-offset-background flex h-11 w-full items-center justify-center rounded-lg bg-linear-to-r px-4 py-3 text-sm font-semibold shadow-md transition-all focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:opacity-60"
            >
              {submitting ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        )}

        <Link
          href="/login"
          className="motion-interactive border-border bg-background text-foreground hover:bg-accent focus:ring-ring focus:ring-offset-background mt-3 flex h-11 w-full items-center justify-center rounded-lg border px-4 py-3 text-sm font-medium transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
          data-testid="forgot-back-to-login"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
