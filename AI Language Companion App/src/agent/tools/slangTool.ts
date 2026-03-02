/**
 * NAVI Agent Framework — Slang Teaching Tool
 *
 * Teaches generational slang (Gen Z, Gen Alpha, older) in the target language.
 */

import type { ToolDefinition } from '../core/toolRegistry';
import type { ChatLLM } from '../models/chatLLM';
import type { AvatarContextController } from '../avatar/contextController';
import type { LocationIntelligence } from '../location/locationIntelligence';
import { promptLoader } from '../prompts/promptLoader';

export function createSlangTool(
  llmProvider: ChatLLM,
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

      const toolConfig = promptLoader.getRaw('toolPrompts.slang') as {
        mode_header: string; template: string; temperature: number; max_tokens: number;
      };
      const modeHeader = promptLoader.get('toolPrompts.slang.mode_header', { generation });
      const toolPrompt = promptLoader.get('toolPrompts.slang.template', { generation, language, dialect });

      const systemPrompt = `${avatarController.buildSystemPrompt()}\n\n${modeHeader}\n${locationCtx}\n\n${toolPrompt}`;

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
