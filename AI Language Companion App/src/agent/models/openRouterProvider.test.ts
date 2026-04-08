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
    it('accepts a string key and defaults to FALLBACK_MODELS', () => {
      const p = new OpenRouterProvider('key1');
      expect(p.isReady()).toBe(true);
      // 8 models means 8 total attempts with 1 key
      // (we verify this indirectly via retry count tests)
    });

    it('accepts an array of keys', () => {
      const p = new OpenRouterProvider(['key1', 'key2'], ['model-a']);
      expect(p.isReady()).toBe(true);
    });

    it('is always ready (no download needed)', async () => {
      const p = new OpenRouterProvider('key1');
      expect(p.isReady()).toBe(true);
      await p.load(); // no-op
      expect(p.isReady()).toBe(true);
    });
  });

  // ── Happy path ───────────────────────────────────────────────────────────────
  describe('successful responses', () => {
    it('returns content on first attempt', async () => {
      global.fetch = vi.fn().mockReturnValue(okResponse('Xin chào!'));
      const p = new OpenRouterProvider('key1', ['model-a']);

      const promise = p.chat([{ role: 'user', content: 'hi' }]);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('Xin chào!');
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('sends Authorization header with Bearer token', async () => {
      global.fetch = vi.fn().mockReturnValue(okResponse('hi'));
      const p = new OpenRouterProvider('my-secret-key', ['model-a']);

      const promise = p.chat([{ role: 'user', content: 'test' }]);
      await vi.runAllTimersAsync();
      await promise;

      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect((init as RequestInit).headers).toBeDefined();
      const headers = init.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer my-secret-key');
    });

    it('passes temperature and max_tokens to the API', async () => {
      global.fetch = vi.fn().mockReturnValue(okResponse('ok'));
      const p = new OpenRouterProvider('key1', ['model-a']);

      const promise = p.chat([{ role: 'user', content: 'test' }], { temperature: 0.3, max_tokens: 200 });
      await vi.runAllTimersAsync();
      await promise;

      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.temperature).toBe(0.3);
      expect(body.max_tokens).toBe(200);
    });
  });

  // ── Retry / rotation ─────────────────────────────────────────────────────────
  describe('retry and model rotation', () => {
    it('retries with next model on 429 and succeeds', async () => {
      global.fetch = vi.fn()
        .mockReturnValueOnce(errResponse(429))
        .mockReturnValue(okResponse('Hello from model-b'));

      const p = new OpenRouterProvider('key1', ['model-a', 'model-b']);
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

      const p = new OpenRouterProvider('key1', ['model-a', 'model-b']);
      const promise = p.chat([{ role: 'user', content: 'hi' }]);
      await vi.runAllTimersAsync();

      expect(await promise).toBe('Works now');
    });

    it('retries on 502 (bad gateway)', async () => {
      global.fetch = vi.fn()
        .mockReturnValueOnce(errResponse(502))
        .mockReturnValue(okResponse('ok'));

      const p = new OpenRouterProvider('key1', ['m1', 'm2']);
      const promise = p.chat([{ role: 'user', content: 'hi' }]);
      await vi.runAllTimersAsync();

      expect(await promise).toBe('ok');
    });

    it('retries on 402 (payment required) instead of crashing', async () => {
      global.fetch = vi.fn()
        .mockReturnValueOnce(errResponse(402, 'insufficient credits'))
        .mockReturnValue(okResponse('ok'));

      const p = new OpenRouterProvider('key1', ['m1', 'm2']);
      const promise = p.chat([{ role: 'user', content: 'hi' }]);
      await vi.runAllTimersAsync();

      expect(await promise).toBe('ok');
    });

    it('tries all key×model combinations before giving up', async () => {
      global.fetch = vi.fn().mockReturnValue(errResponse(429));

      const p = new OpenRouterProvider(['k1', 'k2'], ['m1', 'm2']); // 4 total
      // Register rejects expectation BEFORE flushing timers to avoid unhandled rejection
      const chatPromise = p.chat([{ role: 'user', content: 'hi' }]);
      const assertion = expect(chatPromise).rejects.toThrow('high demand');
      await vi.runAllTimersAsync();
      await assertion;

      expect(fetch).toHaveBeenCalledTimes(4); // 2 keys × 2 models
    });

    it('throws "high demand" after exhausting 1 key × 8 FALLBACK_MODELS', async () => {
      global.fetch = vi.fn().mockReturnValue(errResponse(503));

      const p = new OpenRouterProvider('single-key'); // uses all 8 FALLBACK_MODELS
      const chatPromise = p.chat([{ role: 'user', content: 'hi' }]);
      const assertion = expect(chatPromise).rejects.toThrow('high demand');
      await vi.runAllTimersAsync();
      await assertion;

      expect(fetch).toHaveBeenCalledTimes(FALLBACK_MODELS.length); // 1 × 8
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

      const p = new OpenRouterProvider('key1', ['m1', 'm2']);
      const promise = p.chat([{ role: 'user', content: 'hi' }]);
      await vi.runAllTimersAsync();

      expect(await promise).toBe('Non-empty response');
    });
  });

  // ── Non-retryable errors ─────────────────────────────────────────────────────
  describe('non-retryable errors', () => {
    it('throws immediately on 401 (unauthorized) without retrying', async () => {
      global.fetch = vi.fn().mockReturnValue(errResponse(401, 'invalid key'));

      const p = new OpenRouterProvider('bad-key', ['m1', 'm2', 'm3']);
      const chatPromise = p.chat([{ role: 'user', content: 'hi' }]);
      const assertion = expect(chatPromise).rejects.toThrow('401');
      await vi.runAllTimersAsync();
      await assertion;

      expect(fetch).toHaveBeenCalledTimes(1); // no retry
    });

    it('throws immediately on 403 (forbidden)', async () => {
      global.fetch = vi.fn().mockReturnValue(errResponse(403, 'forbidden'));

      const p = new OpenRouterProvider('key1', ['m1', 'm2']);
      const chatPromise = p.chat([{ role: 'user', content: 'hi' }]);
      const assertion = expect(chatPromise).rejects.toThrow('403');
      await vi.runAllTimersAsync();
      await assertion;

      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  // ── setApiKeys / setModels ────────────────────────────────────────────────────
  describe('runtime key and model replacement', () => {
    it('uses new key after setApiKeys()', async () => {
      global.fetch = vi.fn().mockReturnValue(okResponse('ok'));
      const p = new OpenRouterProvider('old-key', ['m1']);
      p.setApiKeys('new-key');

      const promise = p.chat([{ role: 'user', content: 'hi' }]);
      await vi.runAllTimersAsync();
      await promise;

      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer new-key');
    });

    it('uses new models after setModels()', async () => {
      global.fetch = vi.fn().mockReturnValue(okResponse('ok'));
      const p = new OpenRouterProvider('key1', ['old-model']);
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
