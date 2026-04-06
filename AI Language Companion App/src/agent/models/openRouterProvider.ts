/**
 * NAVI Agent Framework — OpenRouter LLM Provider
 *
 * Routes all LLM calls to OpenRouter's cloud API.
 * Used when VITE_OPENROUTER_API_KEY is set — replaces WebLLM entirely.
 * No model download required; provider is ready immediately on construction.
 *
 * Rotation strategy: cycles through (key, model) pairs so same-account users
 * still benefit from per-model rate limit pools.
 * Endpoint: https://openrouter.ai/api/v1/chat/completions
 */

import type { ModelInfo, ModelProvider, ModelStatus } from '../core/types';
import type { ChatLLM, ChatOptions } from './chatLLM';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
export const FALLBACK_MODELS = [
  'google/gemma-4-27b-it:free',                    // top — Gemma 4
  'google/gemma-3-27b-it:free',                    // Gemma 3 fallback
  'deepseek/deepseek-r1:free',                     // strong reasoning, own rate pool
  'deepseek/deepseek-v3:free',                     // fast + capable
  'qwen/qwen3-32b:free',                           // best multilingual
  'meta-llama/llama-3.3-70b-instruct:free',        // reliable
  'mistralai/mistral-small-3.1-24b-instruct:free', // solid fallback
  'microsoft/phi-4:free',                          // fast, smart
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
const MAX_RETRY_AFTER_MS = 30_000;

/** Status codes that warrant rotating to the next key+model rather than throwing. */
const RETRYABLE_STATUSES = new Set([402, 408, 429, 500, 502, 503, 504]);

export class OpenRouterProvider implements ModelProvider<null>, ChatLLM {
  private status: ModelStatus = 'ready'; // no download — always ready
  private apiKeys: string[];
  private currentKeyIndex: number = 0;
  private models: string[];
  private abortController: AbortController | null = null;

  constructor(apiKeys: string | string[], models?: string[]) {
    this.apiKeys = Array.isArray(apiKeys) ? apiKeys : [apiKeys];
    this.models = models ?? FALLBACK_MODELS;
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

  /** Replace API keys at runtime (e.g. when user updates their key in Settings). */
  setApiKeys(keys: string | string[]): void {
    const arr = Array.isArray(keys) ? keys : [keys];
    this.apiKeys.splice(0, this.apiKeys.length, ...arr);
    this.currentKeyIndex = 0;
  }

  /** Replace the active model list at runtime. */
  setModels(models: string[]): void {
    this.models.splice(0, this.models.length, ...models);
  }

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
    console.log(`[NAVI] ── PROMPT (openrouter) ──`);
    for (const m of messages) {
      console.log(`[NAVI] [${m.role}] ${m.content}`);
    }

    const useStream = !!(options?.stream && options?.onToken);

    // Try every key × model combination before giving up
    const totalAttempts = this.apiKeys.length * this.models.length;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < totalAttempts; attempt++) {
      // Rotate key and model independently so each attempt tries a unique combination
      const keyIdx = (this.currentKeyIndex + attempt) % this.apiKeys.length;
      const modelIdx = attempt % this.models.length;
      const apiKey = this.apiKeys[keyIdx];
      const modelId = this.models[modelIdx];

      // Exponential backoff between retries (skip on first attempt)
      if (attempt > 0) {
        const backoffMs = Math.min(200 * Math.pow(2, attempt - 1), 8_000);
        await new Promise<void>(r => setTimeout(r, backoffMs));
      }

      this.abortController = new AbortController();
      const timeoutId = setTimeout(() => this.abortController?.abort(), DEFAULT_TIMEOUT);

      try {
        const response = await fetch(OPENROUTER_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://navi.app',
            'X-Title': 'NAVI Language Companion',
          },
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
          // Respect Retry-After header on 429s before moving on
          if (response.status === 429) {
            const retryAfterSec = parseInt(response.headers.get('Retry-After') ?? '0', 10);
            if (retryAfterSec > 0) {
              const waitMs = Math.min(retryAfterSec * 1000, MAX_RETRY_AFTER_MS);
              console.warn(`[NAVI] OpenRouter 429 — waiting ${waitMs}ms (Retry-After: ${retryAfterSec}s)`);
              await new Promise<void>(r => setTimeout(r, waitMs));
            }
          }
          const errorBody = await response.text().catch(() => '');
          console.warn(`[NAVI] OpenRouter ${response.status} on key ${keyIdx} model ${modelId}: ${errorBody}`);
          // Advance the sticky key index for future calls
          this.currentKeyIndex = (keyIdx + 1) % this.apiKeys.length;
          lastError = new Error(`retryable_${response.status}_key_${keyIdx}_model_${modelIdx}`);
          const nextModelId = this.models[(modelIdx + 1) % this.models.length];
          console.warn(`[NAVI] Rotating to model ${nextModelId}`);
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          throw new Error(`OpenRouter error (${response.status}): ${errorText}`);
        }

        if (useStream && options?.onToken && response.body) {
          const result = await this.handleStream(response.body, options.onToken);
          console.log(`[NAVI] ── RESPONSE (openrouter key ${keyIdx} model ${modelId}) ──`);
          console.log(`[NAVI] [assistant] ${result}`);
          return result;
        }

        const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        const result = data.choices?.[0]?.message?.content ?? '';
        if (!result) {
          // Advance key index on empty response so next call tries a different key
          this.currentKeyIndex = (keyIdx + 1) % this.apiKeys.length;
          lastError = new Error(`empty_response_key_${keyIdx}_model_${modelIdx}`);
          continue;
        }
        console.log(`[NAVI] ── RESPONSE (openrouter key ${keyIdx} model ${modelId}) ──`);
        console.log(`[NAVI] [assistant] ${result}`);
        return result;
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === 'AbortError') {
          throw new Error(`OpenRouter request timed out after ${DEFAULT_TIMEOUT}ms`);
        }
        lastError = err as Error;
        // Only continue retrying for known retryable errors; rethrow others immediately
        if (lastError.message.startsWith('retryable_') || lastError.message.startsWith('empty_response_')) continue;
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
