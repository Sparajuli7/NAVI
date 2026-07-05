import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenRouterProvider, FALLBACK_MODELS } from './openRouterProvider';

// Helper to build a successful fetch response
function okResponse(content: string) {
  return Promise.resolve({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({ choices: [{ message: { content } }] }),
    text: async () => '',
  } as unknown as Response);
}

// Helper to build a failed fetch response
function errResponse(status: number, body = '') {
  return Promise.resolve({
    ok: false,
    status,
    headers: new Headers(),
    json: async () => ({}),
    text: async () => body,
  } as unknown as Response);
}

describe('OpenRouterProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ── Constructor defaults ──────────────────────────────────────────────────────
  describe('constructor', () => {
    it('defaults to PRIMARY + FALLBACK when no models provided', () => {
      const p = new OpenRouterProvider();
      expect(p.isReady()).toBe(true);
    });

    it('accepts an array of models', () => {
      const p = new OpenRouterProvider(['model-a', 'model-b']);
      expect(p.isReady()).toBe(true);
    });

    it('is always ready (no download needed)', async () => {
      const p = new OpenRouterProvider();
      expect(p.isReady()).toBe(true);
      await p.load(); // no-op
      expect(p.isReady()).toBe(true);
    });
  });

  // ── Happy path ───────────────────────────────────────────────────────────────
  describe('successful responses', () => {
    it('returns content on first attempt', async () => {
      global.fetch = vi.fn().mockReturnValue(okResponse('Xin chào!'));
      const p = new OpenRouterProvider(['model-a']);

      const promise = p.chat([{ role: 'user', content: 'hi' }]);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('Xin chào!');
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('does NOT send an Authorization header (proxy handles auth)', async () => {
      global.fetch = vi.fn().mockReturnValue(okResponse('hi'));
      const p = new OpenRouterProvider(['model-a']);

      const promise = p.chat([{ role: 'user', content: 'test' }]);
      await vi.runAllTimersAsync();
      await promise;

      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers['Authorization']).toBeUndefined();
    });

    it('passes temperature and max_tokens to the API', async () => {
      global.fetch = vi.fn().mockReturnValue(okResponse('ok'));
      const p = new OpenRouterProvider(['model-a']);

      const promise = p.chat([{ role: 'user', content: 'test' }], { temperature: 0.3, max_tokens: 200 });
      await vi.runAllTimersAsync();
      await promise;

      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.temperature).toBe(0.3);
      expect(body.max_tokens).toBe(200);
    });

    it('calls /api/chat (the local proxy), never openrouter.ai directly', async () => {
      global.fetch = vi.fn().mockReturnValue(okResponse('ok'));
      const p = new OpenRouterProvider(['model-a']);

      const promise = p.chat([{ role: 'user', content: 'test' }]);
      await vi.runAllTimersAsync();
      await promise;

      const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe('/api/chat');
      expect(url).not.toContain('openrouter.ai');
    });
  });

  // ── Retry / rotation ─────────────────────────────────────────────────────────
  describe('retry and model rotation', () => {
    it('retries with next model on 429 and succeeds', async () => {
      global.fetch = vi.fn()
        .mockReturnValueOnce(errResponse(429))
        .mockReturnValue(okResponse('Hello from model-b'));

      const p = new OpenRouterProvider(['model-a', 'model-b']);
      const promise = p.chat([{ role: 'user', content: 'hi' }]);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('Hello from model-b');
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('retries on 503 (service unavailable)', async () => {
      global.fetch = vi.fn()
        .mockReturnValueOnce(errResponse(503, 'overloaded'))
        .mockReturnValue(okResponse('Works now'));

      const p = new OpenRouterProvider(['model-a', 'model-b']);
      const promise = p.chat([{ role: 'user', content: 'hi' }]);
      await vi.runAllTimersAsync();

      expect(await promise).toBe('Works now');
    });

    it('retries on 502 (bad gateway)', async () => {
      global.fetch = vi.fn()
        .mockReturnValueOnce(errResponse(502))
        .mockReturnValue(okResponse('ok'));

      const p = new OpenRouterProvider(['m1', 'm2']);
      const promise = p.chat([{ role: 'user', content: 'hi' }]);
      await vi.runAllTimersAsync();

      expect(await promise).toBe('ok');
    });

    it('tries all models before giving up', async () => {
      global.fetch = vi.fn().mockReturnValue(errResponse(429));

      const p = new OpenRouterProvider(['m1', 'm2']); // 2 models total
      const chatPromise = p.chat([{ role: 'user', content: 'hi' }]);
      const assertion = expect(chatPromise).rejects.toThrow('high demand');
      await vi.runAllTimersAsync();
      await assertion;

      expect(fetch).toHaveBeenCalledTimes(2); // 2 models tried
    });

    it('throws "high demand" after exhausting all FALLBACK_MODELS', async () => {
      global.fetch = vi.fn().mockReturnValue(errResponse(503));

      const p = new OpenRouterProvider(); // uses default PRIMARY + FALLBACK = 2 models
      const chatPromise = p.chat([{ role: 'user', content: 'hi' }]);
      const assertion = expect(chatPromise).rejects.toThrow('high demand');
      await vi.runAllTimersAsync();
      await assertion;
    });

    it('throws "high demand" after exhausting explicit FALLBACK_MODELS list', async () => {
      global.fetch = vi.fn().mockReturnValue(errResponse(503));

      const p = new OpenRouterProvider(FALLBACK_MODELS);
      const chatPromise = p.chat([{ role: 'user', content: 'hi' }]);
      const assertion = expect(chatPromise).rejects.toThrow('high demand');
      await vi.runAllTimersAsync();
      await assertion;

      expect(fetch).toHaveBeenCalledTimes(FALLBACK_MODELS.length);
    });

    it('retries on empty response and succeeds on next model', async () => {
      global.fetch = vi.fn()
        .mockReturnValueOnce(Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ choices: [{ message: { content: '' } }] }),
          text: async () => '',
        } as unknown as Response))
        .mockReturnValue(okResponse('Non-empty response'));

      const p = new OpenRouterProvider(['m1', 'm2']);
      const promise = p.chat([{ role: 'user', content: 'hi' }]);
      await vi.runAllTimersAsync();

      expect(await promise).toBe('Non-empty response');
    });
  });

  // ── Non-retryable errors ─────────────────────────────────────────────────────
  describe('non-retryable errors', () => {
    it('throws immediately on 401 (unauthorized) without retrying', async () => {
      global.fetch = vi.fn().mockReturnValue(errResponse(401, 'invalid key'));

      const p = new OpenRouterProvider(['m1', 'm2', 'm3']);
      const chatPromise = p.chat([{ role: 'user', content: 'hi' }]);
      const assertion = expect(chatPromise).rejects.toThrow('401');
      await vi.runAllTimersAsync();
      await assertion;

      expect(fetch).toHaveBeenCalledTimes(1); // no retry
    });

    it('throws immediately on 403 (forbidden)', async () => {
      global.fetch = vi.fn().mockReturnValue(errResponse(403, 'forbidden'));

      const p = new OpenRouterProvider(['m1', 'm2']);
      const chatPromise = p.chat([{ role: 'user', content: 'hi' }]);
      const assertion = expect(chatPromise).rejects.toThrow('403');
      await vi.runAllTimersAsync();
      await assertion;

      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  // ── setApiKeys / setModels ────────────────────────────────────────────────────
  describe('runtime model replacement', () => {
    it('setApiKeys() is a no-op (key lives server-side)', async () => {
      global.fetch = vi.fn().mockReturnValue(okResponse('ok'));
      const p = new OpenRouterProvider(['m1']);
      p.setApiKeys('any-key'); // should not throw or change behavior

      const promise = p.chat([{ role: 'user', content: 'hi' }]);
      await vi.runAllTimersAsync();
      await promise;

      // Still no auth header
      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers['Authorization']).toBeUndefined();
    });

    it('uses new models after setModels()', async () => {
      global.fetch = vi.fn().mockReturnValue(okResponse('ok'));
      const p = new OpenRouterProvider(['old-model']);
      p.setModels(['new-model-a', 'new-model-b']);

      const promise = p.chat([{ role: 'user', content: 'hi' }]);
      await vi.runAllTimersAsync();
      await promise;

      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.model).toBe('new-model-a');
    });
  });
});
