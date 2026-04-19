/**
 * NAVI Agent Framework — Memory Retrieval Agent
 *
 * Sub-agent that traverses the Knowledge Graph to surface relevant
 * context for the current conversation turn. Called by the Orchestrator
 * before every LLM call.
 *
 * Replaces the flat `MemoryManager.buildContextForPrompt()` with
 * graph-aware retrieval that understands relationships between
 * terms, conversations, scenarios, and locations.
 *
 * Query types:
 * - turn_context:    lightweight per-turn retrieval (<5ms)
 * - session_start:   deeper query — what happened last time?
 * - explicit_recall:  user says "remember when..."
 * - teaching:        find related terms the user already knows
 * - scenario_entry:  what terms did user learn in similar scenarios?
 */

import type {
  ContextPacket,
  MemoryQuery,
  TermContext,
  EngagementPattern,
  TermHistory,
  StruggleContext,
  SessionRecap,
  ConversationNode,
  TermNode,
  TopicNode,
  LocationNode,
  ScenarioNode,
  PhraseMastery,
  EncounterType,
} from '../core/types';
import type { KnowledgeGraphStore } from '../memory/knowledgeGraph';

// ─── MemoryRetrievalAgent ───────────────────────────────────────

export class MemoryRetrievalAgent {
  constructor(private graph: KnowledgeGraphStore) {}

  /**
   * Main entry: retrieve relevant context for the current turn.
   * Returns a ContextPacket the Orchestrator injects into the avatar scaffold.
   */
  retrieve(query: MemoryQuery): ContextPacket {
    switch (query.queryType) {
      case 'session_start':
        return this.buildSessionStartContext(query);
      case 'explicit_recall':
        return this.buildExplicitRecallContext(query);
      case 'teaching':
        return this.buildTeachingContext(query);
      case 'scenario_entry':
        return this.buildScenarioEntryContext(query);
      case 'turn_context':
      default:
        return this.buildTurnContext(query);
    }
  }

  // ── Query Implementations ─────────────────────────────────────

  private buildTurnContext(query: MemoryQuery): ContextPacket {
    const relatedTerms = this.getRelatedTerms(query.currentTopics, query.language);
    // Scope struggle terms to current language
    const struggleTerms = this.getStrugglingTermPhrases(query.language);
    const bridgeMemories = this.getBridgeMemories(query.currentLocation, query.language);
    const engagementHints = this.getEngagementHints(query.currentAvatarId);

    const sections: string[] = [];

    if (relatedTerms.length > 0) {
      const termLines = relatedTerms.slice(0, 5).map(t =>
        `- "${t.phrase}" (${t.mastery}, learned via ${t.encounterType}: ${t.reason})`,
      );
      sections.push(`KNOWN TERMS:\n${termLines.join('\n')}`);
    }

    if (struggleTerms.length > 0) {
      sections.push(`STRUGGLING WITH: ${struggleTerms.slice(0, 3).join(', ')}`);
    }

    if (bridgeMemories.length > 0) {
      sections.push(`FROM OTHER LOCATIONS:\n${bridgeMemories.slice(0, 2).join('\n')}`);
    }

    if (engagementHints.length > 0) {
      sections.push(`ENGAGEMENT NOTES: ${engagementHints.slice(0, 2).join('. ')}`);
    }

    return {
      promptInjection: sections.length > 0 ? sections.join('\n\n') : '',
      relatedTerms,
      engagementHints,
      bridgeMemories,
      struggleTerms,
      relevanceScore: this.computeRelevance(relatedTerms, struggleTerms),
    };
  }

  private buildSessionStartContext(query: MemoryQuery): ContextPacket {
    const recap = this.getSessionRecap(query.currentAvatarId);
    const sections: string[] = [];

    if (recap.lastSessionSummary) {
      sections.push(`LAST SESSION (${recap.daysAgo}d ago): ${recap.lastSessionSummary}`);
    }
    if (recap.termsIntroduced.length > 0) {
      const terms = recap.termsIntroduced.slice(0, 5).map(t => `"${t.phrase}"`).join(', ');
      sections.push(`RECENTLY LEARNED: ${terms}`);
    }
    if (recap.unfinishedTopics.length > 0) {
      sections.push(`UNFINISHED TOPICS: ${recap.unfinishedTopics.join(', ')}`);
    }

    const relatedTerms = this.getRelatedTerms(recap.unfinishedTopics, query.language);
    // Scope struggle terms to current language
    const struggleTerms = this.getStrugglingTermPhrases(query.language);

    return {
      promptInjection: sections.length > 0 ? sections.join('\n') : '',
      relatedTerms,
      engagementHints: [],
      bridgeMemories: [],
      struggleTerms,
      relevanceScore: recap.lastSessionSummary ? 0.8 : 0.3,
    };
  }

  private buildExplicitRecallContext(query: MemoryQuery): ContextPacket {
    // Search conversations by user message keywords
    const keywords = query.userMessage.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const conversations = this.graph.getNodesByType<ConversationNode>('conversation');

    const matches = conversations
      .filter(c => {
        const lower = c.summary.toLowerCase();
        return keywords.some(kw => lower.includes(kw));
      })
      .sort((a, b) => b.metadata.engagementScore - a.metadata.engagementScore)
      .slice(0, 5);

    const sections: string[] = [];
    if (matches.length > 0) {
      const lines = matches.map(c => {
        const date = new Date(c.createdAt).toLocaleDateString();
        return `- [${date}] ${c.summary}`;
      });
      sections.push(`REMEMBERED CONVERSATIONS:\n${lines.join('\n')}`);
    }

    // Find terms from those conversations
    const relatedTerms: TermContext[] = [];
    for (const conv of matches) {
      for (const termId of conv.termsIntroduced) {
        const term = this.graph.getNode<TermNode>(termId);
        if (term) {
          relatedTerms.push(this.termToContext(term));
        }
      }
    }

    return {
      promptInjection: sections.join('\n'),
      relatedTerms: relatedTerms.slice(0, 8),
      engagementHints: [],
      bridgeMemories: [],
      struggleTerms: [],
      relevanceScore: matches.length > 0 ? 0.9 : 0.2,
    };
  }

  private buildTeachingContext(query: MemoryQuery): ContextPacket {
    const relatedTerms = this.getRelatedTerms(query.currentTopics, query.language);
    // Filter struggling terms by current language
    const allStruggleCtx = this.graph.getStrugglingTermsWithContext();
    const struggleCtx = query.language
      ? allStruggleCtx.filter(s => s.term.language === query.language)
      : allStruggleCtx;

    const sections: string[] = [];

    // Show what user already knows in these topics
    const knownTerms = relatedTerms.filter(t => t.mastery !== 'new');
    if (knownTerms.length > 0) {
      const lines = knownTerms.slice(0, 5).map(t =>
        `- "${t.phrase}" (${t.mastery}${t.relatedTerms.length > 0 ? `, related: ${t.relatedTerms.join(', ')}` : ''})`,
      );
      sections.push(`USER ALREADY KNOWS:\n${lines.join('\n')}`);
    }

    // Show struggle patterns
    if (struggleCtx.length > 0) {
      const lines = struggleCtx.slice(0, 3).map(s =>
        `- "${s.term.phrase}" (${s.term.attemptCount} attempts, struggled ${s.term.struggleCount}x)`,
      );
      sections.push(`STRUGGLING WITH:\n${lines.join('\n')}`);
    }

    return {
      promptInjection: sections.join('\n\n'),
      relatedTerms,
      engagementHints: [],
      bridgeMemories: [],
      struggleTerms: struggleCtx.map(s => s.term.phrase),
      relevanceScore: 0.7,
    };
  }

  private buildScenarioEntryContext(query: MemoryQuery): ContextPacket {
    const scenarioNode = this.graph.findScenarioNode(query.currentScenario);
    const sections: string[] = [];
    const relatedTerms: TermContext[] = [];

    if (scenarioNode) {
      // Terms previously learned in this scenario
      const terms = this.graph.getTermsInScenario(scenarioNode.id);
      if (terms.length > 0) {
        const lines = terms.slice(0, 5).map(t =>
          `- "${t.phrase}" (${t.mastery}, ${t.encounterType})`,
        );
        sections.push(`PREVIOUSLY LEARNED IN ${query.currentScenario.toUpperCase()}:\n${lines.join('\n')}`);
        relatedTerms.push(...terms.map(t => this.termToContext(t)));
      }

      // Past conversations in this scenario
      const pastConvIds = scenarioNode.conversationIds.slice(-3);
      const convSummaries = pastConvIds
        .map(id => this.graph.getNode<ConversationNode>(id))
        .filter((c): c is ConversationNode => c !== undefined)
        .map(c => c.summary);
      if (convSummaries.length > 0) {
        sections.push(`PAST SESSIONS HERE:\n${convSummaries.map(s => `- ${s}`).join('\n')}`);
      }
    }

    return {
      promptInjection: sections.join('\n\n'),
      relatedTerms,
      engagementHints: [],
      bridgeMemories: [],
      struggleTerms: [],
      relevanceScore: scenarioNode ? 0.8 : 0.3,
    };
  }

  // ── Data Retrieval Helpers ────────────────────────────────────

  /** Get terms related to current topics (graph traversal) */
  getRelatedTerms(topics: string[], language: string): TermContext[] {
    const result: TermContext[] = [];
    const seen = new Set<string>();

    for (const topicName of topics) {
      const topicNode = this.graph.findTopicNode(topicName);
      if (!topicNode) continue;

      for (const termId of topicNode.termIds) {
        if (seen.has(termId)) continue;
        seen.add(termId);

        const term = this.graph.getNode<TermNode>(termId);
        if (!term || term.language !== language) continue;
        result.push(this.termToContext(term));
      }
    }

    // Also include terms due for review
    const allTerms = this.graph.getNodesByType<TermNode>('term');
    const now = Date.now();
    for (const term of allTerms) {
      if (seen.has(term.id)) continue;
      if (term.language === language && term.nextReviewAt <= now && term.mastery !== 'mastered') {
        seen.add(term.id);
        result.push(this.termToContext(term));
      }
    }

    return result.sort((a, b) => a.lastPracticed - b.lastPracticed).slice(0, 10);
  }

  /** Get engagement patterns for teaching strategy */
  getEngagementPatterns(avatarId: string): EngagementPattern {
    const conversations = this.graph.getNodesByType<ConversationNode>('conversation')
      .filter(c => c.metadata.avatarId === avatarId);

    if (conversations.length === 0) {
      return {
        highEngagementTopics: [],
        preferredEncounterType: 'organic' as EncounterType,
        averageSessionLength: 0,
        peakEngagementScenarios: [],
      };
    }

    // Find high-engagement topics
    const topicEngagement = new Map<string, number[]>();
    for (const conv of conversations) {
      for (const topicId of conv.topicsCovered) {
        const topic = this.graph.getNode<TopicNode>(topicId);
        if (topic) {
          const scores = topicEngagement.get(topic.name) ?? [];
          scores.push(conv.metadata.engagementScore);
          topicEngagement.set(topic.name, scores);
        }
      }
    }

    const highEngagementTopics = [...topicEngagement.entries()]
      .map(([name, scores]) => ({ name, avg: scores.reduce((a, b) => a + b, 0) / scores.length }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5)
      .map(t => t.name);

    // Find preferred encounter type
    const encounterCounts = new Map<string, number>();
    const terms = this.graph.getNodesByType<TermNode>('term')
      .filter(t => t.metadata.avatarId === avatarId && t.metadata.engagementScore > 0.6);
    for (const t of terms) {
      encounterCounts.set(t.encounterType, (encounterCounts.get(t.encounterType) ?? 0) + 1);
    }
    const preferredEncounterType = ([...encounterCounts.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'organic') as EncounterType;

    // Average session length
    const avgLength = conversations.reduce((s, c) => s + c.turnCount, 0) / conversations.length;

    // Peak engagement scenarios
    const scenarioEngagement = new Map<string, number[]>();
    for (const conv of conversations) {
      if (conv.scenario) {
        const scores = scenarioEngagement.get(conv.scenario) ?? [];
        scores.push(conv.metadata.engagementScore);
        scenarioEngagement.set(conv.scenario, scores);
      }
    }
    const peakEngagementScenarios = [...scenarioEngagement.entries()]
      .map(([name, scores]) => ({ name, avg: scores.reduce((a, b) => a + b, 0) / scores.length }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3)
      .map(s => s.name);

    return {
      highEngagementTopics,
      preferredEncounterType,
      averageSessionLength: Math.round(avgLength),
      peakEngagementScenarios,
    };
  }

  /** Cross-location bridging: terms from other locations relevant here */
  getBridgeMemories(currentLocation: string, language: string): string[] {
    const currentLocNode = this.graph.findLocationNode(currentLocation, '');
    const allLocations = this.graph.getNodesByType<LocationNode>('location')
      .filter(l => l.id !== currentLocNode?.id && l.language === language);

    const bridges: string[] = [];
    for (const loc of allLocations) {
      const terms = loc.termIds
        .map(id => this.graph.getNode<TermNode>(id))
        .filter((t): t is TermNode => t !== undefined && t.mastery !== 'mastered')
        .slice(0, 2);

      if (terms.length > 0) {
        const phrases = terms.map(t => `"${t.phrase}"`).join(', ');
        bridges.push(`- From ${loc.city}: ${phrases}`);
      }
    }
    return bridges;
  }

  /** Get session recap for returning users */
  getSessionRecap(avatarId: string): SessionRecap {
    const conversations = this.graph.getNodesByType<ConversationNode>('conversation')
      .filter(c => c.metadata.avatarId === avatarId)
      .sort((a, b) => b.createdAt - a.createdAt);

    if (conversations.length === 0) {
      return { lastSessionSummary: '', termsIntroduced: [], termsReviewed: [], unfinishedTopics: [], daysAgo: 0 };
    }

    const last = conversations[0];
    const daysAgo = Math.floor((Date.now() - last.createdAt) / (1000 * 60 * 60 * 24));

    const termsIntroduced = last.termsIntroduced
      .map(id => this.graph.getNode<TermNode>(id))
      .filter((t): t is TermNode => t !== undefined);

    // Find topics that were covered but have low proficiency
    const unfinishedTopics: string[] = [];
    for (const topicId of last.topicsCovered) {
      const topic = this.graph.getNode<TopicNode>(topicId);
      if (topic && topic.proficiencyScore < 0.5) {
        unfinishedTopics.push(topic.name);
      }
    }

    return {
      lastSessionSummary: last.summary,
      termsIntroduced,
      termsReviewed: [],
      unfinishedTopics,
      daysAgo,
    };
  }

  /** Get full history for a specific term */
  getTermHistory(termId: string): TermHistory | null {
    const term = this.graph.getNode<TermNode>(termId);
    if (!term) return null;

    const conversations = this.graph.getConversationsForTerm(termId);
    const relatedTerms = this.graph.getRelatedTerms(termId);
    const scenarioContext = term.learnedInScenario
      ? this.graph.getNode<ScenarioNode>(term.learnedInScenario) ?? null
      : null;
    const locationContext = term.learnedAtLocation
      ? this.graph.getNode<LocationNode>(term.learnedAtLocation) ?? null
      : null;

    return { term, conversations, relatedTerms, scenarioContext, locationContext };
  }

  // ── Private Helpers ───────────────────────────────────────────

  private termToContext(term: TermNode): TermContext {
    const related = term.relatedTerms
      .map(id => this.graph.getNode<TermNode>(id))
      .filter((t): t is TermNode => t !== undefined)
      .map(t => t.phrase);

    return {
      phrase: term.phrase,
      mastery: term.mastery,
      lastPracticed: term.lastPracticed,
      encounterType: term.encounterType,
      reason: term.inferredReason,
      relatedTerms: related,
    };
  }

  /** Get phrases the user struggles with from the knowledge graph, scoped by language. */
  private getStrugglingTermPhrases(language?: string): string[] {
    return this.graph.getNodesByType<TermNode>('term')
      .filter(t => {
        if (language && t.language !== language) return false;
        return t.struggleCount > 0 && t.mastery !== 'mastered';
      })
      .sort((a, b) => b.struggleCount - a.struggleCount)
      .slice(0, 5)
      .map(t => `"${t.phrase}"`);
  }

  private getEngagementHints(avatarId: string): string[] {
    const patterns = this.getEngagementPatterns(avatarId);
    const hints: string[] = [];
    if (patterns.highEngagementTopics.length > 0) {
      hints.push(`User is most engaged with: ${patterns.highEngagementTopics.slice(0, 3).join(', ')}`);
    }
    if (patterns.peakEngagementScenarios.length > 0) {
      hints.push(`Best scenarios: ${patterns.peakEngagementScenarios.join(', ')}`);
    }
    return hints;
  }

  private computeRelevance(terms: TermContext[], struggles: string[]): number {
    if (terms.length === 0 && struggles.length === 0) return 0.1;
    return Math.min(1, 0.3 + terms.length * 0.1 + struggles.length * 0.15);
  }
}
