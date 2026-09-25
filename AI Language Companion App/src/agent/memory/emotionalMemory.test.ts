import { describe, it, expect, beforeEach, vi } from 'vitest';

const memory = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: async (key: string) => memory.get(key),
  set: async (key: string, value: unknown) => { memory.set(key, value); },
}));

import {
  scoreEmotionalPeak,
  computeReferenceability,
  pickEmotionalReference,
  inferResolution,
  EmotionalMemoryStore,
} from './emotionalMemory';
import type { EmotionalMemory } from '../core/types';

function makeMemory(overrides: Partial<EmotionalMemory> = {}): EmotionalMemory {
  return {
    id: 'em_1',
    timestamp: Date.now() - 14 * 24 * 60 * 60 * 1000,
    sessionNumber: 5,
    emotion: 'pride',
    valence: 'positive',
    intensity: 0.8,
    trigger: 'nailed a phrase at the market',
    userQuote: 'I did it they understood me',
    avatarResponse: 'Yes!',
    resolution: 'resolved_positive',
    avatarId: 'av1',
    location: 'Paris',
    associatedPhrases: [],
    callbackCount: 0,
    hasBeenNarrativized: false,
    ...overrides,
  };
}

describe('emotionalMemory helpers', () => {
  it('scores pride as breakthrough peak', () => {
    const peak = scoreEmotionalPeak('proud', 'I did it! They understood me finally!!');
    expect(peak).not.toBeNull();
    expect(peak!.emotion).toBe('breakthrough');
    expect(peak!.valence).toBe('positive');
    expect(peak!.intensity).toBeGreaterThanOrEqual(0.3);
  });

  it('returns null for neutral', () => {
    expect(scoreEmotionalPeak('neutral', 'okay sure')).toBeNull();
  });

  it('never picks unresolved negative without contrast', () => {
    const neg = makeMemory({
      emotion: 'frustration',
      valence: 'negative',
      resolution: 'unresolved',
      intensity: 0.9,
    });
    const ref = pickEmotionalReference([neg], 'frustrated', false);
    expect(ref).toBeNull();
  });

  it('allows contrast callback when past struggle resolved positively', () => {
    const past = makeMemory({
      emotion: 'frustration',
      valence: 'negative',
      resolution: 'resolved_positive',
      intensity: 0.9,
      timestamp: Date.now() - 20 * 24 * 60 * 60 * 1000,
    });
    const ref = pickEmotionalReference([past], 'frustrated', false);
    expect(ref).not.toBeNull();
    expect(ref!.trigger).toBe('contrast');
    expect(ref!.injection).toMatch(/EMOTIONAL CALLBACK/);
  });

  it('respects once-per-session guard', () => {
    const past = makeMemory({ valence: 'positive', intensity: 0.9 });
    expect(pickEmotionalReference([past], 'excited', true)).toBeNull();
  });

  it('decays referenceability after callbacks', () => {
    const fresh = makeMemory({ callbackCount: 0 });
    const used = makeMemory({ callbackCount: 3, lastReferencedAt: Date.now() - 10 * 24 * 60 * 60 * 1000 });
    expect(computeReferenceability(fresh)).toBeGreaterThan(computeReferenceability(used));
  });

  it('infers resolved_positive for warm replies to negative valence', () => {
    expect(inferResolution('frustration', 'negative', "You've got this, we'll get it together")).toBe(
      'resolved_positive',
    );
  });
});

describe('EmotionalMemoryStore', () => {
  let store: EmotionalMemoryStore;

  beforeEach(async () => {
    memory.clear();
    store = new EmotionalMemoryStore();
    await store.load();
    await store.clear();
  });

  it('caps at 50 memories keeping highest intensity', async () => {
    for (let i = 0; i < 55; i++) {
      await store.add({
        timestamp: Date.now(),
        sessionNumber: i,
        emotion: 'joy',
        valence: 'positive',
        intensity: i / 55,
        trigger: `t${i}`,
        userQuote: `q${i}`,
        avatarResponse: 'ok',
        resolution: 'resolved_positive',
        avatarId: 'av1',
        location: '',
        associatedPhrases: [],
      });
    }
    expect(store.getForAvatar('av1').length).toBe(50);
    expect(store.getForAvatar('av1')[0].intensity).toBeGreaterThan(0.8);
  });

  it('marks referenced and increments callbackCount', async () => {
    const m = await store.add({
      timestamp: Date.now() - 20 * 24 * 60 * 60 * 1000,
      sessionNumber: 1,
      emotion: 'pride',
      valence: 'positive',
      intensity: 0.9,
      trigger: 'win',
      userQuote: 'I did it',
      avatarResponse: 'nice',
      resolution: 'resolved_positive',
      avatarId: 'av1',
      location: '',
      associatedPhrases: [],
    });
    await store.markReferenced('av1', m.id);
    expect(store.getForAvatar('av1')[0].callbackCount).toBe(1);
  });
});
