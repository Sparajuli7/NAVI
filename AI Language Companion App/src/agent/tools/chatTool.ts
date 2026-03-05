/**
 * NAVI Agent Framework — Chat Tool
 *
 * The default tool: handles general conversation with the avatar.
 * Builds the system prompt from the avatar context controller,
 * injects memory context, learning context, and warmth instructions,
 * then streams the LLM response.
 */

import type { ToolDefinition } from '../core/toolRegistry';
import type { ChatLLM } from '../models/chatLLM';
import type { AvatarContextController } from '../avatar/contextController';
import type { MemoryManager } from '../memory';
import { promptLoader } from '../prompts/promptLoader';

export function createChatTool(
  llmProvider: ChatLLM,
  avatarController: AvatarContextController,
  memoryManager: MemoryManager,
): ToolDefinition {
  return {
    name: 'chat',
    description: 'General conversation with the avatar. Default tool for all non-specific requests.',
    paramSchema: {
      message: { type: 'string', required: true, description: 'User message' },
      history: { type: 'array', required: false, description: 'Conversation history' },
      onToken: { type: 'function', required: false, description: 'Streaming callback' },
      warmthInstruction: { type: 'string', required: false, description: 'Warmth-tier behavior' },
      learningContext: { type: 'string', required: false, description: 'Learner profile context' },
      conversationGoals: { type: 'string', required: false, description: 'Director goals injection' },
    },
    requiredModels: ['llm'],
    costTier: 'heavy',

    async execute(params: Record<string, unknown>): Promise<unknown> {
      const message = params.message as string;
      const history = (params.history as Array<{ role: string; content: string }>) ?? [];
      const onToken = params.onToken as ((token: string, full: string) => void) | undefined;
      const warmthInstruction = params.warmthInstruction as string | undefined;
      const learningContext = params.learningContext as string | undefined;
      const conversationGoals = params.conversationGoals as string | undefined;

      // Build system prompt from avatar context + memory + relationship + learning
      const memoryContext = memoryManager.buildContextForPrompt({
        location: avatarController.getActiveProfile()?.location,
        scenario: avatarController.getActiveProfile()?.scenario,
      });

      const chatConfig = promptLoader.getRaw('toolPrompts.chat') as {
        temperature: number; max_tokens: number;
      };

      const systemPrompt = avatarController.buildSystemPrompt({
        memoryContext,
        warmthInstruction,
        learningContext,
        conversationGoals,
      });

      // Build message array — keep sliding window tight (last 8 turns)
      // to prevent context degradation and character drift in long conversations
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-8),
        { role: 'user', content: message },
      ];

      // Generate response
      const response = await llmProvider.chat(messages, {
        temperature: chatConfig.temperature,
        max_tokens: chatConfig.max_tokens,
        stream: !!onToken,
        onToken,
      });

      // Store in working memory
      memoryManager.working.set('last_user_message', message);
      memoryManager.working.set('last_response', response);

      return { response };
    },
  };
}
