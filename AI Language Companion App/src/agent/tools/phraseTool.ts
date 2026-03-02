/**
 * NAVI Agent Framework — Phrase Generation Tool
 *
 * Generates useful phrases for the user's current context.
 */

import type { ToolDefinition } from '../core/toolRegistry';
import type { ChatLLM } from '../models/chatLLM';
import type { AvatarContextController } from '../avatar/contextController';
import type { LocationIntelligence } from '../location/locationIntelligence';

export function createPhraseTool(
  llmProvider: ChatLLM,
  avatarController: AvatarContextController,
  locationIntelligence: LocationIntelligence,
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

      const systemPrompt = `${avatarController.buildSystemPrompt()}

PHRASE GENERATION MODE.
Language: ${language} (${dialect})

Generate 2-3 useful phrases for the user's situation.
For EACH phrase use this EXACT format:

**Phrase:** [text in ${language}]
**Say it:** [phonetic for English speakers]
**Sound tip:** [how to physically produce the sounds]
**Means:** [natural meaning]
**Tip:** [when/how to use it]

After all phrases, add a brief note about which one to use first.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ];

      const response = await llmProvider.chat(messages, {
        temperature: 0.4,
        max_tokens: 600,
      });

      return { response };
    },
  };
}
