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
 */

import type { ModelInfo, ModelProvider, ModelStatus } from '../core/types';

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

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
      languages: ['multilingual'],
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

  /** Start recording and transcribing */
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

    this.recognition = new SpeechRecognitionAPI();
    this.recognition.lang = lang;
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
}
