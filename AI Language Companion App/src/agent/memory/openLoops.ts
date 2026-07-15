/**
 * Cross-session open loops — unfinished conversational threads with 48h TTL
 * in WorkingMemory, mirrored lightly into episodic tags for continuity.
 */

import type { OpenLoopSlot } from '../core/types';
import type { WorkingMemory } from './workingMemory';
import type { EpisodicMemoryStore } from './episodicMemory';

const WM_KEY = 'open_loops';
const TTL_MS = 48 * 60 * 60 * 1000;
const MAX_LOOPS = 5;

const OPEN_LOOP_PATTERNS = [
  /I'?ll tell you (?:more )?later/i,
  /remind me to tell you/i,
  /to be continued/i,
  /you won'?t believe what/i,
  /next time (?:I|we|you)/i,
  /I have (?:a |this )?story about/i,
  /\.\.\.\s*$/,
  /ask me (?:about|later)/i,
];

export function extractOpenLoopFromResponse(
  llmResponse: string,
  avatarId: string,
): OpenLoopSlot | null {
  if (!OPEN_LOOP_PATTERNS.some((p) => p.test(llmResponse))) return null;
  // Prefer the last sentence as the hook
  const sentences = llmResponse.trim().split(/(?<=[.!?…])\s+/);
  const hook = sentences[sentences.length - 1]?.trim() || llmResponse.trim().slice(0, 100);
  return {
    summary: hook.slice(0, 140),
    createdAt: Date.now(),
    avatarId,
  };
}

export function storeOpenLoop(working: WorkingMemory, loop: OpenLoopSlot): void {
  const existing = (working.get(WM_KEY) as OpenLoopSlot[] | undefined) ?? [];
  const filtered = existing.filter(
    (l) => l.avatarId !== loop.avatarId || l.summary.slice(0, 40) !== loop.summary.slice(0, 40),
  );
  filtered.push(loop);
  working.set(WM_KEY, filtered.slice(-MAX_LOOPS), TTL_MS);
}

export function getOpenLoops(working: WorkingMemory, avatarId: string): OpenLoopSlot[] {
  const all = (working.get(WM_KEY) as OpenLoopSlot[] | undefined) ?? [];
  return all.filter((l) => l.avatarId === avatarId);
}

export function formatOpenLoopsForPrompt(loops: OpenLoopSlot[]): string {
  if (loops.length === 0) return '';
  const items = loops.slice(-2).map((l) => `- ${l.summary}`).join('\n');
  return [
    'OPEN LOOPS FROM LAST TIME — you left these unfinished. Pick one up naturally early if it fits.',
    'Do not announce "open loop." Just continue like a friend who remembered.',
    'Stay mostly in the user\'s language; one target phrase per message.',
    items,
  ].join('\n');
}

/** Persist a short episodic breadcrumb so loops survive WM eviction. */
export function persistOpenLoopEpisode(
  episodic: EpisodicMemoryStore,
  loop: OpenLoopSlot,
  location?: string,
): void {
  episodic
    .add({
      summary: `Open loop: ${loop.summary}`,
      timestamp: loop.createdAt,
      location,
      importance: 0.55,
      tags: ['open_loop', loop.avatarId],
    })
    .catch((e) => console.warn('[NAVI] open loop episodic persist failed', e));
}

export function loadOpenLoopsFromEpisodic(
  episodic: EpisodicMemoryStore,
  avatarId: string,
  maxAgeMs: number = TTL_MS,
): OpenLoopSlot[] {
  const cutoff = Date.now() - maxAgeMs;
  return episodic
    .getRecent(20)
    .filter(
      (ep) =>
        ep.timestamp >= cutoff
        && ep.tags?.includes('open_loop')
        && ep.tags?.includes(avatarId),
    )
    .map((ep) => ({
      summary: ep.summary.replace(/^Open loop:\s*/i, ''),
      createdAt: ep.timestamp,
      avatarId,
    }));
}
