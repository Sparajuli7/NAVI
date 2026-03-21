/**
 * NAVI Agent Framework — Gemini Embedding Provider
 *
 * Uses Google's Gemini Embedding Model v2 (text-embedding-004) for semantic memory retrieval.
 * Requires network access — falls back to local keyword matching when offline.
 *
 * API key is stored in localStorage (navi_gemini_key) and set via Settings panel.
 * Key is only sent to Google's generativelanguage.googleapis.com endpoint.
 *
 * Usage:
 *   const provider = new GeminiEmbeddingProvider(apiKey);
 *   if (provider.isAvailable()) {
 *     const vector = await provider.embed('some text');
 *   }
 */

const GEMINI_EMBED_MODEL = 'text-embedding-004';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiEmbedResponse {
  embedding: {
    values: number[];
  };
}

export class GeminiEmbeddingProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /** Returns true if the provider has a key and the browser is online */
  isAvailable(): boolean {
    return !!this.apiKey && typeof navigator !== 'undefined' && navigator.onLine;
  }

  /** Update the API key (e.g. when user changes it in settings) */
  setApiKey(key: string): void {
    this.apiKey = key;
  }

  /**
   * Embed a text string using Gemini Embedding Model v2.
   * Returns a 768-dimensional float vector.
   * Throws if offline, no key, or API error.
   */
  async embed(text: string): Promise<number[]> {
    if (!this.apiKey) throw new Error('Gemini API key not set');
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Offline — cannot use Gemini embeddings');
    }

    const url = `${GEMINI_API_BASE}/models/${GEMINI_EMBED_MODEL}:embedContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${GEMINI_EMBED_MODEL}`,
        content: { parts: [{ text }] },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Gemini API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as GeminiEmbedResponse;
    return data.embedding.values;
  }

  /**
   * Compute cosine similarity between two vectors.
   * Returns value in [0, 1] — higher = more similar.
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }
}

/** Singleton — initialized lazily from localStorage */
let _instance: GeminiEmbeddingProvider | null = null;

export function getGeminiEmbedding(): GeminiEmbeddingProvider {
  if (!_instance) {
    const key = typeof localStorage !== 'undefined'
      ? (localStorage.getItem('navi_gemini_key') ?? '')
      : '';
    _instance = new GeminiEmbeddingProvider(key);
  }
  return _instance;
}

/** Call this when the user updates their Gemini API key */
export function updateGeminiApiKey(key: string): void {
  if (typeof localStorage !== 'undefined') localStorage.setItem('navi_gemini_key', key);
  if (_instance) _instance.setApiKey(key);
  else _instance = new GeminiEmbeddingProvider(key);
}
