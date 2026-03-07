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
      rate: { type: 'number', required: false, description: 'Speech rate (0.1-2.0, default 1.0)' },
      mode: { type: 'string', required: false, description: '"normal" | "slow" | "syllable" | "teach" — pronunciation mode' },
    },
    requiredModels: ['tts'],
    costTier: 'light',

    async execute(params: Record<string, unknown>): Promise<unknown> {
      const text = params.text as string;
      const language = (params.language as string) ?? locationIntelligence.getPrimaryLanguage();
      const rate = (params.rate as number) ?? 1.0;
      const mode = (params.mode as string) ?? 'normal';

      switch (mode) {
        case 'slow':
          ttsProvider.speakSlow(text, language);
          break;
        case 'syllable':
          await ttsProvider.speakBySyllable(text, language);
          break;
        case 'teach':
          await ttsProvider.teachPronunciation(text, language);
          break;
        default:
          ttsProvider.speak(text, language, rate);
          break;
      }

      return { speaking: true, text, language, mode };
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
      language: { type: 'string', required: false, description: 'Language name or BCP-47 code for recognition (defaults to target language)' },
      onResult: { type: 'function', required: false, description: 'Callback for transcription result' },
    },
    requiredModels: ['stt'],
    costTier: 'light',

    async execute(params: Record<string, unknown>): Promise<unknown> {
      // Default to the user's TARGET language, not English
      const language = (params.language as string) ?? locationIntelligence.getPrimaryLanguage();
      const langCode = sttProvider.getLangCode(language);
      const onResult = params.onResult as ((transcript: string) => void) | undefined;

      return new Promise<unknown>((resolve, reject) => {
        sttProvider.startRecording(
          langCode,
          (transcript) => {
            onResult?.(transcript);
            resolve({ transcript, language: langCode });
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
