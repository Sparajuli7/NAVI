/**
 * NAVI Agent Framework — Slang Teaching Tool
 *
 * Teaches generational slang (Gen Z, Gen Alpha, older) in the target language.
 */

import type { ToolDefinition } from '../core/toolRegistry';
import type { LLMProvider } from '../models/llmProvider';
import type { AvatarContextController } from '../avatar/contextController';
import type { LocationIntelligence } from '../location/locationIntelligence';

export function createSlangTool(
  llmProvider: LLMProvider,
  avatarController: AvatarContextController,
  locationIntelligence: LocationIntelligence,
): ToolDefinition {
  return {
    name: 'teach_slang',
    description: 'Teach generational slang and informal language in the target language.',
    paramSchema: {
      message: { type: 'string', required: true, description: 'Slang question or topic' },
      generation: { type: 'string', required: false, description: 'gen_z | millennial | older' },
    },
    requiredModels: ['llm'],
    costTier: 'heavy',

    async execute(params: Record<string, unknown>): Promise<unknown> {
      const message = params.message as string;
      const generation = (params.generation as string) ?? 'gen_z';
      const language = locationIntelligence.getPrimaryLanguage();
      const dialect = locationIntelligence.getDialect();
      const locationCtx = locationIntelligence.buildContextForPrompt();

      const systemPrompt = `${avatarController.buildSystemPrompt()}

SLANG MODE — Generation: ${generation}
${locationCtx}

You are teaching ${generation} slang in ${language} (${dialect}).
For each slang term:
- Give the slang word/phrase
- Explain what it means
- Show how it's used in a real sentence
- Note if it's text-only (like ㅋㅋㅋ) or spoken too
- Compare to English slang equivalent if possible
- Mention if using it wrong could be embarrassing

Be fun and natural. Use the slang yourself while explaining.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ];

      const response = await llmProvider.chat(messages, {
        temperature: 0.7,
        max_tokens: 500,
      });

      return { response };
    },
  };
}
