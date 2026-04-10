/**
 * Backend routing logic tests
 *
 * Tests the decision logic for which LLM provider is activated,
 * without instantiating the full NaviAgent (which requires browser APIs).
 *
 * The key invariant: VITE_OPENROUTER_API_KEY in the build env must NOT
 * silently activate OpenRouter when the user hasn't explicitly chosen it.
 * Only savedBackendPref === 'openrouter' should trigger cloud routing.
 */
import { describe, it, expect } from 'vitest';

/**
 * Pure function that mirrors the routing decision in NaviAgent constructor
 * (lines 319–339 of agent/index.ts). Extracted here to test in isolation.
 */
function resolveBackend(opts: {
  envKey: string | undefined;
  savedBackendPref: string | null;
  savedORKey: string;
}): 'openrouter' | 'webllm' | 'ollama' | 'auto' {
  const rawKey = opts.envKey;
  const savedORKey = opts.savedORKey;
  const savedBackendPref = opts.savedBackendPref;

  // Mirror constructor lines 299–315
  let llmBackend: 'openrouter' | 'webllm' | 'ollama' | 'auto' = 'auto';
  if (savedBackendPref === 'webllm' || savedBackendPref === 'openrouter') {
    llmBackend = savedBackendPref as 'webllm' | 'openrouter';
  }

  // Mirror lines 319–329 (FIXED condition: === 'openrouter' not !== 'webllm')
  const openRouterKeys = rawKey
    ? rawKey.split(',').map(k => k.trim()).filter(Boolean)
    : savedORKey ? [savedORKey] : [];

  if (openRouterKeys.length > 0 && llmBackend === 'openrouter') {
    return 'openrouter';
  }

  if (llmBackend === 'ollama') return 'ollama';

  // 'webllm' or 'auto' both default to local inference
  return llmBackend === 'webllm' ? 'webllm' : 'auto';
}

describe('NaviAgent backend routing', () => {
  it('defaults to auto (WebLLM) when env key present but no saved preference', () => {
    const result = resolveBackend({
      envKey: 'sk-or-test-key',
      savedBackendPref: null,
      savedORKey: '',
    });
    // 'auto' resolves to WebLLM — NOT openrouter
    expect(result).toBe('auto');
    expect(result).not.toBe('openrouter');
  });

  it('uses OpenRouter when user explicitly chose openrouter + env key present', () => {
    const result = resolveBackend({
      envKey: 'sk-or-test-key',
      savedBackendPref: 'openrouter',
      savedORKey: '',
    });
    expect(result).toBe('openrouter');
  });

  it('uses OpenRouter when user chose openrouter + only localStorage key (no env)', () => {
    const result = resolveBackend({
      envKey: undefined,
      savedBackendPref: 'openrouter',
      savedORKey: 'sk-or-stored-key',
    });
    expect(result).toBe('openrouter');
  });

  it('uses WebLLM when user explicitly chose webllm, even if env key is present', () => {
    const result = resolveBackend({
      envKey: 'sk-or-test-key',
      savedBackendPref: 'webllm',
      savedORKey: '',
    });
    expect(result).toBe('webllm');
  });

  it('uses WebLLM when no preference and no keys at all', () => {
    const result = resolveBackend({
      envKey: undefined,
      savedBackendPref: null,
      savedORKey: '',
    });
    expect(result).toBe('auto');
  });

  it('does NOT use OpenRouter when env key present but preference is null', () => {
    // Regression test for the original bug: env key + no pref → was wrongly activating OpenRouter
    const withEnvKey = resolveBackend({ envKey: 'sk-key', savedBackendPref: null, savedORKey: '' });
    const withoutEnvKey = resolveBackend({ envKey: undefined, savedBackendPref: null, savedORKey: '' });
    expect(withEnvKey).toBe(withoutEnvKey); // env key must have no effect without explicit pref
  });
});
