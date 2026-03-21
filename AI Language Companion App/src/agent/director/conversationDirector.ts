/**
 * NAVI Agent Framework — Conversation Director
 *
 * Orchestrates conversations with learning intent. Runs before and after
 * each message to inject goals and detect outcomes.
 *
 * No extra LLM calls — uses heuristics and the phrase detector.
 *
 * Pre-processing (before routing):
 *   0. Situation assessment — probe new/incomplete users naturally
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
 *   6. Extract situation signals from user message
 *   7. Check for milestones
 */

import type { LearnerProfileStore } from '../memory/learnerProfile';
import type { RelationshipStore } from '../memory/relationshipStore';
import type { EpisodicMemoryStore } from '../memory/episodicMemory';
import type { SituationAssessor } from '../memory/situationAssessor';
import type { WorkingMemory } from '../memory/workingMemory';
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
  | 'free_conversation'
  | 'assess_comfort_level'
  | 'avoid_recent_openers'
  | 'proactive_memory'
  | 'session_opener'
  | 'assess_user';

export interface DirectorContext {
  /** Goals selected for this message */
  goals: ConversationGoal[];
  /** Prompt text to inject into system prompt */
  promptInjection: string;
  /** Learning context string for the avatar */
  learningContext: string;
  /** Warmth instruction for the avatar */
  warmthInstruction: string;
  /** Situation model context for the avatar */
  situationContext: string;
}

// ─── Assessment Question Queue ──────────────────────────────

/** Questions the avatar can naturally weave in to assess the user */
const ASSESSMENT_QUESTIONS = [
  // Are they in-country?
  'Are you here already or still getting ready for the trip?',
  // Urgency
  'So what\'s coming up for you — anything you need to handle soon, or just exploring?',
  // Comfort
  'Have you tried speaking any of the language yet, or starting totally fresh?',
  // Goal / next situation
  'What\'s the first thing you want to be able to do here? Like, what situation are you most nervous about?',
];

// ─── ConversationDirector ────────────────────────────────────

export class ConversationDirector {
  private situationAssessor: SituationAssessor | null = null;
  private assessmentQuestionIndex = 0;

  // Language tier advancement tracking
  private consecutiveTargetLangMessages = 0;
  private consecutiveHelpRequests = 0;
  private exchangesSinceTierChange = 0;
  private readonly TIER_ADVANCE_THRESHOLD = 3;
  private readonly TIER_DROP_THRESHOLD = 2;
  private readonly MIN_EXCHANGES_FOR_TIER_CHANGE = 5;

  // Dynamic language calibration
  private messageWindow: string[] = [];
  private readonly WM_KEY = 'calibration_tier';
  private readonly WM_TTL_MS = 30 * 60 * 1000;
  private working: WorkingMemory | undefined;

  constructor(
    private learner: LearnerProfileStore,
    private relationships: RelationshipStore,
    private episodic: EpisodicMemoryStore,
    working?: WorkingMemory,
  ) {
    this.working = working;
  }

  /** Set the situation assessor (called after MemoryManager wires it up) */
  setSituationAssessor(assessor: SituationAssessor): void {
    this.situationAssessor = assessor;
  }

  // ── Pre-Processing ─────────────────────────────────────────

  /**
   * Analyze learner state and build conversation goals + prompt injection.
   * Call this before routing the user's message.
   */
  preProcess(
    message: string,
    avatarId: string,
    options?: { isSessionStart?: boolean; userMode?: 'learn' | 'guide' | 'friend' | null },
  ): DirectorContext {
    const goals: ConversationGoal[] = [];
    const goalInstructions: string[] = [];

    // 0. Extract situation signals from the current message BEFORE building context
    // This ensures urgent messages like "I'm at a restaurant right now" get
    // immediate situation-aware responses, not delayed until post-processing.
    if (this.situationAssessor) {
      // Fire-and-forget the save — we just need the in-memory model updated
      this.situationAssessor.extractSignals(message).catch(() => {});
    }

    // If mode is 'guide', skip all learning goals — user just needs navigation/translation
    const userMode = options?.userMode ?? null;
    const isGuideMode = userMode === 'guide';

    // 0a. Language calibration — only in learn mode or unset; skip for guide/friend
    const wmTier = this.working?.get(this.WM_KEY) as number | undefined;
    const comfortTier = wmTier !== undefined ? wmTier : this.learner.languageComfortTier;
    const tierKey = `tier_${comfortTier}_${['unknown', 'beginner', 'early', 'intermediate', 'advanced'][comfortTier]}`;
    if (!isGuideMode) {
      try {
        const calibrationInstruction = promptLoader.get(`systemLayers.languageCalibration.${tierKey}`);
        goalInstructions.push(calibrationInstruction);
      } catch {
        // Tier key not found in config — skip calibration injection
      }
    }

    // 0b. Comfort level assessment — only on first interactions
    // Skip if situation assessment is also needed (assess_new_user covers this more naturally)
    const needsAssessment = this.situationAssessor?.needsAssessment() ?? false;
    if (!this.learner.comfortAssessed && this.learner.stats.totalSessions <= 1 && !needsAssessment) {
      goals.push('assess_comfort_level');
      goalInstructions.push(
        promptLoader.get('systemLayers.conversationGoals.assess_comfort_level'),
      );
    }

    // 0c. Opener anti-repetition — inject if we have recent openers
    const recentOpeners = this.learner.recentOpeners;
    if (recentOpeners.length > 0) {
      goals.push('avoid_recent_openers');
      goalInstructions.push(
        promptLoader.get('systemLayers.conversationGoals.avoid_recent_openers', {
          recentOpeners: recentOpeners.map((o) => `"${o}"`).join(', '),
        }),
      );
    }

    // 0d. Situation assessment — for new or incompletely assessed users
    // (needsAssessment already computed above for comfort level check)
    if (needsAssessment) {
      const isNew = this.situationAssessor?.isNewUser() ?? false;
      const question = this.getNextAssessmentQuestion();

      goals.push('assess_user');

      if (isNew) {
        goalInstructions.push(
          promptLoader.get('systemLayers.conversationGoals.assess_new_user', {
            assessmentQuestion: question,
          }),
        );
      } else {
        goalInstructions.push(
          promptLoader.get('systemLayers.conversationGoals.assess_continuing', {
            assessmentQuestion: question,
          }),
        );
      }
    }

    // 0e. Check for proactive memory — things the avatar should bring up
    const recentEpisodes = this.episodic.getRecent(3);
    if (recentEpisodes.length > 0) {
      const memoryContext = recentEpisodes
        .map((ep) => ep.summary)
        .join('; ');
      goals.push('proactive_memory');
      goalInstructions.push(
        promptLoader.get('systemLayers.conversationGoals.proactive_memory', { memoryContext }),
      );
    }

    // 0f. Session opener — if this is the first message in a new session
    if (options?.isSessionStart && recentEpisodes.length === 0 && !needsAssessment) {
      goals.push('session_opener');
      goalInstructions.push(
        promptLoader.get('systemLayers.conversationGoals.session_opener'),
      );
    }

    // Learning goals — only active in 'learn' mode or blended (null) mode. Skipped in guide/friend.
    if (!isGuideMode) {
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
    }

    // Default: free conversation (only if no other goals were set)
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
    const situationContext = this.situationAssessor?.formatForPrompt() ?? '';

    console.log(`[NAVI:director] preProcess goals=[${goals.join(', ')}] assessment=${needsAssessment ? 'active' : 'complete'}`);
    if (warmthInstruction) console.log(`[NAVI:director] warmth: ${warmthInstruction}`);

    return {
      goals,
      promptInjection,
      learningContext,
      warmthInstruction,
      situationContext,
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
    // Rolling window calibration
    this.messageWindow.push(userMessage);
    if (this.messageWindow.length > 5) this.messageWindow = this.messageWindow.slice(-5);
    if (this.working) {
      const tier = this.computeCalibrationTier(this.messageWindow);
      this.working.set(this.WM_KEY, tier, this.WM_TTL_MS);
    }

    // 1. Detect phrases in the response
    const detectedPhrases = detectPhrases(llmResponse);
    if (detectedPhrases.length > 0) {
      console.log(`[NAVI:director] postProcess detected ${detectedPhrases.length} phrases: ${detectedPhrases.map(p => p.phrase).join(', ')}`);
    }
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
    if (topics.length > 0) {
      console.log(`[NAVI:director] postProcess detected topics: ${topics.join(', ')}`);
    }
    for (const topic of topics) {
      await this.learner.updateTopicProficiency(topic, 0.05);
    }

    // 3. Record interaction in relationship store
    await this.relationships.recordInteraction(avatarId);

    // 4. Extract situation signals from user message (continuous assessment)
    if (this.situationAssessor) {
      const changed = await this.situationAssessor.extractSignals(userMessage);
      if (changed) {
        const model = this.situationAssessor.getModel();
        console.log(`[NAVI:director] situation model updated: urgency=${model.urgency} comfort=${model.comfortLevel} goal=${model.primaryGoal} confidence=${model.assessmentConfidence.toFixed(2)}`);
      }
    }

    // 5. Check for milestones
    await this.checkMilestones(avatarId);

    // 6. Language tier advancement — assess user message for target-language use vs help requests
    await this.assessLanguageTier(userMessage);
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

  private getNextAssessmentQuestion(): string {
    if (!this.situationAssessor) return ASSESSMENT_QUESTIONS[0];

    const model = this.situationAssessor.getModel();

    // Pick the question for the most important missing signal
    if (model.inCountry === null) return ASSESSMENT_QUESTIONS[0];
    if (model.urgency === 'unknown') return ASSESSMENT_QUESTIONS[1];
    if (model.comfortLevel === 'unknown') return ASSESSMENT_QUESTIONS[2];
    if (model.primaryGoal === 'unknown' || !model.nextSituation) return ASSESSMENT_QUESTIONS[3];

    // Cycle through if somehow all are filled but confidence is still low
    const idx = this.assessmentQuestionIndex % ASSESSMENT_QUESTIONS.length;
    this.assessmentQuestionIndex++;
    return ASSESSMENT_QUESTIONS[idx];
  }

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

  // ── Dynamic Calibration Helpers ────────────────────────────

  private countTargetLanguageWords(text: string): number {
    return text.split(/\s+/).filter(w => /[^\x00-\x7F]/.test(w) && w.length > 0).length;
  }

  private computeCalibrationTier(messages: string[]): number {
    if (messages.length === 0) return 0;
    const last3 = messages.slice(-3);
    if (last3.every(m => this.countTargetLanguageWords(m) === 0)) return 0;
    const window = messages.slice(-5);
    const avgWords = window.reduce((sum, m) => sum + this.countTargetLanguageWords(m), 0) / window.length;
    const avgNonAsciiRatio = window.reduce((sum, m) => {
      const nonAscii = (m.match(/[^\x00-\x7F]/g) ?? []).length;
      return sum + (m.length > 0 ? nonAscii / m.length : 0);
    }, 0) / window.length;
    if (avgNonAsciiRatio > 0.7 && window.reduce((s, m) => s + m.length, 0) / window.length > 30) return 4;
    if (avgNonAsciiRatio > 0.5) return 3;
    if (avgWords >= 3) return 2;
    if (avgWords >= 1) return 1;
    return 0;
  }

  // ── Language Tier Advancement ───────────────────────────────

  /**
   * Analyze user messages to adaptively advance or drop the language comfort tier.
   * Tier advances when user consistently responds in the target language.
   * Tier drops when user consistently asks for help/translation.
   * Minimum 5 exchanges between any tier change to allow calibration.
   */
  private async assessLanguageTier(userMessage: string): Promise<void> {
    this.exchangesSinceTierChange++;

    const usesTargetLang = this.detectsTargetLanguageUse(userMessage);
    const needsHelp = this.detectsHelpRequest(userMessage);

    if (usesTargetLang) {
      this.consecutiveTargetLangMessages++;
      this.consecutiveHelpRequests = 0;
    } else if (needsHelp) {
      this.consecutiveHelpRequests++;
      this.consecutiveTargetLangMessages = 0;
    } else {
      this.consecutiveTargetLangMessages = 0;
    }

    if (this.exchangesSinceTierChange < this.MIN_EXCHANGES_FOR_TIER_CHANGE) return;

    const currentTier = this.learner.languageComfortTier;

    if (this.consecutiveTargetLangMessages >= this.TIER_ADVANCE_THRESHOLD && currentTier < 4) {
      await this.learner.setComfortTier(currentTier + 1);
      this.consecutiveTargetLangMessages = 0;
      this.exchangesSinceTierChange = 0;
      console.log(`[NAVI:director] Language comfort tier advanced: ${currentTier} → ${currentTier + 1}`);
    } else if (this.consecutiveHelpRequests >= this.TIER_DROP_THRESHOLD && currentTier > 1) {
      await this.learner.setComfortTier(currentTier - 1);
      this.consecutiveHelpRequests = 0;
      this.exchangesSinceTierChange = 0;
      console.log(`[NAVI:director] Language comfort tier dropped: ${currentTier} → ${currentTier - 1}`);
    }
  }

  private detectsTargetLanguageUse(message: string): boolean {
    if (!message || message.trim().length < 3) return false;
    // Non-ASCII characters strongly indicate target-language script use
    const nonAscii = (message.match(/[^\x00-\x7F]/g) ?? []).length;
    if (nonAscii > 2) return true;
    // ASCII message: check it's not a help request
    const lower = message.toLowerCase();
    const helpWords = ['what does', 'how do you say', 'translate', 'in english', 'explain', 'what is'];
    return !helpWords.some((w) => lower.includes(w));
  }

  private detectsHelpRequest(message: string): boolean {
    const lower = message.toLowerCase();
    const patterns = [
      'what does', 'translate', 'how do you say', 'how do i say',
      "don't understand", "i don't understand", 'what did you say',
      'in english', 'what does that mean', 'explain', 'say that again',
    ];
    return patterns.some((p) => lower.includes(p));
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
