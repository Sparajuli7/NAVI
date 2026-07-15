/**
 * NAVI Agent Framework — Proactive Engine
 *
 * Determines if the avatar should send a proactive message on app open.
 * First match wins — returns a warm opening message or null.
 *
 * Trigger logic:
 *  0. Month-3 retention interventions (session-count heuristic)
 *  1. daysSinceLastSession > 7 → long absence message
 *  2. daysSinceLastSession > 2 → short absence check-in
 *  3. currentStreak milestone (7, 14, 30) → streak celebration
 *  4. strugglingPhrases > 0 && daysSinceLastSession >= 1 → practice nudge
 *  5. null (no proactive message needed)
 */

import type { LearnerProfileStore } from '../memory/learnerProfile';
import type { EpisodicMemoryStore } from '../memory/episodicMemory';
import type { EmotionalMemoryStore } from '../memory/emotionalMemory';
import type { PersonalityDetails } from '../../types/character';
import { promptLoader } from '../prompts/promptLoader';

const STREAK_MILESTONES = [3, 7, 14, 30];

/** Narrative streak messages — these come from the CHARACTER, not the app. */
const STREAK_NARRATIVES: Record<number, string> = {
  3: `Three days in a row — you're building something here.`,
  7: `A full week. Most people give up by day 3.`,
  14: `Two weeks. This isn't a hobby anymore, is it?`,
  30: `A month. I don't even think about whether you'll show up anymore.`,
};

const BACKSTORY_OPENERS = [
  null,
  [
    'I found this amazing little spot near my place the other day — you would love it.',
    'Funny thing happened at the market today. Reminded me of something you said.',
    'The weather here right now... perfect for wandering. You been outside yet?',
  ],
  [
    'You know, I grew up on a street kind of like the one near you. Different city, same chaos.',
    'I was thinking about the first time I really felt like I belonged here. Took longer than I expected.',
    'My neighbor does this thing every morning — I\'ll tell you about it, it\'s become my favorite part of the day.',
  ],
  [
    'I stayed in this city because of a person. Not the reason you think — I\'ll tell you sometime.',
    'There\'s a place I go when things get heavy. I\'ve never actually told anyone about it.',
    'My family doesn\'t totally get why I live here. But every time I walk through the old quarter, I know.',
  ],
  [
    'Can I tell you something I\'ve been thinking about? It\'s not about language.',
    'You remind me of someone I used to know here. That\'s a good thing — I miss them.',
    'I had a moment yesterday where I felt like you\'d be the one person who\'d get it.',
  ],
];

export type Month3Options = {
  avatarId?: string;
  emotional?: EmotionalMemoryStore | null;
  personalityDetails?: PersonalityDetails | null;
  /** Force a specific intervention for tests */
  forceIntervention?: 'journey_reflection' | 'identity_upgrade' | 'unfinished_story';
};

export class ProactiveEngine {
  private firedThisSession = false;
  private lastCompletedScenario: string | null = null;
  private emotional: EmotionalMemoryStore | null = null;
  private month3FiredKey = 'navi_month3_intervention_fired';

  constructor(
    private learner: LearnerProfileStore,
    private episodic: EpisodicMemoryStore,
  ) {}

  setEmotionalMemory(store: EmotionalMemoryStore): void {
    this.emotional = store;
  }

  /**
   * Returns a warm opening message if a proactive trigger is active,
   * or null if no proactive message is needed.
   */
  getProactiveMessage(
    backstoryTier?: number,
    language?: string,
    warmth?: number,
    month3?: Month3Options,
  ): string | null {
    if (this.firedThisSession) return null;

    const stats = this.learner.stats;
    const daysSinceLast = this.daysSince(stats.lastSessionDate);
    const streak = stats.currentStreak;

    let message: string | null = null;

    // 0. Month-3 retention (sessions 60–100, or forced in tests)
    const month3Msg = this.month3Intervention(stats.totalSessions, daysSinceLast, month3);
    if (month3Msg) {
      message = month3Msg;
    }
    // 1. Long absence (> 7 days)
    else if (daysSinceLast > 7) {
      message = this.absenceMessage(warmth ?? 0, daysSinceLast, stats.totalPhrases, stats.longestStreak);
    }
    // 2. Short absence (> 2 days)
    else if (daysSinceLast > 2) {
      message = this.absenceMessage(warmth ?? 0, daysSinceLast, stats.totalPhrases, stats.currentStreak);
    }
    // 3. Streak milestone
    else if (streak > 0 && this.isStreakMilestone(streak)) {
      message = STREAK_NARRATIVES[streak] ?? `${streak}-day streak. You've been showing up — that's the whole game.`;
    }
    // 4. Scenario completion debrief
    else if (this.lastCompletedScenario) {
      const scenario = this.lastCompletedScenario;
      this.lastCompletedScenario = null;
      message = `So that ${scenario} practice — how did it feel? Anything surprise you?`;
    }
    // 5. Backstory disclosure
    else if (backstoryTier && backstoryTier > 0 && Math.random() < 0.2) {
      const tierOpeners = BACKSTORY_OPENERS[backstoryTier];
      if (tierOpeners) {
        message = tierOpeners[Math.floor(Math.random() * tierOpeners.length)];
      }
    }
    // 6. Struggling phrases
    else {
      const struggling = this.learner.getStrugglingPhrases(1, language);
      if (struggling.length > 0 && daysSinceLast >= 1) {
        message = `That phrase we've been working on — want to give it another shot today? No pressure, just checking in.`;
      }
    }

    if (message) this.firedThisSession = true;
    return message;
  }

  markScenarioCompleted(scenarioLabel: string): void {
    this.lastCompletedScenario = scenarioLabel;
  }

  /** Visible for tests — heuristic month-3 window */
  isMonth3Risk(totalSessions: number, daysSinceLast: number): boolean {
    return totalSessions >= 60 && totalSessions <= 100 && daysSinceLast >= 2;
  }

  private month3Intervention(
    totalSessions: number,
    daysSinceLast: number,
    opts?: Month3Options,
  ): string | null {
    const forced = opts?.forceIntervention;
    const inWindow = forced || this.isMonth3Risk(totalSessions, daysSinceLast);
    if (!inWindow) return null;

    // Once per browser until cleared (avoid nagging)
    try {
      if (!forced && typeof localStorage !== 'undefined') {
        const last = localStorage.getItem(this.month3FiredKey);
        if (last && Date.now() - Number(last) < 7 * 24 * 60 * 60 * 1000) return null;
      }
    } catch { /* ignore */ }

    const emotional = opts?.emotional ?? this.emotional;
    const avatarId = opts?.avatarId;
    const contrast = avatarId && emotional
      ? emotional.getJourneyContrast(avatarId)
      : null;

    let kind: 'journey_reflection' | 'identity_upgrade' | 'unfinished_story' = forced
      ?? (daysSinceLast >= 4
        ? 'unfinished_story'
        : totalSessions >= 80
          ? 'identity_upgrade'
          : 'journey_reflection');

    // Prefer unfinished story on longer gaps (month-3 cliff)
    if (!forced && daysSinceLast >= 4) kind = 'unfinished_story';

    const recurring =
      opts?.personalityDetails?.recurring_character
      ?? 'someone I know around here';

    let message: string | null = null;
    try {
      if (kind === 'journey_reflection') {
        const contrastMemory = contrast
          ? `remember when ${contrast.trigger.slice(0, 80)} — and look at you now`
          : 'remember how careful you were with every word at the start — listen to yourself now';
        message = promptLoader.get('systemLayers.month3Interventions.journey_reflection', {
          contrastMemory,
        });
        // Proactive engine returns USER-facing message, not system instruction
        message = contrast
          ? `I've been thinking — ${contrastMemory}. You sound different now. In a good way.`
          : `I've been thinking about how you used to hesitate on every word. Listen to yourself now. You sound like someone who lives here.`;
      } else if (kind === 'identity_upgrade') {
        message = `I'm not going to treat you like a beginner anymore. You're past that. Let's talk like people who belong here.`;
      } else {
        message = `Okay wait — something just happened with ${recurring} and I have to tell you, but not over text. Come talk to me.`;
      }
    } catch {
      message = `I've been thinking about how far you've come. Ready when you are.`;
    }

    try {
      if (!forced && typeof localStorage !== 'undefined') {
        localStorage.setItem(this.month3FiredKey, String(Date.now()));
      }
    } catch { /* ignore */ }

    return message;
  }

  private daysSince(timestamp: number): number {
    return (Date.now() - timestamp) / (24 * 60 * 60 * 1000);
  }

  private isStreakMilestone(streak: number): boolean {
    return STREAK_MILESTONES.includes(streak);
  }

  private absenceMessage(warmth: number, daysSince: number, totalPhrases: number, streakOrLongest: number): string {
    if (warmth >= 0.8) {
      return 'There you are.';
    }
    if (warmth >= 0.6) {
      return `Finally! I have so much to tell you. Also I tried that thing you mentioned and — actually, where have you been?`;
    }
    if (warmth >= 0.4) {
      if (totalPhrases > 0) {
        return `Where have you been? I was starting to wonder. You had ${totalPhrases} phrase${totalPhrases === 1 ? '' : 's'} going — let's not let that fade.`;
      }
      return `Where have you been? I was starting to wonder.`;
    }
    if (warmth >= 0.2) {
      return `Oh, you're back. Been busy?`;
    }
    if (daysSince > 7) {
      if (totalPhrases > 0) {
        return `Hey — you've got ${totalPhrases} phrase${totalPhrases === 1 ? '' : 's'} and ${streakOrLongest > 0 ? `a ${streakOrLongest}-day streak` : 'real momentum'} going. Would be a shame to let that fade. What's been going on?`;
      }
      return `Hey, it's been a while! Life got busy? No pressure — we can ease back in whenever you're ready. What's been going on?`;
    }
    if (totalPhrases > 0 || streakOrLongest > 0) {
      return `You've got ${totalPhrases} phrase${totalPhrases === 1 ? '' : 's'}${streakOrLongest > 0 ? ` and a ${streakOrLongest}-day streak` : ''} building up. Would be a shame to let that slip — pick up where we left off?`;
    }
    return `Hey, haven't heard from you in a couple days — everything good? Whenever you're ready, I'm here.`;
  }
}
