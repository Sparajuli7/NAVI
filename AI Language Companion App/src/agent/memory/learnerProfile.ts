/**
 * NAVI Agent Framework — Learner Profile Store
 *
 * Tracks what the user has learned, what they struggle with, and when to revisit.
 * Uses spaced repetition (Leitner-style intervals) for review scheduling.
 *
 * Storage: IndexedDB via idb-keyval. Max 500 phrases.
 */

import type {
  TrackedPhrase,
  TopicProficiency,
  LearnerProfile,
  PhraseAttempt,
  PhraseMastery,
  LearningStage,
  LearningStageInfo,
} from '../core/types';
import { STAGE_SCENARIO_ACCESS } from '../core/types';
import { get, set } from 'idb-keyval';
import { agentBus } from '../core/eventBus';

const STORAGE_KEY = 'navi_learner_profile';
const MAX_PHRASES = 500;

// Spaced repetition intervals (in ms) — legacy single track (kept for reference)
const REVIEW_INTERVALS: Record<PhraseMastery, number> = {
  new: 1 * 24 * 60 * 60 * 1000,        // 1 day
  learning: 3 * 24 * 60 * 60 * 1000,    // 3 days
  practiced: 7 * 24 * 60 * 60 * 1000,   // 7 days
  mastered: 30 * 24 * 60 * 60 * 1000,   // 30 days
};

// Dual SR tracks — struggle path (urgent, shorter intervals)
const STRUGGLE_INTERVALS: Record<PhraseMastery, number> = {
  new:       6 * 60 * 60 * 1000,        // 6 hours (urgent)
  learning:  1 * 24 * 60 * 60 * 1000,   // 1 day
  practiced: 3 * 24 * 60 * 60 * 1000,   // 3 days
  mastered:  14 * 24 * 60 * 60 * 1000,  // 2 weeks
};

// Dual SR tracks — success path (relaxed, longer intervals)
const SUCCESS_INTERVALS: Record<PhraseMastery, number> = {
  new:       2 * 24 * 60 * 60 * 1000,   // 2 days (relaxed)
  learning:  5 * 24 * 60 * 60 * 1000,   // 5 days
  practiced: 14 * 24 * 60 * 60 * 1000,  // 2 weeks
  mastered:  60 * 24 * 60 * 60 * 1000,  // 2 months
};

// How many successful attempts to advance mastery
const MASTERY_THRESHOLDS: Record<PhraseMastery, number> = {
  new: 1,        // 1 practice → learning
  learning: 3,   // 3 practices → practiced
  practiced: 7,  // 7 practices → mastered
  mastered: Infinity,
};

export class LearnerProfileStore {
  private profile: LearnerProfile;
  private loaded = false;

  constructor() {
    this.profile = this.defaultProfile();
  }

  private defaultProfile(): LearnerProfile {
    return {
      phrases: [],
      topics: [],
      languageComfortTier: 1,
      comfortAssessed: false,
      recentOpeners: [],
      stats: {
        totalPhrases: 0,
        masteredPhrases: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastSessionDate: 0,
        totalSessions: 0,
      },
    };
  }

  async load(): Promise<void> {
    const stored = await get<LearnerProfile>(STORAGE_KEY);
    if (stored) {
      this.profile = stored;
    }
    this.loaded = true;
  }

  async save(): Promise<void> {
    await set(STORAGE_KEY, this.profile);
  }

  // ── Phrase Tracking ──────────────────────────────────────────

  /** Record a phrase encounter or practice attempt */
  async recordPhraseAttempt(attempt: PhraseAttempt): Promise<TrackedPhrase> {
    if (!this.loaded) await this.load();

    let tracked = this.profile.phrases.find(
      (p) => p.phrase.toLowerCase() === attempt.phrase.toLowerCase() && p.language === attempt.language,
    );

    if (tracked) {
      // Update existing phrase
      tracked.attemptCount++;
      tracked.lastPracticed = attempt.timestamp;

      // Advance mastery based on outcome
      if (attempt.outcome !== 'struggled') {
        tracked.mastery = this.advanceMastery(tracked.mastery, tracked.attemptCount);
        // Success path — use relaxed intervals
        tracked.nextReviewAt = attempt.timestamp + SUCCESS_INTERVALS[tracked.mastery];
      } else {
        // Struggle — increment struggle count
        tracked.struggleCount = (tracked.struggleCount ?? 0) + 1;
        if (tracked.mastery !== 'new') {
          // Regression on struggle — drop one level
          const levels: PhraseMastery[] = ['new', 'learning', 'practiced', 'mastered'];
          const idx = levels.indexOf(tracked.mastery);
          if (idx > 0) tracked.mastery = levels[idx - 1];
        }
        // Struggle path — use urgent short intervals
        tracked.nextReviewAt = attempt.timestamp + STRUGGLE_INTERVALS[tracked.mastery];
      }
    } else {
      // New phrase
      tracked = {
        phrase: attempt.phrase,
        language: attempt.language,
        mastery: 'new',
        attemptCount: 1,
        firstSeen: attempt.timestamp,
        lastPracticed: attempt.timestamp,
        nextReviewAt: attempt.timestamp + REVIEW_INTERVALS.new,
        learnedAt: attempt.context,
      };
      this.profile.phrases.push(tracked);
      this.profile.stats.totalPhrases++;

      // Evict oldest unmastered phrases if over capacity
      if (this.profile.phrases.length > MAX_PHRASES) {
        this.profile.phrases.sort((a, b) => {
          if (a.mastery === 'mastered' && b.mastery !== 'mastered') return -1;
          if (b.mastery === 'mastered' && a.mastery !== 'mastered') return 1;
          return b.lastPracticed - a.lastPracticed;
        });
        this.profile.phrases = this.profile.phrases.slice(0, MAX_PHRASES);
      }
    }

    // Update mastered count
    this.profile.stats.masteredPhrases = this.profile.phrases.filter(
      (p) => p.mastery === 'mastered',
    ).length;

    agentBus.emit('learner:phrase_detected', { phrase: tracked });
    await this.save();
    return tracked;
  }

  /** Get phrases due for spaced repetition review */
  getPhrasesForReview(limit: number = 5): TrackedPhrase[] {
    const now = Date.now();
    return this.profile.phrases
      .filter((p) => p.nextReviewAt <= now && p.mastery !== 'mastered')
      .sort((a, b) => a.nextReviewAt - b.nextReviewAt)
      .slice(0, limit);
  }

  /** Get phrases the user has struggled with */
  getStrugglingPhrases(limit: number = 5): TrackedPhrase[] {
    return this.profile.phrases
      .filter((p) => p.mastery === 'new' && p.attemptCount >= 2)
      .sort((a, b) => a.lastPracticed - b.lastPracticed)
      .slice(0, limit);
  }

  /**
   * Get struggling phrases on the urgent SR track.
   * These have been marked as 'struggled' at least once and are due for review now.
   * Sorted by nextReviewAt ASC (most overdue first).
   */
  getUrgentReviewPhrases(limit: number = 5): TrackedPhrase[] {
    const now = Date.now();
    return this.profile.phrases
      .filter(
        (p) =>
          p.mastery !== 'mastered' &&
          (p.struggleCount ?? 0) >= 1 &&
          p.nextReviewAt <= now,
      )
      .sort((a, b) => a.nextReviewAt - b.nextReviewAt)
      .slice(0, limit);
  }

  /**
   * Get phrases on the routine SR track (never struggled, due for regular review).
   * Sorted by nextReviewAt ASC (most overdue first).
   */
  getRoutineReviewPhrases(limit: number = 5): TrackedPhrase[] {
    const now = Date.now();
    return this.profile.phrases
      .filter(
        (p) =>
          p.mastery !== 'mastered' &&
          (p.struggleCount ?? 0) === 0 &&
          p.nextReviewAt <= now,
      )
      .sort((a, b) => a.nextReviewAt - b.nextReviewAt)
      .slice(0, limit);
  }

  /** Get phrases learned at a specific location */
  getPhrasesByLocation(location: string): TrackedPhrase[] {
    return this.profile.phrases.filter(
      (p) => p.learnedAt?.toLowerCase().includes(location.toLowerCase()),
    );
  }

  // ── Topic Proficiency ────────────────────────────────────────

  /** Update proficiency for a topic */
  async updateTopicProficiency(topic: string, delta: number): Promise<void> {
    if (!this.loaded) await this.load();

    let existing = this.profile.topics.find((t) => t.topic === topic);
    if (!existing) {
      existing = { topic, score: 0.5, lastPracticed: Date.now(), attemptCount: 0 };
      this.profile.topics.push(existing);
    }

    existing.score = Math.max(0, Math.min(1, existing.score + delta));
    existing.lastPracticed = Date.now();
    existing.attemptCount++;

    await this.save();
  }

  /** Get the weakest topics for the director to target */
  getWeakTopics(count: number = 3): TopicProficiency[] {
    return [...this.profile.topics]
      .sort((a, b) => a.score - b.score)
      .slice(0, count);
  }

  // ── Session & Streak Tracking ────────────────────────────────

  /** Record a new session (call once per app open / conversation start) */
  async recordSession(): Promise<void> {
    if (!this.loaded) await this.load();

    const now = Date.now();
    const lastDate = this.profile.stats.lastSessionDate;
    const dayMs = 24 * 60 * 60 * 1000;

    // Check if this is a new day
    const lastDay = Math.floor(lastDate / dayMs);
    const today = Math.floor(now / dayMs);

    if (today > lastDay) {
      if (today - lastDay === 1) {
        // Consecutive day — extend streak
        this.profile.stats.currentStreak++;
      } else if (lastDay > 0) {
        // Streak broken
        this.profile.stats.currentStreak = 1;
      } else {
        // First session ever
        this.profile.stats.currentStreak = 1;
      }

      this.profile.stats.longestStreak = Math.max(
        this.profile.stats.longestStreak,
        this.profile.stats.currentStreak,
      );
    }

    this.profile.stats.lastSessionDate = now;
    this.profile.stats.totalSessions++;

    // Check for session milestones
    const sessions = this.profile.stats.totalSessions;
    if (sessions === 1 || sessions === 10 || sessions === 50 || sessions === 100) {
      agentBus.emit('learner:milestone', {
        type: 'session_count',
        count: sessions,
      });
    }

    await this.save();
  }

  // ── Prompt Formatting ────────────────────────────────────────

  /** Format learner context for injection into system prompt */
  formatForPrompt(): string {
    const sections: string[] = [];
    const stats = this.profile.stats;

    // Auto-advance comfort tier based on mastered phrases
    this.autoAdvanceComfort();

    if (stats.totalPhrases > 0) {
      sections.push(
        `Learner stats: ${stats.totalPhrases} phrases tracked, ${stats.masteredPhrases} mastered. ` +
        `${stats.currentStreak}-day streak. ${stats.totalSessions} sessions total.`,
      );
    }

    // Recent phrases for context
    const recent = [...this.profile.phrases]
      .sort((a, b) => b.lastPracticed - a.lastPracticed)
      .slice(0, 5);
    if (recent.length > 0) {
      const phraseList = recent
        .map((p) => `"${p.phrase}" (${p.mastery})`)
        .join(', ');
      sections.push(`Recently practiced: ${phraseList}`);
    }

    // Weak topics
    const weak = this.getWeakTopics(2);
    if (weak.length > 0) {
      sections.push(`Areas to improve: ${weak.map((t) => t.topic).join(', ')}`);
    }

    return sections.join('\n');
  }

  // ── Language Comfort & Opener Tracking ───────────────────────

  /**
   * Set the language comfort tier after assessment.
   * 0=unknown, 1=beginner, 2=early, 3=intermediate, 4=advanced
   */
  async setComfortTier(tier: number): Promise<void> {
    if (!this.loaded) await this.load();
    this.profile.languageComfortTier = Math.max(0, Math.min(4, tier));
    this.profile.comfortAssessed = tier > 0;
    await this.save();
  }

  /**
   * Auto-increment comfort tier when evidence of improvement is detected.
   * Advances by 1 tier when mastered phrases cross the next threshold.
   */
  autoAdvanceComfort(): void {
    const mastered = this.profile.stats.masteredPhrases;
    const TIER_THRESHOLDS = [0, 1, 8, 25, 60]; // phrases needed per tier
    const currentTier = this.profile.languageComfortTier;
    if (currentTier < 4 && mastered >= TIER_THRESHOLDS[currentTier + 1]) {
      this.profile.languageComfortTier = currentTier + 1;
      this.profile.comfortAssessed = true;
      // Save is handled by the next recordPhraseAttempt or explicit save
    }
  }

  /**
   * Record a conversation opener to prevent repetition.
   * Keeps the last 5 openers.
   */
  async recordOpener(opener: string): Promise<void> {
    if (!this.loaded) await this.load();
    // Keep a short summary (first 60 chars) to avoid bloat
    const summary = opener.trim().slice(0, 60);
    this.profile.recentOpeners = [summary, ...this.profile.recentOpeners].slice(0, 5);
    await this.save();
  }

  // ── Learning Stage Detection ─────────────────────────────────

  /**
   * Compute the current learning stage from learner metrics.
   *
   * Uses a composite score (0–3) derived from four signals:
   *   1. Total interaction count (from relationship store, passed in)
   *   2. Number of mastered phrases (mastery >= practiced, i.e. practiced + mastered)
   *   3. Language comfort tier (0-4)
   *   4. Scenario completion count (optional, passed in)
   *
   * A user who's had 100 interactions but only mastered 5 phrases stays
   * at SURVIVAL — the composite score prevents gaming any single metric.
   *
   * This is always computed, never stored.
   */
  getCurrentStage(interactionCount: number, completedScenarios: number = 0): LearningStageInfo {
    // Count phrases at 'practiced' or 'mastered' level as "functionally mastered"
    const masteredCount = this.profile.phrases.filter(
      (p) => p.mastery === 'practiced' || p.mastery === 'mastered',
    ).length;

    const comfortTier = this.profile.languageComfortTier; // 0-4

    // Normalize each signal to 0–3 range (matching stage indices)
    // Interaction score: 0-50→0, 50-200→1, 200-500→2, 500+→3
    let interactionScore: number;
    if (interactionCount >= 500) interactionScore = 3;
    else if (interactionCount >= 200) interactionScore = 2 + (interactionCount - 200) / 300;
    else if (interactionCount >= 50) interactionScore = 1 + (interactionCount - 50) / 150;
    else interactionScore = interactionCount / 50;

    // Phrase score: 0-20→0, 20-60→1, 60-150→2, 150+→3
    let phraseScore: number;
    if (masteredCount >= 150) phraseScore = 3;
    else if (masteredCount >= 60) phraseScore = 2 + (masteredCount - 60) / 90;
    else if (masteredCount >= 20) phraseScore = 1 + (masteredCount - 20) / 40;
    else phraseScore = masteredCount / 20;

    // Comfort tier score: 0→0, 1→0.75, 2→1.5, 3→2.25, 4→3
    const comfortScore = comfortTier * 0.75;

    // Scenario score (bonus): each completed scenario adds 0.15, capped at 1.5
    const scenarioScore = Math.min(1.5, completedScenarios * 0.15);

    // Composite: weighted average (interactions and phrases are primary signals)
    // Weights: interactions=0.3, phrases=0.35, comfort=0.25, scenarios=0.1
    const compositeScore = Math.min(3,
      interactionScore * 0.3 +
      phraseScore * 0.35 +
      comfortScore * 0.25 +
      scenarioScore * 0.1,
    );

    // Map composite to stage
    let stage: LearningStage;
    let stageIndex: number;
    if (compositeScore >= 2.5) {
      stage = 'fluent';
      stageIndex = 3;
    } else if (compositeScore >= 1.5) {
      stage = 'conversational';
      stageIndex = 2;
    } else if (compositeScore >= 0.75) {
      stage = 'functional';
      stageIndex = 1;
    } else {
      stage = 'survival';
      stageIndex = 0;
    }

    // Target language density ranges per stage
    const densityRanges: Record<LearningStage, [number, number]> = {
      survival: [0.1, 0.2],
      functional: [0.3, 0.5],
      conversational: [0.6, 0.8],
      fluent: [0.85, 0.95],
    };

    return {
      stage,
      index: stageIndex,
      targetLanguageDensity: densityRanges[stage],
      availableScenarios: STAGE_SCENARIO_ACCESS[stage],
      compositeScore,
    };
  }

  // ── Accessors ────────────────────────────────────────────────

  get phrases(): TrackedPhrase[] {
    return this.profile.phrases;
  }

  get topics(): TopicProficiency[] {
    return this.profile.topics;
  }

  get stats(): LearnerProfile['stats'] {
    return this.profile.stats;
  }

  get languageComfortTier(): number {
    return this.profile.languageComfortTier;
  }

  get comfortAssessed(): boolean {
    return this.profile.comfortAssessed;
  }

  get recentOpeners(): string[] {
    return this.profile.recentOpeners;
  }

  async clear(): Promise<void> {
    this.profile = this.defaultProfile();
    await this.save();
  }

  // ── Private ──────────────────────────────────────────────────

  private advanceMastery(current: PhraseMastery, attemptCount: number): PhraseMastery {
    const levels: PhraseMastery[] = ['new', 'learning', 'practiced', 'mastered'];
    const idx = levels.indexOf(current);
    if (idx >= levels.length - 1) return current;
    if (attemptCount >= MASTERY_THRESHOLDS[current]) {
      return levels[idx + 1];
    }
    return current;
  }
}
