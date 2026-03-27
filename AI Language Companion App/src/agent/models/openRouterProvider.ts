/**
 * NAVI Agent Framework — OpenRouter LLM Provider
 *
 * Routes all LLM calls to OpenRouter's cloud API.
 * Used when VITE_OPENROUTER_API_KEY is set — replaces WebLLM entirely.
 * No model download required; provider is ready immediately on construction.
 *
 * Model: meta-llama/llama-3.3-70b-instruct:free
 * Endpoint: https://openrouter.ai/api/v1/chat/completions
 */

import type { ModelInfo, ModelProvider, ModelStatus } from '../core/types';
import type { ChatLLM, ChatOptions } from './chatLLM';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';
const DEFAULT_TIMEOUT = 120_000;

export class OpenRouterProvider implements ModelProvider<null>, ChatLLM {
  private status: ModelStatus = 'ready'; // no download — always ready
  private readonly apiKey: string;
  private readonly model: string;
  private abortController: AbortController | null = null;

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    this.apiKey = apiKey;
    this.model = model;
  }

  info(): ModelInfo {
    return {
      id: `openrouter:${this.model}`,
      name: `OpenRouter: ${this.model}`,
      capability: 'llm',
      sizeBytes: 0,
      runtime: 'custom',
      required: false,
      status: this.status,
      languages: ['multilingual'],
    };
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
    console.log(`[NAVI] ── PROMPT (openrouter: ${this.model}) ──`);
    for (const m of messages) {
      console.log(`[NAVI] [${m.role}] ${m.content}`);
    }

    const useStream = !!(options?.stream && options?.onToken);

    this.abortController = new AbortController();
    const timeoutId = setTimeout(() => this.abortController?.abort(), DEFAULT_TIMEOUT);

    try {
      const response = await fetch(OPENROUTER_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://navi.app',
          'X-Title': 'NAVI Language Companion',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.max_tokens ?? 512,
          top_p: options?.top_p ?? 0.8,
          stream: useStream,
        }),
        signal: this.abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`OpenRouter error (${response.status}): ${errorText}`);
      }

      if (useStream && options?.onToken && response.body) {
        const result = await this.handleStream(response.body, options.onToken);
        console.log(`[NAVI] ── RESPONSE (openrouter) ──`);
        console.log(`[NAVI] [assistant] ${result}`);
        return result;
      }

      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const result = data.choices?.[0]?.message?.content ?? '';
      console.log(`[NAVI] ── RESPONSE (openrouter) ──`);
      console.log(`[NAVI] [assistant] ${result}`);
      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`OpenRouter request timed out after ${DEFAULT_TIMEOUT}ms`);
      }
      throw err;
    }
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
