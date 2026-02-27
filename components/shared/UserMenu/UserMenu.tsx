'use client';

/**
 * UserMenu — the user avatar button and its dropdown.
 *
 * The dropdown provides quick access to the most commonly adjusted settings
 * (theme, language) without opening the full settings dialog, as well as a
 * link to the full settings panel. This follows the pattern used by apps like
 * Notion, Linear, and GitHub where the user menu doubles as a quick-settings
 * panel.
 *
 * ─── LAYOUT ───────────────────────────────────────────────────────────────────
 *
 * ┌─────────────────────────────────┐
 * │  [LT]  Learning Tree            │  ← User info header (gradient avatar)
 * │        Personal workspace       │
 * ├─────────────────────────────────┤
 * │  Theme    [Light] [Dark] [Sys]  │  ← Inline segment controls
 * ├─────────────────────────────────┤
 * │  Language   [EN]  [UA]          │
 * ├─────────────────────────────────┤
 * │  ⚙  Settings                    │  ← Opens full SettingsDialog
 * └─────────────────────────────────┘
 *
 * ─── WHY RADIX DROPDOWN MENU? ────────────────────────────────────────────────
 *
 * Radix DropdownMenu provides focus trapping, keyboard navigation (arrow keys,
 * Escape), and correct ARIA roles out of the box. Implementing these correctly
 * with a plain <div> would require significant effort and is error-prone.
 *
 * The `modal={false}` option keeps the page interactive while the menu is open,
 * which is the correct behaviour for a persistent-sidebar layout where users
 * may want to scroll the tree while the menu is open.
 */
import { useEffect, useState } from 'react';

import Image from 'next/image';
import { signOut, useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { LogOut, Settings } from 'lucide-react';

import { type Locale, useI18n } from '@/lib/i18n';
import { saveUserPreferences } from '@/lib/userPreferences';
import { cn } from '@/lib/utils';

/** True when viewport is narrow (mobile). Used to open menu above trigger and widen dropdown. */
function useIsNarrowViewport() {
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = globalThis.matchMedia?.('(max-width: 640px)');
    if (!mq) return;
    const set = () => setIsNarrow(mq.matches);
    set();
    mq.addEventListener('change', set);
    return () => mq.removeEventListener('change', set);
  }, []);
  return isNarrow;
}

/** Derive initials from name or email (fallback: LT). */
function getInitials(user: { name?: string | null; email?: string | null }) {
  if (user?.name) {
    const parts = user.name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts.at(-1)![0]).toUpperCase();
    return user.name.slice(0, 2).toUpperCase();
  }
  if (user?.email) return user.email.slice(0, 2).toUpperCase();
  return 'LT';
}

type UserMenuProps = Readonly<{
  onOpenSettings: () => void;
}>;

// ─── Constants ────────────────────────────────────────────────────────────────

const THEME_OPTIONS = ['light', 'dark', 'system'] as const;
type ThemeOption = (typeof THEME_OPTIONS)[number];

const LOCALE_OPTIONS: { id: Locale; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'uk', label: 'UA' },
];

// Theme option -> translation key (use t() when rendering)
const THEME_LABEL_KEYS: Record<ThemeOption, string> = {
  light: 'settings.themeLight',
  dark: 'settings.themeDark',
  system: 'settings.themeSystem',
};

// ─── Inline segment button (used inside the dropdown) ─────────────────────────

function InlineSegment({
  active,
  onClick,
  children,
}: Readonly<{ active: boolean; onClick: () => void; children: React.ReactNode }>) {
  return (
    <button
      type="button"
      onClick={(e) => {
        // Prevent DropdownMenu from interpreting clicks inside as item selections
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'motion-interactive rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
        active
          ? 'bg-indigo-600 text-white dark:bg-indigo-500'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function UserMenu({ onOpenSettings }: UserMenuProps) {
  const { data: session } = useSession();
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const isNarrow = useIsNarrowViewport();
  const userName = session?.user?.name ?? t('userMenu.userName');
  const userEmail = session?.user?.email ?? t('userMenu.workspace');
  const initials = session?.user ? getInitials(session.user) : 'LT';

  // Close menu when the user scrolls anywhere on the page
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    globalThis.addEventListener('scroll', close, { capture: true, passive: true });
    return () => globalThis.removeEventListener('scroll', close, { capture: true });
  }, [open]);

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen} modal={false}>
      {/* Avatar: user image from session (Google), or initials fallback. */}
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={t('userMenu.label')}
          className={cn(
            'motion-interactive relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full',
            'bg-linear-to-br from-indigo-500 to-violet-600',
            'text-xs font-bold text-white shadow-sm',
            'transition-shadow hover:shadow-md',
            'focus-visible:ring-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            open && 'ring-offset-background ring-2 ring-indigo-400 ring-offset-2',
          )}
        >
          {session?.user?.image ? (
            <Image src={session.user.image} alt="" fill sizes="32px" className="object-cover" unoptimized />
          ) : (
            initials
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal forceMount>
        <AnimatePresence>
          {open && (
            <DropdownMenu.Content
              forceMount
              asChild
              side={isNarrow ? 'top' : 'bottom'}
              sideOffset={8}
              align="end"
              alignOffset={0}
              collisionPadding={12}
            >
              <motion.div
                initial={
                  reducedMotion
                    ? { opacity: 1 }
                    : { opacity: 0, scale: 0.97 }
                }
                animate={
                  reducedMotion
                    ? { opacity: 1 }
                    : { opacity: 1, scale: 1 }
                }
                exit={
                  reducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.985 }
                }
                transition={{ duration: reducedMotion ? 0.01 : 0.18, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  'motion-surface border-border bg-popover z-50 min-w-56 overflow-hidden rounded-xl border shadow-xl',
                  'max-w-[min(20rem,calc(100vw-2rem))]',
                  'text-popover-foreground',
                )}
              >
          {/* ── User info header ──────────────────────────────────────── */}
          <div className="border-border/60 flex items-center gap-3 border-b px-4 py-3">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
              {session?.user?.image ? (
                <Image src={session.user.image} alt="" fill sizes="36px" className="object-cover" unoptimized />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0">
              <p className="text-foreground truncate text-sm font-semibold">{userName}</p>
              <p className="text-muted-foreground truncate text-xs">{userEmail}</p>
            </div>
          </div>

          {/* ── Theme ────────────────────────────────────────────────── */}
          <div className="border-border/60 border-b px-4 py-3">
            <p className="text-muted-foreground mb-2 text-xs font-medium">{t('settings.theme')}</p>
            <div className="bg-muted/50 flex gap-1 rounded-md p-0.5">
              {THEME_OPTIONS.map((value) => (
                <InlineSegment
                  key={value}
                  active={theme === value}
                  onClick={() => {
                    setTheme(value);
                    void saveUserPreferences({ theme: value });
                  }}
                >
                  {t(THEME_LABEL_KEYS[value])}
                </InlineSegment>
              ))}
            </div>
          </div>

          {/* ── Language ─────────────────────────────────────────────── */}
          <div className="border-border/60 border-b px-4 py-3">
            <p className="text-muted-foreground mb-2 text-xs font-medium">
              {t('settings.language')}
            </p>
            <div className="bg-muted/50 flex gap-1 rounded-md p-0.5">
              {LOCALE_OPTIONS.map(({ id, label }) => (
                <InlineSegment
                  key={id}
                  active={locale === id}
                  onClick={() => {
                    setLocale(id);
                    void saveUserPreferences({ locale: id });
                  }}
                >
                  {label}
                </InlineSegment>
              ))}
            </div>
          </div>

          {/* ── Settings link ─────────────────────────────────────────── */}
          <div className="border-border/60 border-b p-1">
            <DropdownMenu.Item
              className={cn(
                'motion-interactive icon-tilt-hover flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5',
                'text-foreground text-sm transition-colors outline-none',
                'hover:bg-accent hover:text-accent-foreground',
                'focus:bg-accent focus:text-accent-foreground',
              )}
              onSelect={(e) => {
                e.preventDefault();
                setOpen(false);
                onOpenSettings();
              }}
            >
              <Settings size={14} className="text-muted-foreground shrink-0" />
              <span>{t('userMenu.settings')}</span>
            </DropdownMenu.Item>
          </div>

          {/* ── Sign out ───────────────────────────────────────────────── */}
          <div className="p-1">
            <DropdownMenu.Item
              className={cn(
                'motion-interactive icon-pop-hover flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5',
                'text-foreground text-sm transition-colors outline-none',
                'hover:bg-accent hover:text-accent-foreground',
                'focus:bg-accent focus:text-accent-foreground',
              )}
              onSelect={(e) => {
                e.preventDefault();
                setOpen(false);
                void signOut({ callbackUrl: '/login' });
              }}
            >
              <LogOut size={14} className="text-muted-foreground shrink-0" />
              <span>{t('userMenu.signOut')}</span>
            </DropdownMenu.Item>
          </div>
              </motion.div>
            </DropdownMenu.Content>
          )}
        </AnimatePresence>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
