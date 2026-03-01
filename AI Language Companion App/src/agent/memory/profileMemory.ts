/**
 * NAVI Agent Framework — Profile Memory
 *
 * Persistent user profile: preferences, learning progress, notes.
 * This is the "who is this user" memory that persists across all
 * conversations and avatar sessions.
 *
 * Design decision: Flat JSON stored in IndexedDB.
 * User profile data is small (<10KB) and read frequently.
 * No need for a database — a single JSON blob is sufficient.
 * Updates are merged, not replaced, to prevent data loss.
 */

import type { ProfileMemory } from '../core/types';
import { get, set } from 'idb-keyval';
import { agentBus } from '../core/eventBus';

const STORAGE_KEY = 'navi_profile_memory';

const DEFAULT_PROFILE: ProfileMemory = {
  nativeLanguage: 'English',
  preferences: {},
  learningProgress: {},
  notes: [],
};

export class ProfileMemoryStore {
  private profile: ProfileMemory = { ...DEFAULT_PROFILE };
  private loaded = false;

  async load(): Promise<void> {
    const stored = await get<ProfileMemory>(STORAGE_KEY);
    if (stored) {
      this.profile = { ...DEFAULT_PROFILE, ...stored };
    }
    this.loaded = true;
  }

  async save(): Promise<void> {
    await set(STORAGE_KEY, this.profile);
    agentBus.emit('memory:update', { type: 'profile', profile: this.profile });
  }

  /** Get the full profile */
  getProfile(): ProfileMemory {
    return { ...this.profile };
  }

  /** Update preferences (merges with existing) */
  async updatePreferences(prefs: Record<string, unknown>): Promise<void> {
    if (!this.loaded) await this.load();
    this.profile.preferences = { ...this.profile.preferences, ...prefs };
    await this.save();
  }

  /** Update learning progress for a specific skill/language */
  async updateProgress(key: string, value: unknown): Promise<void> {
    if (!this.loaded) await this.load();
    this.profile.learningProgress[key] = value;
    await this.save();
  }

  /** Set native language */
  async setNativeLanguage(lang: string): Promise<void> {
    if (!this.loaded) await this.load();
    this.profile.nativeLanguage = lang;
    await this.save();
  }

  /** Add a note */
  async addNote(note: string): Promise<void> {
    if (!this.loaded) await this.load();
    this.profile.notes.push(note);
    // Keep last 50 notes
    if (this.profile.notes.length > 50) {
      this.profile.notes = this.profile.notes.slice(-50);
    }
    await this.save();
  }

  /** Remove a note by index */
  async removeNote(index: number): Promise<void> {
    if (!this.loaded) await this.load();
    this.profile.notes.splice(index, 1);
    await this.save();
  }

  /** Format profile for prompt injection */
  formatForPrompt(): string {
    const lines: string[] = [];
    lines.push(`User's native language: ${this.profile.nativeLanguage}`);

    const prefs = this.profile.preferences;
    if (Object.keys(prefs).length > 0) {
      const prefStr = Object.entries(prefs)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      lines.push(`Preferences: ${prefStr}`);
    }

    if (this.profile.notes.length > 0) {
      lines.push(`User notes: ${this.profile.notes.slice(-5).join('; ')}`);
    }

    return lines.join('\n');
  }

  /** Reset to defaults */
  async reset(): Promise<void> {
    this.profile = { ...DEFAULT_PROFILE };
    await this.save();
  }
}
