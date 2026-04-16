/**
 * NAVI Agent Framework — Proactive Engine
 *
 * Determines if the avatar should send a proactive message on app open.
 * First match wins — returns a warm opening message or null.
 *
 * Trigger logic:
 *  1. daysSinceLastSession > 7 → long absence message
 *  2. daysSinceLastSession > 2 → short absence check-in
 *  3. currentStreak milestone (7, 14, 30) → streak celebration
 *  4. strugglingPhrases > 0 && daysSinceLastSession >= 1 → practice nudge
 *  5. null (no proactive message needed)
 */

import type { LearnerProfileStore } from '../memory/learnerProfile';
import type { EpisodicMemoryStore } from '../memory/episodicMemory';

const STREAK_MILESTONES = [7, 14, 30];

/** Backstory disclosure messages the avatar can share at each tier */
const BACKSTORY_OPENERS = [
  // tier 0 — no backstory
  null,
  // tier 1 — surface-level daily life
  [
    'I found this amazing little spot near my place the other day — you would love it.',
    'Funny thing happened at the market today. Reminded me of something you said.',
    'The weather here right now... perfect for wandering. You been outside yet?',
  ],
  // tier 2 — casual personal stories
  [
    'You know, I grew up on a street kind of like the one near you. Different city, same chaos.',
    'I was thinking about the first time I really felt like I belonged here. Took longer than I expected.',
    'My neighbor does this thing every morning — I\'ll tell you about it, it\'s become my favorite part of the day.',
  ],
  // tier 3 — real personal things
  [
    'I stayed in this city because of a person. Not the reason you think — I\'ll tell you sometime.',
    'There\'s a place I go when things get heavy. I\'ve never actually told anyone about it.',
    'My family doesn\'t totally get why I live here. But every time I walk through the old quarter, I know.',
  ],
  // tier 4 — deep/vulnerable
  [
    'Can I tell you something I\'ve been thinking about? It\'s not about language.',
    'You remind me of someone I used to know here. That\'s a good thing — I miss them.',
    'I had a moment yesterday where I felt like you\'d be the one person who\'d get it.',
  ],
];

export class ProactiveEngine {
  /** Prevents the proactive message from firing more than once per app session. */
  private firedThisSession = false;
  /** Track last completed scenario for debrief hooks */
  private lastCompletedScenario: string | null = null;

  constructor(
    private learner: LearnerProfileStore,
    private episodic: EpisodicMemoryStore,
  ) {}

  /**
   * Returns a warm opening message if a proactive trigger is active,
   * or null if no proactive message is needed.
   * Call this on app open before the user types anything.
   * Guaranteed to return a non-null value at most once per session.
   */
  getProactiveMessage(backstoryTier?: number): string | null {
    if (this.firedThisSession) return null;

    const stats = this.learner.stats;
    const daysSinceLast = this.daysSince(stats.lastSessionDate);
    const streak = stats.currentStreak;

    let message: string | null = null;

    // 1. Long absence (> 7 days)
    if (daysSinceLast > 7) {
      message = `Hey, it's been a while! Life got busy? No pressure — we can ease back in whenever you're ready. What's been going on?`;
    }
    // 2. Short absence (> 2 days)
    else if (daysSinceLast > 2) {
      message = `Hey, haven't heard from you in a couple days — everything good? Whenever you're ready, I'm here.`;
    }
    // 3. Streak milestone
    else if (streak > 0 && this.isStreakMilestone(streak)) {
      message = `${streak}-day streak! You've been showing up — that's the whole game.`;
    }
    // 4. Scenario completion debrief
    else if (this.lastCompletedScenario) {
      const scenario = this.lastCompletedScenario;
      this.lastCompletedScenario = null;
      message = `So that ${scenario} practice — how did it feel? Anything surprise you?`;
    }
    // 5. Backstory disclosure (gated by tier, ~20% chance per eligible session)
    else if (backstoryTier && backstoryTier > 0 && Math.random() < 0.2) {
      const tierOpeners = BACKSTORY_OPENERS[backstoryTier];
      if (tierOpeners) {
        message = tierOpeners[Math.floor(Math.random() * tierOpeners.length)];
      }
    }
    // 6. Struggling phrases + at least 1 day since last session
    else {
      const struggling = this.learner.getStrugglingPhrases(1);
      if (struggling.length > 0 && daysSinceLast >= 1) {
        message = `That phrase we've been working on — want to give it another shot today? No pressure, just checking in.`;
      }
    }

    if (message) this.firedThisSession = true;
    return message;
  }

  // ── Scenario Completion Hook ──────────────────────────────────

  /**
   * Call when a scenario session ends. The next proactive message will
   * include a debrief hook for this scenario.
   */
  markScenarioCompleted(scenarioLabel: string): void {
    this.lastCompletedScenario = scenarioLabel;
  }

  // ── Private ────────────────────────────────────────────────────

  private daysSince(timestamp: number): number {
    return (Date.now() - timestamp) / (24 * 60 * 60 * 1000);
  }

  private isStreakMilestone(streak: number): boolean {
    return STREAK_MILESTONES.includes(streak);
  }
}
