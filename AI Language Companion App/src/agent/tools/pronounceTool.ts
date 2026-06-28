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
import { getToolConfig, getUserNativeLanguage } from './toolHelpers';
import { lookupPhraseIPA } from '../../utils/pronunciationLookup';

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

      const toolConfig = getToolConfig('toolPrompts.pronounce');
      const modeHeader = toolConfig.mode_header;
      const userNativeLanguage = getUserNativeLanguage(memoryManager);

      // Pre-lookup: try to find real IPA for the phrase the user is asking about
      let ipaHint = '';
      const ipa = await lookupPhraseIPA(message, language).catch(() => null);
      if (ipa) {
        ipaHint = `\nREFERENCE IPA (use this as the basis for the "Say it" field — convert to reader-friendly pronunciation): ${ipa}\n`;
      }

      const toolPrompt = promptLoader.get('toolPrompts.pronounce.template', { language, dialect, userNativeLanguage });

      const systemPrompt = `${avatarController.buildSystemPrompt({ userNativeLanguage })}\n\n${modeHeader}\n${toolPrompt}${ipaHint}`;

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
