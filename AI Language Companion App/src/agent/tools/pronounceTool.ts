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

export function createPronounceTool(
  llmProvider: ChatLLM,
  avatarController: AvatarContextController,
  locationIntelligence: LocationIntelligence,
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

      const systemPrompt = `${avatarController.buildSystemPrompt()}

PRONUNCIATION MODE ACTIVE.
Language: ${language} (${dialect})

For every phrase you teach, you MUST use this exact format:

**Phrase:** [text in ${language}]
**Say it:** [phonetic pronunciation for English speakers]
**Sound tip:** [detailed mouth position, tongue placement, breath pattern, tone direction]
**Means:** [natural meaning]
**Tip:** [when to use, common mistakes]

Break down difficult sounds. For tonal languages, describe each tone.
Mark stress patterns clearly. Compare to English sounds where possible.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ];

      const response = await llmProvider.chat(messages, {
        temperature: 0.4,
        max_tokens: 500,
      });

      return { response };
    },
  };
}
