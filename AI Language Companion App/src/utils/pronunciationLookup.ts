/**
 * Pronunciation Lookup — Free Dictionary API + IndexedDB cache
 *
 * Looks up real IPA pronunciation for words via the free dictionaryapi.dev API.
 * Results are cached in IndexedDB so a local pronunciation dictionary builds
 * up over time. Supports: en, fr, es, ja, ko, hi, de, it, pt, ar, tr, ru, vi.
 */

import { get, set } from 'idb-keyval';

const CACHE_KEY = 'navi_pronunciation_cache';
const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries';

/** Language name → API language code */
const LANG_CODES: Record<string, string> = {
  English: 'en', French: 'fr', Spanish: 'es', Japanese: 'ja',
  Korean: 'ko', Hindi: 'hi', German: 'de', Italian: 'it',
  Portuguese: 'pt', Arabic: 'ar', Turkish: 'tr', Russian: 'ru',
  Vietnamese: 'vi', Mandarin: 'zh', Nepali: 'hi', // Nepali falls back to Hindi
};

interface PronunciationEntry {
  ipa: string;
  audio?: string;
  timestamp: number;
}

type PronunciationCache = Record<string, PronunciationEntry>;

let memoryCache: PronunciationCache = {};
let cacheLoaded = false;

function cacheKey(word: string, lang: string): string {
  return `${lang}:${word.toLowerCase().trim()}`;
}

async function loadCache(): Promise<void> {
  if (cacheLoaded) return;
  const stored = await get<PronunciationCache>(CACHE_KEY);
  if (stored) memoryCache = stored;
  cacheLoaded = true;
}

async function saveCache(): Promise<void> {
  await set(CACHE_KEY, memoryCache);
}

/** Look up IPA for a single word. Returns null if not found. */
export async function lookupWordIPA(
  word: string,
  language: string,
): Promise<{ ipa: string; audio?: string } | null> {
  await loadCache();

  const langCode = LANG_CODES[language];
  if (!langCode) return null;

  const key = cacheKey(word, langCode);

  // Check cache first
  if (memoryCache[key]) {
    return { ipa: memoryCache[key].ipa, audio: memoryCache[key].audio };
  }

  // Call API
  try {
    const resp = await fetch(`${API_BASE}/${langCode}/${encodeURIComponent(word.toLowerCase().trim())}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return null;

    const data = await resp.json();
    const phonetics = data?.[0]?.phonetics as Array<{ text?: string; audio?: string }> | undefined;
    if (!phonetics) return null;

    // Find the best phonetic entry (prefer one with both IPA text and audio)
    const withText = phonetics.filter(p => p.text);
    const best = withText.find(p => p.audio) ?? withText[0];
    if (!best?.text) return null;

    const entry: PronunciationEntry = {
      ipa: best.text,
      audio: best.audio || undefined,
      timestamp: Date.now(),
    };
    memoryCache[key] = entry;
    // Save async — don't block
    saveCache().catch(() => {});

    return { ipa: entry.ipa, audio: entry.audio };
  } catch {
    return null; // API failed — fall back to LLM
  }
}

/**
 * Look up IPA for a phrase by composing word-level lookups.
 * Returns a combined IPA string like "/boʒ.uʁ/ /kɔ.mɑ̃/ /sa/ /va/"
 * or null if no words could be looked up.
 */
export async function lookupPhraseIPA(
  phrase: string,
  language: string,
): Promise<string | null> {
  // Split on whitespace and common punctuation
  const words = phrase
    .replace(/[?!.,;:'"()[\]{}¿¡]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0);

  if (words.length === 0) return null;

  // Look up all words in parallel
  const results = await Promise.all(
    words.map(w => lookupWordIPA(w, language)),
  );

  const ipaParts = results.map((r, i) => r?.ipa ?? words[i]);
  const foundCount = results.filter(r => r !== null).length;

  // Only return if we found IPA for at least half the words
  if (foundCount < Math.ceil(words.length / 2)) return null;

  return ipaParts.join(' ');
}

/**
 * Enrich a raw LLM response by replacing hallucinated pronunciations
 * with real IPA data from the dictionary API.
 *
 * Finds **Say it:** lines, looks up the preceding **Phrase:** line,
 * and replaces the pronunciation if real IPA is found.
 */
export async function enrichPronunciations(
  text: string,
  targetLanguage: string,
): Promise<string> {
  // Match phrase cards: find pairs of **Phrase:** and **Say it:** lines
  const phrasePattern = /\*\*Phrase:\*\*\s*(.+)/gi;
  const phrases: Array<{ phrase: string; index: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = phrasePattern.exec(text)) !== null) {
    phrases.push({ phrase: match[1].trim(), index: match.index });
  }

  if (phrases.length === 0) return text;

  let result = text;

  // Process in reverse order so replacement indices stay valid
  for (let i = phrases.length - 1; i >= 0; i--) {
    const { phrase } = phrases[i];
    const ipa = await lookupPhraseIPA(phrase, targetLanguage);
    if (!ipa) continue;

    // Find the **Say it:** line that follows this **Phrase:** line
    const afterPhrase = result.slice(phrases[i].index);
    const sayItMatch = afterPhrase.match(/\*\*Say it:\*\*\s*(.+)/i);
    if (!sayItMatch) continue;

    const sayItStart = phrases[i].index + (sayItMatch.index ?? 0);
    const sayItEnd = sayItStart + sayItMatch[0].length;

    result = result.slice(0, sayItStart)
      + `**Say it:** ${ipa}`
      + result.slice(sayItEnd);
  }

  return result;
}

/** Get the count of cached pronunciations */
export async function getCacheSize(): Promise<number> {
  await loadCache();
  return Object.keys(memoryCache).length;
}
