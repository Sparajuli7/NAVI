import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProactiveEngine } from './ProactiveEngine';
import type { LearnerProfileStore } from '../memory/learnerProfile';
import type { EpisodicMemoryStore } from '../memory/episodicMemory';

const DAY_MS = 24 * 60 * 60 * 1000;

function makeLearner(overrides: {
  lastSessionDate?: number;
  currentStreak?: number;
  strugglingPhrases?: number;
}): LearnerProfileStore {
  return {
    stats: {
      lastSessionDate: overrides.lastSessionDate ?? Date.now(),
      currentStreak: overrides.currentStreak ?? 0,
      totalPhrases: 0,
      masteredPhrases: 0,
      longestStreak: 0,
      totalSessions: 0,
    },
    getStrugglingPhrases: vi.fn().mockReturnValue(
      Array(overrides.strugglingPhrases ?? 0).fill({ text: 'xin chào' }),
    ),
  } as unknown as LearnerProfileStore;
}

const fakeEpisodic = {} as EpisodicMemoryStore;

describe('ProactiveEngine', () => {
  let engine: ProactiveEngine;

  beforeEach(() => {
    engine = new ProactiveEngine(
      makeLearner({ lastSessionDate: Date.now() - 8 * DAY_MS }),
      fakeEpisodic,
    );
  });

  it('returns a message on first call when 7+ days absent', () => {
    const msg = engine.getProactiveMessage();
    expect(msg).toMatch(/it's been a while/i);
  });

  it('returns null on the second call (session guard)', () => {
    engine.getProactiveMessage(); // first — fires
    const second = engine.getProactiveMessage();
    expect(second).toBeNull();
  });

  it('returns null when last session was today (no trigger)', () => {
    const fresh = new ProactiveEngine(
      makeLearner({ lastSessionDate: Date.now() - 1000 }),
      fakeEpisodic,
    );
    expect(fresh.getProactiveMessage()).toBeNull();
  });

  it('returns short-absence message when 3–7 days absent', () => {
    const eng = new ProactiveEngine(
      makeLearner({ lastSessionDate: Date.now() - 3 * DAY_MS }),
      fakeEpisodic,
    );
    const msg = eng.getProactiveMessage();
    expect(msg).toMatch(/haven't heard from you/i);
  });

  it('returns streak milestone message at day 7', () => {
    const eng = new ProactiveEngine(
      makeLearner({ lastSessionDate: Date.now() - 1000, currentStreak: 7 }),
      fakeEpisodic,
    );
    const msg = eng.getProactiveMessage();
    expect(msg).toMatch(/7-day streak/i);
  });

  it('returns streak milestone message at day 14', () => {
    const eng = new ProactiveEngine(
      makeLearner({ lastSessionDate: Date.now() - 1000, currentStreak: 14 }),
      fakeEpisodic,
    );
    expect(eng.getProactiveMessage()).toMatch(/14-day streak/i);
  });

  it('returns streak milestone message at day 30', () => {
    const eng = new ProactiveEngine(
      makeLearner({ lastSessionDate: Date.now() - 1000, currentStreak: 30 }),
      fakeEpisodic,
    );
    expect(eng.getProactiveMessage()).toMatch(/30-day streak/i);
  });

  it('returns struggling-phrase nudge when phrases present + 1 day absence', () => {
    const eng = new ProactiveEngine(
      makeLearner({ lastSessionDate: Date.now() - DAY_MS - 1000, strugglingPhrases: 2 }),
      fakeEpisodic,
    );
    const msg = eng.getProactiveMessage();
    expect(msg).toMatch(/phrase we've been working on/i);
  });

  it('does NOT return struggling-phrase nudge when last session was today', () => {
    const eng = new ProactiveEngine(
      makeLearner({ lastSessionDate: Date.now() - 1000, strugglingPhrases: 3 }),
      fakeEpisodic,
    );
    expect(eng.getProactiveMessage()).toBeNull();
  });
});
