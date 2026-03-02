/**
 * NAVI Agent Framework — Chat Tool
 *
 * The default tool: handles general conversation with the avatar.
 * Builds the system prompt from the avatar context controller,
 * injects memory context, and streams the LLM response.
 */

import type { ToolDefinition } from '../core/toolRegistry';
import type { ChatLLM } from '../models/chatLLM';
import type { AvatarContextController } from '../avatar/contextController';
import type { MemoryManager } from '../memory';

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
    },
    requiredModels: ['llm'],
    costTier: 'heavy',

    async execute(params: Record<string, unknown>): Promise<unknown> {
      const message = params.message as string;
      const history = (params.history as Array<{ role: string; content: string }>) ?? [];
      const onToken = params.onToken as ((token: string, full: string) => void) | undefined;

      // Build system prompt from avatar context + memory
      const memoryContext = memoryManager.buildContextForPrompt({
        location: avatarController.getActiveProfile()?.location,
        scenario: avatarController.getActiveProfile()?.scenario,
      });

      const systemPrompt = avatarController.buildSystemPrompt({
        memoryContext,
      });

      // Build message array
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-20), // Keep last 20 messages for context
        { role: 'user', content: message },
      ];

      // Generate response
      const response = await llmProvider.chat(messages, {
        temperature: 0.7,
        max_tokens: 512,
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
