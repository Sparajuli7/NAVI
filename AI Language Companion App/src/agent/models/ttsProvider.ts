/**
 * NAVI Agent Framework — TTS Model Provider
 *
 * Wraps the browser's Web Speech API (SpeechSynthesis) behind
 * the ModelProvider interface.
 *
 * Design decision: Browser API first, replaceable later.
 * The Web Speech API is free, requires no download, and works offline
 * (on most platforms). It's not great quality, but it's instant.
 * When we add a real on-device TTS model (e.g., Piper via WASM),
 * we register a new provider — no changes to consuming code.
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
};

export class TTSProvider implements ModelProvider<SpeechSynthesis> {
  private status: ModelStatus;

  constructor() {
    this.status = typeof window !== 'undefined' && 'speechSynthesis' in window
      ? 'ready'
      : 'error';
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
    // Browser API — nothing to load
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

  /** Speak a phrase in the given language */
  speak(text: string, language: string = 'English', rate: number = 0.4): void {
    const synth = this.getEngine();
    if (!synth) return;

    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LANG_CODE_MAP[language] ?? language;
    utterance.rate = rate;
    utterance.pitch = 1.0;

    const voices = synth.getVoices();
    const match = voices.find((v) => v.lang.startsWith(utterance.lang.slice(0, 2)));
    if (match) utterance.voice = match;

    synth.speak(utterance);
  }

  /** Stop any current speech */
  stop(): void {
    this.getEngine()?.cancel();
  }

  /** Get the language code for a language name */
  getLangCode(language: string): string {
    return LANG_CODE_MAP[language] ?? 'en-US';
  }
}
