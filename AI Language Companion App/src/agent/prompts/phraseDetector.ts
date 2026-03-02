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
  const phrases: string[] = [];
  const pronunciations: string[] = [];
  const meanings: string[] = [];

  // Extract all phrase matches
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

  // Build detected phrases — align by index
  const results: DetectedPhrase[] = [];
  for (let i = 0; i < phrases.length; i++) {
    // Skip placeholder text that wasn't filled in
    const phrase = phrases[i];
    if (phrase.startsWith('[') && phrase.endsWith(']')) continue;

    results.push({
      phrase,
      pronunciation: pronunciations[i]?.startsWith('[') ? undefined : pronunciations[i],
      meaning: meanings[i]?.startsWith('[') ? undefined : meanings[i],
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
