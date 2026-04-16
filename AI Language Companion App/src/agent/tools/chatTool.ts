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
      situationContext: { type: 'string', required: false, description: 'Situation model context' },
      userMode: { type: 'string', required: false, description: 'Inferred user mode: learn|guide|friend|null' },
      translationMode: { type: 'string', required: false, description: 'Translation mode: listen (ambient) or speak (user message)' },
      dialectKey: { type: 'string', required: false, description: 'Explicit dialect key to override city string matching' },
      isFirstEverMessage: { type: 'boolean', required: false, description: 'True when this is the very first message in the conversation' },
      isFirstScenarioMessage: { type: 'boolean', required: false, description: 'True when the active scenario just changed (first message in a new scenario)' },
      learningStage: { type: 'string', required: false, description: 'Current learning stage (survival/functional/conversational/fluent)' },
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
      const situationContext = params.situationContext as string | undefined;
      const userMode = params.userMode as 'learn' | 'guide' | 'friend' | null | undefined;
      const translationMode = params.translationMode as 'listen' | 'speak' | undefined;
      const dialectKey = params.dialectKey as string | undefined;
      const isFirstEverMessage = params.isFirstEverMessage as boolean | undefined;
      const isFirstScenarioMessage = params.isFirstScenarioMessage as boolean | undefined;
      const learningStage = params.learningStage as string | undefined;

      // Build system prompt from avatar context + memory + relationship + learning + situation
      const memoryContext = memoryManager.buildContextForPrompt({
        location: avatarController.getActiveProfile()?.location,
        scenario: avatarController.getActiveProfile()?.scenario,
      });

      const chatConfig = promptLoader.getRaw('toolPrompts.chat') as {
        temperature: number; max_tokens: number;
      };

      // Get user's native language from profile memory
      const userNativeLanguage = memoryManager.profile.getProfile().nativeLanguage || 'English';

      const systemPrompt = avatarController.buildSystemPrompt({
        memoryContext,
        warmthInstruction,
        learningContext,
        conversationGoals,
        situationContext,
        userNativeLanguage,
        userMode: userMode ?? null,
        dialectKey,
        isFirstEverMessage,
        isFirstScenarioMessage,
        learningStage,
      });

      // In 'listen' translation mode, use the listenAndTranslate template instead of chat
      if (translationMode === 'listen') {
        const profile = avatarController.getActiveProfile();
        const language = profile?.dialect || 'the local language';
        const listenTemplate = promptLoader.get('toolPrompts.listenAndTranslate.template', {
          language,
          captured: message,
          userNativeLanguage,
        });
        const listenConfig = promptLoader.getRaw('toolPrompts.listenAndTranslate') as {
          temperature: number; max_tokens: number;
        };
        const listenMessages = [
          { role: 'system', content: listenTemplate },
          { role: 'user', content: message },
        ];
        const listenResponse = await llmProvider.chat(listenMessages, {
          temperature: listenConfig.temperature,
          max_tokens: listenConfig.max_tokens,
          stream: !!onToken,
          onToken,
        });
        memoryManager.working.set('last_user_message', message, 2 * 60 * 60 * 1000); // EXP-058: 2h session TTL
        memoryManager.working.set('last_response', listenResponse, 2 * 60 * 60 * 1000); // EXP-058: 2h session TTL
        return { response: listenResponse };
      }

      // Inject the chat-specific behavioral prompt (friend mode, not teaching mode)
      const chatBehavior = promptLoader.get('toolPrompts.chat.template', { userNativeLanguage });

      // Build final system message: avatar prompt + chat behavior
      // Chat behavior template contains adaptive language scaffolding instructions
      // that tell the LLM to read the conversation and adjust its own language mix
      const fullSystem = `${systemPrompt}\n\n${chatBehavior}`;

      // Build message array — keep sliding window tight (last 8 turns)
      // to prevent context degradation and character drift in long conversations
      const messages = [
        { role: 'system', content: fullSystem },
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

      // Store in working memory (EXP-058: 2h session TTL instead of default 10min)
      memoryManager.working.set('last_user_message', message, 2 * 60 * 60 * 1000);
      memoryManager.working.set('last_response', response, 2 * 60 * 60 * 1000);

      return { response };
    },
  };
}
