/**
 * NAVI Agent Framework — TTS & STT Tools
 *
 * Tools for text-to-speech playback and speech-to-text recording.
 */

import type { ToolDefinition } from '../core/toolRegistry';
import type { TTSProvider } from '../models/ttsProvider';
import type { STTProvider } from '../models/sttProvider';
import type { LocationIntelligence } from '../location/locationIntelligence';

export function createTTSSpeakTool(
  ttsProvider: TTSProvider,
  locationIntelligence: LocationIntelligence,
): ToolDefinition {
  return {
    name: 'tts_speak',
    description: 'Speak a phrase aloud using text-to-speech.',
    paramSchema: {
      text: { type: 'string', required: true, description: 'Text to speak' },
      language: { type: 'string', required: false, description: 'Language name (defaults to location language)' },
      rate: { type: 'number', required: false, description: 'Speech rate (0.1-2.0, default 0.4)' },
    },
    requiredModels: ['tts'],
    costTier: 'light',

    async execute(params: Record<string, unknown>): Promise<unknown> {
      const text = params.text as string;
      const language = (params.language as string) ?? locationIntelligence.getPrimaryLanguage();
      const rate = (params.rate as number) ?? 0.4;

      ttsProvider.speak(text, language, rate);

      return { speaking: true, text, language };
    },
  };
}

export function createSTTListenTool(
  sttProvider: STTProvider,
  locationIntelligence: LocationIntelligence,
): ToolDefinition {
  return {
    name: 'stt_listen',
    description: 'Listen to user speech and transcribe it.',
    paramSchema: {
      language: { type: 'string', required: false, description: 'Language code for recognition' },
      onResult: { type: 'function', required: false, description: 'Callback for transcription result' },
    },
    requiredModels: ['stt'],
    costTier: 'light',

    async execute(params: Record<string, unknown>): Promise<unknown> {
      const language = (params.language as string) ?? 'en-US';
      const onResult = params.onResult as ((transcript: string) => void) | undefined;

      return new Promise<unknown>((resolve, reject) => {
        sttProvider.startRecording(
          language,
          (transcript) => {
            onResult?.(transcript);
            resolve({ transcript, language });
          },
          (error) => {
            reject(new Error(error));
          },
        );

        // Auto-stop after 15 seconds
        setTimeout(() => {
          sttProvider.stop();
        }, 15_000);
      });
    },
  };
}
