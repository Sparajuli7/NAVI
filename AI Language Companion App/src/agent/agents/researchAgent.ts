/**
 * NAVI Agent Framework — Research Agent
 *
 * Sub-agent that holds evidence-based language learning protocols
 * and recommends which to apply for the current conversation turn.
 *
 * Protocols are loaded from learningProtocols.json (config-driven,
 * editable without code changes).
 *
 * Design: Pure heuristic — zero LLM calls. Protocol selection is
 * based on user state signals (frustration, passivity, struggle patterns,
 * comfort tier, etc.). The output is an interpolated instruction string
 * ready for injection into the avatar scaffold.
 *
 * Protocol priority stack (evaluated top-to-bottom, first match wins primary):
 * 1. affective_filter    — user showing frustration (ALWAYS takes priority)
 * 2. output_hypothesis   — 3+ passive turns without target language output
 * 3. spaced_repetition   — struggle terms exist + error_correction
 * 4. (pause)             — 3+ new terms this session (consolidate, don't add more)
 * 5. comprehensible_input — tier advancement possible (i+1)
 * 6. contextual_learning  — scenario is active
 * 7. multimodal_encoding  — teaching new term + noticing_hypothesis
 * 8. (none)              — free conversation, no protocol injection
 *
 * Up to 3 protocols can be active simultaneously.
 */

import type {
  ResearchRecommendation,
  ReadinessAssessment,
  StruggleContext,
  EngagementPattern,
  EncounterType,
  LearnerProfile,
  UserMode,
} from '../core/types';
import { promptLoader } from '../prompts/promptLoader';

// ─── Types ──────────────────────────────────────────────────────

/** Input for the Research Agent's recommendation */
export interface ResearchQuery {
  userMessage: string;
  currentTier: number;
  userMode: UserMode;
  recentEngagement: number;
  termsInSession: number;
  turnsWithoutOutput: number;
  userShowingFrustration: boolean;
  struggleTerms: string[];
  activeScenario: string;
  language: string;
  script: string;
  location: string;
  encounterContext: string;
  inferredReason: string;
}

/** Teaching adjustment suggestion */
export interface TeachingAdjustment {
  termPhrase: string;
  currentApproach: string;
  suggestedApproach: string;
  basedOn: string;
}

// ─── ResearchAgent ──────────────────────────────────────────────

export class ResearchAgent {
  /** Maximum number of protocols to inject per turn */
  private readonly MAX_ACTIVE_PROTOCOLS = 3;

  /**
   * Given current conversation state, recommend which learning protocol(s)
   * to apply and generate the specific instruction to inject.
   */
  getRecommendation(query: ResearchQuery): ResearchRecommendation {
    // Guide mode: no learning protocols
    if (query.userMode === 'guide') {
      return this.emptyRecommendation();
    }

    const selected: Array<{ name: string; instruction: string; priority: number }> = [];

    // 1. Affective filter — ALWAYS takes priority when user is frustrated
    if (query.userShowingFrustration) {
      selected.push({
        name: 'affective_filter',
        instruction: this.getProtocolInstruction('affective_filter', {
          userNativeLanguage: 'the user\'s native language',
        }),
        priority: 1.0,
      });
    }

    // 2. Output hypothesis — user has been passive for 3+ turns
    if (query.turnsWithoutOutput >= 3 && !query.userShowingFrustration) {
      selected.push({
        name: 'output_hypothesis',
        instruction: this.getProtocolInstruction('output_hypothesis', {}),
        priority: 0.9,
      });
    }

    // 3. Spaced repetition + error correction — struggle terms exist
    if (query.struggleTerms.length > 0 && selected.length < this.MAX_ACTIVE_PROTOCOLS) {
      const topStruggle = query.struggleTerms[0];
      selected.push({
        name: 'spaced_repetition',
        instruction: this.getProtocolInstruction('spaced_repetition', {
          phrase: topStruggle,
          encounterContext: query.encounterContext || 'previous conversation',
        }),
        priority: 0.85,
      });

      if (selected.length < this.MAX_ACTIVE_PROTOCOLS) {
        selected.push({
          name: 'error_correction',
          instruction: this.getProtocolInstruction('error_correction', {}),
          priority: 0.8,
        });
      }
    }

    // 4. Pause new terms if session already has 3+
    if (query.termsInSession >= 3) {
      // Don't add new teaching protocols — let existing ones consolidate
      // But still allow spaced_repetition and affective_filter above
    }

    // 5. Comprehensible input — tier advancement possible
    if (query.currentTier < 4 && selected.length < this.MAX_ACTIVE_PROTOCOLS && query.termsInSession < 3) {
      const nextTier = Math.min(4, query.currentTier + 1);
      selected.push({
        name: 'comprehensible_input',
        instruction: this.getProtocolInstruction('comprehensible_input', {
          tier: String(query.currentTier),
          nextTier: String(nextTier),
        }),
        priority: 0.7,
      });
    }

    // 6. Contextual learning — scenario is active
    if (query.activeScenario && selected.length < this.MAX_ACTIVE_PROTOCOLS) {
      selected.push({
        name: 'contextual_learning',
        instruction: this.getProtocolInstruction('contextual_learning', {
          phrase: query.struggleTerms[0] || 'new phrases',
          inferredReason: query.inferredReason || 'practicing in this scenario',
          location: query.location,
          scenario: query.activeScenario,
        }),
        priority: 0.65,
      });
    }

    // 7. Multimodal encoding — when teaching new terms
    if (query.termsInSession > 0 && query.termsInSession < 3 && selected.length < this.MAX_ACTIVE_PROTOCOLS) {
      selected.push({
        name: 'multimodal_encoding',
        instruction: this.getProtocolInstruction('multimodal_encoding', {
          phrase: query.struggleTerms[0] || 'the current phrase',
          script: query.script || 'the local script',
          scenario: query.activeScenario || 'the current situation',
        }),
        priority: 0.6,
      });
    }

    // Cap at MAX_ACTIVE_PROTOCOLS
    const protocols = selected
      .sort((a, b) => b.priority - a.priority)
      .slice(0, this.MAX_ACTIVE_PROTOCOLS);

    // Build combined injection
    const promptInjection = protocols.length > 0
      ? `LEARNING APPROACH:\n${protocols.map(p => `- [${p.name}] ${p.instruction}`).join('\n')}`
      : '';

    // Compute adjustments
    const adjustments: ResearchRecommendation['adjustments'] = {};
    if (query.userShowingFrustration) {
      adjustments.temperature = 0.5;
      adjustments.maxNewTerms = 0;
      adjustments.targetLanguageRatio = 0.3;
    } else if (query.turnsWithoutOutput >= 3) {
      adjustments.maxNewTerms = 1;
    } else if (query.termsInSession >= 3) {
      adjustments.maxNewTerms = 0;
    }

    return { protocols, promptInjection, adjustments };
  }

  /**
   * Determine if the user is ready for the next comfort tier.
   * Based on mastery rates, engagement, and current tier.
   */
  assessReadiness(learnerProfile: LearnerProfile, language: string): ReadinessAssessment {
    const currentTier = learnerProfile.languageComfortTier;
    const { totalPhrases, masteredPhrases } = learnerProfile.stats;

    // Thresholds per tier
    const thresholds: Record<number, { phrases: number; mastery: number }> = {
      0: { phrases: 0, mastery: 0 },     // unknown → beginner: any engagement
      1: { phrases: 5, mastery: 2 },     // beginner → early: 5 phrases, 2 mastered
      2: { phrases: 15, mastery: 8 },    // early → intermediate: 15 phrases, 8 mastered
      3: { phrases: 30, mastery: 20 },   // intermediate → advanced: 30 phrases, 20 mastered
      4: { phrases: 999, mastery: 999 }, // advanced: no further advancement
    };

    const threshold = thresholds[currentTier] ?? thresholds[4];
    const ready = totalPhrases >= threshold.phrases && masteredPhrases >= threshold.mastery;
    const suggestedTier = ready ? Math.min(4, currentTier + 1) : currentTier;

    const masteryRatio = totalPhrases > 0 ? masteredPhrases / totalPhrases : 0;
    const confidence = Math.min(1, masteryRatio + (totalPhrases > 10 ? 0.2 : 0));

    let reasoning = '';
    if (ready) {
      reasoning = `User has ${totalPhrases} phrases (${masteredPhrases} mastered) — meets tier ${suggestedTier} threshold.`;
    } else {
      reasoning = `User needs ${threshold.phrases - totalPhrases} more phrases and ${threshold.mastery - masteredPhrases} more mastered to advance.`;
    }

    return { ready, currentTier, suggestedTier, confidence, reasoning };
  }

  /**
   * Analyze struggle patterns and suggest alternative teaching approaches.
   */
  analyzeStrugglePatterns(
    struggleTerms: StruggleContext[],
    engagementPatterns: EngagementPattern,
  ): TeachingAdjustment[] {
    const adjustments: TeachingAdjustment[] = [];

    for (const ctx of struggleTerms.slice(0, 5)) {
      let suggestedApproach = '';
      let basedOn = '';

      // If user engages more in scenarios, suggest contextual approach
      if (engagementPatterns.peakEngagementScenarios.length > 0) {
        suggestedApproach = `Try teaching "${ctx.term.phrase}" within a ${engagementPatterns.peakEngagementScenarios[0]} scenario — user engages more there.`;
        basedOn = 'contextual_learning + engagement patterns';
      }
      // If user's preferred encounter type differs from how they learned this
      else if (engagementPatterns.preferredEncounterType !== ctx.term.encounterType) {
        suggestedApproach = `Switch to ${engagementPatterns.preferredEncounterType} approach — user learns better that way.`;
        basedOn = 'encounter type preference';
      }
      // Default: multimodal
      else {
        suggestedApproach = `Use multimodal encoding: written form + pronunciation + situational image.`;
        basedOn = 'multimodal_encoding';
      }

      adjustments.push({
        termPhrase: ctx.term.phrase,
        currentApproach: ctx.term.encounterType,
        suggestedApproach,
        basedOn,
      });
    }

    return adjustments;
  }

  // ── Private Helpers ───────────────────────────────────────────

  private getProtocolInstruction(
    protocolKey: string,
    vars: Record<string, string>,
  ): string {
    try {
      return promptLoader.get(`learningProtocols.protocols.${protocolKey}.instruction`, vars);
    } catch {
      // Fallback if template not found
      return `Apply ${protocolKey} protocol.`;
    }
  }

  private emptyRecommendation(): ResearchRecommendation {
    return {
      protocols: [],
      promptInjection: '',
      adjustments: {},
    };
  }
}
