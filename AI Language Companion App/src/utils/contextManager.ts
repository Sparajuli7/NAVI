import type { LLMMessage } from '../types/inference';
import type { Message } from '../types/chat';
import { estimateTokens } from './tokenEstimator';

const TOKEN_BUDGET = {
  system:   400,
  memory:   150,
  history: 2300,
  user:     200,
  response: 800,
};

export function buildMessages(
  systemPrompt: string,
  history: Message[],
  newMessage: string,
): LLMMessage[] {
  const messages: LLMMessage[] = [];

  messages.push({ role: 'system', content: systemPrompt });

  let historyBudget = TOKEN_BUDGET.history;
  const eligible: Message[] = [];

  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    const tokens = estimateTokens(msg.content);
    if (historyBudget - tokens < 0) break;
    historyBudget -= tokens;
    eligible.unshift(msg);
  }

  for (const msg of eligible) {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    });
  }

  messages.push({ role: 'user', content: newMessage });

  return messages;
}
