/**
 * NAVI Agent Framework — Memory Maker
 *
 * Analyzes conversation exchanges and writes to the Knowledge Graph.
 * Runs post-conversation (after each exchange) and produces structured
 * graph updates with rich metadata.
 *
 * Extracts 5 metadata dimensions for every interaction:
 * 1. New terms learned (phrase, pronunciation, meaning)
 * 2. Engagement level (0-1, heuristic from message signals)
 * 3. Language + script + avatar context
 * 4. Encounter context (scenario, organic, requested, corrected, overheard)
 * 5. Inferred reason for learning (why the user needs this term)
 *
 * Design: Mostly heuristic (no LLM calls) except for non-obvious reason
 * inference which uses a short LLM call (<50 tokens).
 */

import type { ChatLLM } from '../models/chatLLM';
import type {
  ToolName,
  ConversationNode,
  TermNode,
  TopicNode,
  ScenarioNode,
  AvatarGraphNode,
  LocationNode,
  GraphNode,
  GraphEdge,
  EncounterType,
  ConversationMood,
  SituationModel,
  PhraseMastery,
  UserMode,
} from '../core/types';
import type { DetectedPhrase } from '../prompts/phraseDetector';
import { KnowledgeGraphStore, nodeId, defaultMetadata } from './knowledgeGraph';
import { promptLoader } from '../prompts/promptLoader';

// ─── Types ──────────────────────────────────────────────────────

/** Input for processing a single exchange */
export interface ExchangeInput {
  userMessage: string;
  assistantResponse: string;
  detectedPhrases: DetectedPhrase[];
  detectedTopics: string[];
  toolUsed: ToolName;
  avatarId: string;
  avatarName: string;
  location: string;
  scenario: string;
  language: string;
  script: string;
  dialectKey: string;
  userMode: UserMode;
  situationModel: SituationModel | null;
}

/** Result of processing an exchange */
export interface GraphUpdate {
  nodesCreated: GraphNode[];
  nodesUpdated: string[];
  edgesCreated: GraphEdge[];
  conversationNodeId: string;
}

// ─── MemoryMaker ────────────────────────────────────────────────

export class MemoryMaker {
  /** Accumulates exchanges for session consolidation */
  private sessionExchanges: ExchangeInput[] = [];
  private currentConversationNodeId: string | null = null;

  constructor(
    private graph: KnowledgeGraphStore,
    private llmProvider: ChatLLM | null = null,
  ) {}

  /**
   * Process a single conversation exchange and update the knowledge graph.
   * Called by ConversationDirector.postProcess() after each turn.
   */
  async processExchange(exchange: ExchangeInput): Promise<GraphUpdate> {
    const nodesCreated: GraphNode[] = [];
    const nodesUpdated: string[] = [];
    const edgesCreated: GraphEdge[] = [];

    this.sessionExchanges.push(exchange);

    // Ensure anchor nodes exist (location, scenario, avatar)
    const locationNode = this.ensureLocationNode(exchange);
    const scenarioNode = exchange.scenario ? this.ensureScenarioNode(exchange) : null;
    const avatarNode = this.ensureAvatarNode(exchange);

    // Create or update conversation node
    const engagementScore = this.scoreEngagement(exchange);
    const mood = this.detectMood(exchange.userMessage);

    if (!this.currentConversationNodeId) {
      const convNode: ConversationNode = {
        id: nodeId('conversation'),
        type: 'conversation',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: defaultMetadata({
          engagementScore,
          language: exchange.language,
          script: exchange.script,
          avatarId: exchange.avatarId,
          avatarName: exchange.avatarName,
          encounterContext: exchange.scenario || 'general conversation',
          inferredReason: '',
        }),
        summary: this.summarizeExchange(exchange),
        turnCount: 1,
        userMessages: [exchange.userMessage.slice(0, 200)],
        termsIntroduced: [],
        topicsCovered: [],
        location: exchange.location,
        scenario: exchange.scenario,
        mood,
      };
      this.graph.addNode(convNode);
      this.currentConversationNodeId = convNode.id;
      nodesCreated.push(convNode);

      // Link conversation → location
      edgesCreated.push(
        this.graph.addEdge('OCCURRED_AT', convNode.id, locationNode.id),
      );

      // Link conversation → scenario
      if (scenarioNode) {
        edgesCreated.push(
          this.graph.addEdge('PART_OF', convNode.id, scenarioNode.id),
        );
        scenarioNode.conversationIds.push(convNode.id);
        this.graph.updateNode(scenarioNode.id, scenarioNode);
      }

      // Link conversation → avatar
      avatarNode.conversationIds.push(convNode.id);
      this.graph.updateNode(avatarNode.id, avatarNode);
      locationNode.conversationIds.push(convNode.id);
      this.graph.updateNode(locationNode.id, locationNode);
    } else {
      // Update existing conversation node
      const existing = this.graph.getNode<ConversationNode>(this.currentConversationNodeId);
      if (existing) {
        existing.turnCount++;
        existing.userMessages.push(exchange.userMessage.slice(0, 200));
        // Rolling average of engagement
        existing.metadata.engagementScore =
          (existing.metadata.engagementScore * (existing.turnCount - 1) + engagementScore) / existing.turnCount;
        existing.mood = mood;
        existing.summary = this.summarizeExchange(exchange);
        existing.updatedAt = Date.now();
        this.graph.updateNode(existing.id, existing);
        nodesUpdated.push(existing.id);
      }
    }

    const conversationNodeId = this.currentConversationNodeId!;

    // Process detected phrases → TermNodes
    for (const detected of exchange.detectedPhrases) {
      const encounterType = this.classifyEncounterType(detected, exchange.toolUsed, exchange.userMessage);
      const inferredReason = await this.inferReason(detected, exchange);

      // Check if term already exists
      let termNode = this.graph.findTermNode(detected.phrase, exchange.language);

      if (termNode) {
        // Update existing term
        termNode.attemptCount++;
        termNode.lastPracticed = Date.now();
        termNode.updatedAt = Date.now();
        this.graph.updateNode(termNode.id, termNode);
        nodesUpdated.push(termNode.id);

        // Add PRACTICED_IN edge
        edgesCreated.push(
          this.graph.addEdge('PRACTICED_IN', termNode.id, conversationNodeId),
        );
      } else {
        // Create new term node
        termNode = {
          id: nodeId('term'),
          type: 'term',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          metadata: defaultMetadata({
            engagementScore,
            language: exchange.language,
            script: exchange.script,
            avatarId: exchange.avatarId,
            avatarName: exchange.avatarName,
            encounterContext: exchange.scenario || exchange.toolUsed,
            inferredReason,
          }),
          phrase: detected.phrase,
          pronunciation: detected.pronunciation,
          meaning: detected.meaning,
          language: exchange.language,
          script: exchange.script,
          mastery: 'new' as PhraseMastery,
          attemptCount: 1,
          struggleCount: 0,
          firstSeen: Date.now(),
          lastPracticed: Date.now(),
          nextReviewAt: Date.now() + 2 * 24 * 60 * 60 * 1000, // 2 days
          learnedInConversation: conversationNodeId,
          learnedInScenario: scenarioNode?.id ?? '',
          learnedFromAvatar: avatarNode.id,
          learnedAtLocation: locationNode.id,
          encounterType,
          inferredReason,
          relatedTerms: [],
        };

        this.graph.addNode(termNode);
        nodesCreated.push(termNode);

        // Create edges: LEARNED_IN, ENCOUNTERED_VIA, TAUGHT_BY
        edgesCreated.push(
          this.graph.addEdge('LEARNED_IN', termNode.id, conversationNodeId),
        );
        if (scenarioNode) {
          edgesCreated.push(
            this.graph.addEdge('ENCOUNTERED_VIA', termNode.id, scenarioNode.id),
          );
          scenarioNode.termIds.push(termNode.id);
          this.graph.updateNode(scenarioNode.id, scenarioNode);
        }
        edgesCreated.push(
          this.graph.addEdge('TAUGHT_BY', termNode.id, avatarNode.id),
        );
        avatarNode.termsTaught.push(termNode.id);
        this.graph.updateNode(avatarNode.id, avatarNode);

        locationNode.termIds.push(termNode.id);
        this.graph.updateNode(locationNode.id, locationNode);

        // Update conversation node
        const conv = this.graph.getNode<ConversationNode>(conversationNodeId);
        if (conv) {
          conv.termsIntroduced.push(termNode.id);
          this.graph.updateNode(conv.id, conv);
        }
      }

      // Process topics → TopicNodes and link to terms
      for (const topicName of exchange.detectedTopics) {
        const topicNode = this.ensureTopicNode(topicName, exchange);
        // Link term → topic
        if (!topicNode.termIds.includes(termNode.id)) {
          topicNode.termIds.push(termNode.id);
          this.graph.updateNode(topicNode.id, topicNode);
          edgesCreated.push(
            this.graph.addEdge('CONTAINS_TERM', topicNode.id, termNode.id),
          );
        }
        // Update conversation node topics
        const conv = this.graph.getNode<ConversationNode>(conversationNodeId);
        if (conv && !conv.topicsCovered.includes(topicNode.id)) {
          conv.topicsCovered.push(topicNode.id);
          this.graph.updateNode(conv.id, conv);
        }
      }
    }

    // Also process topics even if no phrases detected
    if (exchange.detectedPhrases.length === 0) {
      for (const topicName of exchange.detectedTopics) {
        this.ensureTopicNode(topicName, exchange);
        const conv = this.graph.getNode<ConversationNode>(conversationNodeId);
        const topicNode = this.graph.findTopicNode(topicName);
        if (conv && topicNode && !conv.topicsCovered.includes(topicNode.id)) {
          conv.topicsCovered.push(topicNode.id);
          this.graph.updateNode(conv.id, conv);
        }
      }
    }

    // Persist (fire and forget for UX)
    this.graph.save().catch(err =>
      console.error('[NAVI:memoryMaker] save failed:', err),
    );

    return { nodesCreated, nodesUpdated, edgesCreated, conversationNodeId };
  }

  /** Start a new conversation (resets session accumulator) */
  startNewConversation(): void {
    this.sessionExchanges = [];
    this.currentConversationNodeId = null;
  }

  /** Get the current conversation node ID */
  getCurrentConversationId(): string | null {
    return this.currentConversationNodeId;
  }

  // ── Engagement Scoring (heuristic, no LLM) ───────────────────

  private scoreEngagement(exchange: ExchangeInput): number {
    let score = 0.5; // baseline

    const msg = exchange.userMessage;

    // Positive signals
    if (msg.length > 50) score += 0.15;
    if (msg.includes('?')) score += 0.1;
    if (/[^\x00-\x7F]/.test(msg)) score += 0.1; // uses target language
    if (/!|lol|haha|wow|omg/i.test(msg)) score += 0.1;
    if (/tell me more|what else|go on|keep going/i.test(msg)) score += 0.1;

    // Negative signals
    if (msg.length < 5) score -= 0.2;
    if (/^(ok|thanks|sure|yes|no|k|ty)$/i.test(msg.trim())) score -= 0.15;

    return Math.max(0, Math.min(1, score));
  }

  // ── Encounter Type Classification (heuristic, no LLM) ────────

  private classifyEncounterType(
    phrase: DetectedPhrase,
    toolUsed: ToolName,
    userMessage: string,
  ): EncounterType {
    if (toolUsed === 'generate_phrase' || toolUsed === 'pronounce') return 'requested';
    if (toolUsed === 'camera_read') return 'overheard';

    const lower = userMessage.toLowerCase();
    if (lower.includes('how do i say') || lower.includes('how do you say')) return 'requested';
    if (lower.includes('what does') && lower.includes('mean')) return 'overheard';

    // Check if this is a correction
    if (/actually|not quite|close but|the correct/i.test(phrase.meaning ?? '')) return 'corrected';

    if (toolUsed === 'chat') return 'organic';
    if (toolUsed === 'explain_culture' || toolUsed === 'teach_slang') return 'scenario';

    return 'organic';
  }

  // ── Reason Inference ──────────────────────────────────────────

  private async inferReason(
    phrase: DetectedPhrase,
    exchange: ExchangeInput,
  ): Promise<string> {
    // Heuristic: obvious cases (no LLM needed)
    if (exchange.scenario) {
      return `User is practicing for: ${exchange.scenario}`;
    }
    if (exchange.toolUsed === 'translate') {
      return `User needs to understand local speech in ${exchange.location}`;
    }
    if (exchange.toolUsed === 'pronounce') {
      return `User wants to say this correctly`;
    }
    if (exchange.situationModel?.urgency === 'immediate') {
      return `User needs this urgently for an upcoming interaction`;
    }

    // Non-obvious: use LLM if available (short call, <50 tokens)
    if (this.llmProvider?.isReady()) {
      try {
        const prompt = promptLoader.get('learningProtocols.reasonInference.template', {
          userMessage: exchange.userMessage.slice(0, 100),
          phrase: phrase.phrase,
          meaning: phrase.meaning ?? 'unknown',
          scenario: exchange.scenario || 'general conversation',
          urgency: exchange.situationModel?.urgency ?? 'unknown',
          primaryGoal: exchange.situationModel?.primaryGoal ?? 'unknown',
        });
        const config = promptLoader.getRaw('learningProtocols.reasonInference') as {
          temperature: number;
          max_tokens: number;
        };
        const result = await this.llmProvider.chat(
          [{ role: 'system', content: 'Answer in 1 sentence only.' }, { role: 'user', content: prompt }],
          { temperature: config.temperature, max_tokens: config.max_tokens },
        );
        if (result && result.length > 5) return result.trim();
      } catch {
        // Fallback to heuristic
      }
    }

    // Final fallback
    return `Learning "${phrase.phrase}" through ${exchange.toolUsed} in ${exchange.location}`;
  }

  // ── Mood Detection (heuristic, no LLM) ────────────────────────

  private detectMood(userMessage: string): ConversationMood {
    const lower = userMessage.toLowerCase();
    if (/frustrated|confused|don't understand|help|lost|stuck/i.test(lower)) return 'frustrated';
    if (/struggling|hard|difficult|can't/i.test(lower)) return 'struggling';
    if (/got it|i see|makes sense|cool|nice|awesome/i.test(lower)) return 'confident';
    if (/\?|how|what|why|tell me|explain|show/i.test(lower)) return 'curious';
    return 'neutral';
  }

  // ── Summarization (heuristic, no LLM) ─────────────────────────

  private summarizeExchange(exchange: ExchangeInput): string {
    const phrases = exchange.detectedPhrases.map(p => `"${p.phrase}"`).join(', ');
    const topics = exchange.detectedTopics.join(', ');
    let summary = `User: ${exchange.userMessage.slice(0, 80)}`;
    if (phrases) summary += ` | Phrases: ${phrases}`;
    if (topics) summary += ` | Topics: ${topics}`;
    if (exchange.scenario) summary += ` | Scenario: ${exchange.scenario}`;
    return summary;
  }

  // ── Anchor Node Helpers (find-or-create) ──────────────────────

  private ensureLocationNode(exchange: ExchangeInput): LocationNode {
    let node = this.graph.findLocationNode(exchange.location, exchange.dialectKey);
    if (node) return node;

    node = {
      id: nodeId('location'),
      type: 'location',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: defaultMetadata({
        language: exchange.language,
        script: exchange.script,
        avatarId: exchange.avatarId,
        avatarName: exchange.avatarName,
      }),
      city: exchange.location,
      country: '',
      dialectKey: exchange.dialectKey,
      language: exchange.language,
      script: exchange.script,
      conversationIds: [],
      termIds: [],
    };
    this.graph.addNode(node);
    return node;
  }

  private ensureScenarioNode(exchange: ExchangeInput): ScenarioNode {
    let node = this.graph.findScenarioNode(exchange.scenario);
    if (node) return node;

    node = {
      id: nodeId('scenario'),
      type: 'scenario',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: defaultMetadata({
        language: exchange.language,
        script: exchange.script,
        avatarId: exchange.avatarId,
        avatarName: exchange.avatarName,
        encounterContext: exchange.scenario,
      }),
      scenarioKey: exchange.scenario,
      description: exchange.scenario,
      conversationIds: [],
      termIds: [],
    };
    this.graph.addNode(node);
    return node;
  }

  private ensureAvatarNode(exchange: ExchangeInput): AvatarGraphNode {
    let node = this.graph.findAvatarNode(exchange.avatarId);
    if (node) return node;

    node = {
      id: nodeId('avatar'),
      type: 'avatar',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: defaultMetadata({
        language: exchange.language,
        script: exchange.script,
        avatarId: exchange.avatarId,
        avatarName: exchange.avatarName,
      }),
      avatarId: exchange.avatarId,
      name: exchange.avatarName,
      personality: '',
      dialect: exchange.dialectKey,
      location: exchange.location,
      termsTaught: [],
      conversationIds: [],
    };
    this.graph.addNode(node);
    return node;
  }

  private ensureTopicNode(topicName: string, exchange: ExchangeInput): TopicNode {
    let node = this.graph.findTopicNode(topicName);
    if (node) {
      node.lastPracticed = Date.now();
      node.updatedAt = Date.now();
      this.graph.updateNode(node.id, node);
      return node;
    }

    node = {
      id: nodeId('topic'),
      type: 'topic',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: defaultMetadata({
        language: exchange.language,
        script: exchange.script,
        avatarId: exchange.avatarId,
        avatarName: exchange.avatarName,
      }),
      name: topicName,
      proficiencyScore: 0.1,
      termIds: [],
      lastPracticed: Date.now(),
    };
    this.graph.addNode(node);
    return node;
  }
}
