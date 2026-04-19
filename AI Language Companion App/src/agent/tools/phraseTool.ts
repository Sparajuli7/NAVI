/**
 * NAVI Agent Framework — Phrase Generation Tool
 *
 * Generates useful phrases for the user's current context.
 */

import type { ToolDefinition } from '../core/toolRegistry';
import type { ChatLLM } from '../models/chatLLM';
import type { AvatarContextController } from '../avatar/contextController';
import type { LocationIntelligence } from '../location/locationIntelligence';
import type { MemoryManager } from '../memory';
import { promptLoader } from '../prompts/promptLoader';
export function createPhraseTool(
  llmProvider: ChatLLM,
  avatarController: AvatarContextController,
  locationIntelligence: LocationIntelligence,
  memoryManager: MemoryManager,
): ToolDefinition {
  return {
    name: 'generate_phrase',
    description: 'Generate useful phrases for a situation with pronunciation guidance.',
    paramSchema: {
      message: { type: 'string', required: true, description: 'What phrases the user needs' },
    },
    requiredModels: ['llm'],
    costTier: 'heavy',

    async execute(params: Record<string, unknown>): Promise<unknown> {
      const message = params.message as string;
      const language = locationIntelligence.getPrimaryLanguage();
      const dialect = locationIntelligence.getDialect();

      const toolConfig = promptLoader.getRaw('toolPrompts.phrase') as {
        mode_header: string; template: string; temperature: number; max_tokens: number;
      };
      const userNativeLanguage = memoryManager.profile.getProfile().nativeLanguage || 'English';
      // Filter tracked phrases by current language to avoid cross-companion leaking
      const trackedPhrases = language
        ? memoryManager.learner.getPhrasesForLanguage(language)
        : memoryManager.learner.phrases;
      const recentPhrases = trackedPhrases.length > 0
        ? [...trackedPhrases]
            .sort((a, b) => b.lastPracticed - a.lastPracticed)
            .slice(0, 10)
            .map((p) => `"${p.phrase}"`)
            .join(', ')
        : 'none yet';
      const toolPrompt = promptLoader.get('toolPrompts.phrase.template', { language, dialect, userNativeLanguage, recentPhrases });

      const systemPrompt = `${avatarController.buildSystemPrompt({ userNativeLanguage })}\n\n${toolConfig.mode_header}\n${toolPrompt}`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ];

      const response = await llmProvider.chat(messages, {
        temperature: toolConfig.temperature,
        max_tokens: toolConfig.max_tokens,
      });

      return { response };
    },
  };
}
