import { describe, it, expect, beforeEach, vi } from 'vitest';

const memory = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: async (key: string) => memory.get(key),
  set: async (key: string, value: unknown) => { memory.set(key, value); },
}));

import {
  detectThreadCandidates,
  computeThreadPriority,
  formatThreadsForPrompt,
  ConversationThreadStore,
} from './conversationThreads';
import type { ConversationThread } from '../core/types';

describe('conversationThreads helpers', () => {
  it('detects story open loops from avatar response', () => {
    const found = detectThreadCandidates(
      'cool',
      "I'll tell you later about what happened with the neighbor...",
      'av1',
    );
    expect(found.some((t) => t.type === 'story')).toBe(true);
  });

  it('detects project intents', () => {
    const found = detectThreadCandidates(
      "I'm going to try ordering in French tomorrow",
      'Nice, you should try the bakery on the corner',
      'av1',
    );
    expect(found.some((t) => t.type === 'project')).toBe(true);
  });

  it('detects debates when both disagree', () => {
    const found = detectThreadCandidates(
      "I don't think ketchup belongs on pho",
      'No way — I disagree, some people love it',
      'av1',
    );
    expect(found.some((t) => t.type === 'debate')).toBe(true);
  });

  it('prioritizes active debates over dormant rituals', () => {
    const debate: ConversationThread = {
      id: '1',
      type: 'debate',
      summary: 'ketchup fight',
      openQuestion: 'who won?',
      createdAt: Date.now(),
      lastReferencedAt: Date.now(),
      sessionCount: 1,
      emotionalWeight: 0.7,
      status: 'active',
      avatarId: 'av1',
      associatedTerms: [],
    };
    const ritual: ConversationThread = {
      ...debate,
      id: '2',
      type: 'ritual',
      status: 'dormant',
      emotionalWeight: 0.3,
      lastReferencedAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
    };
    expect(computeThreadPriority(debate)).toBeGreaterThan(computeThreadPriority(ritual));
  });

  it('formats prompt with Praktika-safe language note', () => {
    const text = formatThreadsForPrompt([{
      id: '1',
      type: 'story',
      summary: 'neighbor drama',
      openQuestion: 'what next?',
      createdAt: Date.now(),
      lastReferencedAt: Date.now(),
      sessionCount: 1,
      emotionalWeight: 0.5,
      status: 'active',
      avatarId: 'av1',
      associatedTerms: [],
    }]);
    expect(text).toMatch(/ACTIVE CONVERSATION THREADS/);
    expect(text).toMatch(/user's language/i);
  });
});

describe('ConversationThreadStore', () => {
  let store: ConversationThreadStore;

  beforeEach(async () => {
    memory.clear();
    store = new ConversationThreadStore();
    await store.load();
    await store.clear();
  });

  it('dedupes near-identical summaries', async () => {
    await store.add({
      type: 'story',
      summary: 'The neighbor finally moved out after the fight',
      openQuestion: 'then what?',
      emotionalWeight: 0.5,
      avatarId: 'av1',
      associatedTerms: [],
    });
    await store.add({
      type: 'story',
      summary: 'The neighbor finally moved out after the fight — again',
      openQuestion: 'then what?',
      emotionalWeight: 0.5,
      avatarId: 'av1',
      associatedTerms: [],
    });
    expect(store.getActive('av1').length).toBe(1);
  });

  it('returns top threads by priority', async () => {
    await store.add({
      type: 'ritual',
      summary: 'morning coffee chat',
      openQuestion: 'same as usual?',
      emotionalWeight: 0.2,
      avatarId: 'av1',
      associatedTerms: [],
    });
    await store.add({
      type: 'debate',
      summary: 'best pho broth',
      openQuestion: 'still disagree?',
      emotionalWeight: 0.8,
      avatarId: 'av1',
      associatedTerms: [],
    });
    const top = store.topThreads('av1', 1);
    expect(top[0].type).toBe('debate');
  });
});
