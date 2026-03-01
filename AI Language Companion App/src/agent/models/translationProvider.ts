/**
 * NAVI Agent Framework — Translation Model Provider (Stub)
 *
 * Provides text translation between languages.
 *
 * Design decision: Stub that delegates to the LLM.
 * A dedicated translation model (e.g., NLLB-200, MarianMT) would be
 * faster and more accurate for pure translation. But loading a separate
 * ~500MB model just for translation is expensive on a phone.
 *
 * For now, translation is handled by prompting the LLM with a
 * translation-focused system prompt. This is slower but uses the
 * model we already have loaded.
 *
 * Phase 2: Add ONNX-based NLLB or MarianMT for fast, dedicated translation.
 * The interface stays the same — just register a new provider.
 *
 * TODO: Evaluate NLLB-200-distilled for on-device translation
 * TODO: Measure latency difference between LLM translation and dedicated model
 */

import type { ModelInfo, ModelProvider, ModelStatus } from '../core/types';

export interface TranslationResult {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
}

export class TranslationProvider implements ModelProvider<null> {
  private status: ModelStatus = 'ready';

  info(): ModelInfo {
    return {
      id: 'llm-translation-stub',
      name: 'LLM-based Translation (stub)',
      capability: 'translation',
      sizeBytes: 0,
      runtime: 'custom',
      required: false,
      status: this.status,
      languages: ['multilingual'],
    };
  }

  async load(): Promise<void> {
    this.status = 'ready';
  }

  async unload(): Promise<void> {
    this.status = 'unloaded';
  }

  isReady(): boolean {
    return this.status === 'ready';
  }

  getEngine(): null {
    return null;
  }

  /**
   * Build a translation prompt for the LLM.
   * The actual LLM call is done by the tool that uses this provider,
   * not by the provider itself — keeping the provider stateless.
   */
  buildTranslationPrompt(
    text: string,
    targetLanguage: string,
    sourceLanguage?: string,
    options?: {
      includePhonetic?: boolean;
      includeExplanation?: boolean;
      dialect?: string;
      formality?: 'casual' | 'neutral' | 'formal';
    },
  ): string {
    const parts: string[] = [];

    if (sourceLanguage) {
      parts.push(`Translate the following from ${sourceLanguage} to ${targetLanguage}.`);
    } else {
      parts.push(`Translate the following to ${targetLanguage}.`);
    }

    if (options?.dialect) {
      parts.push(`Use ${options.dialect} dialect specifically.`);
    }

    if (options?.formality) {
      parts.push(`Formality level: ${options.formality}.`);
    }

    parts.push(`\nText: "${text}"`);

    parts.push('\nRespond with ONLY a JSON object:');
    parts.push('{');
    parts.push('  "translated": "the translation",');
    if (options?.includePhonetic) {
      parts.push('  "phonetic": "phonetic pronunciation for English speakers",');
    }
    if (options?.includeExplanation) {
      parts.push('  "explanation": "brief cultural/contextual notes",');
    }
    parts.push('  "literal": "word-for-word literal meaning"');
    parts.push('}');

    return parts.join('\n');
  }
}
