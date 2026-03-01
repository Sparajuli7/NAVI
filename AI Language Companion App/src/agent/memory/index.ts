/**
 * NAVI Agent Framework — Memory Manager
 *
 * Unified interface to all four memory systems.
 * Components interact with this single manager instead of
 * reaching into individual stores directly.
 *
 * Memory hierarchy:
 * 1. Working Memory  — Ring buffer, current session context, auto-expires
 * 2. Episodic Memory — Summarized conversation episodes, persisted
 * 3. Semantic Memory — Vector embeddings for similarity search
 * 4. Profile Memory  — User preferences and learning progress
 */

import { WorkingMemory } from './workingMemory';
import { EpisodicMemoryStore } from './episodicMemory';
import { SemanticMemoryStore } from './semanticMemory';
import { ProfileMemoryStore } from './profileMemory';
import type { EpisodicMemory } from '../core/types';
import { agentBus } from '../core/eventBus';

export class MemoryManager {
  readonly working: WorkingMemory;
  readonly episodic: EpisodicMemoryStore;
  readonly semantic: SemanticMemoryStore;
  readonly profile: ProfileMemoryStore;

  private initialized = false;

  constructor(workingMemoryCapacity: number = 32) {
    this.working = new WorkingMemory(workingMemoryCapacity);
    this.episodic = new EpisodicMemoryStore();
    this.semantic = new SemanticMemoryStore();
    this.profile = new ProfileMemoryStore();
  }

  /** Initialize all persistent stores */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    await Promise.all([
      this.episodic.load(),
      this.semantic.load(),
      this.profile.load(),
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

    return sections.join('\n\n');
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
  } {
    return {
      workingSlots: this.working.size,
      episodicCount: this.episodic.count,
      semanticCount: this.semantic.count,
    };
  }

  /** Clear all memory (for reset/testing) */
  async clearAll(): Promise<void> {
    this.working.clear();
    await this.episodic.clear();
    await this.semantic.clear();
    await this.profile.reset();
    agentBus.emit('memory:update', { type: 'cleared' });
  }
}

export { WorkingMemory } from './workingMemory';
export { EpisodicMemoryStore } from './episodicMemory';
export { SemanticMemoryStore } from './semanticMemory';
export { ProfileMemoryStore } from './profileMemory';
