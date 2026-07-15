/**
 * NAVI Agent Framework — Phrase Detector
 *
 * Regex-based detection of phrase cards in LLM responses.
 * No LLM calls — pure text analysis.
 *
 * Detects the standardized format:
 *   **Phrase:** [text]
 *   **Say it:** [phonetic]
 *   **Means:** [meaning]
 */

export interface DetectedPhrase {
  /** The phrase text in the target language */
  phrase: string;
  /** Phonetic pronunciation */
  pronunciation?: string;
  /** English meaning */
  meaning?: string;
  /** Language (if detectable from context) */
  language?: string;
}

// Match **Phrase:** followed by text until the next ** or newline
const PHRASE_REGEX = /\*\*Phrase:\*\*\s*(.+?)(?:\n|$)/gi;
const SAY_IT_REGEX = /\*\*Say it:\*\*\s*(.+?)(?:\n|$)/gi;
const MEANS_REGEX = /\*\*Means:\*\*\s*(.+?)(?:\n|$)/gi;

/**
 * Scan an LLM response for phrase cards in the standard format.
 * Returns all detected phrases with their pronunciation and meaning.
 */
export function detectPhrases(text: string): DetectedPhrase[] {
  const results: DetectedPhrase[] = [];
  const seen = new Set<string>();

  // 1. Full phrase cards: **Phrase:** / **Say it:** / **Means:**
  const phrases: string[] = [];
  const pronunciations: string[] = [];
  const meanings: string[] = [];

  let match: RegExpExecArray | null;

  PHRASE_REGEX.lastIndex = 0;
  while ((match = PHRASE_REGEX.exec(text)) !== null) {
    phrases.push(match[1].trim());
  }

  SAY_IT_REGEX.lastIndex = 0;
  while ((match = SAY_IT_REGEX.exec(text)) !== null) {
    pronunciations.push(match[1].trim());
  }

  MEANS_REGEX.lastIndex = 0;
  while ((match = MEANS_REGEX.exec(text)) !== null) {
    meanings.push(match[1].trim());
  }

  for (let i = 0; i < phrases.length; i++) {
    const phrase = phrases[i];
    if (phrase.startsWith('[') && phrase.endsWith(']')) continue;
    const key = phrase.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      phrase,
      pronunciation: pronunciations[i]?.startsWith('[') ? undefined : pronunciations[i],
      meaning: meanings[i]?.startsWith('[') ? undefined : meanings[i],
    });
  }

  // 2. Inline teaching format: **phrase** (phonetic) — optional meaning
  //    Matches Praktika doctrine: **bonjour** (bon-ZHOOR) — hello
  const INLINE_REGEX = /\*\*([^*]+)\*\*\s*\(([^)]+)\)(?:\s*[—–-]\s*([^.!?\n]+))?/g;
  INLINE_REGEX.lastIndex = 0;
  while ((match = INLINE_REGEX.exec(text)) !== null) {
    const phrase = match[1].trim();
    // Skip card field labels
    if (/^(phrase|say it|means|tip|sound tip)$/i.test(phrase)) continue;
    const key = phrase.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      phrase,
      pronunciation: match[2].trim(),
      meaning: match[3]?.trim(),
    });
  }

  return results;
}

/**
 * Detect topic keywords from text using a simple keyword list.
 * Returns matched topics for proficiency tracking.
 */
const TOPIC_KEYWORDS: Record<string, string[]> = {
  greetings: ['hello', 'hi', 'hey', 'good morning', 'good evening', 'goodbye', 'bye', 'greeting', 'greet'],
  ordering_food: ['menu', 'order', 'food', 'restaurant', 'eat', 'dish', 'meal', 'hungry', 'drink', 'cafe'],
  directions: ['where', 'direction', 'left', 'right', 'straight', 'turn', 'map', 'lost', 'navigate'],
  shopping: ['buy', 'price', 'cost', 'shop', 'market', 'bargain', 'cheap', 'expensive', 'money'],
  transportation: ['bus', 'train', 'taxi', 'metro', 'station', 'ticket', 'ride', 'transport'],
  emergencies: ['help', 'emergency', 'hospital', 'doctor', 'police', 'danger', 'sick', 'pain'],
  social: ['friend', 'family', 'party', 'fun', 'night', 'club', 'bar', 'dance'],
  formal_speech: ['formal', 'polite', 'sir', 'madam', 'respect', 'honorific', 'business', 'meeting'],
  numbers: ['number', 'count', 'how many', 'how much', 'price', 'one', 'two', 'three'],
  time: ['time', 'when', 'today', 'tomorrow', 'yesterday', 'morning', 'evening', 'night', 'clock'],
};

export function detectTopics(text: string): string[] {
  const lower = text.toLowerCase();
  const matched: string[] = [];

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      matched.push(topic);
    }
  }

  return matched;
}
