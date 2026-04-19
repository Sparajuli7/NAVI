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
    saveCache().catch(e => console.warn('[NAVI]', e));

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
 * Build a pronunciation reference bank from cached IPA data and tracked phrases.
 * This is injected into the system prompt so the LLM has factual pronunciation
 * data to draw from when naturally weaving phrases into conversation.
 *
 * Returns a prompt-ready string like:
 * "PRONUNCIATION REFERENCE (use these IPA values to generate accurate reader-friendly pronunciations):
 *  bonjour → /bɔ̃.ʒuʁ/
 *  merci → /mɛʁ.si/"
 *
 * Returns empty string if no cached data is available.
 */
export async function buildPronunciationBank(
  language: string,
  recentPhrases?: Array<{ phrase: string }>,
): Promise<string> {
  await loadCache();

  const langCode = LANG_CODES[language];
  if (!langCode) return '';

  const entries: string[] = [];

  // Pull from cache — all entries for this language
  const prefix = `${langCode}:`;
  for (const [key, entry] of Object.entries(memoryCache)) {
    if (key.startsWith(prefix)) {
      const word = key.slice(prefix.length);
      entries.push(`${word} → ${entry.ipa}`);
    }
  }

  // Also try to look up recently taught phrases (non-blocking, best-effort)
  if (recentPhrases && recentPhrases.length > 0) {
    const toLookup = recentPhrases
      .slice(0, 5)
      .map(p => p.phrase)
      .filter(p => !entries.some(e => e.startsWith(p.toLowerCase())));

    const results = await Promise.all(
      toLookup.map(p => lookupPhraseIPA(p, language).catch(() => null)),
    );

    for (let i = 0; i < toLookup.length; i++) {
      if (results[i]) entries.push(`${toLookup[i]} → ${results[i]}`);
    }
  }

  if (entries.length === 0) return '';

  // Cap at 15 entries to avoid bloating the prompt
  const capped = entries.slice(0, 15);
  return `PRONUNCIATION REFERENCE (use these IPA values to write accurate reader-friendly pronunciations — convert IPA to simple syllable-by-syllable form the user can read, like "bon-ZHOOR" from /bɔ̃.ʒuʁ/):\n${capped.join('\n')}`
}

/** Get the count of cached pronunciations */
export async function getCacheSize(): Promise<number> {
  await loadCache();
  return Object.keys(memoryCache).length;
}
