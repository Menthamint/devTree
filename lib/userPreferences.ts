/**
 * userPreferences.ts — load and save user preferences via the API.
 *
 * Used to sync theme, locale, and feature flags (tags per page/block) to the
 * database so they follow the user across devices. When the user is logged in,
 * preferences are applied on load and persisted when they change in the UI.
 */

export type UserPreferencesPayload = {
  theme?: 'light' | 'dark' | 'system';
  locale?: 'en' | 'uk';
  tagsPerPageEnabled?: boolean;
  tagsPerBlockEnabled?: boolean;
  recordingStartSoundEnabled?: boolean;
  dictationFormattingEnabled?: boolean;
  // Statistics tracking (default true when absent)
  statisticsEnabled?: boolean;
  trackSessionTime?: boolean;
  trackPageTime?: boolean;
  trackFolderTime?: boolean;
  trackContentEvents?: boolean;
};

/**
 * Fetch the current user's preferences from the API.
 * Returns null if not authenticated or request fails.
 */
export async function loadUserPreferences(): Promise<UserPreferencesPayload | null> {
  try {
    const res = await fetch('/api/user/preferences');
    if (!res.ok) return null;
    const data = await res.json();
    return data as UserPreferencesPayload;
  } catch {
    return null;
  }
}

/**
 * Save (merge) preferences to the API. Fire-and-forget; errors are not surfaced.
 * Call after updating theme, locale, or feature toggles in the UI.
 */
export async function saveUserPreferences(data: UserPreferencesPayload): Promise<void> {
  await saveUserPreferencesWithOptions(data);
}

export async function saveUserPreferencesWithOptions(
  data: UserPreferencesPayload,
  opts?: { purgeDisabledStats?: boolean },
): Promise<void> {
  try {
    const query = opts?.purgeDisabledStats ? '?purgeDisabledStats=1' : '';
    await fetch(`/api/user/preferences${query}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch {
    // Persistence is best-effort; do not block UI
  }
}
