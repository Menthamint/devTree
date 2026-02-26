'use client';

import { useEffect, useRef } from 'react';

import { SessionProvider, useSession } from 'next-auth/react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';

import { ConfirmationProvider } from '@/lib/confirmationContext';
import { I18nProvider, type Locale, useI18n } from '@/lib/i18n';
import { useSettingsStore } from '@/lib/settingsStore';
import { useStatsStore } from '@/lib/statsStore';
import { loadUserPreferences } from '@/lib/userPreferences';
import { useSessionTracking } from '@/lib/useSessionTracking';

import { RecordingIndicator } from './RecordingIndicator';

/**
 * When the user is logged in, fetch their saved preferences from the API and
 * apply theme, locale, and feature flags so settings follow them across devices.
 * Runs once per session. Applying locale via setLocale also persists it to the
 * cookie, so the next full page refresh will use the same language.
 */
function SyncUserPreferences() {
  const { data: session, status } = useSession();
  const { setTheme } = useTheme();
  const { setLocale } = useI18n();
  const { setTagsPerPage, setTagsPerBlock, setRecordingStartSound } = useSettingsStore();
  const {
    setEnabled: setStatsEnabled,
    setTrackSessionTime,
    setTrackPageTime,
    setTrackFolderTime,
    setTrackContentEvents,
  } = useStatsStore();
  const appliedRef = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user || appliedRef.current) return;
    appliedRef.current = true;
    loadUserPreferences().then((prefs) => {
      if (!prefs) return;
      if (prefs.theme) setTheme(prefs.theme);
      if (prefs.locale) setLocale(prefs.locale);
      if (typeof prefs.tagsPerPageEnabled === 'boolean') setTagsPerPage(prefs.tagsPerPageEnabled);
      if (typeof prefs.tagsPerBlockEnabled === 'boolean')
        setTagsPerBlock(prefs.tagsPerBlockEnabled);
      if (typeof prefs.recordingStartSoundEnabled === 'boolean')
        setRecordingStartSound(prefs.recordingStartSoundEnabled);
      // Statistics tracking — enabled by default
      setStatsEnabled(prefs.statisticsEnabled ?? true);
      setTrackSessionTime(prefs.trackSessionTime ?? true);
      setTrackPageTime(prefs.trackPageTime ?? true);
      setTrackFolderTime(prefs.trackFolderTime ?? true);
      setTrackContentEvents(prefs.trackContentEvents ?? true);
    });
  }, [
    status,
    session?.user,
    setTheme,
    setLocale,
    setTagsPerPage,
    setTagsPerBlock,
    setRecordingStartSound,
    setStatsEnabled,
    setTrackSessionTime,
    setTrackPageTime,
    setTrackFolderTime,
    setTrackContentEvents,
  ]);

  return null;
}

/** Mounts the session-level activity tracker. */
function SessionTracker() {
  useSessionTracking();
  return null;
}

export function Providers({
  children,
  initialLocale = 'en',
}: Readonly<{ children: React.ReactNode; initialLocale?: Locale }>) {
  return (
    <SessionProvider>
      <ConfirmationProvider>
        <NextThemesProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <I18nProvider initialLocale={initialLocale}>
            <SyncUserPreferences />
            <SessionTracker />
            {children}
            <RecordingIndicator />
          </I18nProvider>
        </NextThemesProvider>
      </ConfirmationProvider>
    </SessionProvider>
  );
}
