/**
 * Emotional Memory Store — peak moments for safe bonding callbacks.
 * Max 50 per avatar. Never surface negative memories without positive contrast.
 */

import { get, set } from 'idb-keyval';
import type {
  EmotionalMemory,
  EmotionalPeak,
  EmotionalValence,
  EmotionalResolution,
} from '../core/types';

const STORAGE_KEY = 'navi_emotional_memories';
const MAX_PER_AVATAR = 50;
const PEAK_THRESHOLD = 0.3;

/** Matches ConversationDirector EmotionalState without importing it (avoids cycles). */
export type PeakInputState = 'excited' | 'frustrated' | 'anxious' | 'proud' | 'neutral' | 'confused';

export function mapEmotionalStateToPeak(state: PeakInputState): EmotionalPeak | null {
  switch (state) {
    case 'frustrated': return 'frustration';
    case 'excited': return 'excitement';
    case 'proud': return 'pride';
    case 'anxious': return 'vulnerability';
    case 'confused': return null; // not a bonding peak
    case 'neutral': return null;
  }
}

export function scoreEmotionalPeak(
  state: PeakInputState,
  message: string,
): { emotion: EmotionalPeak; intensity: number; valence: EmotionalValence } | null {
  const peak = mapEmotionalStateToPeak(state);
  if (!peak) return null;

  const len = message.trim().length;
  let intensity = 0.35;
  if (len > 80) intensity += 0.15;
  if (len > 160) intensity += 0.1;
  if (/!{2,}|\?{2,}/.test(message)) intensity += 0.1;
  if (/[🎉🔥💪😢😭😤]/u.test(message)) intensity += 0.1;

  if (peak === 'pride' || /\bi did it\b|\bfinally\b|\bthey understood\b/i.test(message)) {
    intensity = Math.max(intensity, 0.7);
    return { emotion: 'breakthrough', intensity: Math.min(1, intensity + 0.15), valence: 'positive' };
  }

  const valence: EmotionalValence =
    peak === 'frustration' || peak === 'vulnerability' ? 'negative'
      : peak === 'excitement' || peak === 'pride' || peak === 'joy' ? 'positive'
        : 'mixed';

  if (intensity < PEAK_THRESHOLD) return null;
  return { emotion: peak, intensity: Math.min(1, intensity), valence };
}

export function computeReferenceability(memory: EmotionalMemory, now: number = Date.now()): number {
  const daysSinceCreation = (now - memory.timestamp) / (1000 * 60 * 60 * 24);
  const daysSinceReference = memory.callbackCount > 0 && memory.lastReferencedAt
    ? (now - memory.lastReferencedAt) / (1000 * 60 * 60 * 24)
    : daysSinceCreation;

  let score = memory.intensity;
  if (memory.emotion === 'breakthrough') score *= 1.5;
  if (memory.valence === 'positive') score *= 1.2;
  score *= Math.pow(0.7, memory.callbackCount);

  if (daysSinceCreation < 3) score *= 0.3;
  else if (daysSinceCreation < 7) score *= 0.7;
  else if (daysSinceCreation < 60) score *= 1.0;
  else if (daysSinceCreation < 90) score *= 0.8;
  else score *= 0.5;

  if (daysSinceReference < 5) score *= 0.2;

  return Math.min(1, Math.max(0, score));
}

function paraphraseQuote(quote: string): string {
  const trimmed = quote.trim().slice(0, 80);
  if (trimmed.length < 12) return 'they were feeling something strong';
  return trimmed.replace(/\bi\b/gi, 'they').replace(/!+/g, '.');
}

function timeAgo(ts: number, now: number): string {
  const days = Math.floor((now - ts) / (1000 * 60 * 60 * 24));
  if (days < 1) return 'earlier today';
  if (days === 1) return 'yesterday';
  if (days < 8) return `${days} days ago`;
  if (days < 35) return 'a few weeks ago';
  if (days < 100) return 'about a month ago';
  return 'a while back';
}

export type EmotionalReferenceTrigger = 'contrast' | 'echo' | 'anniversary' | 'vulnerability';

export function pickEmotionalReference(
  memories: EmotionalMemory[],
  currentState: PeakInputState,
  alreadyReferencedThisSession: boolean,
  now: number = Date.now(),
): { memory: EmotionalMemory; trigger: EmotionalReferenceTrigger; injection: string } | null {
  if (alreadyReferencedThisSession || memories.length === 0) return null;

  const scored = memories
    .map((m) => ({ m, score: computeReferenceability(m, now) }))
    .filter((x) => x.score > 0.55)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;

  // Safety: never dump negative without positive contrast
  const currentNegative = currentState === 'frustrated' || currentState === 'anxious';
  let chosen: { m: EmotionalMemory; score: number } | undefined;
  let trigger: EmotionalReferenceTrigger = 'echo';

  if (currentNegative) {
    // Contrast only: past struggle that resolved positively
    chosen = scored.find(
      (x) =>
        (x.m.emotion === 'frustration' || x.m.emotion === 'vulnerability')
        && x.m.resolution === 'resolved_positive',
    );
    trigger = 'contrast';
  } else if (currentState === 'proud' || currentState === 'excited') {
    chosen = scored.find((x) => x.m.valence === 'positive') ?? scored[0];
    trigger = 'echo';
  } else if (currentState === 'confused') {
    return null;
  } else {
    // Anniversary / positive free reference
    const anniversary = scored.find((x) => {
      const days = (now - x.m.timestamp) / (1000 * 60 * 60 * 24);
      return Math.abs(days - 7) < 1 || Math.abs(days - 30) < 2 || Math.abs(days - 90) < 3;
    });
    if (anniversary) {
      chosen = anniversary;
      trigger = 'anniversary';
    } else {
      chosen = scored.find((x) => x.m.valence === 'positive');
      trigger = 'echo';
    }
  }

  if (!chosen) return null;
  // Final safety: skip unresolved negatives
  if (chosen.m.valence === 'negative' && chosen.m.resolution !== 'resolved_positive') {
    return null;
  }

  const m = chosen.m;
  const strategy =
    trigger === 'contrast'
      ? 'Acknowledge the hard feeling, then gently contrast with how they got through a similar moment before. Do NOT quote them verbatim. Stay mostly in their language; one target phrase only.'
      : trigger === 'anniversary'
        ? 'Mention the time gap naturally ("you know what happened about a month ago…") then connect to now. Paraphrase, never quote.'
        : 'Echo the past win briefly as if you were thinking about them — warm, not performative.';

  const injection = [
    'EMOTIONAL CALLBACK — reference naturally, do not announce it:',
    `The user had a ${m.emotion} moment ${timeAgo(m.timestamp, now)}: ${m.trigger}`,
    `They said something like: "${paraphraseQuote(m.userQuote)}"`,
    `Outcome: ${m.resolution}`,
    `How to reference: ${strategy}`,
    'Max one callback this session. Never dump unresolved negative memories.',
  ].join('\n');

  return { memory: m, trigger, injection };
}

export class EmotionalMemoryStore {
  private byAvatar: Record<string, EmotionalMemory[]> = {};
  private loaded = false;

  async load(): Promise<void> {
    const stored = await get<Record<string, EmotionalMemory[]>>(STORAGE_KEY);
    if (stored) this.byAvatar = stored;
    this.loaded = true;
  }

  async save(): Promise<void> {
    await set(STORAGE_KEY, this.byAvatar);
  }

  getForAvatar(avatarId: string): EmotionalMemory[] {
    return this.byAvatar[avatarId] ?? [];
  }

  async add(memory: Omit<EmotionalMemory, 'id' | 'callbackCount' | 'hasBeenNarrativized'>): Promise<EmotionalMemory> {
    if (!this.loaded) await this.load();
    const full: EmotionalMemory = {
      ...memory,
      id: `em_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      callbackCount: 0,
      hasBeenNarrativized: false,
    };
    const list = this.byAvatar[memory.avatarId] ?? [];
    list.push(full);
    list.sort((a, b) => b.intensity - a.intensity);
    this.byAvatar[memory.avatarId] = list.slice(0, MAX_PER_AVATAR);
    await this.save();
    return full;
  }

  async markReferenced(avatarId: string, memoryId: string): Promise<void> {
    if (!this.loaded) await this.load();
    const list = this.byAvatar[avatarId];
    if (!list) return;
    const m = list.find((x) => x.id === memoryId);
    if (!m) return;
    m.callbackCount += 1;
    m.lastReferencedAt = Date.now();
    await this.save();
  }

  /** Best positive contrast memory for month-3 journey reflection */
  getJourneyContrast(avatarId: string): EmotionalMemory | null {
    const list = this.getForAvatar(avatarId);
    const positives = list
      .filter((m) => m.valence === 'positive' || m.resolution === 'resolved_positive')
      .sort((a, b) => b.intensity - a.intensity);
    return positives[0] ?? null;
  }

  async clear(): Promise<void> {
    this.byAvatar = {};
    await this.save();
  }
}

export function inferResolution(
  emotion: EmotionalPeak,
  valence: EmotionalValence,
  avatarResponse: string,
): EmotionalResolution {
  if (valence === 'positive') return 'resolved_positive';
  const warm = /\byou'?ve got this\b|\bit'?s okay\b|\bwe'?ll\b|\btogether\b|\bproud\b/i.test(avatarResponse);
  if (valence === 'negative' && warm) return 'resolved_positive';
  if (valence === 'negative') return 'unresolved';
  return 'ongoing';
}
