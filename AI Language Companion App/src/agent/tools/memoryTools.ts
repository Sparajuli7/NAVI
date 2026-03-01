/**
 * NAVI Agent Framework — Memory Tools
 *
 * Tools for storing and recalling information from memory.
 */

import type { ToolDefinition } from '../core/toolRegistry';
import type { MemoryManager } from '../memory';

export function createMemoryRecallTool(
  memoryManager: MemoryManager,
): ToolDefinition {
  return {
    name: 'memory_recall',
    description: 'Recall information from past conversations and user profile.',
    paramSchema: {
      message: { type: 'string', required: true, description: 'What to recall' },
    },
    requiredModels: [],
    costTier: 'light',

    async execute(params: Record<string, unknown>): Promise<unknown> {
      const query = params.message as string;

      // Search episodic memory
      const episodes = memoryManager.episodic.search(query, 5);

      // Check working memory
      const workingSlots = memoryManager.working.getAll();
      const relevantSlots = workingSlots.filter(
        (s) => s.key.toLowerCase().includes(query.toLowerCase()) ||
               JSON.stringify(s.value).toLowerCase().includes(query.toLowerCase()),
      );

      // Get profile info
      const profile = memoryManager.profile.getProfile();

      return {
        episodes: episodes.map((ep) => ({
          summary: ep.summary,
          date: new Date(ep.timestamp).toLocaleDateString(),
          location: ep.location,
        })),
        workingMemory: relevantSlots.map((s) => ({ key: s.key, value: s.value })),
        profile: {
          nativeLanguage: profile.nativeLanguage,
          notes: profile.notes.slice(-5),
        },
      };
    },
  };
}

export function createMemoryStoreTool(
  memoryManager: MemoryManager,
): ToolDefinition {
  return {
    name: 'memory_store',
    description: 'Store information for future recall.',
    paramSchema: {
      key: { type: 'string', required: true, description: 'What to remember' },
      value: { type: 'string', required: true, description: 'The information' },
      type: { type: 'string', required: false, description: 'working | episodic | profile' },
    },
    requiredModels: [],
    costTier: 'light',

    async execute(params: Record<string, unknown>): Promise<unknown> {
      const key = params.key as string;
      const value = params.value as string;
      const type = (params.type as string) ?? 'working';

      switch (type) {
        case 'working':
          memoryManager.working.set(key, value);
          break;
        case 'episodic':
          await memoryManager.episodic.add({
            summary: `${key}: ${value}`,
            timestamp: Date.now(),
            importance: 0.6,
            tags: [key],
          });
          break;
        case 'profile':
          await memoryManager.profile.addNote(`${key}: ${value}`);
          break;
      }

      return { stored: true, type, key };
    },
  };
}
