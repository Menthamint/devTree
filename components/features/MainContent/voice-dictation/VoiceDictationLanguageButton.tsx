'use client';

/**
 * VoiceDictationLanguageButton — Language selector for voice dictation.
 *
 * Features:
 *   - Cycles through supported languages (en, uk) in a toggle
 *   - Default language matches current i18n locale
 *   - Chrome-only (hidden on other browsers)
 *   - Visual feedback showing current language
 */
import { useEffect, useState } from 'react';

import { Globe } from 'lucide-react';

import { type Locale, useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

import { isChromeBasedBrowser } from './voiceDictationUtils';

type VoiceDictationLanguageButtonProps = Readonly<{
  onLanguageChange: (language: Locale) => void;
}>;

const SUPPORTED_LANGUAGES: Readonly<Locale[]> = ['en', 'uk'];

const LANGUAGE_LABELS: Record<Locale, string> = {
  en: 'English',
  uk: 'Українська',
};

/**
 * Gets the language display code (2-letter code for UI display)
 */
function getLanguageCode(locale: Locale): string {
  return locale === 'uk' ? 'UA' : 'EN';
}

export function VoiceDictationLanguageButton({
  onLanguageChange,
}: VoiceDictationLanguageButtonProps) {
  const { locale } = useI18n();
  const [currentLanguage, setCurrentLanguage] = useState<Locale>(locale);
  const [isSupported, setIsSupported] = useState(false);

  // Check browser support on mount
  useEffect(() => {
    const supported = isChromeBasedBrowser();
    setIsSupported(supported);
  }, []);

  // Sync language with i18n locale
  useEffect(() => {
    setCurrentLanguage(locale);
  }, [locale]);

  if (!isSupported) {
    return null;
  }

  const handleCycleLanguage = (e: React.MouseEvent) => {
    e.preventDefault();
    const currentIndex = SUPPORTED_LANGUAGES.indexOf(currentLanguage);
    const nextIndex = (currentIndex + 1) % SUPPORTED_LANGUAGES.length;
    const nextLanguage = SUPPORTED_LANGUAGES[nextIndex];
    setCurrentLanguage(nextLanguage);
    onLanguageChange(nextLanguage);
  };

  return (
    <button
      type="button"
      title={`Dictation language: ${LANGUAGE_LABELS[currentLanguage]} (click to cycle)`}
      onMouseDown={handleCycleLanguage}
      className={cn(
        'motion-interactive flex h-7 w-7 items-center justify-center rounded text-sm transition-colors',
        'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      )}
    >
      <Globe size={14} />
      <span className="ml-1 text-xs font-semibold">{getLanguageCode(currentLanguage)}</span>
    </button>
  );
}
