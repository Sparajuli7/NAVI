/**
 * NAVI Agent Framework — Ollama LLM Provider
 *
 * Connects to a local Ollama instance via its OpenAI-compatible API.
 * Ollama runs models locally on your machine (Mac, Linux, Windows)
 * and exposes them at http://localhost:11434.
 *
 * Use cases:
 * - Development: test with larger/better models than what fits in WebGPU
 * - Desktop: run NAVI as a web app with Ollama as the backend
 * - Model testing: quickly swap between qwen, llama, mistral, gemma, etc.
 *
 * Design decision: Use Ollama's OpenAI-compatible endpoint (/v1/chat/completions).
 * This means the same code would work with any OpenAI-compatible local server
 * (llama.cpp server, vLLM, LM Studio, etc.) — just change the base URL.
 *
 * No npm dependencies — uses native fetch API.
 *
 * Prerequisites:
 *   1. Install Ollama: https://ollama.com
 *   2. Pull a model: `ollama pull qwen2.5:1.5b` (or any model)
 *   3. Ollama runs automatically on localhost:11434
 *   4. Set OLLAMA_ORIGINS=* if CORS blocks browser requests:
 *      `OLLAMA_ORIGINS="*" ollama serve`
 */

import type { ModelInfo, ModelProvider, ModelStatus } from '../core/types';
import type { ChatLLM, ChatOptions } from './chatLLM';

export interface OllamaProviderConfig {
  /** Ollama model name (e.g., 'qwen2.5:1.5b', 'llama3.2:3b', 'mistral:7b') */
  model: string;
  /** Human-readable name */
  name?: string;
  /** Base URL for Ollama API */
  baseUrl?: string;
  /** Approximate model size in bytes (for UI display) */
  sizeBytes?: number;
  /** Connection timeout in ms */
  timeoutMs?: number;
}

/** Common Ollama model presets for quick setup */
export const OLLAMA_PRESETS = {
  'qwen2.5:1.5b': {
    model: 'qwen2.5:1.5b',
    name: 'Qwen 2.5 1.5B (Ollama)',
    sizeBytes: 986_000_000,
  },
  'qwen2.5:3b': {
    model: 'qwen2.5:3b',
    name: 'Qwen 2.5 3B (Ollama)',
    sizeBytes: 1_900_000_000,
  },
  'qwen2.5:7b': {
    model: 'qwen2.5:7b',
    name: 'Qwen 2.5 7B (Ollama)',
    sizeBytes: 4_700_000_000,
  },
  'llama3.2:3b': {
    model: 'llama3.2:3b',
    name: 'Llama 3.2 3B (Ollama)',
    sizeBytes: 2_000_000_000,
  },
  'llama3.2:1b': {
    model: 'llama3.2:1b',
    name: 'Llama 3.2 1B (Ollama)',
    sizeBytes: 1_300_000_000,
  },
  'mistral:7b': {
    model: 'mistral:7b',
    name: 'Mistral 7B (Ollama)',
    sizeBytes: 4_100_000_000,
  },
  'gemma2:2b': {
    model: 'gemma2:2b',
    name: 'Gemma 2 2B (Ollama)',
    sizeBytes: 1_600_000_000,
  },
  'phi3:mini': {
    model: 'phi3:mini',
    name: 'Phi-3 Mini (Ollama)',
    sizeBytes: 2_300_000_000,
  },
} satisfies Record<string, Partial<OllamaProviderConfig>>;

const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_TIMEOUT = 60_000;

export class OllamaProvider implements ModelProvider<null>, ChatLLM {
  private status: ModelStatus = 'not_loaded';
  private config: Required<OllamaProviderConfig>;
  private abortController: AbortController | null = null;

  constructor(config: OllamaProviderConfig) {
    this.config = {
      model: config.model,
      name: config.name ?? `Ollama: ${config.model}`,
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      sizeBytes: config.sizeBytes ?? 0,
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT,
    };
  }

  info(): ModelInfo {
    return {
      id: `ollama:${this.config.model}`,
      name: this.config.name,
      capability: 'llm',
      sizeBytes: this.config.sizeBytes,
      runtime: 'custom',
      required: false,
      status: this.status,
      languages: ['multilingual'],
    };
  }

  /**
   * "Loading" for Ollama means verifying the server is reachable
   * and the model is available. The model itself loads on first
   * inference (Ollama handles this automatically).
   */
  async load(onProgress?: (progress: number, text: string) => void): Promise<void> {
    this.status = 'loading';
    onProgress?.(10, 'Connecting to Ollama...');

    try {
      // Check server is running
      const alive = await this.checkConnection();
      if (!alive) {
        throw new Error(
          `Cannot connect to Ollama at ${this.config.baseUrl}. ` +
          `Make sure Ollama is running: https://ollama.com\n` +
          `If CORS is blocking, start with: OLLAMA_ORIGINS="*" ollama serve`
        );
      }
      onProgress?.(40, 'Connected to Ollama');

      // Check model is available
      const available = await this.isModelAvailable();
      if (!available) {
        onProgress?.(50, `Model ${this.config.model} not found. Pulling...`);
        // Try to pull the model
        await this.pullModel(onProgress);
      } else {
        onProgress?.(80, `Model ${this.config.model} ready`);
      }

      // Warm up — send a tiny request so the model loads into memory
      onProgress?.(90, 'Warming up model...');
      await this.chat(
        [{ role: 'user', content: 'hi' }],
        { max_tokens: 5, temperature: 0 },
      );

      this.status = 'ready';
      onProgress?.(100, 'Ollama ready');
    } catch (err) {
      this.status = 'error';
      throw err;
    }
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

  // ── Chat Interface (ChatLLM) ─────────────────────────────────

  async chat(
    messages: Array<{ role: string; content: string }>,
    options?: ChatOptions,
  ): Promise<string> {
    // Log outgoing prompt
    console.log(`[NAVI] ── PROMPT (ollama: ${this.config.model}) ──`);
    for (const m of messages) {
      console.log(`[NAVI] [${m.role}] ${m.content}`);
    }

    const url = `${this.config.baseUrl}/v1/chat/completions`;

    const body = {
      model: this.config.model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 512,
      top_p: options?.top_p ?? 0.8,
      stream: options?.stream && !!options?.onToken,
    };

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // Set up timeout
    const timeoutId = setTimeout(() => {
      this.abortController?.abort();
    }, this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Ollama error (${response.status}): ${errorText}`);
      }

      // Streaming response
      if (body.stream && options?.onToken && response.body) {
        const result = await this.handleStream(response.body, options.onToken);
        console.log(`[NAVI] ── RESPONSE (ollama) ──`);
        console.log(`[NAVI] [assistant] ${result}`);
        return result;
      }

      // Non-streaming response
      const data = await response.json();
      const result = data.choices?.[0]?.message?.content ?? '';
      console.log(`[NAVI] ── RESPONSE (ollama) ──`);
      console.log(`[NAVI] [assistant] ${result}`);
      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Ollama request timed out after ${this.config.timeoutMs}ms`);
      }
      throw err;
    }
  }

  // ── Ollama-Specific Methods ──────────────────────────────────

  /** Check if Ollama server is reachable */
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /** Check if a specific model is already pulled */
  async isModelAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return false;

      const data = await response.json();
      const models = (data.models ?? []) as Array<{ name: string }>;
      return models.some((m) =>
        m.name === this.config.model || m.name.startsWith(`${this.config.model}:`),
      );
    } catch {
      return false;
    }
  }

  /** List all models available in the local Ollama instance */
  async listAvailableModels(): Promise<Array<{ name: string; size: number; modified: string }>> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return [];

      const data = await response.json();
      return (data.models ?? []).map((m: { name: string; size: number; modified_at: string }) => ({
        name: m.name,
        size: m.size,
        modified: m.modified_at,
      }));
    } catch {
      return [];
    }
  }

  /** Pull a model from the Ollama registry */
  private async pullModel(
    onProgress?: (progress: number, text: string) => void,
  ): Promise<void> {
    const response = await fetch(`${this.config.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: this.config.model, stream: true }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Failed to pull model ${this.config.model}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value, { stream: true }).split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.total && event.completed) {
            const pct = Math.round((event.completed / event.total) * 100);
            onProgress?.(50 + pct * 0.3, `Pulling ${this.config.model}: ${pct}%`);
          } else if (event.status) {
            onProgress?.(60, event.status);
          }
        } catch {
          // Skip unparseable lines
        }
      }
    }
  }

  /** Handle SSE streaming from Ollama's OpenAI-compatible endpoint */
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
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content ?? '';
          if (delta) {
            fullText += delta;
            onToken(delta, fullText);
          }
        } catch {
          // Skip unparseable chunks
        }
      }
    }

    return fullText;
  }

  /** Get the model name this provider is configured for */
  getModelName(): string {
    return this.config.model;
  }

  /** Get the base URL */
  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  /** Update the model at runtime (e.g., user picks a different one from the list) */
  async switchModel(model: string): Promise<void> {
    this.config.model = model;
    this.config.name = `Ollama: ${model}`;
    this.status = 'not_loaded';
  }
}

// ── Utilities ──────────────────────────────────────────────────

/** Quick check: is Ollama running on this machine? */
export async function isOllamaAvailable(
  baseUrl: string = DEFAULT_BASE_URL,
): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** List models available in a local Ollama instance */
export async function listOllamaModels(
  baseUrl: string = DEFAULT_BASE_URL,
): Promise<Array<{ name: string; size: number }>> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.models ?? []).map((m: { name: string; size: number }) => ({
      name: m.name,
      size: m.size,
    }));
  } catch {
    return [];
  }
}
