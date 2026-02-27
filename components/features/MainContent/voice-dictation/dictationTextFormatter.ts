/* eslint-disable sonarjs/slow-regex */
// Regexes for formatting dictation text; these are not vulnerable to ReDoS since they match
// specific punctuation or whitespace boundaries only and don't use nested quantifiers.
const TERMINAL_PUNCTUATION_REGEX = /[.!?…]["')\]]*$/u;
const SENTENCE_SEPARATOR_REGEX = /([.!?…]+\s*)(\p{L})/gu;
const WHITESPACE_COLLAPSE = /\s+/gu;
/* eslint-enable sonarjs/slow-regex */

/**
 * Normalize whitespace in text.
 */
function normalizeWhitespace(value: string): string {
  return value.replaceAll(WHITESPACE_COLLAPSE, ' ').trim();
}

/**
 * Capitalize the first letter of text.
 */
function capitalizeFirstLetter(value: string): string {
  return value.replace(/^(\p{L})/u, (match) => match.toLocaleUpperCase());
}

/**
 * Capitalize the first letter after sentence-ending punctuation.
 */
function capitalizeSentenceStarts(value: string): string {
  return value.replaceAll(
    SENTENCE_SEPARATOR_REGEX,
    (_, separator: string, firstLetter: string) => `${separator}${firstLetter.toLocaleUpperCase()}`,
  );
}

/**
 * Add a terminal period if punctuation is missing.
 */
function addTerminalPeriodIfMissing(value: string): string {
  if (!value || TERMINAL_PUNCTUATION_REGEX.test(value)) {
    return value;
  }
  return `${value}.`;
}

/**
 * Format final dictation text (adds capitalization and terminal period).
 *
 * IMPORTANT LIMITATION:
 * Web Speech API (browser's built-in speech recognition) does NOT automatically
 * add punctuation to transcripts. It returns plain text without commas, periods,
 * question marks, etc. This is true for all languages (English, Ukrainian, etc.).
 *
 * The API only transcribes the audio content literally. If the speaker doesn't
 * verbally say "comma" or "period", those won't appear in the transcript.
 *
 * To get true punctuation restoration, you need one of these solutions:
 *
 * 1. Browser-side NLP model (recommended):
 *    - Use Transformers.js with a punctuation restoration model
 *    - Example: "deepmultilingualpunctuation" model from Hugging Face
 *    - Runs locally in browser, no API calls needed
 *    - ~50-100MB model download on first use
 *
 * 2. Server-side API:
 *    - OpenAI Whisper API (paid, accurate, multilingual)
 *    - Google Cloud Speech-to-Text (paid, good punctuation)
 *    - Custom FastAPI + punctuation model
 *
 * 3. Hybrid approach:
 *    - Use Web Speech API for real-time interim results
 *    - Send final transcript to server for punctuation restoration
 *    - Replace text in editor with punctuated version
 *
 * Current formatter only provides:
 * - Capitalization of first letter and sentence starts
 * - Whitespace normalization
 * - Terminal period if missing
 *
 * See docs/VOICE-DICTATION.md for implementation guide.
 */
export function formatDictationText(text: string): string {
  if (!text.trim()) return '';

  const normalizedWhitespace = normalizeWhitespace(text);
  const capitalized = capitalizeSentenceStarts(capitalizeFirstLetter(normalizedWhitespace));

  return addTerminalPeriodIfMissing(capitalized);
}

/**
 * Format interim text for real-time display during recording.
 * Does NOT add terminal punctuation (user is still speaking).
 */
export function formatInterimDictationText(text: string): string {
  if (!text.trim()) return '';

  const normalizedWhitespace = normalizeWhitespace(text);
  return capitalizeFirstLetter(normalizedWhitespace);
}

// ─── Enhanced Punctuation (with Transformers.js) ──────────────────────────────

/**
 * Format dictation text with intelligent punctuation restoration.
 * Uses linguistic rules to add commas, question marks, and better sentence detection.
 *
 * @param text - Raw transcript from speech recognition
 * @param language - Language code ('en' or 'uk')
 * @returns Formatted text with punctuation and capitalization
 */
export async function formatDictationTextWithPunctuation(
  text: string,
  language: 'en' | 'uk' = 'en',
): Promise<string> {
  if (!text.trim()) return '';

  // Import punctuation service dynamically to avoid loading it on every page
  const { addPunctuation } = await import('@/lib/punctuationService');

  // Normalize whitespace first
  const normalized = normalizeWhitespace(text);

  // Add intelligent punctuation
  const punctuated = await addPunctuation(normalized, language);

  // Capitalize sentences
  const capitalized = capitalizeSentenceStarts(capitalizeFirstLetter(punctuated));

  return capitalized;
}

/**
 * Format interim text with basic punctuation hints for live display.
 * Lightweight version that runs without async delays.
 */
export function formatInterimDictationTextWithPunctuation(
  text: string,
  language: 'en' | 'uk' = 'en',
): string {
  if (!text.trim()) return '';

  const normalized = normalizeWhitespace(text);

  // Add basic punctuation hints for common patterns
  let result = normalized;

  // Add question mark for sentences starting with question words
  const questionWords =
    language === 'en'
      ? [
          'what',
          'when',
          'where',
          'who',
          'why',
          'how',
          'is',
          'are',
          'do',
          'does',
          'can',
          'could',
          'would',
          'should',
        ]
      : ['що', 'коли', 'де', 'хто', 'чому', 'як', 'чи'];

  const firstWord = result.split(' ')[0]?.toLowerCase();
  if (questionWords.includes(firstWord)) {
    result += ' ?';
  }

  return capitalizeFirstLetter(result);
}
