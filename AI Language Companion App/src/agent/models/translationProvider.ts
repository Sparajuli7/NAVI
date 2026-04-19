/**
 * NAVI Agent Framework — Translation Model Provider (Stub)
 *
 * Stub that delegates translation to the LLM via a translation-focused prompt.
 * Swap with an ONNX-based NLLB or MarianMT model for dedicated translation.
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
      userNativeLanguage?: string;
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
      const lang = options?.userNativeLanguage || 'English';
      parts.push(`  "phonetic": "phonetic pronunciation for ${lang} speakers",`);
    }
    if (options?.includeExplanation) {
      parts.push('  "explanation": "brief cultural/contextual notes",');
    }
    parts.push('  "literal": "word-for-word literal meaning"');
    parts.push('}');

    return parts.join('\n');
  }
}
