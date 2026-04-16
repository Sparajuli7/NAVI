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

import type { RelationshipState, SharedMilestone, SharedReference } from '../core/types';
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

  /** Add a shared reference (inside joke, callback) — stores with timing metadata (EXP-012) */
  async addSharedReference(avatarId: string, reference: string): Promise<void> {
    if (!this.loaded) await this.load();

    const rel = this.getRelationship(avatarId);
    const richRef: SharedReference = {
      text: reference,
      createdAtInteraction: rel.interactionCount,
      createdAt: Date.now(),
      callbackCount: 0,
      lastCallbackAtInteraction: 0,
    };
    // Keep last 20 references
    rel.sharedReferences.push(richRef);
    if (rel.sharedReferences.length > 20) {
      rel.sharedReferences = rel.sharedReferences.slice(-20);
    }

    await this.save();
  }

  /** Extract text from a shared reference (handles legacy string and rich SharedReference) */
  private getRefText(ref: string | SharedReference): string {
    return typeof ref === 'string' ? ref : ref.text;
  }

  /** Normalize a legacy string ref into a SharedReference */
  private normalizeRef(ref: string | SharedReference, fallbackInteraction: number): SharedReference {
    if (typeof ref === 'string') {
      return {
        text: ref,
        createdAtInteraction: fallbackInteraction,
        createdAt: Date.now(),
        callbackCount: 0,
        lastCallbackAtInteraction: 0,
      };
    }
    return ref;
  }

  // ── Shared References Callback System ────────────────────────

  /**
   * Returns a shared reference to weave into conversation, gated by warmth tier.
   * Frequency: stranger=never, acquaintance=rare(10%), friend=sometimes(30%),
   * close_friend=often(50%), family=natural(70%).
   *
   * EXP-012: Timing-aware callback scheduling based on research:
   *   - 1st callback: 3-5 messages after creation (immediate recognition)
   *   - 2nd callback: 15-20 messages after creation (surprised delight)
   *   - 3rd+ callback: 50+ messages after creation (deep bond, next session)
   * References in the right time window get priority over random picks.
   *
   * Returns null if no callback should happen this turn.
   */
  getCallbackSuggestion(avatarId: string): string | null {
    const rel = this.getRelationship(avatarId);
    if (rel.sharedReferences.length === 0) return null;

    const label = this.getWarmthLabel(rel.warmth);
    const frequencies: Record<string, number> = {
      stranger: 0,
      acquaintance: 0.1,
      friend: 0.3,
      close_friend: 0.5,
      family: 0.7,
    };
    const freq = frequencies[label] ?? 0;
    if (Math.random() > freq) return null;

    const now = rel.interactionCount;

    // Normalize all refs and find ones in optimal callback windows
    const candidates: { ref: SharedReference; index: number; priority: number }[] = [];

    for (let i = 0; i < rel.sharedReferences.length; i++) {
      const normalized = this.normalizeRef(rel.sharedReferences[i], Math.max(0, now - 50));
      const age = now - normalized.createdAtInteraction;
      const sinceLastCallback = now - normalized.lastCallbackAtInteraction;

      let priority = 0;

      if (normalized.callbackCount === 0 && age >= 3 && age <= 8) {
        // 1st callback window: 3-8 messages after event (immediate recognition)
        priority = 3;
      } else if (normalized.callbackCount === 1 && age >= 15 && age <= 25) {
        // 2nd callback window: 15-25 messages after event (surprised delight)
        priority = 2;
      } else if (normalized.callbackCount >= 2 && sinceLastCallback >= 50) {
        // 3rd+ callback: 50+ messages since last callback (deep bond)
        priority = 1;
      }

      if (priority > 0) {
        candidates.push({ ref: normalized, index: i, priority });
      }
    }

    // Sort by priority (highest first), pick the best candidate
    candidates.sort((a, b) => b.priority - a.priority);

    if (candidates.length > 0) {
      const picked = candidates[0];
      // Update the stored reference with callback metadata
      picked.ref.callbackCount++;
      picked.ref.lastCallbackAtInteraction = now;
      rel.sharedReferences[picked.index] = picked.ref;
      // Fire-and-forget save
      this.save().catch(() => {});
      console.log(`[NAVI:relationship] EXP-012 timed callback: "${picked.ref.text}" (count=${picked.ref.callbackCount}, priority=${picked.priority})`);
      return picked.ref.text;
    }

    // Fallback: pick a random reference (legacy behavior for refs with no timing data)
    const refs = rel.sharedReferences;
    const recentBias = Math.random() < 0.7;
    const pool = recentBias ? refs.slice(-Math.ceil(refs.length / 2)) : refs;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    return this.getRefText(picked) ?? null;
  }

  // ── Backstory Tier ─────────────────────────────────────────────

  /**
   * Get the current backstory disclosure tier (0-4) for an avatar.
   *
   * EXP-010: Changed from interaction-count-linked (every 50 interactions)
   * to warmth-linked. Backstory disclosure should track emotional closeness,
   * not just time spent. The warmth tiers already model this progression:
   *   stranger  (0.0-0.2) → tier 0 (no backstory)
   *   acquaintance (0.2-0.4) → tier 1 (surface-level daily life)
   *   friend    (0.4-0.6) → tier 2 (casual personal stories)
   *   close_friend (0.6-0.8) → tier 3 (real personal things)
   *   family    (0.8-1.0) → tier 4 (deep/vulnerable)
   *
   * Previous: Math.floor(interactionCount / 50) — took ~40 sessions to reach
   * full disclosure (50 interactions × 4 tiers ÷ 5 msgs/session = 40 sessions).
   * Now: directly mapped to warmth, which itself takes ~200 interactions to max
   * but reaches "friend" (tier 2) by session ~9. This front-loads surface
   * disclosure while keeping deep vulnerability gated behind real relationship.
   */
  getBackstoryTier(avatarId: string): number {
    const rel = this.getRelationship(avatarId);
    if (rel.warmth >= 0.8) return 4;
    if (rel.warmth >= 0.6) return 3;
    if (rel.warmth >= 0.4) return 2;
    if (rel.warmth >= 0.2) return 1;
    return 0;
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

    // Backstory disclosure tier instruction
    const backstoryTier = this.getBackstoryTier(avatarId);
    try {
      const backstoryInstruction = promptLoader.get(`systemLayers.backstoryDisclosure.tier_${backstoryTier}`) as string;
      if (backstoryInstruction) sections.push(backstoryInstruction);
    } catch {
      // backstoryDisclosure config not yet loaded — skip silently
    }

    // Callback suggestion — a specific shared reference to weave in this turn
    const callback = this.getCallbackSuggestion(avatarId);
    if (callback) {
      sections.push(`CALLBACK: You remember this about them: "${callback}". Don't announce you remember — reference it in a way that shows you CARE. If it was a struggle, check on them. If a success, build on it. Show you were thinking about them.`);
    }

    // Shared references (general pool for the avatar to draw from)
    if (rel.sharedReferences.length > 0) {
      const refs = rel.sharedReferences.slice(-5).map(r => this.getRefText(r)).join('; ');
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
