/**
 * NAVI Agent Framework — Pronunciation Tool
 *
 * Handles pronunciation coaching requests.
 * Can either explain how to pronounce something or start a practice session.
 */

import type { ToolDefinition } from '../core/toolRegistry';
import type { ChatLLM } from '../models/chatLLM';
import type { AvatarContextController } from '../avatar/contextController';
import type { LocationIntelligence } from '../location/locationIntelligence';
import type { MemoryManager } from '../memory';
import { promptLoader } from '../prompts/promptLoader';

export function createPronounceTool(
  llmProvider: ChatLLM,
  avatarController: AvatarContextController,
  locationIntelligence: LocationIntelligence,
  memoryManager: MemoryManager,
): ToolDefinition {
  return {
    name: 'pronounce',
    description: 'Teach pronunciation of a word or phrase with phonetic breakdown.',
    paramSchema: {
      message: { type: 'string', required: true, description: 'The phrase or pronunciation question' },
    },
    requiredModels: ['llm'],
    costTier: 'heavy',

    async execute(params: Record<string, unknown>): Promise<unknown> {
      const message = params.message as string;
      const language = locationIntelligence.getPrimaryLanguage();
      const dialect = locationIntelligence.getDialect();

      const toolConfig = promptLoader.getRaw('toolPrompts.pronounce') as {
        mode_header: string; template: string; temperature: number; max_tokens: number;
      };
      const modeHeader = toolConfig.mode_header;
      const userNativeLanguage = memoryManager.profile.getProfile().nativeLanguage || 'English';
      const toolPrompt = promptLoader.get('toolPrompts.pronounce.template', { language, dialect, userNativeLanguage });

      const systemPrompt = `${avatarController.buildSystemPrompt({ userNativeLanguage })}\n\n${modeHeader}\n${toolPrompt}`;

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
