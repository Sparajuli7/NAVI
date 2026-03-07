/**
 * NAVI Agent Framework — STT Model Provider
 *
 * Wraps the browser's Web Speech API (SpeechRecognition) behind
 * the ModelProvider interface.
 *
 * Design decision: Same as TTS — browser API first, swappable.
 * SpeechRecognition is Chrome/Edge only. When we add Whisper.cpp
 * via WASM, it registers as a second STT provider with broader
 * browser support.
 *
 * Key fix: Language detection now defaults to the user's target
 * language, not English. The STT must detect the language being
 * spoken — which is the language the user is learning.
 */

import type { ModelInfo, ModelProvider, ModelStatus } from '../core/types';

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

/** Map language names to BCP-47 codes for speech recognition */
const STT_LANG_CODE_MAP: Record<string, string> = {
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

export class STTProvider implements ModelProvider<SpeechRecognition | null> {
  private status: ModelStatus;
  private recognition: SpeechRecognition | null = null;

  constructor() {
    this.status =
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
        ? 'ready'
        : 'error';
  }

  info(): ModelInfo {
    return {
      id: 'browser-speech-recognition',
      name: 'Browser STT (Web Speech API)',
      capability: 'stt',
      sizeBytes: 0,
      runtime: 'browser-api',
      required: false,
      status: this.status,
      languages: Object.keys(STT_LANG_CODE_MAP),
    };
  }

  async load(): Promise<void> {
    if (
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    ) {
      this.status = 'ready';
    } else {
      this.status = 'error';
      throw new Error('SpeechRecognition API not available');
    }
  }

  async unload(): Promise<void> {
    this.stop();
    this.status = 'unloaded';
  }

  isReady(): boolean {
    return this.status === 'ready';
  }

  getEngine(): SpeechRecognition | null {
    return this.recognition;
  }

  /**
   * Start recording and transcribing.
   * @param lang - BCP-47 code (e.g. 'vi-VN') OR language name (e.g. 'Vietnamese').
   *               This should be the TARGET language the user is learning/practicing,
   *               NOT English (unless the user is speaking English).
   */
  startRecording(
    lang: string = 'en-US',
    onResult: (transcript: string) => void,
    onError?: (error: string) => void,
  ): void {
    if (!this.isReady()) {
      onError?.('Speech recognition not available');
      return;
    }

    const SpeechRecognitionAPI =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    // Resolve language name to BCP-47 code if a name was passed
    const langCode = STT_LANG_CODE_MAP[lang] ?? lang;

    this.recognition = new SpeechRecognitionAPI();
    this.recognition.lang = langCode;
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      onResult(transcript);
    };

    this.recognition.onerror = (event) => {
      onError?.(event.error);
    };

    this.recognition.start();
  }

  /** Stop recording */
  stop(): void {
    this.recognition?.stop();
    this.recognition = null;
  }

  /** Get the BCP-47 language code for a language name */
  getLangCode(language: string): string {
    return STT_LANG_CODE_MAP[language] ?? 'en-US';
  }
}
