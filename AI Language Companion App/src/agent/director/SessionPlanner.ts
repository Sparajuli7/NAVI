/**
 * NAVI Agent Framework — Session Planner
 *
 * Picks ONE learning goal per conversation session and holds it across all
 * turns via WorkingMemory. This is the "spine" that gives conversations
 * persistent intent — instead of recalculating goals every message, the
 * session goal is decided once and kept for 2 hours.
 *
 * Priority order:
 *  1. Phrases due for review (urgent SR)
 *  2. Struggling phrases (repeated fails)
 *  3. Returning user (days since last session > 2) → reconnect
 *  4. Weak topics (score < 0.35)
 *  5. Advanced user with no other goals → challenge
 *  6. Milestone approaching (interactionCount % 25 == 0)
 *  7. Default → free_conversation
 */

import type { LearnerProfileStore } from '../memory/learnerProfile';
import type { RelationshipStore } from '../memory/relationshipStore';
import type { EpisodicMemoryStore } from '../memory/episodicMemory';
import type { WorkingMemory } from '../memory/workingMemory';
import type { ConversationGoal } from './ConversationDirector';

// ─── Types ─────────────────────────────────────────────────────

export interface SessionGoal {
  /** Which goal type was selected */
  type: ConversationGoal;
  /** Target phrase text, topic name, etc. */
  target?: string;
  /** Injected into the system prompt */
  instruction: string;
  /** What postProcess() looks for to mark "achieved" */
  successCriteria: string;
  /** Timestamp when picked */
  pickedAt: number;
  /** Whether the goal has been achieved this session */
  achieved: boolean;
}

const SESSION_GOAL_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

// ─── SessionPlanner ────────────────────────────────────────────

export class SessionPlanner {
  constructor(private working: WorkingMemory) {}

  /**
   * Get the current session goal, or pick a new one if none exists.
   * Uses WorkingMemory with a 2-hour TTL so the goal persists across turns.
   */
  getOrPick(
    avatarId: string,
    learner: LearnerProfileStore,
    relationships: RelationshipStore,
    episodic: EpisodicMemoryStore,
    /** EXP-053: Current target language — scopes phrase queries */
    language?: string,
  ): SessionGoal {
    const key = `session_goal_${avatarId}`;

    // Return existing session goal if still active
    const existing = this.working.get(key) as SessionGoal | undefined;
    if (existing) {
      return existing;
    }

    // Pick a new goal using priority order
    const goal = this.pickGoal(avatarId, learner, relationships, episodic, language);
    this.working.set(key, goal, SESSION_GOAL_TTL_MS);
    console.log(`[NAVI:session] goal picked: ${goal.type}${goal.target ? ` (target: ${goal.target})` : ''}`);
    return goal;
  }

  /**
   * Mark the current session goal as achieved.
   */
  markAchieved(avatarId: string): void {
    const key = `session_goal_${avatarId}`;
    const existing = this.working.get(key) as SessionGoal | undefined;
    if (existing) {
      const updated: SessionGoal = { ...existing, achieved: true };
      this.working.set(key, updated, SESSION_GOAL_TTL_MS);
      console.log(`[NAVI:session] goal achieved: ${existing.type}`);
    }
  }

  /**
   * Get the current session goal without picking a new one.
   * Returns null if there is no active goal.
   */
  getActive(avatarId: string): SessionGoal | null {
    const key = `session_goal_${avatarId}`;
    return (this.working.get(key) as SessionGoal | undefined) ?? null;
  }

  // ── Private ────────────────────────────────────────────────────

  private pickGoal(
    avatarId: string,
    learner: LearnerProfileStore,
    relationships: RelationshipStore,
    episodic: EpisodicMemoryStore,
    language?: string,
  ): SessionGoal {
    const now = Date.now();

    // 1. Phrases due for review (urgent spaced repetition)
    // EXP-053: Scope to current language
    const duePhrases = learner.getPhrasesForReview(1, language);
    if (duePhrases.length > 0) {
      const phrase = duePhrases[0];
      return {
        type: 'review_due_phrases',
        target: phrase.phrase,
        instruction: `This phrase is due for review: '${phrase.phrase}'. Weave it into this conversation naturally — use it yourself, then pause and see if the user engages with it.`,
        successCriteria: phrase.phrase,
        pickedAt: now,
        achieved: false,
      };
    }

    // 2. Struggling phrases (mastery=new, attempts>=2)
    // EXP-053: Scope to current language
    const struggling = learner.getStrugglingPhrases(1, language);
    if (struggling.length > 0) {
      const phrase = struggling[0];
      return {
        type: 'revisit_struggling',
        target: phrase.phrase,
        instruction: `The user has tried this phrase before but struggles: '${phrase.phrase}'. Find a natural moment to bring it up and help them get it right this time. Be encouraging — they've seen it before.`,
        successCriteria: phrase.phrase,
        pickedAt: now,
        achieved: false,
      };
    }

    // 3. Returning user — days since last session > 2
    const rel = relationships.getRelationship(avatarId);
    const daysSinceLast = this.daysSince(rel.lastInteraction);
    if (daysSinceLast > 2) {
      return {
        type: 'free_conversation',
        instruction: `The user hasn't chatted in a few days. Open warmly, check in on what's been happening, and ease back in gently. No pressure to learn — just reconnect first.`,
        successCriteria: '',
        pickedAt: now,
        achieved: false,
      };
    }

    // 4. Weak topics (score < 0.35)
    const weakTopics = learner.getWeakTopics(3).filter((t) => t.score < 0.35);
    if (weakTopics.length > 0) {
      const topic = weakTopics[0].topic;
      return {
        type: 'introduce_new_vocab',
        target: topic,
        instruction: `Work some vocabulary around '${topic}' into this conversation naturally. Don't announce it — just find a moment where it fits.`,
        successCriteria: topic,
        pickedAt: now,
        achieved: false,
      };
    }

    // 5. Advanced user with many mastered phrases and no other goals
    const stats = learner.stats;
    if (stats.masteredPhrases >= 10) {
      return {
        type: 'challenge_user',
        instruction: `The user is ready for more. Don't just give harder vocabulary — push them toward a real-world micro-action. Suggest one small thing they could actually try in the next hour: a phrase to use at the counter, a question to ask a local, a social risk worth taking. Keep it achievable. Tell them to report back.`,
        successCriteria: '',
        pickedAt: now,
        achieved: false,
      };
    }

    // 6. Milestone approaching (interactionCount % 25 == 0 and > 0)
    if (rel.interactionCount > 0 && rel.interactionCount % 25 === 0) {
      return {
        type: 'celebrate_progress',
        instruction: `The user has been showing up and doing the work. Don't just celebrate vocabulary — celebrate who they're becoming. Reference a specific moment or situation they handled. Connect it to the future: they're someone who moves through this place differently now than when they started. Be genuinely proud, not performatively cheerful.`,
        successCriteria: '',
        pickedAt: now,
        achieved: false,
      };
    }

    // 7. Default: free conversation
    return {
      type: 'free_conversation',
      instruction: `Have a natural conversation in your language. Follow the user's lead but stay in your language. Be the local friend, not the tutor.`,
      successCriteria: '',
      pickedAt: now,
      achieved: false,
    };
  }

  private daysSince(timestamp: number): number {
    return (Date.now() - timestamp) / (24 * 60 * 60 * 1000);
  }
}
