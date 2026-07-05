/**
 * NAVI Agent Framework — OpenRouter LLM Provider
 *
 * Routes all LLM calls through the /api/chat serverless proxy, which
 * forwards to OpenRouter using a server-side API key. The key is never
 * visible to the client.
 *
 * Primary model: qwen/qwen3-32b
 * Fallback model: meta-llama/llama-3.3-70b-instruct
 *
 * On failure (timeout, 5xx, rate limit), retries once with the fallback
 * before surfacing an error. Logs which model served each response.
 */

import type { ModelInfo, ModelProvider, ModelStatus } from '../core/types';
import type { ChatLLM, ChatOptions } from './chatLLM';

const PROXY_ENDPOINT = '/api/chat';

/** Primary + fallback for production inference */
const PRIMARY_MODEL = 'qwen/qwen3-32b';
const FALLBACK_MODEL = 'meta-llama/llama-3.3-70b-instruct';

/** Extended free-tier model list — used by BackendSelectScreen for user selection */
export const FALLBACK_MODELS = [
  'google/gemma-4-27b-it:free',
  'google/gemma-3-27b-it:free',
  'deepseek/deepseek-r1:free',
  'deepseek/deepseek-v3:free',
  'qwen/qwen3-32b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'microsoft/phi-4:free',
];

export const PAID_MODELS = [
  'openai/gpt-4o-mini',
  'openai/gpt-4o',
  'openai/o1-mini',
  'anthropic/claude-3-haiku',
  'google/gemini-flash-1.5',
  'mistralai/mistral-medium',
  'meta-llama/llama-3.1-70b-instruct',
];

const DEFAULT_TIMEOUT = 90_000;

/** Status codes that warrant a retry with the fallback model. */
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export class OpenRouterProvider implements ModelProvider<null>, ChatLLM {
  private status: ModelStatus = 'ready'; // no download — always ready
  private models: string[];
  private abortController: AbortController | null = null;

  /**
   * @param models Optional override model list (e.g. user-selected free models from
   *               BackendSelectScreen). When omitted, defaults to primary + fallback.
   */
  constructor(models?: string[]) {
    this.models = models ?? [PRIMARY_MODEL, FALLBACK_MODEL];
  }

  info(): ModelInfo {
    return {
      id: `openrouter:${this.models[0]}`,
      name: `OpenRouter: ${this.models[0]}`,
      capability: 'llm',
      sizeBytes: 0,
      runtime: 'custom',
      required: false,
      status: this.status,
      languages: ['multilingual'],
    };
  }

  /** Update the active model list at runtime (called from SettingsPanel). */
  setModels(models: string[]): void {
    this.models.splice(0, this.models.length, ...models);
  }

  /** No-op — key is managed server-side. Kept for call-site backward compat. */
  setApiKeys(_keys: string | string[]): void { /* key lives in server env */ }

  /** No-op — OpenRouter needs no local download. */
  async load(_onProgress?: (progress: number, text: string) => void): Promise<void> {
    this.status = 'ready';
  }

  async unload(): Promise<void> {
    this.abortController?.abort();
    this.abortController = null;
    this.status = 'unloaded';
  }

  isReady(): boolean {
    return this.status === 'ready';
  }

  getEngine(): null {
    return null;
  }

  // ── ChatLLM interface ────────────────────────────────────────

  async chat(
    messages: Array<{ role: string; content: string }>,
    options?: ChatOptions,
  ): Promise<string> {
    const useStream = !!(options?.stream && options?.onToken);

    // Try each model in sequence; stop on first success
    let lastError: Error | null = null;

    for (let i = 0; i < this.models.length; i++) {
      const modelId = this.models[i];

      this.abortController = new AbortController();
      const timeoutId = setTimeout(() => this.abortController?.abort(), DEFAULT_TIMEOUT);

      try {
        const response = await fetch(PROXY_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelId,
            messages,
            temperature: options?.temperature ?? 0.7,
            max_tokens: options?.max_tokens ?? 512,
            top_p: options?.top_p ?? 0.8,
            stream: useStream,
          }),
          signal: this.abortController.signal,
        });

        clearTimeout(timeoutId);

        if (RETRYABLE_STATUSES.has(response.status)) {
          const errorBody = await response.text().catch(() => '');
          console.warn(`[NAVI] OpenRouter ${response.status} on model ${modelId}: ${errorBody}`);
          lastError = new Error(`openrouter_${response.status}_model_${i}`);
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          throw new Error(`OpenRouter error (${response.status}): ${errorText}`);
        }

        if (useStream && options?.onToken && response.body) {
          const result = await this.handleStream(response.body, options.onToken);
          console.log(`[NAVI] OpenRouter served by: ${modelId}`);
          return result;
        }

        const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        const result = data.choices?.[0]?.message?.content ?? '';
        if (!result) {
          lastError = new Error(`empty_response_model_${i}`);
          continue;
        }

        console.log(`[NAVI] OpenRouter served by: ${modelId}`);
        return result;
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === 'AbortError') {
          throw new Error(`OpenRouter request timed out after ${DEFAULT_TIMEOUT}ms`);
        }
        lastError = err as Error;
        // Only retry for flagged errors; rethrow unexpected ones immediately
        if (
          lastError.message.startsWith('openrouter_') ||
          lastError.message.startsWith('empty_response_')
        ) continue;
        throw lastError;
      }
    }

    throw new Error('NAVI is experiencing high demand right now. Please try again in a moment.');
  }

  // ── SSE streaming (OpenAI-compatible format) ─────────────────

  private async handleStream(
    body: ReadableStream<Uint8Array>,
    onToken: (token: string, full: string) => void,
  ): Promise<string> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        if (data === '[DONE]') break;

        try {
          const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
          const delta = parsed.choices?.[0]?.delta?.content ?? '';
          if (delta) {
            fullText += delta;
            onToken(delta, fullText);
          }
        } catch {
          // Skip unparseable SSE chunks
        }
      }
    }

    return fullText;
  }
}
