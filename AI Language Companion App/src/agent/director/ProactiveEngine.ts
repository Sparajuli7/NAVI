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

export class ProactiveEngine {
  constructor(
    private learner: LearnerProfileStore,
    private episodic: EpisodicMemoryStore,
  ) {}

  /**
   * Returns a warm opening message if a proactive trigger is active,
   * or null if no proactive message is needed.
   * Call this on app open before the user types anything.
   */
  getProactiveMessage(): string | null {
    const stats = this.learner.stats;
    const daysSinceLast = this.daysSince(stats.lastSessionDate);
    const streak = stats.currentStreak;

    // 1. Long absence (> 7 days)
    if (daysSinceLast > 7) {
      return `Hey, it's been a while! Life got busy? No pressure — we can ease back in whenever you're ready. What's been going on?`;
    }

    // 2. Short absence (> 2 days)
    if (daysSinceLast > 2) {
      return `Hey, haven't heard from you in a couple days — everything good? Whenever you're ready, I'm here.`;
    }

    // 3. Streak milestone
    if (streak > 0 && this.isStreakMilestone(streak)) {
      return `🔥 ${streak}-day streak! You've been showing up — that's the whole game.`;
    }

    // 4. Struggling phrases + at least 1 day since last session
    const struggling = this.learner.getStrugglingPhrases(1);
    if (struggling.length > 0 && daysSinceLast >= 1) {
      return `That phrase we've been working on — want to give it another shot today? No pressure, just checking in.`;
    }

    return null;
  }

  // ── Private ────────────────────────────────────────────────────

  private daysSince(timestamp: number): number {
    return (Date.now() - timestamp) / (24 * 60 * 60 * 1000);
  }

  private isStreakMilestone(streak: number): boolean {
    return STREAK_MILESTONES.includes(streak);
  }
}
