/**
 * NAVI Agent Framework — Conversation Director
 *
 * Orchestrates conversations with learning intent. Runs before and after
 * each message to inject goals and detect outcomes.
 *
 * No extra LLM calls — uses heuristics and the phrase detector.
 *
 * Pre-processing (before routing):
 *   1. Check for phrases due for spaced repetition review
 *   2. Check for struggling phrases to revisit
 *   3. Check for weak topics to target
 *   4. Check for cross-location bridges
 *   5. Check for relationship milestones
 *   6. Build prompt injection string with conversation goals
 *
 * Post-processing (after LLM response):
 *   1. Run phraseDetector on response
 *   2. Record detected phrases in learnerProfile
 *   3. Detect topics via keyword matching
 *   4. Update topic proficiency
 *   5. Record interaction in relationshipStore
 *   6. Check for milestones
 */

import type { LearnerProfileStore } from '../memory/learnerProfile';
import type { RelationshipStore } from '../memory/relationshipStore';
import type { EpisodicMemoryStore } from '../memory/episodicMemory';
import type { TrackedPhrase } from '../core/types';
import { detectPhrases, detectTopics } from '../prompts/phraseDetector';
import { promptLoader } from '../prompts/promptLoader';

// ─── Types ───────────────────────────────────────────────────

export type ConversationGoal =
  | 'introduce_new_vocab'
  | 'revisit_struggling'
  | 'review_due_phrases'
  | 'challenge_user'
  | 'celebrate_progress'
  | 'bridge_locations'
  | 'free_conversation';

export interface DirectorContext {
  /** Goals selected for this message */
  goals: ConversationGoal[];
  /** Prompt text to inject into system prompt */
  promptInjection: string;
  /** Learning context string for the avatar */
  learningContext: string;
  /** Warmth instruction for the avatar */
  warmthInstruction: string;
}

// ─── ConversationDirector ────────────────────────────────────

export class ConversationDirector {
  constructor(
    private learner: LearnerProfileStore,
    private relationships: RelationshipStore,
    private episodic: EpisodicMemoryStore,
  ) {}

  // ── Pre-Processing ─────────────────────────────────────────

  /**
   * Analyze learner state and build conversation goals + prompt injection.
   * Call this before routing the user's message.
   */
  preProcess(message: string, avatarId: string): DirectorContext {
    const goals: ConversationGoal[] = [];
    const goalInstructions: string[] = [];

    // 1. Check for phrases due for review (spaced repetition)
    const reviewDue = this.learner.getPhrasesForReview(3);
    if (reviewDue.length > 0) {
      goals.push('review_due_phrases');
      const phrases = reviewDue.map((p) => `"${p.phrase}"`).join(', ');
      goalInstructions.push(
        promptLoader.get('systemLayers.conversationGoals.review_due_phrases', { phrases }),
      );
    }

    // 2. Check for struggling phrases
    const struggling = this.learner.getStrugglingPhrases(3);
    if (struggling.length > 0) {
      goals.push('revisit_struggling');
      const phrases = struggling.map((p) => `"${p.phrase}"`).join(', ');
      goalInstructions.push(
        promptLoader.get('systemLayers.conversationGoals.revisit_struggling', { phrases }),
      );
    }

    // 3. Check weak topics
    const weakTopics = this.learner.getWeakTopics(2);
    if (weakTopics.length > 0 && !goals.includes('review_due_phrases')) {
      goals.push('introduce_new_vocab');
      const topics = weakTopics.map((t) => t.topic).join(', ');
      goalInstructions.push(
        promptLoader.get('systemLayers.conversationGoals.introduce_new_vocab', { topics }),
      );
    }

    // 4. Check for cross-location bridges
    const bridges = this.findLocationBridges(avatarId);
    if (bridges) {
      goals.push('bridge_locations');
      goalInstructions.push(
        promptLoader.get('systemLayers.conversationGoals.bridge_locations', { bridges }),
      );
    }

    // 5. Check for relationship milestones
    const rel = this.relationships.getRelationship(avatarId);
    if (rel.interactionCount > 0 && rel.interactionCount % 25 === 0) {
      goals.push('celebrate_progress');
      goalInstructions.push(
        promptLoader.get('systemLayers.conversationGoals.celebrate_progress'),
      );
    }

    // 6. Challenge advanced users
    const stats = this.learner.stats;
    if (stats.masteredPhrases >= 10 && goals.length === 0) {
      goals.push('challenge_user');
      goalInstructions.push(
        promptLoader.get('systemLayers.conversationGoals.challenge_user'),
      );
    }

    // Default: free conversation
    if (goals.length === 0) {
      goals.push('free_conversation');
      goalInstructions.push(
        promptLoader.get('systemLayers.conversationGoals.free_conversation'),
      );
    }

    // Build context strings
    const learningContext = this.learner.formatForPrompt();
    const warmthInstruction = this.relationships.formatForPrompt(avatarId);
    const promptInjection = goalInstructions.join('\n');

    return {
      goals,
      promptInjection,
      learningContext,
      warmthInstruction,
    };
  }

  // ── Post-Processing ────────────────────────────────────────

  /**
   * Analyze the LLM response and update learner/relationship state.
   * Call this after getting the LLM response.
   */
  async postProcess(
    userMessage: string,
    llmResponse: string,
    toolUsed: string,
    avatarId: string,
  ): Promise<void> {
    // 1. Detect phrases in the response
    const detectedPhrases = detectPhrases(llmResponse);
    for (const detected of detectedPhrases) {
      await this.learner.recordPhraseAttempt({
        phrase: detected.phrase,
        language: detected.language ?? 'unknown',
        timestamp: Date.now(),
        context: toolUsed,
        outcome: 'learned',
      });
    }

    // 2. Detect topics
    const topics = detectTopics(userMessage + ' ' + llmResponse);
    for (const topic of topics) {
      await this.learner.updateTopicProficiency(topic, 0.05);
    }

    // 3. Record interaction in relationship store
    await this.relationships.recordInteraction(avatarId);

    // 4. Check for milestones
    await this.checkMilestones(avatarId);
  }

  // ── Proactive Suggestions ──────────────────────────────────

  /**
   * Generate suggestions the UI can display to the user.
   * Call periodically or on session start.
   */
  getSuggestions(avatarId: string): string[] {
    const suggestions: string[] = [];

    // Review due phrases
    const reviewDue = this.learner.getPhrasesForReview(2);
    for (const phrase of reviewDue) {
      suggestions.push(
        `Review time! You learned "${phrase.phrase}" a while ago — let's practice it.`,
      );
    }

    // Weak topics
    const weakTopics = this.learner.getWeakTopics(1);
    for (const topic of weakTopics) {
      suggestions.push(
        `You haven't practiced ${topic.topic} recently. Want to work on that?`,
      );
    }

    // Streak encouragement
    const stats = this.learner.stats;
    if (stats.currentStreak >= 3) {
      suggestions.push(
        `${stats.currentStreak}-day streak! Keep it going!`,
      );
    }

    // Relationship milestone upcoming
    const rel = this.relationships.getRelationship(avatarId);
    const nextMilestone = Math.ceil(rel.interactionCount / 25) * 25;
    if (nextMilestone - rel.interactionCount <= 5) {
      suggestions.push(
        `You're almost at ${nextMilestone} conversations together!`,
      );
    }

    return suggestions.slice(0, 3);
  }

  // ── Private Helpers ────────────────────────────────────────

  private findLocationBridges(avatarId: string): string | null {
    const rel = this.relationships.getRelationship(avatarId);
    if (rel.interactionCount < 5) return null; // Too early for bridges

    // Look for phrases learned in other locations
    const phrases = this.learner.phrases;
    const locations = new Set(phrases.map((p) => p.learnedAt).filter(Boolean));

    if (locations.size <= 1) return null;

    // Build bridge text from cross-location phrases
    const bridgeParts: string[] = [];
    for (const location of locations) {
      const locationPhrases = phrases
        .filter((p) => p.learnedAt === location)
        .slice(0, 2);
      if (locationPhrases.length > 0) {
        const phraseList = locationPhrases.map((p) => `"${p.phrase}"`).join(', ');
        bridgeParts.push(`In ${location}: ${phraseList}`);
      }
    }

    return bridgeParts.length > 1 ? bridgeParts.join('. ') : null;
  }

  private async checkMilestones(avatarId: string): Promise<void> {
    const stats = this.learner.stats;
    const rel = this.relationships.getRelationship(avatarId);

    // First phrase learned
    if (stats.totalPhrases === 1) {
      await this.relationships.addMilestone(avatarId, 'Learned their first phrase!');
    }

    // Phrase count milestones
    const phraseMilestones = [10, 25, 50, 100, 250, 500];
    for (const count of phraseMilestones) {
      if (stats.totalPhrases === count) {
        await this.relationships.addMilestone(avatarId, `Learned ${count} phrases!`);
      }
    }

    // Mastery milestones
    if (stats.masteredPhrases === 1) {
      await this.relationships.addMilestone(avatarId, 'Mastered their first phrase!');
    }

    // Streak milestones
    const streakMilestones = [7, 14, 30, 60, 100];
    for (const days of streakMilestones) {
      if (stats.currentStreak === days) {
        await this.relationships.addMilestone(avatarId, `${days}-day learning streak!`);
      }
    }

    // Interaction milestones
    const interactionMilestones = [25, 50, 100, 250, 500];
    for (const count of interactionMilestones) {
      if (rel.interactionCount === count) {
        await this.relationships.addMilestone(avatarId, `${count} conversations together!`);
      }
    }
  }
}
