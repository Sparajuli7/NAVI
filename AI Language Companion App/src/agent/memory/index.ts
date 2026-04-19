/**
 * NAVI Agent Framework — Memory Manager
 *
 * Unified interface to all memory systems.
 * Components interact with this single manager instead of
 * reaching into individual stores directly.
 *
 * Memory hierarchy:
 * 1. Working Memory    — Ring buffer, current session context, auto-expires
 * 2. Episodic Memory   — Summarized conversation episodes, persisted
 * 3. Semantic Memory   — Vector embeddings for similarity search
 * 4. Profile Memory    — User preferences and learning progress
 * 5. Learner Profile   — Phrase tracking, topic proficiency, spaced repetition
 * 6. Relationships     — Per-avatar warmth, milestones, shared references
 * 7. Situation         — Proactive user situation model (urgency, comfort, goal)
 * 8. Knowledge Graph   — Rich graph of terms, conversations, scenarios, locations
 * 9. Memory Maker      — Post-conversation graph writer with 5 metadata extractors
 */

import { WorkingMemory } from './workingMemory';
import { EpisodicMemoryStore } from './episodicMemory';
import { SemanticMemoryStore } from './semanticMemory';
import { ProfileMemoryStore } from './profileMemory';
import { LearnerProfileStore } from './learnerProfile';
import { RelationshipStore } from './relationshipStore';
import { SituationAssessor } from './situationAssessor';
import { KnowledgeGraphStore } from './knowledgeGraph';
import { MemoryMaker } from './memoryMaker';
import type { EpisodicMemory } from '../core/types';
import type { ChatLLM } from '../models/chatLLM';
import { agentBus } from '../core/eventBus';

export class MemoryManager {
  readonly working: WorkingMemory;
  readonly episodic: EpisodicMemoryStore;
  readonly semantic: SemanticMemoryStore;
  readonly profile: ProfileMemoryStore;
  readonly learner: LearnerProfileStore;
  readonly relationships: RelationshipStore;
  readonly situation: SituationAssessor;
  readonly graph: KnowledgeGraphStore;
  readonly memoryMaker: MemoryMaker;

  private initialized = false;

  constructor(workingMemoryCapacity: number = 32, llmProvider?: ChatLLM) {
    this.working = new WorkingMemory(workingMemoryCapacity);
    this.episodic = new EpisodicMemoryStore();
    this.semantic = new SemanticMemoryStore();
    this.profile = new ProfileMemoryStore();
    this.learner = new LearnerProfileStore();
    this.relationships = new RelationshipStore();
    this.situation = new SituationAssessor();
    this.graph = new KnowledgeGraphStore();
    this.memoryMaker = new MemoryMaker(this.graph, llmProvider ?? null);
  }

  /** Initialize all persistent stores (including knowledge graph) */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    await Promise.all([
      this.episodic.load(),
      this.semantic.load(),
      this.profile.load(),
      this.learner.load(),
      this.relationships.load(),
      this.situation.load(),
      this.graph.load(),
    ]);
    this.initialized = true;
    agentBus.emit('memory:update', { type: 'initialized' });
  }

  /**
   * Build a context string for prompt injection from all memory systems.
   * This is what gets injected into the system prompt to give the
   * avatar knowledge of past interactions and user preferences.
   */
  buildContextForPrompt(options?: {
    location?: string;
    scenario?: string;
    recentEpisodeCount?: number;
  }): string {
    const sections: string[] = [];

    // Profile context
    const profileCtx = this.profile.formatForPrompt();
    if (profileCtx) sections.push(profileCtx);

    // Episodic memories
    let episodes: EpisodicMemory[] = [];
    if (options?.location) {
      episodes = this.episodic.getByLocation(options.location, 3);
    }
    if (options?.scenario) {
      const scenarioEps = this.episodic.getByScenario(options.scenario, 3);
      episodes = [...episodes, ...scenarioEps];
    }
    if (episodes.length === 0) {
      episodes = this.episodic.getRecent(options?.recentEpisodeCount ?? 5);
    }
    const episodicCtx = this.episodic.formatForPrompt(episodes);
    if (episodicCtx) sections.push(episodicCtx);

    // Working memory context (current session)
    const workingSlots = this.working.getAll();
    if (workingSlots.length > 0) {
      const workingCtx = workingSlots
        .map((s) => `- ${s.key}: ${JSON.stringify(s.value)}`)
        .join('\n');
      sections.push(`Current session context:\n${workingCtx}`);
    }

    const ctx = sections.join('\n\n');
    return ctx;
  }

  /** Store a conversation episode asynchronously (fire-and-forget for UX) */
  storeEpisodeAsync(
    summary: string,
    options: {
      location?: string;
      scenario?: string;
      importance?: number;
      tags?: string[];
    } = {},
  ): void {
    // Don't await — this runs in the background
    this.episodic
      .add({
        summary,
        timestamp: Date.now(),
        location: options.location,
        scenario: options.scenario,
        importance: options.importance ?? 0.5,
        tags: options.tags ?? [],
      })
      .catch((err) => console.error('[MemoryManager] Failed to store episode:', err));
  }

  /** Get memory stats for debugging/settings UI */
  getStats(): {
    workingSlots: number;
    episodicCount: number;
    semanticCount: number;
    phrasesTracked: number;
    phrasesMastered: number;
    relationshipCount: number;
    graphNodes: number;
    graphEdges: number;
  } {
    return {
      workingSlots: this.working.size,
      episodicCount: this.episodic.count,
      semanticCount: this.semantic.count,
      phrasesTracked: this.learner.stats.totalPhrases,
      phrasesMastered: this.learner.stats.masteredPhrases,
      relationshipCount: this.relationships.count,
      graphNodes: this.graph.nodeCount,
      graphEdges: this.graph.edgeCount,
    };
  }

  /** Clear all memory (for reset/testing) */
  async clearAll(): Promise<void> {
    this.working.clear();
    await this.episodic.clear();
    await this.semantic.clear();
    await this.profile.reset();
    await this.learner.clear();
    await this.relationships.clear();
    await this.situation.reset();
    await this.graph.clear();
    agentBus.emit('memory:update', { type: 'cleared' });
  }
}

export { WorkingMemory } from './workingMemory';
export { EpisodicMemoryStore } from './episodicMemory';
export { SemanticMemoryStore } from './semanticMemory';
export { ProfileMemoryStore } from './profileMemory';
export { LearnerProfileStore } from './learnerProfile';
export { RelationshipStore } from './relationshipStore';
export { SituationAssessor } from './situationAssessor';
export { KnowledgeGraphStore } from './knowledgeGraph';
export { MemoryMaker } from './memoryMaker';
