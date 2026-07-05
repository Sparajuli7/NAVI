/**
 * Backend routing logic tests
 *
 * Tests the decision logic for which LLM provider is activated,
 * without instantiating the full NaviAgent (which requires browser APIs).
 *
 * Key invariants:
 * - 'auto' and no saved pref → OpenRouter (production default)
 * - savedBackendPref === 'ollama' → Ollama
 * - savedBackendPref === 'openrouter' → OpenRouter
 * - No client-side API key is ever needed; the proxy handles auth
 */
import { describe, it, expect } from 'vitest';

/**
 * Pure function that mirrors the routing decision in NaviAgent constructor.
 * Extracted here to test in isolation.
 */
function resolveBackend(opts: {
  savedBackendPref: string | null;
}): 'openrouter' | 'ollama' | 'auto' {
  const savedBackendPref = opts.savedBackendPref;

  // Mirror constructor: restore saved pref
  let llmBackend: 'openrouter' | 'ollama' | 'auto' = 'auto';
  if (savedBackendPref === 'openrouter' || savedBackendPref === 'ollama') {
    llmBackend = savedBackendPref as 'openrouter' | 'ollama';
  }

  // 'auto' and 'openrouter' both route to OpenRouter (no client key needed)
  if (llmBackend === 'ollama') return 'ollama';
  return 'openrouter'; // 'auto' → openrouter
}

describe('NaviAgent backend routing', () => {
  it('defaults to openrouter when no saved preference', () => {
    const result = resolveBackend({ savedBackendPref: null });
    expect(result).toBe('openrouter');
  });

  it('uses OpenRouter when user explicitly chose openrouter', () => {
    const result = resolveBackend({ savedBackendPref: 'openrouter' });
    expect(result).toBe('openrouter');
  });

  it('uses Ollama when user explicitly chose ollama', () => {
    const result = resolveBackend({ savedBackendPref: 'ollama' });
    expect(result).toBe('ollama');
  });

  it('unknown saved pref falls back to openrouter', () => {
    const result = resolveBackend({ savedBackendPref: 'webllm' });
    // webllm is no longer a valid backend — treated as 'auto' → openrouter
    expect(result).toBe('openrouter');
  });
});
