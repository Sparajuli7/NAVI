/**
 * NAVI Agent Framework — Culture Explanation Tool
 *
 * Handles questions about cultural nuances, etiquette, customs.
 */

import type { ToolDefinition } from '../core/toolRegistry';
import type { ChatLLM } from '../models/chatLLM';
import type { AvatarContextController } from '../avatar/contextController';
import type { LocationIntelligence } from '../location/locationIntelligence';

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

      const systemPrompt = `${avatarController.buildSystemPrompt()}

CULTURAL GUIDE MODE.
${locationContext}

You are explaining cultural nuances as a local who understands both the local culture
and the user's perspective as an outsider. Give practical, real-life advice.
Include specific examples. Mention common mistakes outsiders make.
If relevant, teach the appropriate phrases to use in this cultural context.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ];

      const response = await llmProvider.chat(messages, {
        temperature: 0.6,
        max_tokens: 500,
      });

      return { response };
    },
  };
}
