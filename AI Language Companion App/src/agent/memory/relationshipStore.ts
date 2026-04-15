/**
 * NAVI Agent Framework — Relationship Store
 *
 * Tracks the avatar-user bond per avatar. Warmth grows over time
 * and changes how the avatar talks (stranger → family).
 *
 * Warmth mechanics:
 * - +0.005 per interaction
 * - +0.02 per session
 * - +0.05 per milestone
 * - -0.003 per inactive day (never below 0.15 once acquaintance reached)
 *
 * ~200 interactions to reach max warmth (natural over weeks of use).
 *
 * Storage: IndexedDB via idb-keyval. ~5KB per avatar.
 */

import type { RelationshipState, SharedMilestone } from '../core/types';
import { get, set } from 'idb-keyval';
import { agentBus } from '../core/eventBus';
import { promptLoader } from '../prompts/promptLoader';

const STORAGE_KEY = 'navi_relationships';

// Warmth deltas
const WARMTH_PER_INTERACTION = 0.005;
const WARMTH_PER_SESSION = 0.02;
const WARMTH_PER_MILESTONE = 0.05;
const WARMTH_DECAY_PER_DAY = 0.003;
const WARMTH_FLOOR = 0.15; // Never decay below this once acquaintance reached

interface WarmthLevel {
  range: [number, number];
  label: string;
  instruction: string;
}

export class RelationshipStore {
  private relationships: Record<string, RelationshipState> = {};
  private loaded = false;

  async load(): Promise<void> {
    const stored = await get<Record<string, RelationshipState>>(STORAGE_KEY);
    if (stored) {
      // Validate array fields — IndexedDB data may be corrupted
      for (const rel of Object.values(stored)) {
        if (!Array.isArray(rel.sharedReferences)) rel.sharedReferences = [];
        if (!Array.isArray(rel.milestones)) rel.milestones = [];
      }
      this.relationships = stored;
    }
    this.loaded = true;
  }

  async save(): Promise<void> {
    await set(STORAGE_KEY, this.relationships);
  }

  // ── Core Operations ──────────────────────────────────────────

  /** Get or create a relationship for an avatar */
  getRelationship(avatarId: string): RelationshipState {
    if (!this.relationships[avatarId]) {
      this.relationships[avatarId] = {
        avatarId,
        warmth: 0.1,
        interactionCount: 0,
        sessionCount: 0,
        streak: 0,
        lastInteraction: Date.now(),
        sharedReferences: [],
        milestones: [],
      };
    }
    return this.relationships[avatarId];
  }

  /** Record an interaction (each message exchange) */
  async recordInteraction(avatarId: string): Promise<void> {
    if (!this.loaded) await this.load();

    const rel = this.getRelationship(avatarId);
    const prevWarmth = rel.warmth;

    rel.interactionCount++;
    rel.warmth = Math.min(1, rel.warmth + WARMTH_PER_INTERACTION);
    rel.lastInteraction = Date.now();

    // Check for warmth tier change
    const prevLabel = this.getWarmthLabel(prevWarmth);
    const newLabel = this.getWarmthLabel(rel.warmth);
    if (prevLabel !== newLabel) {
      agentBus.emit('relationship:warmth_change', {
        avatarId,
        from: prevLabel,
        to: newLabel,
        warmth: rel.warmth,
      });
    }

    await this.save();
  }

  /** Record a session start */
  async recordSession(avatarId: string): Promise<void> {
    if (!this.loaded) await this.load();

    const rel = this.getRelationship(avatarId);
    rel.sessionCount++;
    rel.warmth = Math.min(1, rel.warmth + WARMTH_PER_SESSION);

    // Streak tracking
    const dayMs = 24 * 60 * 60 * 1000;
    const lastDay = Math.floor(rel.lastInteraction / dayMs);
    const today = Math.floor(Date.now() / dayMs);

    if (today - lastDay === 1) {
      rel.streak++;
    } else if (today > lastDay) {
      rel.streak = 1;
    }

    // Apply warmth decay for inactive days
    this.applyDecay(avatarId);

    await this.save();
  }

  /** Add a milestone (first phrase, 100 words learned, etc.) */
  async addMilestone(avatarId: string, description: string): Promise<SharedMilestone> {
    if (!this.loaded) await this.load();

    const rel = this.getRelationship(avatarId);
    const milestone: SharedMilestone = {
      id: `ms_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      description,
      timestamp: Date.now(),
      avatarId,
    };

    rel.milestones.push(milestone);
    rel.warmth = Math.min(1, rel.warmth + WARMTH_PER_MILESTONE);

    agentBus.emit('relationship:milestone', { avatarId, milestone });
    await this.save();
    return milestone;
  }

  /** Add a shared reference (inside joke, callback) */
  async addSharedReference(avatarId: string, reference: string): Promise<void> {
    if (!this.loaded) await this.load();

    const rel = this.getRelationship(avatarId);
    // Keep last 20 references
    rel.sharedReferences.push(reference);
    if (rel.sharedReferences.length > 20) {
      rel.sharedReferences = rel.sharedReferences.slice(-20);
    }

    await this.save();
  }

  // ── Warmth & Prompt Integration ──────────────────────────────

  /** Get the warmth tier instruction for this avatar */
  getWarmthInstruction(avatarId: string): string {
    const rel = this.getRelationship(avatarId);
    const levels = promptLoader.getRaw('warmthLevels.levels') as WarmthLevel[];

    for (const level of levels) {
      if (rel.warmth >= level.range[0] && rel.warmth < level.range[1]) {
        return level.instruction;
      }
    }

    // Default to highest tier if warmth is exactly 1.0
    return levels[levels.length - 1].instruction;
  }

  /** Format relationship context for system prompt injection */
  formatForPrompt(avatarId: string): string {
    const rel = this.getRelationship(avatarId);
    const sections: string[] = [];

    // Warmth instruction
    sections.push(this.getWarmthInstruction(avatarId));

    // Shared references
    if (rel.sharedReferences.length > 0) {
      const refs = rel.sharedReferences.slice(-5).join('; ');
      sections.push(`Shared memories you can reference: ${refs}`);
    }

    // Milestone context
    if (rel.milestones.length > 0) {
      const recent = rel.milestones.slice(-3);
      const milestoneText = recent.map((m) => m.description).join('; ');
      sections.push(`Recent milestones together: ${milestoneText}`);
    }

    // Streak context
    if (rel.streak >= 3) {
      sections.push(`The user has been practicing ${rel.streak} days in a row.`);
    }

    return sections.join('\n');
  }

  // ── Warmth Decay ─────────────────────────────────────────────

  /** Apply time-based warmth decay (call on session start) */
  applyDecay(avatarId: string): void {
    const rel = this.getRelationship(avatarId);
    const dayMs = 24 * 60 * 60 * 1000;
    const inactiveDays = Math.floor((Date.now() - rel.lastInteraction) / dayMs);

    if (inactiveDays > 0) {
      const decay = inactiveDays * WARMTH_DECAY_PER_DAY;
      const floor = rel.warmth >= 0.2 ? WARMTH_FLOOR : 0;
      rel.warmth = Math.max(floor, rel.warmth - decay);
    }
  }

  // ── Accessors ────────────────────────────────────────────────

  /** Get warmth tier label for a warmth value */
  private getWarmthLabel(warmth: number): string {
    const levels = promptLoader.getRaw('warmthLevels.levels') as WarmthLevel[];
    for (const level of levels) {
      if (warmth >= level.range[0] && warmth < level.range[1]) {
        return level.label;
      }
    }
    return levels[levels.length - 1].label;
  }

  /** Get all tracked relationships */
  getAll(): Record<string, RelationshipState> {
    return { ...this.relationships };
  }

  /** Get count of relationships */
  get count(): number {
    return Object.keys(this.relationships).length;
  }

  async clear(): Promise<void> {
    this.relationships = {};
    await this.save();
  }
}
