'use client';

/**
 * SettingsDialog — application preferences panel.
 *
 * Sections:
 *   1. Account   — profile (name, avatar), change password.
 *   2. Appearance — theme (light / dark / system) and language.
 *   3. Features  — feature-flag toggles (tags per page, tags per block).
 *
 * ─── STATE MANAGEMENT ─────────────────────────────────────────────────────────
 *
 * Theme and language are delegated to their existing owners:
 *   - `useTheme()`  from next-themes  → persists to localStorage['theme']
 *   - `useI18n()`   from lib/i18n     → persists to localStorage['language']
 *
 * Feature flags are owned by the Zustand settings store (`lib/settingsStore`),
 * which persists to localStorage['learning-tree-settings'].
 *
 * This clean separation avoids creating duplicate sources of truth. Each piece
 * of state has exactly one owner; this component just wires the UI to them.
 *
 * ─── WHY TOGGLE SWITCHES INSTEAD OF BUTTONS FOR FEATURES? ───────────────────
 *
 * The theme/language options are mutually exclusive (radio-button semantics),
 * so button groups with a visual "active" state communicate selection clearly.
 * Feature flags are on/off and independent of each other, which maps naturally
 * to the toggle switch (ARIA role="switch") pattern.
 */
import { useEffect, useRef, useState } from 'react';

import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';

import { BarChart2, Palette, SlidersHorizontal, User } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/shared/ui/dialog';
import { Switch } from '@/components/shared/ui/Switch';
import { type Locale, useI18n } from '@/lib/i18n';
import { useSettingsStore } from '@/lib/settingsStore';
import { useStatsStore } from '@/lib/statsStore';
import { saveUserPreferences, saveUserPreferencesWithOptions } from '@/lib/userPreferences';
import { cn } from '@/lib/utils';

type SettingsTab = 'account' | 'appearance' | 'features' | 'statistics';

function getInitials(user: { name?: string | null; email?: string | null }) {
  if (user?.name) {
    const parts = user.name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts.at(-1)![0]).toUpperCase();
    return user.name.slice(0, 2).toUpperCase();
  }
  if (user?.email) return user.email.slice(0, 2).toUpperCase();
  return '?';
}

type SettingsDialogProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>;

// ─── Constants ────────────────────────────────────────────────────────────────

const THEME_OPTIONS = ['light', 'dark', 'system'] as const;
type ThemeOption = (typeof THEME_OPTIONS)[number];

const LOCALE_OPTIONS: { id: Locale; labelKey: string }[] = [
  { id: 'en', labelKey: 'settings.languageEn' },
  { id: 'uk', labelKey: 'settings.languageUk' },
];

const THEME_LABEL_KEYS: Record<ThemeOption, string> = {
  light: 'settings.themeLight',
  dark: 'settings.themeDark',
  system: 'settings.themeSystem',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SegmentButton({
  active,
  onClick,
  children,
}: Readonly<{ active: boolean; onClick: () => void; children: React.ReactNode }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'motion-interactive rounded-md border px-3 py-1.5 text-sm font-medium transition-all',
        'focus-visible:ring-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
        active
          ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm dark:border-indigo-400 dark:bg-indigo-600'
          : 'border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground',
      )}
    >
      {children}
    </button>
  );
}

/** A single row: label (and optional description) on the left, control on the right. Vertically centered so labels line up with inputs. */
function SettingRow({
  label,
  description,
  children,
}: Readonly<{ label: string; description?: string; children: React.ReactNode }>) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-sm font-medium">{label}</p>
        {description && (
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** Section header with title */
function SectionHeader({ title }: Readonly<{ title: string }>) {
  return (
    <h3 className="text-muted-foreground/70 mb-3 text-xs font-semibold tracking-widest uppercase">
      {title}
    </h3>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { theme, setTheme } = useTheme();
  const { t, locale, setLocale } = useI18n();
  const { data: session, update: updateSession } = useSession();
  const {
    tagsPerPageEnabled,
    tagsPerBlockEnabled,
    recordingStartSoundEnabled,
    dictationFormattingEnabled,
    setTagsPerPage,
    setTagsPerBlock,
    setRecordingStartSound,
    setDictationFormatting,
  } = useSettingsStore();
  const {
    enabled: statisticsEnabled,
    trackSessionTime,
    trackPageTime,
    trackContentEvents,
    setEnabled: setStatisticsEnabled,
    setTrackSessionTime,
    setTrackPageTime,
    setTrackFolderTime,
    setTrackContentEvents,
  } = useStatsStore();

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(session?.user?.name ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<'saved' | 'error' | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const user = session?.user;
  const initials = user ? getInitials(user) : '?';

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- calling setState in useEffect is valid React
    if (open && user?.name !== undefined) setDisplayName(user.name ?? '');
  }, [open, user?.name]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileMessage(null);
    setProfileSaving(true);
    try {
      const formData = new FormData();
      formData.set('avatar', file);
      const res = await fetch('/api/user/avatar', { method: 'POST', body: formData });
      if (!res.ok) {
        await res.json().catch(() => ({}));
        setProfileMessage('error');
        setProfileSaving(false);
        return;
      }
      await updateSession();
      setProfileMessage('saved');
    } catch {
      setProfileMessage('error');
    }
    setProfileSaving(false);
    e.target.value = '';
  };

  const handleRemoveAvatar = async () => {
    setProfileMessage(null);
    setProfileSaving(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: null }),
      });
      if (!res.ok) {
        setProfileMessage('error');
        setProfileSaving(false);
        return;
      }
      await updateSession();
      setProfileMessage('saved');
    } catch {
      setProfileMessage('error');
    }
    setProfileSaving(false);
  };

  const handleSaveProfile = async () => {
    setProfileMessage(null);
    setProfileSaving(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: displayName.trim() || null }),
      });
      if (!res.ok) {
        setProfileMessage('error');
        setProfileSaving(false);
        return;
      }
      await updateSession();
      setProfileMessage('saved');
    } catch {
      setProfileMessage('error');
    }
    setProfileSaving(false);
  };

  const handleChangePassword = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    if (newPassword !== confirmPassword) {
      setPasswordError(t('settings.passwordMismatch'));
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetch('/api/user/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPassword, newPassword }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setPasswordError(body.error ?? t('settings.passwordUpdateFailed'));
        setPasswordSaving(false);
        return;
      }
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setPasswordError(t('settings.errorGeneric'));
    }
    setPasswordSaving(false);
  };

  const [activeTab, setActiveTab] = useState<SettingsTab>('account');

  const tabs: { id: SettingsTab; labelKey: string; icon: React.ReactNode }[] = [
    { id: 'account', labelKey: 'settings.sectionAccount', icon: <User size={18} /> },
    { id: 'appearance', labelKey: 'settings.sectionAppearance', icon: <Palette size={18} /> },
    { id: 'features', labelKey: 'settings.sectionFeatures', icon: <SlidersHorizontal size={18} /> },
    { id: 'statistics', labelKey: 'settings.sectionStatistics', icon: <BarChart2 size={18} /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex flex-col gap-0 overflow-hidden p-0',
          'h-dvh max-h-none w-[calc(100vw-1rem)] max-w-full',
          'sm:h-[85vh] sm:max-h-180 sm:w-full sm:max-w-2xl',
        )}
      >
        <DialogHeader className="border-border shrink-0 border-b px-4 py-3 pr-12 sm:px-6 sm:py-4">
          <DialogTitle className="text-base font-semibold sm:text-lg">
            {t('settings.title')}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs sm:text-sm">
            {t('settings.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          {/* Tabs: horizontal on mobile, vertical sidebar on desktop */}
          <nav
            className={cn(
              'border-border bg-muted/30 flex shrink-0 flex-row gap-0 overflow-x-auto overflow-y-hidden border-b py-2 [scrollbar-width:none] sm:flex-col sm:overflow-visible sm:border-r sm:border-b-0 sm:py-2',
              'w-full sm:w-44',
            )}
            style={{ WebkitOverflowScrolling: 'touch' }}
            aria-label={t('settings.title')}
          >
            {tabs.map(({ id, labelKey, icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                aria-label={t(labelKey)}
                className={cn(
                  'motion-interactive flex shrink-0 items-center justify-center gap-2 px-3 py-2.5 text-center text-sm font-medium whitespace-nowrap transition-colors sm:flex-initial sm:justify-start sm:px-4 sm:text-left',
                  activeTab === id
                    ? 'bg-background text-foreground border-b-2 border-indigo-600 sm:border-r-2 sm:border-b-0 dark:border-indigo-400'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                <span
                  className={cn(
                    'shrink-0',
                    activeTab === id
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-muted-foreground',
                  )}
                  aria-hidden
                >
                  {icon}
                </span>
                <span className="sr-only sm:not-sr-only sm:inline">{t(labelKey)}</span>
              </button>
            ))}
          </nav>

          {/* Scrollable content */}
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            {activeTab === 'account' && (
              <section className="space-y-6 p-4 sm:p-6">
                <div className="border-border bg-muted/20 rounded-lg border p-4">
                  <p className="text-foreground mb-2 text-sm font-medium">
                    {t('settings.profile')}
                  </p>
                  <p className="text-muted-foreground mb-3 text-xs">
                    {t('settings.profileDescription')}
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div
                        className={cn(
                          'flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full text-lg font-bold text-white',
                          'bg-linear-to-br from-indigo-500 to-violet-600',
                        )}
                      >
                        {user?.image ? (
                          <Image
                            src={user.image}
                            alt=""
                            fill
                            sizes="56px"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          initials
                        )}
                      </div>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="sr-only"
                        tabIndex={-1}
                        onChange={handleAvatarChange}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        disabled={profileSaving}
                        onClick={() => avatarInputRef.current?.click()}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50 dark:text-indigo-400 dark:hover:text-indigo-300"
                      >
                        {t('settings.changeAvatar')}
                      </button>
                      {user?.image && (
                        <button
                          type="button"
                          disabled={profileSaving}
                          onClick={handleRemoveAvatar}
                          className="text-muted-foreground hover:text-foreground text-left text-sm disabled:opacity-50"
                        >
                          {t('settings.removeAvatar')}
                        </button>
                      )}
                    </div>
                  </div>
                  {profileMessage === 'saved' && (
                    <output className="mt-2 block text-xs text-green-600 dark:text-green-400">
                      {t('settings.profileSaved')}
                    </output>
                  )}
                  {profileMessage === 'error' && (
                    <p className="text-destructive mt-2 text-xs" role="alert">
                      {t('settings.profileUpdateError')}
                    </p>
                  )}
                </div>

                <SettingRow label={t('settings.displayName')}>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={t('settings.displayNamePlaceholder')}
                    className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring w-full min-w-0 rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
                  />
                </SettingRow>
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={profileSaving}
                    onClick={handleSaveProfile}
                    className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                  >
                    {t('settings.saveProfile')}
                  </button>
                </div>

                {user?.email && (
                  <SettingRow label={t('settings.emailForSignIn')}>
                    <span className="text-muted-foreground text-sm">{user.email}</span>
                  </SettingRow>
                )}

                <div>
                  <p className="text-foreground mb-1 text-sm font-medium">
                    {t('settings.changePassword')}
                  </p>
                  <p className="text-muted-foreground mb-3 text-xs">
                    {t('settings.changePasswordDescription')}
                  </p>
                  <form onSubmit={handleChangePassword} className="space-y-3">
                    <input
                      type="password"
                      autoComplete="current-password"
                      placeholder={t('settings.currentPassword')}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="border-border bg-background placeholder:text-muted-foreground focus:border-ring focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
                    />
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder={t('settings.newPassword')}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="border-border bg-background placeholder:text-muted-foreground focus:border-ring focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
                    />
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder={t('settings.confirmPassword')}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="border-border bg-background placeholder:text-muted-foreground focus:border-ring focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
                    />
                    {passwordError && (
                      <p className="text-destructive text-xs" role="alert">
                        {passwordError}
                      </p>
                    )}
                    {passwordSuccess && (
                      <output className="block text-xs text-green-600 dark:text-green-400">
                        {t('settings.passwordUpdated')}
                      </output>
                    )}
                    <button
                      type="submit"
                      disabled={passwordSaving}
                      className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                    >
                      {t('settings.updatePassword')}
                    </button>
                  </form>
                </div>
              </section>
            )}

            {activeTab === 'appearance' && (
              <section className="space-y-6 p-4 sm:p-6">
                <SectionHeader title={t('settings.sectionAppearance')} />
                <div className="space-y-5">
                  <SettingRow
                    label={t('settings.theme')}
                    description={t('settings.themeDescription')}
                  >
                    <div className="flex gap-1.5">
                      {THEME_OPTIONS.map((value) => (
                        <SegmentButton
                          key={value}
                          active={theme === value}
                          onClick={() => {
                            setTheme(value);
                            void saveUserPreferences({ theme: value });
                          }}
                        >
                          {t(THEME_LABEL_KEYS[value])}
                        </SegmentButton>
                      ))}
                    </div>
                  </SettingRow>

                  <SettingRow
                    label={t('settings.language')}
                    description={t('settings.languageDescription')}
                  >
                    <div className="flex gap-1.5">
                      {LOCALE_OPTIONS.map(({ id, labelKey }) => (
                        <SegmentButton
                          key={id}
                          active={locale === id}
                          onClick={() => {
                            setLocale(id);
                            void saveUserPreferences({ locale: id });
                          }}
                        >
                          {t(labelKey)}
                        </SegmentButton>
                      ))}
                    </div>
                  </SettingRow>
                </div>
              </section>
            )}

            {activeTab === 'features' && (
              <section className="space-y-6 p-4 sm:p-6">
                <SectionHeader title={t('settings.sectionFeatures')} />
                <div className="space-y-4">
                  <SettingRow
                    label={t('settings.tagsPerPage')}
                    description={t('settings.tagsPerPageDescription')}
                  >
                    <Switch
                      checked={tagsPerPageEnabled}
                      onChange={(v) => {
                        setTagsPerPage(v);
                        void saveUserPreferences({ tagsPerPageEnabled: v });
                      }}
                      label={t('settings.tagsPerPage')}
                    />
                  </SettingRow>

                  <SettingRow
                    label={t('settings.tagsPerBlock')}
                    description={t('settings.tagsPerBlockDescription')}
                  >
                    <Switch
                      checked={tagsPerBlockEnabled}
                      onChange={(v) => {
                        setTagsPerBlock(v);
                        void saveUserPreferences({ tagsPerBlockEnabled: v });
                      }}
                      label={t('settings.tagsPerBlock')}
                    />
                  </SettingRow>

                  <SettingRow
                    label={t('settings.recordingStartSound')}
                    description={t('settings.recordingStartSoundDescription')}
                  >
                    <Switch
                      checked={recordingStartSoundEnabled}
                      onChange={(v) => {
                        setRecordingStartSound(v);
                        void saveUserPreferences({ recordingStartSoundEnabled: v });
                      }}
                      label={t('settings.recordingStartSound')}
                    />
                  </SettingRow>

                  <SettingRow
                    label={t('settings.dictationFormatting')}
                    description={t('settings.dictationFormattingDescription')}
                  >
                    <Switch
                      checked={dictationFormattingEnabled}
                      onChange={(v) => {
                        setDictationFormatting(v);
                        void saveUserPreferences({ dictationFormattingEnabled: v });
                      }}
                      label={t('settings.dictationFormatting')}
                    />
                  </SettingRow>
                </div>
              </section>
            )}

            {activeTab === 'statistics' && (
              <section className="space-y-6 p-4 sm:p-6">
                <SectionHeader title={t('settings.sectionStatistics')} />
                <div className="space-y-4">
                  <SettingRow
                    label={t('settings.statisticsEnabled')}
                    description={t('settings.statisticsEnabledDescription')}
                  >
                    <Switch
                      checked={statisticsEnabled}
                      onChange={(v) => {
                        setStatisticsEnabled(v);
                        void saveUserPreferencesWithOptions(
                          { statisticsEnabled: v },
                          { purgeDisabledStats: true },
                        );
                      }}
                      label={t('settings.statisticsEnabled')}
                    />
                  </SettingRow>

                  <SettingRow
                    label={t('settings.trackSessionTime')}
                    description={t('settings.trackSessionTimeDescription')}
                  >
                    <Switch
                      checked={trackSessionTime}
                      disabled={!statisticsEnabled}
                      onChange={(v) => {
                        setTrackSessionTime(v);
                        void saveUserPreferencesWithOptions(
                          { trackSessionTime: v },
                          { purgeDisabledStats: true },
                        );
                      }}
                      label={t('settings.trackSessionTime')}
                    />
                  </SettingRow>

                  <SettingRow
                    label={t('settings.trackPageTime')}
                    description={t('settings.trackPageTimeDescription')}
                  >
                    <Switch
                      checked={trackPageTime}
                      disabled={!statisticsEnabled}
                      onChange={(v) => {
                        setTrackPageTime(v);
                        setTrackFolderTime(v);
                        void saveUserPreferencesWithOptions(
                          { trackPageTime: v, trackFolderTime: v },
                          { purgeDisabledStats: true },
                        );
                      }}
                      label={t('settings.trackPageTime')}
                    />
                  </SettingRow>

                  <SettingRow
                    label={t('settings.trackContentEvents')}
                    description={t('settings.trackContentEventsDescription')}
                  >
                    <Switch
                      checked={trackContentEvents}
                      disabled={!statisticsEnabled}
                      onChange={(v) => {
                        setTrackContentEvents(v);
                        void saveUserPreferencesWithOptions(
                          { trackContentEvents: v },
                          { purgeDisabledStats: true },
                        );
                      }}
                      label={t('settings.trackContentEvents')}
                    />
                  </SettingRow>
                </div>
              </section>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
