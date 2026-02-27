'use client';

import { useEffect, useMemo, useState } from 'react';

import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { Check, Eye, EyeOff, X } from 'lucide-react';

import { type Locale, useI18n } from '@/lib/i18n';

type AuthMode = 'login' | 'register';

// ─── Validation & password strength ────────────────────────────────────────
// eslint-disable-next-line sonarjs/slow-regex -- standard email validation regex, bounded by @ and domain separators
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PASSWORD_RULES = {
  minLength: 8,
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  number: /\d/,
  special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
} as const;

type PasswordRequirement = keyof typeof PASSWORD_RULES;

function checkPasswordRequirements(password: string): Record<PasswordRequirement, boolean> {
  return {
    minLength: password.length >= PASSWORD_RULES.minLength,
    uppercase: PASSWORD_RULES.uppercase.test(password),
    lowercase: PASSWORD_RULES.lowercase.test(password),
    number: PASSWORD_RULES.number.test(password),
    special: PASSWORD_RULES.special.test(password),
  };
}

function passwordStrengthScore(password: string): number {
  if (!password) return 0;
  const met = checkPasswordRequirements(password);
  const count = Object.values(met).filter(Boolean).length;
  if (count < 4) return count;
  if (password.length >= 12) return 4;
  return 3;
}

const STRENGTH_KEYS: Record<number, string> = {
  0: 'auth.tooWeak',
  1: 'auth.weak',
  2: 'auth.fair',
  3: 'auth.good',
  4: 'auth.strong',
};

const STRENGTH_COLORS: Record<number, string> = {
  0: 'bg-muted-foreground/40',
  1: 'bg-red-500',
  2: 'bg-amber-500',
  3: 'bg-lime-500',
  4: 'bg-green-600',
};

function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'auth.emailRequired';
  if (!EMAIL_REGEX.test(trimmed)) return 'auth.emailInvalid';
  return null;
}

function validatePasswordLogin(value: string): string | null {
  if (!value) return 'auth.passwordRequired';
  return null;
}

function validatePasswordRegister(value: string): string | null {
  if (!value) return 'auth.passwordRequired';
  const met = checkPasswordRequirements(value);
  if (!met.minLength) return 'auth.passwordMinLength';
  if (!met.uppercase) return 'auth.passwordUppercase';
  if (!met.lowercase) return 'auth.passwordLowercase';
  if (!met.number) return 'auth.passwordNumber';
  if (!met.special) return 'auth.passwordSpecial';
  return null;
}

const LOCALE_OPTIONS: { id: Locale; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'uk', label: 'UA' },
];

const AUTH_ERROR_GENERIC_KEY = 'auth.errorGeneric';
const REQUIREMENT_MET_CLASS = 'text-green-600 dark:text-green-400';
const REQUIREMENT_UNMET_ICON_CLASS = 'text-muted-foreground mr-1.5 inline h-3.5 w-3.5';

// eslint-disable-next-line sonarjs/cognitive-complexity -- combined login/register form has inherent complexity
export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale, setLocale } = useI18n();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/';
  const modeParam = searchParams.get('mode');

  const [mode, setMode] = useState<AuthMode>(modeParam === 'register' ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [justRegistered, setJustRegistered] = useState(false);

  const passwordRequirements = useMemo(() => checkPasswordRequirements(password), [password]);
  const passwordScore = useMemo(() => passwordStrengthScore(password), [password]);
  const strengthLabelKey = STRENGTH_KEYS[passwordScore];
  const strengthColor = STRENGTH_COLORS[passwordScore];

  function getPasswordDescribedBy(): string | undefined {
    if (fieldErrors.password) return 'auth-password-error';
    if (mode === 'register') return 'auth-password-strength';
    return undefined;
  }

  const getSegmentClass = (i: number) => {
    if (password.length === 0) return 'bg-muted';
    return i <= passwordScore ? strengthColor : 'bg-muted';
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- calling setState in useEffect is valid React
    setMode(modeParam === 'register' ? 'register' : 'login');
    if (searchParams.get('registered') === '1') setJustRegistered(true);
  }, [modeParam, searchParams]);

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError('');
    setFieldErrors({});
    setJustRegistered(false);
  };

  const runRegister = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: name.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? t(AUTH_ERROR_GENERIC_KEY));
        setLoading(false);
        return;
      }
      setJustRegistered(true);
      switchMode('login');
    } catch {
      setError(t(AUTH_ERROR_GENERIC_KEY));
    }
    setLoading(false);
  };

  const runLogin = async () => {
    setLoading(true);
    try {
      const res = await signIn('credentials', {
        email: email.trim(),
        password,
        redirect: false,
        callbackUrl,
      });
      if (res?.error) {
        setError(t('auth.invalidCredentials'));
        setLoading(false);
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError(t(AUTH_ERROR_GENERIC_KEY));
      setLoading(false);
    }
  };

  function getFieldErrors(): { email?: string; password?: string } {
    const emailErr = validateEmail(email);
    const passwordErr =
      mode === 'login' ? validatePasswordLogin(password) : validatePasswordRegister(password);
    const errors: { email?: string; password?: string } = {};
    if (emailErr) errors.email = emailErr;
    if (passwordErr) errors.password = passwordErr;
    return errors;
  }

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const errors = getFieldErrors();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    if (mode === 'register') {
      await runRegister();
    } else {
      await runLogin();
    }
  };

  const formTitle = mode === 'login' ? t('auth.welcomeBack') : t('auth.createAccount');
  const formSubtitle = mode === 'login' ? t('auth.signInSubtitle') : t('auth.registerSubtitle');
  const primaryLabel = mode === 'login' ? t('auth.signIn') : t('auth.createAccountButton');
  const primaryLoading = mode === 'login' ? t('auth.signingIn') : t('auth.creatingAccount');

  const inputBase =
    'motion-interactive w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20';
  const btnBase =
    'motion-interactive flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50';

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Left panel: branding */}
      <div className="alive-surface flex min-h-[40vh] flex-col justify-center bg-linear-to-b from-[#1e3a5f] to-[#0f172a] px-6 py-8 text-white lg:min-h-screen lg:w-[42%] lg:px-10 lg:py-12">
        <div className="flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight lg:text-2xl">
            {t('auth.learningTree')}
          </span>
          <div className="flex gap-1 rounded-md border border-white/20 bg-white/5 p-0.5">
            {LOCALE_OPTIONS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setLocale(id)}
                className={`motion-interactive rounded px-2.5 py-1 text-sm font-medium transition-colors ${locale === id ? 'bg-white text-[#1e3a5f]' : 'text-white/80 hover:bg-white/10'}`}
                aria-label={t('auth.language')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <h1 className="mt-8 text-2xl leading-tight font-bold tracking-tight lg:text-3xl">
          {mode === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')}
        </h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-white/80">
          {t('auth.heroSubtitle')}
        </p>
      </div>

      {/* Right panel: form */}
      <div className="bg-background text-foreground flex flex-1 items-center justify-center px-4 py-8 lg:px-12">
        <div className="motion-surface alive-shadow w-full max-w-md">
          <h2 className="text-foreground text-2xl font-bold tracking-tight">{formTitle}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{formSubtitle}</p>

          <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
            {justRegistered && (
              <div
                className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400"
                aria-live="polite"
              >
                {t('auth.accountCreated')}
              </div>
            )}
            {error && (
              <div
                className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
                role="alert"
              >
                {error}
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label
                  htmlFor="auth-name"
                  className="text-foreground mb-1.5 block text-sm font-medium"
                >
                  {t('auth.nameOptional')}
                </label>
                <input
                  id="auth-name"
                  data-testid="auth-name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputBase}
                  placeholder={t('auth.namePlaceholder')}
                />
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="text-foreground mb-1.5 block text-sm font-medium"
              >
                {t('auth.email')}
              </label>
              <input
                id="auth-email"
                data-testid="auth-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }}
                className={`${inputBase} ${fieldErrors.email ? 'border-destructive focus:border-destructive focus:ring-destructive/20' : ''}`}
                placeholder={t('auth.emailPlaceholder')}
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? 'auth-email-error' : undefined}
              />
              {fieldErrors.email && (
                <p id="auth-email-error" className="text-destructive mt-1 text-xs" role="alert">
                  {t(fieldErrors.email)}
                </p>
              )}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="auth-password" className="text-foreground text-sm font-medium">
                  {t('auth.password')}
                </label>
                {mode === 'login' && (
                  <Link
                    href="/forgot-password"
                    data-testid="login-forgot-link"
                    className="motion-interactive text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
                  >
                    {t('auth.forgotPassword')}
                  </Link>
                )}
              </div>
              <div className="relative">
                <input
                  id="auth-password"
                  data-testid="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password)
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  className={`${inputBase} pr-11 ${fieldErrors.password ? 'border-destructive focus:border-destructive focus:ring-destructive/20' : ''}`}
                  placeholder={
                    mode === 'login' ? t('auth.enterPassword') : t('auth.createPassword')
                  }
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={getPasswordDescribedBy()}
                />
                <button
                  type="button"
                  className="motion-interactive text-muted-foreground hover:text-foreground focus:ring-ring focus:ring-offset-background absolute top-1/2 right-3 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded focus:ring-2 focus:ring-offset-2 focus:outline-none"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {fieldErrors.password && (
                <p id="auth-password-error" className="text-destructive mt-1 text-xs" role="alert">
                  {t(
                    fieldErrors.password,
                    fieldErrors.password === 'auth.passwordMinLength'
                      ? { count: PASSWORD_RULES.minLength }
                      : undefined,
                  )}
                </p>
              )}
              {mode === 'register' && (
                <div id="auth-password-strength" className="mt-2 space-y-2" aria-live="polite">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`motion-interactive h-1 flex-1 rounded-full transition-colors ${getSegmentClass(i)}`}
                      />
                    ))}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {t('auth.strength')}:{' '}
                    <span className="text-foreground font-medium">{t(strengthLabelKey)}</span>
                  </p>
                  <ul className="text-muted-foreground space-y-1 text-xs">
                    <li
                      className={
                        passwordRequirements.minLength ? REQUIREMENT_MET_CLASS : ''
                      }
                    >
                      {passwordRequirements.minLength ? (
                        <Check className="mr-1.5 inline h-3.5 w-3.5" />
                      ) : (
                        <X className={REQUIREMENT_UNMET_ICON_CLASS} />
                      )}
                      {t('auth.charCount', { count: PASSWORD_RULES.minLength })}
                    </li>
                    <li
                      className={
                        passwordRequirements.uppercase ? REQUIREMENT_MET_CLASS : ''
                      }
                    >
                      {passwordRequirements.uppercase ? (
                        <Check className="mr-1.5 inline h-3.5 w-3.5" />
                      ) : (
                        <X className={REQUIREMENT_UNMET_ICON_CLASS} />
                      )}
                      {t('auth.oneUppercase')}
                    </li>
                    <li
                      className={
                        passwordRequirements.lowercase ? REQUIREMENT_MET_CLASS : ''
                      }
                    >
                      {passwordRequirements.lowercase ? (
                        <Check className="mr-1.5 inline h-3.5 w-3.5" />
                      ) : (
                        <X className={REQUIREMENT_UNMET_ICON_CLASS} />
                      )}
                      {t('auth.oneLowercase')}
                    </li>
                    <li
                      className={
                        passwordRequirements.number ? REQUIREMENT_MET_CLASS : ''
                      }
                    >
                      {passwordRequirements.number ? (
                        <Check className="mr-1.5 inline h-3.5 w-3.5" />
                      ) : (
                        <X className={REQUIREMENT_UNMET_ICON_CLASS} />
                      )}
                      {t('auth.oneNumber')}
                    </li>
                    <li
                      className={
                        passwordRequirements.special ? REQUIREMENT_MET_CLASS : ''
                      }
                    >
                      {passwordRequirements.special ? (
                        <Check className="mr-1.5 inline h-3.5 w-3.5" />
                      ) : (
                        <X className={REQUIREMENT_UNMET_ICON_CLASS} />
                      )}
                      {t('auth.oneSpecial')}
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <button
              type="submit"
              data-testid="auth-submit"
              disabled={loading}
              className={`${btnBase} bg-primary text-primary-foreground hover:opacity-90`}
            >
              {loading ? primaryLoading : primaryLabel}
            </button>
          </form>

          <div className="my-6 flex items-center gap-4">
            <div className="bg-border h-px flex-1" />
            <span className="text-muted-foreground text-xs">{t('auth.orContinueWith')}</span>
            <div className="bg-border h-px flex-1" />
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              className={`${btnBase} border-border bg-background text-foreground hover:bg-accent border`}
              onClick={() => signIn('google', { callbackUrl })}
            >
              <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 shrink-0">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {t('auth.continueGoogle')}
            </button>
            <button
              type="button"
              className={`${btnBase} border-border bg-background text-foreground hover:bg-accent border`}
              onClick={() => signIn('github', { callbackUrl })}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-5 w-5 shrink-0">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              {t('auth.continueGitHub')}
            </button>
          </div>

          <p className="text-muted-foreground mt-6 text-center text-sm">
            {mode === 'login' ? (
              <>
                {t('auth.noAccount')}{' '}
                <button
                  type="button"
                  data-testid="auth-switch-register"
                  className="motion-interactive text-foreground font-medium underline-offset-2 hover:underline"
                  onClick={() => switchMode('register')}
                >
                  {t('auth.signUp')}
                </button>
              </>
            ) : (
              <>
                {t('auth.hasAccount')}{' '}
                <button
                  type="button"
                  data-testid="auth-switch-login"
                  className="motion-interactive text-foreground font-medium underline-offset-2 hover:underline"
                  onClick={() => switchMode('login')}
                >
                  {t('auth.logIn')}
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
