/**
 * NAVI Agent Framework — Managed Cloud LLM Provider
 *
 * Calls NAVI's OWN server proxy (`/api/chat`) instead of OpenRouter directly.
 * The proxy holds the real OpenRouter key server-side, enforces per-user free
 * allowances (see src/config/monetization.ts), meters usage, and forwards the
 * request. This is how NAVI fronts a shared pool of credits without ever
 * shipping an API key to the browser.
 *
 * Contrast with OpenRouterProvider, which is the BYOK path (user's own key,
 * client-side). This provider needs no key — just a signed-in Supabase session,
 * whose access token is supplied lazily via the injected `getToken` callback so
 * the agent core stays decoupled from the auth layer.
 */

import type { ModelInfo, ModelProvider, ModelStatus } from '../core/types';
import type { ChatLLM, ChatOptions } from './chatLLM';
import { MANAGED_CLOUD, type LimitReason } from '../../config/monetization';

const DEFAULT_TIMEOUT = 90_000;

/** Thrown when the proxy refuses a request (limit hit / not signed in). */
export class ManagedCloudLimitError extends Error {
  reason: LimitReason;
  constructor(reason: LimitReason, message: string) {
    super(message);
    this.name = 'ManagedCloudLimitError';
    this.reason = reason;
  }
}

export type AuthTokenGetter = () => string | null | Promise<string | null>;

export class ManagedCloudProvider implements ModelProvider<null>, ChatLLM {
  private status: ModelStatus = 'ready'; // no download — always ready
  private getToken: AuthTokenGetter;
  private endpoint: string;
  private abortController: AbortController | null = null;

  constructor(getToken: AuthTokenGetter, endpoint: string = MANAGED_CLOUD.endpoint) {
    this.getToken = getToken;
    this.endpoint = endpoint;
  }

  info(): ModelInfo {
    return {
      id: 'managed:navi-cloud',
      name: 'NAVI Cloud',
      capability: 'llm',
      sizeBytes: 0,
      runtime: 'custom',
      required: false,
      status: this.status,
      languages: ['multilingual'],
    };
  }

  /** No-op — managed cloud needs no local download. */
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
    const token = await this.getToken();
    if (!token) {
      throw new ManagedCloudLimitError('not_signed_in', 'Sign in to use NAVI Cloud.');
    }

    this.abortController = new AbortController();
    const timeoutId = setTimeout(() => this.abortController?.abort(), DEFAULT_TIMEOUT);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages,
          temperature: options?.temperature,
          max_tokens: options?.max_tokens,
          top_p: options?.top_p,
        }),
        signal: this.abortController.signal,
      });
      clearTimeout(timeoutId);

      if (response.status === 401) {
        throw new ManagedCloudLimitError('not_signed_in', 'Session expired — please sign in again.');
      }
      // 429/402/503 → an allowance or pool limit; body carries a machine-readable reason.
      if (response.status === 429 || response.status === 402 || response.status === 503) {
        const body = (await response.json().catch(() => ({}))) as {
          reason?: LimitReason;
          message?: string;
        };
        throw new ManagedCloudLimitError(
          body.reason ?? 'daily_cap',
          body.message ??
            "You've reached your free cloud limit. Switch to on-device to keep chatting.",
        );
      }
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`NAVI Cloud error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as { content?: string };
      const content = data.content ?? '';
      // Server is non-streaming for accurate metering; emit once so streaming UIs still update.
      if (options?.stream && options?.onToken && content) {
        options.onToken(content, content);
      }
      return content;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`NAVI Cloud request timed out after ${DEFAULT_TIMEOUT}ms`);
      }
      throw err;
    }
  }
}
