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
import type { TrackedPhrase, LearningStageInfo, UserMode, ConversationGoal } from '../core/types';
import { detectPhrases, detectTopics } from '../prompts/phraseDetector';
import { promptLoader } from '../prompts/promptLoader';
import type { SessionPlanner } from './SessionPlanner';
import avatarTemplates from '../../config/avatarTemplates.json';

// ─── Emotional State Detection ──────────────────────────────

export type EmotionalState = 'excited' | 'frustrated' | 'anxious' | 'proud' | 'neutral' | 'confused';

/**
 * Lightweight heuristic to detect user emotional state from message signals.
 * No LLM call — uses punctuation density, message length, caps ratio, emoji
 * presence, and language mix patterns.
 */
function detectEmotionalState(message: string): EmotionalState {
  if (!message || message.trim().length === 0) return 'neutral';

  const trimmed = message.trim();
  const len = trimmed.length;

  // Confusion signals (highest priority — drives confusion override)
  const confusionPatterns = [
    /\bwhat\b\s*\?/i, /\bhuh\b/i, /\bdon'?t understand/i,
    /\bwhat does that mean/i, /\bi'?m lost/i, /\bconfused/i,
    /^\?+$/, /^\.{2,}$/,
  ];
  if (confusionPatterns.some(p => p.test(trimmed))) return 'confused';

  // Frustration signals
  const capsRatio = len > 3 ? (trimmed.match(/[A-Z]/g) ?? []).length / len : 0;
  const hasFrustrationWords = /\bugh\b|\bwhy\b|\bstupid\b|\bcan'?t\b|\bhate\b|\bgave up\b|\bfailed\b|\bwrong\b/i.test(trimmed);
  const isShortTerse = len < 15 && !/[!?😊🎉👏]/.test(trimmed) && /[.…]$/.test(trimmed);
  if (capsRatio > 0.6 && len > 5) return 'frustrated';
  if (hasFrustrationWords && len < 60) return 'frustrated';
  if (isShortTerse && hasFrustrationWords) return 'frustrated';

  // Anxiety signals
  const anxietyPatterns = /\bnervous\b|\bscared\b|\bworried\b|\bafraid\b|\bwhat if\b|\bis it okay\b|\bam i\b.*\bwrong\b|\bdo i look\b|\bwill they\b/i;
  const hasHedging = /\bmaybe\b|\bI think\b|\bI guess\b|\bnot sure\b|\bsorry\b/i.test(trimmed);
  if (anxietyPatterns.test(trimmed)) return 'anxious';
  if (hasHedging && trimmed.includes('?') && len < 80) return 'anxious';

  // Pride signals
  const pridePatterns = /\bi did it\b|\bi said\b|\bthey understood\b|\bit worked\b|\bnailed\b|\bgot it right\b|\bfinally\b/i;
  const hasPositiveEmoji = /[🎉🔥💪😊👏✨🥳]/.test(trimmed);
  if (pridePatterns.test(trimmed)) return 'proud';

  // Excitement signals (includes laughter markers)
  const exclamationCount = (trimmed.match(/!/g) ?? []).length;
  const hasExcitedWords = /\bamazing\b|\bwow\b|\boh my\b|\bso cool\b|\blove\b|\bincredible\b|\bawesome\b/i.test(trimmed);
  const hasLaughter = /\blol\b|\blmao\b|\brofl\b|\bhaha\b|\bhehe\b|\bha{2,}\b|\bhe{2,}\b|😂|🤣/i.test(trimmed);
  if (exclamationCount >= 2 || (hasExcitedWords && hasPositiveEmoji)) return 'excited';
  if (hasLaughter && len > 10) return 'excited';
  if (len > 100 && exclamationCount >= 1) return 'excited';
  if (hasPositiveEmoji && len > 30) return 'excited';

  // Disengagement signal — very short message with no punctuation or emoji
  if (len <= 4 && !/[!?.…😊🎉👏🔥💪✨🥳😂🤣]/.test(trimmed) && /^[a-zA-Z]*$/.test(trimmed)) return 'neutral';

  return 'neutral';
}

/** Map emotional state to a compact calibration instruction */
function emotionalCalibrationInstruction(state: EmotionalState): string | null {
  switch (state) {
    case 'excited':
      return 'USER ENERGY: High — match their excitement. Be enthusiastic back. This is a good moment to push them further.';
    case 'frustrated':
      return 'USER ENERGY: Frustrated — acknowledge it before anything else. Simplify. Give them one easy win. Do NOT pile on new content.';
    case 'anxious':
      return 'USER ENERGY: Anxious — be calm and steady. Give them the ONE phrase they need. Reassure without being patronizing. No challenges right now.';
    case 'proud':
      return 'USER ENERGY: Proud — celebrate what they did specifically. Name the thing they got right. Then channel that confidence into something slightly harder.';
    case 'confused':
      return 'USER ENERGY: Confused — switch to their native language to explain. Then re-anchor with one simple phrase. Do not add new content until they signal understanding.';
    case 'neutral':
      return null;
  }
}

// ─── Types ───────────────────────────────────────────────────

// Re-export from core/types for backward compatibility
export type { ConversationGoal } from '../core/types';

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
  /** Current learning stage info (computed, never stored) */
  learningStage: LearningStageInfo;
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
  private readonly MIN_EXCHANGES_FOR_TIER_CHANGE = 3;

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
    private sessionPlanner?: SessionPlanner,
  ) {
    this.working = working;
  }

  /** Set the situation assessor (called after MemoryManager wires it up) */
  setSituationAssessor(assessor: SituationAssessor): void {
    this.situationAssessor = assessor;
  }

  /** Set the session planner (called from NaviAgent after construction) */
  setSessionPlanner(planner: SessionPlanner): void {
    this.sessionPlanner = planner;
  }

  // ── Pre-Processing ─────────────────────────────────────────

  /**
   * Analyze learner state and build conversation goals + prompt injection.
   * Call this before routing the user's message.
   */
  preProcess(
    message: string,
    avatarId: string,
    options?: {
      isSessionStart?: boolean;
      userMode?: UserMode;
      userNativeLanguage?: string;
      completedScenarios?: number;
      activeScenario?: string;
      previousScenario?: string;
      /** Current target language — scopes phrase queries to this language */
      language?: string;
    },
  ): DirectorContext {
    const goals: ConversationGoal[] = [];
    const goalInstructions: string[] = [];
    // Extract options early to avoid TDZ errors from blocks using them before declaration
    const currentLanguage = options?.language;
    const activeScenario = options?.activeScenario;
    const userMode = options?.userMode ?? null;
    const isGuideMode = userMode === 'guide';

    // 0-pre. Emotional state detection — inject calibration context
    const emotionalState = detectEmotionalState(message);

    // Negotiation of meaning — inject BEFORE confusion calibration
    // so the model tries rephrasing/simpler words before falling back to native language
    if (emotionalState === 'confused') {
      const negotiationText = promptLoader.get('conversationSkills.skills.negotiation_of_meaning.injection');
      if (negotiationText) {
        goalInstructions.push(negotiationText);
      }
    }

    if (emotionalState !== 'neutral') {
      const calibration = emotionalCalibrationInstruction(emotionalState);
      if (calibration) {
        goalInstructions.push(calibration);
      }

      // Emotional mirror — inject alongside calibration for all non-neutral states
      const emotionalMirrorText = promptLoader.get('conversationSkills.skills.emotional_mirror.injection', {
        emotion: emotionalState,
      });
      if (emotionalMirrorText) {
        goalInstructions.push(emotionalMirrorText);
      }

      // Social proof — inject when frustrated or anxious to normalize struggle
      if (emotionalState === 'frustrated' || emotionalState === 'anxious') {
        const socialProofText = promptLoader.get('conversationSkills.skills.social_proof.injection');
        if (socialProofText) {
          goalInstructions.push(socialProofText);
        }
      }
    }

    // Track message count in WorkingMemory for session pacing
    if (this.working) {
      const currentCount = (this.working.get('session_message_count') as number) ?? 0;
      this.working.set('session_message_count', currentCount + 1, 2 * 60 * 60 * 1000); // 2h TTL
    }

    // Scenario phase tracking — increment turn counter when scenario is active
    if (activeScenario && this.working) {
      const scenarioTurnKey = `scenario_turn_${activeScenario}`;
      const currentTurn = ((this.working.get(scenarioTurnKey) as number) ?? 0) + 1;
      this.working.set(scenarioTurnKey, currentTurn, 2 * 60 * 60 * 1000); // 2h TTL

      let phaseHint: string;
      if (currentTurn <= 2) {
        phaseHint = `SCENARIO PHASE: OPENING (turn ${currentTurn}/8) — Set the scene, introduce key phrases for this situation. Ground the user in where they are and what's about to happen.`;
      } else if (currentTurn <= 5) {
        phaseHint = `SCENARIO PHASE: MIDDLE (turn ${currentTurn}/8) — This is the core interaction. Let the user practice. Coach them through the real moments. Correct by recasting, not lecturing.`;
      } else {
        phaseHint = `SCENARIO PHASE: WRAPPING UP (turn ${currentTurn}/8) — Start closing the scenario naturally. Hint that a debrief is coming. If the user hasn't used a key phrase yet, create one last natural opportunity.`;
      }
      goalInstructions.push(phaseHint);
    }

    // Auto-suggest scenarios based on user messages
    if (!activeScenario && !isGuideMode && this.working) {
      const detectedScenarioType = this.detectScenarioFromMessage(message);
      if (detectedScenarioType) {
        goalInstructions.push(
          `SCENARIO SUGGESTION: The user seems to be in a ${detectedScenarioType} situation. Offer to switch into practice mode naturally: "Want to practice ${detectedScenarioType}? I can walk you through it." Don't force it — if the conversation is flowing, just help them with what they need.`,
        );
      }
    }

    // 0. Extract situation signals from the current message BEFORE building context
    // This ensures urgent messages like "I'm at a restaurant right now" get
    // immediate situation-aware responses, not delayed until post-processing.
    if (this.situationAssessor) {
      this.situationAssessor.extractSignals(message).catch(e => console.warn('[NAVI]', e));
    }

    // If mode is 'guide', skip all learning goals — user just needs navigation/translation

    // SESSION GOAL — use persistent session-level intent if available
    let sessionGoalInstruction: string | null = null;
    if (this.sessionPlanner && !isGuideMode) {
      const sessionGoal = this.sessionPlanner.getOrPick(
        avatarId,
        this.learner,
        this.relationships,
        this.episodic,
        currentLanguage,
      );
      if (sessionGoal && !sessionGoal.achieved) {
        goals.push(sessionGoal.type);
        sessionGoalInstruction = sessionGoal.instruction;
      }
    }

    // 0a-pre. Learning stage detection — HIGH priority, shapes the entire interaction
    const interactionCount = this.relationships.getRelationship(avatarId).interactionCount;
    const completedScenarios = options?.completedScenarios ?? 0;
    const stageInfo = this.learner.getCurrentStage(interactionCount, completedScenarios, currentLanguage);
    const userNativeLang = options?.userNativeLanguage || 'English';

    if (!isGuideMode) {
      const stageInstruction = promptLoader.get(`systemLayers.learningStages.${stageInfo.stage}`, {
        userNativeLanguage: userNativeLang,
      });
      if (stageInstruction) {
        goalInstructions.unshift(stageInstruction);
      }
    }

    // 0a. Language calibration — only in learn mode or unset; skip for guide/friend
    const wmTier = this.working?.get(this.WM_KEY) as number | undefined;
    const comfortTier = wmTier !== undefined ? wmTier : this.learner.languageComfortTier;
    const tierKey = `tier_${comfortTier}_${['unknown', 'beginner', 'early', 'intermediate', 'advanced'][comfortTier]}`;
    if (!isGuideMode) {
      const calibrationInstruction = promptLoader.get(`systemLayers.languageCalibration.${tierKey}`);
      if (calibrationInstruction) {
        goalInstructions.push(calibrationInstruction);
      }
    }

    // 0b. Comfort level assessment — only on first interactions
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

    // Avatar mood injection — 40% chance on session start
    if (options?.isSessionStart) {
      const moods = ['cheerful', 'tired', 'nostalgic', 'excited', 'restless', 'contemplative', 'playful'] as const;
      if (Math.random() < 0.4) {
        const mood = moods[Math.floor(Math.random() * moods.length)];
        const moodText = promptLoader.get(`systemLayers.avatarMoods.${mood}`) as string;
        if (moodText) {
          goalInstructions.push(`TODAY'S MOOD: ${moodText}`);
        }
      }
    }

    // Greeting evolution — inject greeting style from current warmth tier on session start
    if (options?.isSessionStart) {
      const relForGreeting = this.relationships.getRelationship(avatarId);
      const warmthLevels = promptLoader.getRaw('warmthLevels.levels') as Array<{ range: [number, number]; label: string; greetingStyle?: string }>;
      if (warmthLevels) {
        const matchedLevel = warmthLevels.find(
          (level) => relForGreeting.warmth >= level.range[0] && relForGreeting.warmth < level.range[1],
        ) ?? warmthLevels[warmthLevels.length - 1];
        if (matchedLevel?.greetingStyle) {
          goalInstructions.push(`GREETING STYLE (based on your relationship): ${matchedLevel.greetingStyle}`);
        }
      }
    }

    // Relationship language stages — HOW the avatar talks evolves with warmth
    {
      const relForLanguage = this.relationships.getRelationship(avatarId);
      const w = relForLanguage.warmth;
      const langStage = w >= 0.8 ? 'stage_5' : w >= 0.6 ? 'stage_4' : w >= 0.4 ? 'stage_3' : w >= 0.2 ? 'stage_2' : 'stage_1';
      const langStageText = promptLoader.get(`systemLayers.relationshipLanguage.${langStage}`);
      if (langStageText) {
        goalInstructions.push(langStageText);
      }
    }

    // Character arc — WHAT the avatar talks about evolves with warmth
    {
      const relForArc = this.relationships.getRelationship(avatarId);
      const w = relForArc.warmth;
      const arcStage = w >= 0.8 ? 'bonded' : w >= 0.55 ? 'deep' : w >= 0.3 ? 'developing' : 'early';
      const arcText = promptLoader.get(`systemLayers.characterArc.${arcStage}`);
      if (arcText) {
        goalInstructions.push(arcText);
      }
    }

    // 0g. World event injection — give the avatar an ongoing life (25% chance per message)
    // 50% environmental event (worldEvents.json), 50% personal ongoing event (avatarTemplates.json)
    if (Math.random() < 0.25) {
      const templateId = this.relationships.getRelationship(avatarId).avatarId;
      const usePersonalEvent = Math.random() < 0.5;

      if (usePersonalEvent) {
        const template = (avatarTemplates as Array<{ id: string; world_events?: string[] }>).find(
          t => templateId?.includes(t.id),
        );
        const personalEvents = template?.world_events;
        if (personalEvents && personalEvents.length > 0) {
          const event = personalEvents[Math.floor(Math.random() * personalEvents.length)];
          goalInstructions.push(
            `YOUR ONGOING LIFE (this is something happening in YOUR life right now — share it naturally as a friend would, not as a teaching exercise. The user should feel like they're part of your world): ${event}`,
          );
        }
      }

      if (!usePersonalEvent || goalInstructions[goalInstructions.length - 1]?.startsWith('YOUR ONGOING') !== true) {
        try {
          const worldEvents = promptLoader.getRaw('worldEvents') as Record<string, string[]> | undefined;
          const categories = worldEvents ? Object.keys(worldEvents).filter(k => k !== '_comment') : [];
          const matchedCategory = categories.find(c => templateId?.includes(c)) ?? categories[Math.floor(Math.random() * categories.length)];
          if (matchedCategory && worldEvents) {
            const events = worldEvents[matchedCategory];
            if (events && events.length > 0) {
              const event = events[Math.floor(Math.random() * events.length)];
              goalInstructions.push(
                `WORLD EVENT (happening right now around you — react to it naturally, use it as a conversation starter or teaching moment): ${event}`,
              );
            }
          }
        } catch { /* worldEvents config not loaded */ }
      }
    }

    // Learning goals — only active in 'learn' mode or blended (null) mode. Skipped in guide/friend.
    if (!isGuideMode) {
      // 1. Check for phrases due for review (spaced repetition + contextual re-introduction)
      const reviewDue = this.learner.getPhrasesForReview(3, currentLanguage);
      if (reviewDue.length > 0) {
        goals.push('review_due_phrases');
        const phrases = reviewDue.map((p) => `"${p.phrase}"`).join(', ');
        goalInstructions.push(
          promptLoader.get('systemLayers.conversationGoals.review_due_phrases', { phrases }),
        );

        const topReview = reviewDue[0];
        const originalContext = (topReview as TrackedPhrase & { context?: string }).context || 'an earlier conversation';
        goalInstructions.push(
          `CONTEXTUAL RE-INTRODUCTION: The user learned "${topReview.phrase}" in ${originalContext}. Re-use it naturally in the CURRENT conversation without announcing you're reviewing. Create a moment where the phrase fits. If they use it, acknowledge briefly.`,
        );
      }

      // 2. Check for struggling phrases
      const struggling = this.learner.getStrugglingPhrases(3, currentLanguage);
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

      // 4. Check for cross-location bridges (scoped to current language)
      const bridges = this.findLocationBridges(avatarId, currentLanguage);
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

    // Variable reward — ~1 in 5 messages, inject a surprise delight moment
    if (Math.random() < 0.2) {
      const variableRewardText = promptLoader.get('conversationSkills.skills.variable_reward.injection');
      if (variableRewardText) {
        goalInstructions.push(variableRewardText);
      }
    }

    // Surprise competence — check WorkingMemory for flag set by postProcess
    if (this.working?.has('surprise_competence')) {
      const surpriseText = promptLoader.get('conversationSkills.skills.surprise_competence.injection');
      if (surpriseText) {
        goalInstructions.push(surpriseText);
      }
      this.working.remove('surprise_competence');
    }

    // Inside joke / shared reference callback — gated by warmth tier
    const callbackRef = this.relationships.getCallbackSuggestion(avatarId);
    if (callbackRef) {
      const refText = typeof callbackRef === 'string' ? callbackRef : (callbackRef as { text?: string }).text ?? String(callbackRef);
      goalInstructions.push(
        `CALLBACK: You remember this about them: "${refText}". Don't announce you remember — just naturally reference it in a way that shows you were paying attention and you CARE. If it was a struggle they shared, check how they're doing with it now. If it was a success, build on it. If it was something they were excited about, ask for an update. The goal is not "I have good memory" — the goal is "I was thinking about you." Weave it in so naturally that the user feels known, not surveilled.`,
      );
    }

    // ── Conversation Skills Activation ─────────────────────────

    const isFunctionalOrHigher = stageInfo.stage === 'functional'
      || stageInfo.stage === 'conversational'
      || stageInfo.stage === 'fluent';

    // language_play — functional+ AND neutral/excited AND 15% random
    if (isFunctionalOrHigher && (emotionalState === 'neutral' || emotionalState === 'excited') && Math.random() < 0.15) {
      const languagePlayText = promptLoader.get('conversationSkills.skills.language_play.injection');
      if (languagePlayText) {
        goalInstructions.push(languagePlayText);
      }
    }

    // productive_failure — functional+ AND no struggling phrases AND not frustrated AND 10% random
    const struggling = goals.includes('revisit_struggling');
    if (isFunctionalOrHigher && !struggling && emotionalState !== 'frustrated' && Math.random() < 0.10) {
      const productiveFailureText = promptLoader.get('conversationSkills.skills.productive_failure.injection');
      if (productiveFailureText) {
        goalInstructions.push(productiveFailureText);
      }
    }

    // register_awareness — when a scenario is active, once per scenario session
    if (activeScenario && this.working) {
      const scenarioSkillKey = `register_awareness_${activeScenario}`;
      if (!this.working.has(scenarioSkillKey)) {
        const registerText = promptLoader.get('conversationSkills.skills.register_awareness.injection');
        if (registerText) {
          goalInstructions.push(registerText);
          this.working.set(scenarioSkillKey, true, 2 * 60 * 60 * 1000);
        }
      }
    }

    // identity_reinforcement — when celebrating progress or milestone detected
    if (goals.includes('celebrate_progress') && isFunctionalOrHigher) {
      const identityText = promptLoader.get('conversationSkills.skills.identity_reinforcement.injection');
      if (identityText) {
        goalInstructions.push(identityText);
      }
    }

    // vulnerability_moment — warmth >= friend (0.4) AND 10% random chance
    {
      const relForVulnerability = this.relationships.getRelationship(avatarId);
      if (relForVulnerability.warmth >= 0.4 && Math.random() < 0.10) {
        const vulnerabilityText = promptLoader.get('conversationSkills.skills.vulnerability_moment.injection');
        if (vulnerabilityText) {
          goalInstructions.push(vulnerabilityText);
        }
      }
    }

    // Emotional learning anchors — teach during emotional peaks for 3-5x retention
    if (emotionalState === 'proud' || emotionalState === 'excited') {
      const prideWords = /did it|said|understood|worked|nailed|got it|they smiled|responded|success/i;
      if (prideWords.test(message)) {
        const victoryText = promptLoader.get('conversationSkills.skills.victory_anchor.injection');
        if (victoryText) goalInstructions.push(victoryText);
      }
    }
    // comfort_anchor: user was frustrated but showing recovery signals
    if (this.working?.has('was_frustrated') && emotionalState !== 'frustrated') {
      const comfortText = promptLoader.get('conversationSkills.skills.comfort_anchor.injection');
      if (comfortText) goalInstructions.push(comfortText);
      this.working.remove('was_frustrated');
    }
    if (emotionalState === 'frustrated' && this.working) {
      this.working.set('was_frustrated', true, 10 * 60 * 1000); // 10 min TTL
    }

    // Milestone celebration — consume flag set by checkMilestones in postProcess
    if (this.working?.has('milestone_celebration')) {
      const celebrationInstruction = this.working.get('milestone_celebration') as string;
      if (celebrationInstruction) {
        goalInstructions.push(celebrationInstruction);
      }
      this.working.remove('milestone_celebration');
    }

    // Mid-conversation reinforcement — refresh behavioral instructions after turn 6
    if (this.working) {
      const sessionMsgCountForReinforce = (this.working.get('session_message_count') as number) ?? 0;
      if (sessionMsgCountForReinforce > 6) {
        goalInstructions.push(
          'REMINDER: Stay in character. Include a sensory detail. End with a hook or question. Keep it short.',
        );
      }
    }

    // session_pacing — when session message count exceeds 8
    if (this.working) {
      const sessionMsgCount = (this.working.get('session_message_count') as number) ?? 0;
      if (sessionMsgCount > 8) {
        goalInstructions.push(
          'SESSION PACING: This conversation has been going for a while (8+ exchanges). Start wrapping up naturally — plant a seed for the next session (a story to continue, a challenge to report back on, something to try before next time). Do NOT announce you are wrapping up. Just let the energy wind down naturally. If the user is still highly engaged, override this and keep going.',
        );
      }
    }

    // ── Remaining Conversation Skills ───────────────────────────

    // expansion — when postProcess detected correct target language production
    if (this.working?.has('expansion_flag')) {
      const expansionText = promptLoader.get('conversationSkills.skills.expansion.injection');
      if (expansionText) {
        goalInstructions.push(expansionText);
      }
      this.working.remove('expansion_flag');
    }

    // elicitation — when a phrase is due for review AND learner is functional+, 30% chance
    if (goals.includes('review_due_phrases') && isFunctionalOrHigher && Math.random() < 0.30) {
      const elicitationText = promptLoader.get('conversationSkills.skills.contextual_repetition.injection', {
        phrase: this.learner.getPhrasesForReview(1, currentLanguage)[0]?.phrase ?? '',
        originalContext: (this.learner.getPhrasesForReview(1, currentLanguage)[0] as TrackedPhrase & { context?: string })?.context || 'an earlier conversation',
      });
      if (elicitationText) {
        goalInstructions.push(elicitationText);
      }
    }

    // open_loop — inject on EVERY message (standing instruction)
    const openLoopText = promptLoader.get('conversationSkills.skills.open_loop.injection');
    if (openLoopText) {
      goalInstructions.push(openLoopText);
    }

    // sensory_anchor — inject every 3rd message (tracked via WorkingMemory counter)
    if (this.working) {
      const sensoryCount = ((this.working.get('sensory_anchor_counter') as number) ?? 0) + 1;
      this.working.set('sensory_anchor_counter', sensoryCount, 2 * 60 * 60 * 1000);
      if (sensoryCount % 3 === 0) {
        const sensoryText = promptLoader.get('conversationSkills.skills.sensory_anchor.injection');
        if (sensoryText) {
          goalInstructions.push(sensoryText);
        }
      }
    }

    // tblt_pretask — inject when a scenario just started
    const previousScenario = options?.previousScenario;
    if (activeScenario && activeScenario !== previousScenario && this.working) {
      const pretaskKey = `tblt_pretask_${activeScenario}`;
      if (!this.working.has(pretaskKey)) {
        const pretaskText = promptLoader.get('conversationSkills.skills.tblt_pretask.injection');
        if (pretaskText) {
          goalInstructions.push(pretaskText);
          this.working.set(pretaskKey, true, 2 * 60 * 60 * 1000);
        }
      }
    }

    // tblt_posttask — inject when a scenario just ended
    if (previousScenario && previousScenario !== activeScenario) {
      const posttaskText = promptLoader.get('conversationSkills.skills.tblt_posttask.injection');
      if (posttaskText) {
        goalInstructions.push(posttaskText);
      }
    }

    // code_switch_scaffold — inject when learning stage differs from last known stage
    if (this.working && !isGuideMode) {
      const lastStage = this.working.get('last_known_stage') as string | undefined;
      if (lastStage && lastStage !== stageInfo.stage) {
        const comfortTierForScaffold = wmTier !== undefined ? wmTier : this.learner.languageComfortTier;
        const scaffoldText = promptLoader.get('conversationSkills.skills.code_switch_scaffold.injection', {
          tier: String(comfortTierForScaffold),
        });
        if (scaffoldText) {
          goalInstructions.push(scaffoldText);
        }
      }
      this.working.set('last_known_stage', stageInfo.stage, 24 * 60 * 60 * 1000);
    }

    // Build context strings (scoped to current language)
    const learningContext = this.learner.formatForPrompt(currentLanguage);
    const warmthInstruction = this.relationships.formatForPrompt(avatarId);
    const personalCtx = this.surfacePersonalContext();
    const allInstructions = [
      sessionGoalInstruction,
      personalCtx || null,
      ...goalInstructions,
    ].filter((x): x is string => Boolean(x));
    const promptInjection = allInstructions.join('\n');
    const situationContext = this.situationAssessor?.formatForPrompt() ?? '';

    return {
      goals,
      promptInjection,
      learningContext,
      warmthInstruction,
      situationContext,
      learningStage: stageInfo,
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
    /** Current target language — stored with detected phrases */
    language?: string,
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
    for (const detected of detectedPhrases) {
      await this.learner.recordPhraseAttempt({
        phrase: detected.phrase,
        language: detected.language ?? language ?? 'unknown',
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

    // 4. Extract situation signals from user message (continuous assessment)
    if (this.situationAssessor) {
      await this.situationAssessor.extractSignals(userMessage);
    }

    // 5. Check for milestones
    await this.checkMilestones(avatarId);

    // 6. Language tier advancement
    await this.assessLanguageTier(userMessage);

    // 7. Surprise competence detection — flag if user produces target language
    // at density above what we'd expect for their comfort tier
    if (this.working) {
      const comfortTier = this.learner.languageComfortTier;
      const nonAsciiCount = (userMessage.match(/[^\x00-\x7F]/g) ?? []).length;
      const msgLen = userMessage.trim().length;
      const nonAsciiRatio = msgLen > 0 ? nonAsciiCount / msgLen : 0;

      let isSurprise = false;
      if (comfortTier <= 1 && nonAsciiRatio > 0.4 && msgLen > 5) {
        isSurprise = true;
      } else if (comfortTier === 2 && nonAsciiRatio > 0.6 && msgLen > 5) {
        isSurprise = true;
      }

      if (isSurprise) {
        this.working.set('surprise_competence', true, 2 * 60 * 1000);
      }
    }

    // 8. Expansion detection — if user produced correct minimal target language
    // (at least 2 non-ASCII chars, message under 30 chars = correct but basic)
    if (this.working) {
      const nonAsciiCount = (userMessage.match(/[^\x00-\x7F]/g) ?? []).length;
      const msgLen = userMessage.trim().length;
      if (nonAsciiCount >= 2 && msgLen < 30 && msgLen > 2) {
        this.working.set('expansion_flag', true, 2 * 60 * 1000);
      }
    }

    // 9. Memorable moment detection — flag for inside joke callbacks
    if (this.working) {
      const emotionalState = detectEmotionalState(userMessage);
      const hasPhraseMistake = detectedPhrases.length > 0 && llmResponse.toLowerCase().includes('actually');
      const isMilestoneInteraction = this.relationships.getRelationship(avatarId).interactionCount % 25 === 0;
      const isSurpriseCompetence = this.working.get('surprise_competence') !== undefined;

      if (emotionalState === 'proud' || emotionalState === 'excited' || hasPhraseMistake || isMilestoneInteraction || isSurpriseCompetence) {
        const momentDesc = emotionalState === 'proud'
          ? `User was proud: "${userMessage.slice(0, 80)}"`
          : hasPhraseMistake
            ? `Funny phrase moment during "${detectedPhrases[0]?.phrase ?? 'conversation'}"`
            : isSurpriseCompetence
              ? `User surprised us with unexpected target language ability`
              : `Milestone: ${this.relationships.getRelationship(avatarId).interactionCount} interactions`;
        this.relationships.addSharedReference(avatarId, momentDesc).catch(e => console.warn('[NAVI]', e));
      }
    }

    // 10. Check if session goal was achieved
    if (this.sessionPlanner) {
      const active = this.sessionPlanner.getActive(avatarId);
      if (active && !active.achieved) {
        const combined = (userMessage + ' ' + llmResponse).toLowerCase();
        if (active.target && combined.includes(active.target.toLowerCase())) {
          this.sessionPlanner.markAchieved(avatarId);
        }
      }
    }
  }

  // ── Proactive Suggestions ──────────────────────────────────

  /**
   * Generate suggestions the UI can display to the user.
   * Call periodically or on session start.
   */
  getSuggestions(avatarId: string, language?: string): string[] {
    const suggestions: string[] = [];

    const reviewDue = this.learner.getPhrasesForReview(2, language);
    for (const phrase of reviewDue) {
      suggestions.push(
        `Review time! You learned "${phrase.phrase}" a while ago — let's practice it.`,
      );
    }

    const weakTopics = this.learner.getWeakTopics(1);
    for (const topic of weakTopics) {
      suggestions.push(
        `You haven't practiced ${topic.topic} recently. Want to work on that?`,
      );
    }

    const stats = this.learner.stats;
    if (stats.currentStreak >= 3) {
      suggestions.push(
        `${stats.currentStreak}-day streak! Keep it going!`,
      );
    }

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

  /**
   * Pull 3 recent episodic memories with high importance and format as a
   * curated personal context block for injection into the system prompt.
   */
  private surfacePersonalContext(): string {
    const recent = this.episodic.getRecent(5);
    if (recent.length === 0) return '';

    const personalOnes = recent
      .filter((ep) => ep.importance >= 0.5)
      .slice(0, 3);

    if (personalOnes.length === 0) return '';

    const lines = personalOnes.map((ep) => `- ${ep.summary}`);
    return `PERSONAL CONTEXT (reference naturally, don't announce you "remember"):\n${lines.join('\n')}`;
  }

  private getNextAssessmentQuestion(): string {
    if (!this.situationAssessor) return ASSESSMENT_QUESTIONS[0];

    const model = this.situationAssessor.getModel();

    if (model.inCountry === null) return ASSESSMENT_QUESTIONS[0];
    if (model.urgency === 'unknown') return ASSESSMENT_QUESTIONS[1];
    if (model.comfortLevel === 'unknown') return ASSESSMENT_QUESTIONS[2];
    if (model.primaryGoal === 'unknown' || !model.nextSituation) return ASSESSMENT_QUESTIONS[3];

    const idx = this.assessmentQuestionIndex % ASSESSMENT_QUESTIONS.length;
    this.assessmentQuestionIndex++;
    return ASSESSMENT_QUESTIONS[idx];
  }

  private findLocationBridges(avatarId: string, language?: string): string | null {
    const rel = this.relationships.getRelationship(avatarId);
    if (rel.interactionCount < 5) return null;

    const phrases = language ? this.learner.getPhrasesForLanguage(language) : this.learner.phrases;
    const locations = new Set(phrases.map((p) => p.learnedAt).filter(Boolean));

    if (locations.size <= 1) return null;

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

  // ── Scenario Detection From Message ──────────────────────

  private static readonly SCENARIO_HINTS: Record<string, string[]> = {
    restaurant: ['restaurant', 'ordering', 'menu', 'waiter', 'eating out', 'dinner', 'lunch', 'cafe'],
    market: ['market', 'haggling', 'bargain', 'shopping', 'buying', 'vendor', 'stall'],
    hospital: ['hospital', 'doctor', 'sick', 'pharmacy', 'medicine', 'emergency', 'clinic'],
    transit: ['taxi', 'bus', 'train', 'metro', 'airport', 'directions', 'getting around'],
    hotel: ['hotel', 'check in', 'check out', 'room', 'reservation', 'hostel'],
    nightlife: ['bar', 'club', 'nightlife', 'drinks', 'going out'],
  };

  private detectScenarioFromMessage(message: string): string | null {
    const lower = message.toLowerCase();
    const situationalCues = /\b(i'?m at|i'?m in|i'?m going to|right now|about to|just arrived|heading to|sitting in|walking into)\b/i;
    if (!situationalCues.test(lower)) return null;

    for (const [scenario, keywords] of Object.entries(ConversationDirector.SCENARIO_HINTS)) {
      if (keywords.some(k => lower.includes(k))) {
        return scenario;
      }
    }
    return null;
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
    } else if (this.consecutiveHelpRequests >= this.TIER_DROP_THRESHOLD && currentTier > 1) {
      await this.learner.setComfortTier(currentTier - 1);
      this.consecutiveHelpRequests = 0;
      this.exchangesSinceTierChange = 0;
    }
  }

  private detectsTargetLanguageUse(message: string): boolean {
    if (!message || message.trim().length < 3) return false;
    const nonAscii = (message.match(/[^\x00-\x7F]/g) ?? []).length;
    if (nonAscii > 2) return true;
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
      this.working?.set('milestone_celebration', 'You just learned your first phrase — that\'s the hardest one. Everything after this is easier.', 5 * 60 * 1000);
    }

    // Phrase count milestones
    const phraseMilestones = [10, 25, 50, 100, 250, 500];
    for (const count of phraseMilestones) {
      if (stats.totalPhrases === count) {
        await this.relationships.addMilestone(avatarId, `Learned ${count} phrases!`);
        this.working?.set('milestone_celebration', `The user just hit ${count} phrases. Celebrate this naturally — they sound like someone who's actually been here a while. Frame it as identity, not achievement: "You've got ${count} phrases now — you're not a tourist anymore."`, 5 * 60 * 1000);
      }
    }

    // Mastery milestones
    const masteryMilestones = [1, 5, 10, 25, 50, 100];
    for (const count of masteryMilestones) {
      if (stats.masteredPhrases === count) {
        if (count === 1) {
          await this.relationships.addMilestone(avatarId, 'Mastered their first phrase!');
          this.working?.set('milestone_celebration', 'The user just MASTERED their first phrase — it\'s locked in. Celebrate briefly: "That one\'s yours now. Nobody can take it back."', 5 * 60 * 1000);
        } else {
          await this.relationships.addMilestone(avatarId, `Mastered ${count} phrases!`);
          this.working?.set('milestone_celebration', `The user has mastered ${count} phrases — these are locked in, not just learned. Frame it as identity: "You've mastered ${count} phrases. That's not a student — that's someone who lives here."`, 5 * 60 * 1000);
        }
      }
    }

    // Streak milestones
    const streakMilestones = [7, 14, 30, 60, 100];
    for (const days of streakMilestones) {
      if (stats.currentStreak === days) {
        await this.relationships.addMilestone(avatarId, `${days}-day learning streak!`);
        this.working?.set('milestone_celebration', `The user has a ${days}-day streak going. Acknowledge it warmly — "${days} days in a row. You're building something real here."`, 5 * 60 * 1000);
      }
    }

    // Interaction milestones
    const interactionMilestones = [25, 50, 100, 250, 500];
    for (const count of interactionMilestones) {
      if (rel.interactionCount === count) {
        await this.relationships.addMilestone(avatarId, `${count} conversations together!`);
      }
    }

    // Stage change detection — celebrate when the user advances to a new learning stage
    if (this.working) {
      const currentStage = this.learner.getCurrentStage(
        rel.interactionCount,
        0,
      ).stage;
      const lastStage = this.working.get('last_milestone_stage') as string | undefined;
      if (lastStage && lastStage !== currentStage) {
        const stageNames: Record<string, string> = {
          survival: 'getting started',
          functional: 'functional — you can handle real situations now',
          conversational: 'conversational — you can actually have conversations here',
          fluent: 'fluent — you sound like you belong',
        };
        const stageName = stageNames[currentStage] || currentStage;
        this.working.set('milestone_celebration', `STAGE ADVANCEMENT: The user just moved from ${lastStage} to ${currentStage}. This is a BIG moment. Celebrate it: "You've moved to ${stageName}. Seriously — I'm impressed."`, 5 * 60 * 1000);
      }
      this.working.set('last_milestone_stage', currentStage, 24 * 60 * 60 * 1000);
    }
  }

}
