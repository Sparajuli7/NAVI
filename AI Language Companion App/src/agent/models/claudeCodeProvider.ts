/**
 * NAVI Agent Framework — Claude Code LLM Provider
 *
 * Talks to a local "Claude Code bridge" (scripts/claude-bridge.mjs) over HTTP.
 * The bridge shells out to the user's installed `claude` CLI in headless mode,
 * so NAVI can use Claude Code (Opus/Sonnet/Haiku, via the user's own auth) as a
 * chat backend — no API key stored in the app.
 *
 * The browser can't spawn processes, hence the bridge. This provider only speaks
 * HTTP and implements ChatLLM, so tools don't know or care that Claude Code is
 * behind it. Mirrors OllamaProvider's shape (health check + chat + streaming).
 *
 * Prerequisites:
 *   1. Claude Code CLI installed and authenticated (`claude`).
 *   2. Run the bridge: `pnpm run bridge` (starts http://127.0.0.1:4599).
 */

import type { ModelInfo, ModelProvider, ModelStatus } from '../core/types';
import type { ChatLLM, ChatOptions } from './chatLLM';

export interface ClaudeCodeProviderConfig {
  /** Bridge base URL */
  baseUrl?: string;
  /** Claude model alias or id the bridge should use (e.g. 'sonnet', 'opus') */
  model?: string;
  /** Human-readable name */
  name?: string;
  /** Request timeout in ms */
  timeoutMs?: number;
}

const DEFAULT_BASE_URL = 'http://127.0.0.1:4599';
const DEFAULT_MODEL = 'sonnet';
const DEFAULT_TIMEOUT = 120_000;

export class ClaudeCodeProvider implements ModelProvider<null>, ChatLLM {
  private status: ModelStatus = 'not_loaded';
  private config: Required<ClaudeCodeProviderConfig>;
  private abortController: AbortController | null = null;

  constructor(config: ClaudeCodeProviderConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      model: config.model ?? DEFAULT_MODEL,
      name: config.name ?? `Claude Code (${config.model ?? DEFAULT_MODEL})`,
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT,
    };
  }

  info(): ModelInfo {
    return {
      id: `claudecode:${this.config.model}`,
      name: this.config.name,
      capability: 'llm',
      sizeBytes: 0,
      runtime: 'custom',
      required: false,
      status: this.status,
      languages: ['multilingual'],
    };
  }

  /** "Loading" = verifying the bridge is reachable. */
  async load(onProgress?: (progress: number, text: string) => void): Promise<void> {
    this.status = 'loading';
    onProgress?.(20, 'Connecting to Claude Code bridge...');
    const alive = await this.checkConnection();
    if (!alive) {
      this.status = 'error';
      throw new Error(
        `Cannot reach the Claude Code bridge at ${this.config.baseUrl}. ` +
        `Start it with: pnpm run bridge`,
      );
    }
    this.status = 'ready';
    onProgress?.(100, 'Claude Code ready');
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

  getModelName(): string {
    return this.config.model;
  }

  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  /** Update the Claude model at runtime (bridge honours it per-request). */
  switchModel(model: string): void {
    this.config.model = model;
    this.config.name = `Claude Code (${model})`;
  }

  async checkConnection(): Promise<boolean> {
    return isClaudeBridgeAvailable(this.config.baseUrl);
  }

  // ── Chat Interface (ChatLLM) ─────────────────────────────────

  async chat(
    messages: Array<{ role: string; content: string }>,
    options?: ChatOptions,
  ): Promise<string> {
    const useStream = !!options?.stream && !!options?.onToken;

    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    const timeoutId = setTimeout(() => this.abortController?.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, model: this.config.model, stream: useStream }),
        signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Claude Code bridge error (${response.status}): ${errText}`);
      }

      if (useStream && response.body) {
        return await this.handleStream(response.body, options!.onToken!);
      }

      const data = await response.json();
      if (data.error) throw new Error(`Claude Code error: ${data.error}`);
      return data.text ?? '';
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Claude Code request timed out after ${this.config.timeoutMs}ms`);
      }
      throw err;
    }
  }

  /** Parse the bridge's SSE stream (`data: {"token"|"done"|"error": ...}`). */
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
        if (!trimmed.startsWith('data: ')) continue;
        const jsonStr = trimmed.slice(6);
        try {
          const evt = JSON.parse(jsonStr);
          if (evt.error) throw new Error(`Claude Code error: ${evt.error}`);
          if (evt.token) {
            fullText += evt.token;
            onToken(evt.token, fullText);
          }
          if (evt.done && evt.text && !fullText) fullText = evt.text;
        } catch (err) {
          if (err instanceof Error && err.message.startsWith('Claude Code error')) throw err;
          // Skip unparseable fragments
        }
      }
    }

    return fullText;
  }
}

// ── Utilities ──────────────────────────────────────────────────

/** Quick check: is the Claude Code bridge running on this machine? */
export async function isClaudeBridgeAvailable(
  baseUrl: string = DEFAULT_BASE_URL,
): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return false;
    const data = await response.json().catch(() => null);
    return data?.ok === true;
  } catch {
    return false;
  }
}
