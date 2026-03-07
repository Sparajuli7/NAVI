/**
 * NAVI Agent Framework — TTS Model Provider
 *
 * Wraps the browser's Web Speech API (SpeechSynthesis) behind
 * the ModelProvider interface, with multi-voice support,
 * pronunciation teaching (slow/syllable modes), and
 * Google Translate TTS as an online fallback.
 *
 * Voice quality research (free options only):
 *
 * 1. Web Speech API (IMPLEMENTED — primary)
 *    Pros: Free, built into all browsers, works offline on device,
 *          zero download, instant startup, multi-language
 *    Cons: Voice quality varies by OS/browser, limited voice control,
 *          no custom voice training, some languages sound robotic
 *
 * 2. Coqui TTS (NOT IMPLEMENTED — future consideration)
 *    Pros: Open source (MPL-2.0), free, multiple languages,
 *          can run fully locally via WASM, good voice quality,
 *          supports voice cloning
 *    Cons: Large model downloads (~200-500MB per language),
 *          requires WASM runtime, slower inference on mobile,
 *          project maintenance uncertain after company closure
 *
 * 3. Mozilla TTS (NOT IMPLEMENTED — future consideration)
 *    Pros: Open source, free, runs locally, good quality
 *    Cons: Superseded by Coqui TTS (which forked from it),
 *          limited language support, no active development
 *
 * 4. Google Cloud TTS free tier (PARTIALLY IMPLEMENTED — online fallback)
 *    Using Google Translate's public audio endpoint (no API key needed).
 *    Pros: 1M chars/month free, excellent voice quality, many languages
 *    Cons: Requires internet, not truly free at scale,
 *          public endpoint may be rate-limited or change without notice
 *    Note: Used ONLY as online fallback when local quality is poor.
 *          App works fully without it.
 *
 * DO NOT implement ElevenLabs or any paid service.
 */

import type { ModelInfo, ModelProvider, ModelStatus } from '../core/types';

const LANG_CODE_MAP: Record<string, string> = {
  Vietnamese: 'vi-VN',
  Japanese: 'ja-JP',
  French: 'fr-FR',
  Spanish: 'es-MX',
  Korean: 'ko-KR',
  English: 'en-US',
  Chinese: 'zh-CN',
  Portuguese: 'pt-BR',
  German: 'de-DE',
  Italian: 'it-IT',
  Thai: 'th-TH',
  Arabic: 'ar-SA',
  Hindi: 'hi-IN',
  Russian: 'ru-RU',
  Indonesian: 'id-ID',
  Tagalog: 'tl-PH',
  Mandarin: 'zh-CN',
  Cantonese: 'zh-HK',
};

/** Google Translate TTS language codes (shorter format) */
const GTTS_LANG_MAP: Record<string, string> = {
  Vietnamese: 'vi',
  Japanese: 'ja',
  French: 'fr',
  Spanish: 'es',
  Korean: 'ko',
  English: 'en',
  Chinese: 'zh-CN',
  Portuguese: 'pt',
  German: 'de',
  Italian: 'it',
  Thai: 'th',
  Arabic: 'ar',
  Hindi: 'hi',
  Russian: 'ru',
  Indonesian: 'id',
  Tagalog: 'tl',
  Mandarin: 'zh-CN',
  Cantonese: 'zh-TW',
};

/** Languages where browser TTS is typically poor and we should prefer Google Translate when online */
const POOR_LOCAL_TTS_LANGUAGES = new Set([
  'Vietnamese', 'Thai', 'Korean', 'Japanese', 'Chinese', 'Mandarin', 'Cantonese',
  'Arabic', 'Hindi', 'Tagalog', 'Indonesian',
]);

export interface VoiceOption {
  /** Display name for voice selection UI */
  name: string;
  /** The underlying SpeechSynthesisVoice */
  voice: SpeechSynthesisVoice;
  /** Whether this is a local/offline voice */
  isLocal: boolean;
  /** Language code */
  lang: string;
}

export class TTSProvider implements ModelProvider<SpeechSynthesis> {
  private status: ModelStatus;
  /** Currently selected voice index per language (0 = default) */
  private selectedVoiceIndex: Record<string, number> = {};
  /** Cache of available voices per language */
  private voiceCache: Record<string, VoiceOption[]> = {};
  /** Whether we're currently online */
  private online: boolean = typeof navigator !== 'undefined' ? navigator.onLine : false;
  /** Audio element for Google Translate TTS fallback */
  private audioElement: HTMLAudioElement | null = null;

  constructor() {
    this.status = typeof window !== 'undefined' && 'speechSynthesis' in window
      ? 'ready'
      : 'error';

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => { this.online = true; });
      window.addEventListener('offline', () => { this.online = false; });

      // Voices may load asynchronously
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = () => {
          this.voiceCache = {};
        };
      }
    }
  }

  info(): ModelInfo {
    return {
      id: 'browser-speech-synthesis',
      name: 'Browser TTS (Web Speech API)',
      capability: 'tts',
      sizeBytes: 0,
      runtime: 'browser-api',
      required: false,
      status: this.status,
      languages: Object.keys(LANG_CODE_MAP),
    };
  }

  async load(): Promise<void> {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.status = 'ready';
    } else {
      this.status = 'error';
      throw new Error('SpeechSynthesis API not available');
    }
  }

  async unload(): Promise<void> {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.audioElement?.pause();
    this.audioElement = null;
    this.status = 'unloaded';
  }

  isReady(): boolean {
    return this.status === 'ready';
  }

  getEngine(): SpeechSynthesis | null {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      return window.speechSynthesis;
    }
    return null;
  }

  // ─── Voice Selection ─────────────────────────────────────────

  /**
   * Get available voices for a language.
   * Returns 2-3 options representing natural speaker variation.
   */
  getVoicesForLanguage(language: string): VoiceOption[] {
    if (this.voiceCache[language]) return this.voiceCache[language];

    const synth = this.getEngine();
    if (!synth) return [];

    const langCode = LANG_CODE_MAP[language] ?? language;
    const prefix = langCode.slice(0, 2);
    const allVoices = synth.getVoices();

    // Find all matching voices
    const matching = allVoices
      .filter((v) => v.lang.startsWith(prefix))
      .map((v) => ({
        name: this.formatVoiceName(v),
        voice: v,
        isLocal: v.localService,
        lang: v.lang,
      }));

    if (matching.length === 0) {
      this.voiceCache[language] = [];
      return [];
    }

    // Deduplicate by name and pick up to 3 diverse voices
    const seen = new Set<string>();
    const diverse: VoiceOption[] = [];

    // Prefer local voices first (work offline)
    const sorted = [...matching].sort((a, b) => {
      if (a.isLocal && !b.isLocal) return -1;
      if (!a.isLocal && b.isLocal) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const v of sorted) {
      if (diverse.length >= 3) break;
      const key = v.voice.name;
      if (seen.has(key)) continue;
      seen.add(key);
      diverse.push(v);
    }

    this.voiceCache[language] = diverse;
    return diverse;
  }

  /** Select which voice to use for a language (0-indexed from getVoicesForLanguage) */
  selectVoice(language: string, index: number): void {
    const voices = this.getVoicesForLanguage(language);
    if (index >= 0 && index < voices.length) {
      this.selectedVoiceIndex[language] = index;
    }
  }

  /** Get the currently selected voice index for a language */
  getSelectedVoiceIndex(language: string): number {
    return this.selectedVoiceIndex[language] ?? 0;
  }

  // ─── Speaking ─────────────────────────────────────────────────

  /**
   * Speak a phrase in the given language.
   * Uses Google Translate TTS fallback when online and local quality is poor.
   */
  speak(text: string, language: string = 'English', rate: number = 1.0): void {
    // Try Google Translate fallback for languages with poor local TTS
    if (this.online && POOR_LOCAL_TTS_LANGUAGES.has(language)) {
      const played = this.speakWithGoogleTranslate(text, language, rate);
      if (played) return;
    }

    this.speakLocal(text, language, rate);
  }

  /** Speak using the local Web Speech API */
  speakLocal(text: string, language: string = 'English', rate: number = 1.0): void {
    const synth = this.getEngine();
    if (!synth) return;

    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LANG_CODE_MAP[language] ?? language;
    utterance.rate = rate;
    utterance.pitch = 1.0;

    // Use selected voice if available
    const voices = this.getVoicesForLanguage(language);
    const selectedIdx = this.selectedVoiceIndex[language] ?? 0;
    if (voices[selectedIdx]) {
      utterance.voice = voices[selectedIdx].voice;
    }

    synth.speak(utterance);
  }

  /**
   * Speak using Google Translate's public audio endpoint.
   * Free, no API key needed. Only used when online.
   * Returns true if playback was initiated.
   */
  private speakWithGoogleTranslate(text: string, language: string, rate: number): boolean {
    const gttsLang = GTTS_LANG_MAP[language];
    if (!gttsLang) return false;

    // Google Translate TTS has a ~200 char limit per request
    const truncated = text.slice(0, 200);
    const encoded = encodeURIComponent(truncated);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${gttsLang}&q=${encoded}`;

    try {
      // Stop any current local speech
      this.getEngine()?.cancel();

      if (this.audioElement) {
        this.audioElement.pause();
      }
      this.audioElement = new Audio(url);
      this.audioElement.playbackRate = Math.max(0.5, Math.min(rate, 2.0));
      this.audioElement.play().catch(() => {
        // Fallback to local TTS if Google Translate fails
        this.speakLocal(text, language, rate);
      });
      return true;
    } catch {
      return false;
    }
  }

  // ─── Pronunciation Teaching ───────────────────────────────────

  /**
   * Speak a phrase slowly for pronunciation demonstration.
   * Rate is reduced to ~60% of normal speed.
   */
  speakSlow(text: string, language: string = 'English'): void {
    this.speak(text, language, 0.6);
  }

  /**
   * Break a phrase into syllable-like chunks and speak each with a pause.
   * Uses language-aware splitting — spaces for most languages,
   * character-level for CJK languages.
   */
  async speakBySyllable(text: string, language: string = 'English'): Promise<void> {
    const chunks = this.splitIntoChunks(text, language);

    for (let i = 0; i < chunks.length; i++) {
      await this.speakAndWait(chunks[i], language, 0.5);
      // Pause between chunks (shorter for CJK single characters)
      if (i < chunks.length - 1) {
        await this.delay(chunks[i].length <= 1 ? 400 : 600);
      }
    }
  }

  /**
   * Full pronunciation teaching sequence:
   * 1. Speak at normal speed
   * 2. Pause
   * 3. Speak slowly
   * 4. Pause
   * 5. Speak by syllable/chunk
   */
  async teachPronunciation(text: string, language: string = 'English'): Promise<void> {
    // Step 1: Normal speed
    await this.speakAndWait(text, language, 1.0);
    await this.delay(800);

    // Step 2: Slow
    await this.speakAndWait(text, language, 0.6);
    await this.delay(800);

    // Step 3: By syllable
    await this.speakBySyllable(text, language);
  }

  // ─── Helpers ──────────────────────────────────────────────────

  /** Stop any current speech (local and Google Translate) */
  stop(): void {
    this.getEngine()?.cancel();
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement = null;
    }
  }

  /** Get the language code for a language name */
  getLangCode(language: string): string {
    return LANG_CODE_MAP[language] ?? 'en-US';
  }

  /** Check if the app is currently online */
  isOnline(): boolean {
    return this.online;
  }

  /** Split text into pronunciation-friendly chunks */
  private splitIntoChunks(text: string, language: string): string[] {
    // CJK languages: split by character (each is roughly a syllable)
    const cjkLanguages = new Set(['Japanese', 'Chinese', 'Mandarin', 'Cantonese', 'Korean']);
    if (cjkLanguages.has(language)) {
      // For Korean, split by syllable blocks (each char is a block)
      // For CJK, each character is meaningful
      return text.split('').filter((c) => c.trim().length > 0);
    }

    // Vietnamese: split by spaces (each word is typically one syllable)
    if (language === 'Vietnamese') {
      return text.split(/\s+/).filter(Boolean);
    }

    // For other languages, split by spaces (word-level chunks)
    // This is a reasonable approximation for pronunciation teaching
    const words = text.split(/\s+/).filter(Boolean);

    // If only 1-2 words, return as-is (already small enough)
    if (words.length <= 2) return words;

    // Group into chunks of 1-2 words for natural pacing
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += 2) {
      if (i + 1 < words.length && words[i].length + words[i + 1].length < 8) {
        chunks.push(`${words[i]} ${words[i + 1]}`);
      } else {
        chunks.push(words[i]);
        if (i + 1 < words.length) chunks.push(words[i + 1]);
      }
    }
    return chunks;
  }

  /** Speak and return a promise that resolves when speech finishes */
  private speakAndWait(text: string, language: string, rate: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const synth = this.getEngine();
      if (!synth) { resolve(); return; }

      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = LANG_CODE_MAP[language] ?? language;
      utterance.rate = rate;
      utterance.pitch = 1.0;

      const voices = this.getVoicesForLanguage(language);
      const selectedIdx = this.selectedVoiceIndex[language] ?? 0;
      if (voices[selectedIdx]) {
        utterance.voice = voices[selectedIdx].voice;
      }

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      synth.speak(utterance);

      // Safety timeout — some browsers don't fire onend for very short text
      setTimeout(() => resolve(), Math.max(3000, text.length * 200));
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Format voice name for display (strip vendor prefixes) */
  private formatVoiceName(voice: SpeechSynthesisVoice): string {
    let name = voice.name;
    // Strip common prefixes
    name = name.replace(/^(Google |Microsoft |Apple )/, '');
    // Add locale hint if not obvious from voice name
    if (!name.includes(voice.lang)) {
      name = `${name} (${voice.lang})`;
    }
    return name;
  }
}
