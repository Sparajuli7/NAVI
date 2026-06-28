/**
 * NAVI Agent Framework — Translation Tool
 *
 * Handles translation requests using the LLM with a translation-focused prompt.
 */

import type { ToolDefinition } from '../core/toolRegistry';
import type { ChatLLM } from '../models/chatLLM';
import type { TranslationProvider } from '../models/translationProvider';
import type { LocationIntelligence } from '../location/locationIntelligence';
import type { MemoryManager } from '../memory';
import { getUserNativeLanguage } from './toolHelpers';

export function createTranslateTool(
  llmProvider: ChatLLM,
  translationProvider: TranslationProvider,
  locationIntelligence: LocationIntelligence,
  memoryManager?: MemoryManager,
): ToolDefinition {
  return {
    name: 'translate',
    description: 'Translate text between languages with cultural context.',
    paramSchema: {
      message: { type: 'string', required: true, description: 'Text to translate or translation request' },
      targetLanguage: { type: 'string', required: false, description: 'Target language (defaults to location language)' },
      sourceLanguage: { type: 'string', required: false, description: 'Source language' },
    },
    requiredModels: ['llm'],
    costTier: 'heavy',

    async execute(params: Record<string, unknown>): Promise<unknown> {
      const message = params.message as string;
      const targetLanguage = (params.targetLanguage as string) ?? locationIntelligence.getPrimaryLanguage();
      const sourceLanguage = params.sourceLanguage as string | undefined;

      const userNativeLanguage = getUserNativeLanguage(memoryManager);
      const translationPrompt = translationProvider.buildTranslationPrompt(
        message,
        targetLanguage,
        sourceLanguage,
        {
          includePhonetic: true,
          includeExplanation: true,
          dialect: locationIntelligence.getDialect(),
          userNativeLanguage,
        },
      );

      const messages = [
        { role: 'system', content: 'You are a translation assistant. Respond ONLY with valid JSON.' },
        { role: 'user', content: translationPrompt },
      ];

      const raw = await llmProvider.chat(messages, {
        temperature: 0.3,
        max_tokens: 400,
      });

      try {
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleaned);
      } catch (err) {
        console.warn('[NAVI:translate] LLM did not return valid JSON, using raw text as translation:', err);
        return { translated: raw, sourceLanguage: sourceLanguage ?? 'unknown', targetLanguage };
      }
    },
  };
}
