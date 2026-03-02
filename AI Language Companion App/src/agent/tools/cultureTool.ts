/**
 * NAVI Agent Framework — Culture Explanation Tool
 *
 * Handles questions about cultural nuances, etiquette, customs.
 */

import type { ToolDefinition } from '../core/toolRegistry';
import type { ChatLLM } from '../models/chatLLM';
import type { AvatarContextController } from '../avatar/contextController';
import type { LocationIntelligence } from '../location/locationIntelligence';
import { promptLoader } from '../prompts/promptLoader';

export function createCultureTool(
  llmProvider: ChatLLM,
  avatarController: AvatarContextController,
  locationIntelligence: LocationIntelligence,
): ToolDefinition {
  return {
    name: 'explain_culture',
    description: 'Explain cultural nuances, etiquette, customs, and social norms.',
    paramSchema: {
      message: { type: 'string', required: true, description: 'Cultural question' },
    },
    requiredModels: ['llm'],
    costTier: 'heavy',

    async execute(params: Record<string, unknown>): Promise<unknown> {
      const message = params.message as string;
      const locationContext = locationIntelligence.buildContextForPrompt();

      const toolConfig = promptLoader.getRaw('toolPrompts.culture') as {
        mode_header: string; template: string; temperature: number; max_tokens: number;
      };
      const toolPrompt = promptLoader.get('toolPrompts.culture.template');

      const systemPrompt = `${avatarController.buildSystemPrompt()}\n\n${toolConfig.mode_header}\n${locationContext}\n\n${toolPrompt}`;

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
