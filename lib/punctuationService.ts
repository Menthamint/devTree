/**
 * punctuationService.ts — Browser-based punctuation restoration using Transformers.js
 *
 * This service adds intelligent punctuation to plain text transcripts from speech recognition.
 *
 * Current Implementation (Phase 1):
 * - Smart rule-based punctuation using linguistic heuristics
 * - No model download required initially (fast, lightweight)
 * - Works offline
 *
 * Future Enhancement (Phase 2):
 * - Optional ML model for improved accuracy (Whisper API or local BERT model)
 * - Configurable via settings
 *
 * Usage:
 *   const punctuated = await addPunctuation('hello world how are you');
 *   // Result: "Hello world, how are you?"
 */

// ─── Smart Punctuation Rules ──────────────────────────────────────────────────

/**
 * Coordinating conjunctions that should have a comma before them in longer sentences
 */
const COORDINATING_CONJUNCTIONS = {
  en: ['and', 'but', 'or', 'nor', 'for', 'yet', 'so'],
  uk: ['і', 'та', 'але', 'чи', 'або', 'ні', 'бо', 'тому'],
};

/**
 * Introductory words/phrases that should have comma after them
 */
const INTRODUCTORY_PHRASES = {
  en: [
    'however', 'therefore', 'furthermore', 'moreover', 'meanwhile',
    'in addition', 'for example', 'in fact', 'by the way',
    'first', 'second', 'third', 'finally', 'lastly',
    'well', 'yes', 'no', 'okay', 'alright',
  ],
  uk: [
    'однак', 'тому', 'крім того', 'більше того', 'тим часом',
    'наприклад', 'насправді', 'до речі',
    'по-перше', 'по-друге', 'по-третє', 'нарешті', 'зрештою',
    'так', 'ні', 'добре', 'гаразд',
  ],
};

/**
 * Sentence starters that indicate a new sentence
 */
const SENTENCE_STARTERS = {
  en: ['i', 'we', 'they', 'he', 'she', 'it', 'you', 'there', 'this', 'that', 'these', 'those', 'the', 'a', 'an'],
  uk: ['я', 'ми', 'ти', 'ви', 'він', 'вона', 'воно', 'вони', 'це', 'той', 'та', 'те', 'ці'],
};

/**
 * Question indicators (words that suggest a question)
 */
const QUESTION_WORDS = {
  en: ['what', 'when', 'where', 'who', 'whom', 'whose', 'why', 'how', 'which', 'is', 'are', 'do', 'does', 'did', 'can', 'could', 'would', 'should', 'will'],
  uk: ['що', 'коли', 'де', 'хто', 'кого', 'чий', 'чому', 'як', 'який', 'яка', 'яке', 'які', 'чи'],
};

// ─── Punctuation Restoration ──────────────────────────────────────────────────

/**
 * Add intelligent punctuation to plain text.
 * 
 * @param text - Plain text without punctuation (from speech recognition)
 * @param language - Language code ('en' or 'uk')
 * @returns Text with punctuation added
 */
export async function addPunctuation(
  text: string,
  language: 'en' | 'uk' = 'en',
): Promise<string> {
  if (!text.trim()) return text;

  // Split into words
  const words = text.trim().split(/\s+/);
  if (words.length === 0) return text;

  return processWordsForPunctuation(words, language);
}

/**
 * Process words array and add punctuation.
 * Separated from main function to reduce cognitive complexity.
 */
function processWordsForPunctuation(words: string[], language: 'en' | 'uk'): string {
  const result: string[] = [];
  let currentSentenceLength = 0;
  let i = 0;

  while (i < words.length) {
    const word = words[i];
    const wordLower = word.toLowerCase();
    const nextWord = i < words.length - 1 ? words[i + 1] : null;
    const nextWordLower = nextWord?.toLowerCase() || '';
    const prevWord = i > 0 ? words[i - 1] : null;

    let punctuatedWord = word;
    currentSentenceLength++;

    // Process introductory phrases
    const phraseSkip = processIntroductoryPhrase(i, words, wordLower, result, language);
    if (phraseSkip > 0) {
      i += phraseSkip + 1; // Skip phrase words and advance
      currentSentenceLength = 0;
      continue;
    }

    // 1. Add period before sentence starters (if sentence is long enough)
    if (shouldAddPeriodBeforeStarter(i, currentSentenceLength, nextWordLower, language)) {
      punctuatedWord += '.';
      currentSentenceLength = 0;
    }

    // 2. Add comma before coordinating conjunctions in longer sentences
    if (shouldAddCommaBeforeConjunction(
      currentSentenceLength,
      wordLower,
      nextWord,
      prevWord,
      language,
    )) {
      result[result.length - 1] += ',';
    }

    // 3. Add question mark at end if sentence starts with question word
    if (!nextWord) {
      punctuatedWord = addFinalPunctuation(punctuatedWord, result, language);
    }

    // 4. Add period at natural breaks (after 12+ words without punctuation)
    if (shouldAddPeriodAtBreak(currentSentenceLength, nextWord, nextWordLower, punctuatedWord, language)) {
      punctuatedWord += '.';
      currentSentenceLength = 0;
    }

    result.push(punctuatedWord);
    i++;
  }

  return result.join(' ');
}

/**
 * Check if current position is at the start of a sentence.
 */
function isAtSentenceStart(index: number, result: string[]): boolean {
  return index === 0 || result[result.length - 1]?.endsWith('.') === true;
}

/**
 * Check if words at index match the given phrase.
 */
function matchesPhrase(index: number, words: string[], phraseWords: string[]): boolean {
  if (phraseWords[0] !== words[index].toLowerCase()) {
    return false;
  }
  
  for (let j = 0; j < phraseWords.length; j++) {
    if (index + j >= words.length || words[index + j].toLowerCase() !== phraseWords[j]) {
      return false;
    }
  }
  
  return true;
}

/**
 * Add phrase words to result with comma after last word.
 */
function addPhraseWithComma(index: number, words: string[], phraseLength: number, result: string[]): void {
  for (let j = 0; j < phraseLength - 1; j++) {
    result.push(words[index + j]);
  }
  result.push(words[index + phraseLength - 1] + ',');
}

/**
 * Check if introductory phrase is present and process it.
 * Returns number of words to skip (0 if no phrase found).
 */
function processIntroductoryPhrase(
  index: number,
  words: string[],
  wordLower: string,
  result: string[],
  language: 'en' | 'uk',
): number {
  if (!isAtSentenceStart(index, result)) {
    return 0;
  }

  const phrases = INTRODUCTORY_PHRASES[language];
  if (!phrases.some(phrase => wordLower === phrase.split(' ')[0])) {
    return 0;
  }

  for (const phrase of phrases) {
    const phraseWords = phrase.split(' ');
    
    if (matchesPhrase(index, words, phraseWords)) {
      addPhraseWithComma(index, words, phraseWords.length, result);
      return phraseWords.length - 1;
    }
  }

  return 0;
}

function shouldAddPeriodBeforeStarter(
  index: number,
  sentenceLength: number,
  nextWordLower: string,
  language: 'en' | 'uk',
): boolean {
  return (
    index > 0 &&
    sentenceLength >= 5 &&
    SENTENCE_STARTERS[language].includes(nextWordLower)
  );
}

function shouldAddCommaBeforeConjunction(
  sentenceLength: number,
  wordLower: string,
  nextWord: string | null,
  prevWord: string | null,
  language: 'en' | 'uk',
): boolean {
  return (
    sentenceLength >= 6 &&
    COORDINATING_CONJUNCTIONS[language].includes(wordLower) &&
    nextWord !== null &&
    prevWord !== null &&
    !prevWord.endsWith(',')
  );
}

function addFinalPunctuation(
  word: string,
  result: string[],
  language: 'en' | 'uk',
): string {
  const firstWord = result[0]?.toLowerCase().replace(/[^a-zа-яіїєґ]/g, '') || '';
  if (QUESTION_WORDS[language].includes(firstWord)) {
    return word + '?';
  } else if (!word.match(/[.!?]$/)) {
    return word + '.';
  }
  return word;
}

function shouldAddPeriodAtBreak(
  sentenceLength: number,
  nextWord: string | null,
  nextWordLower: string,
  currentWord: string,
  language: 'en' | 'uk',
): boolean {
  return (
    sentenceLength >= 12 &&
    nextWord !== null &&
    !currentWord.endsWith('.') &&
    SENTENCE_STARTERS[language].includes(nextWordLower)
  );
}

// ─── Model Management Stubs ───────────────────────────────────────────────────

/**
 * Check if ML punctuation model is loaded (currently uses rule-based approach).
 */
function isPunctuationModelLoaded(): boolean {
  return true; // Rule-based system is always "loaded"
}

/**
 * Check if ML punctuation model is loading (currently uses rule-based approach).
 */
function isPunctuationModelLoading(): boolean {
  return false;
}

/**
 * Get model loading error (currently none for rule-based approach).
 */
function getPunctuationModelError(): Error | null {
  return null;
}

/**
 * Preload punctuation model (no-op for rule-based approach).
 */
async function preloadPunctuationModel(): Promise<void> {
  // No-op: rule-based system doesn't need preloading
}

/**
 * Clear model cache (no-op for rule-based approach).
 */
function clearPunctuationModelCache(): void {
  // No-op: rule-based system has no cache
}
