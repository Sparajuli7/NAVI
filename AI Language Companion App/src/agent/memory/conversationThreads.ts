/**
 * Conversation Thread Store — unfinished stories/debates/projects/rituals.
 * Cap 30 active threads per avatar. Surfaced into director promptInjection.
 */

import { get, set } from 'idb-keyval';
import type { ConversationThread, ThreadType, ThreadStatus } from '../core/types';

const STORAGE_KEY = 'navi_conversation_threads';
const MAX_ACTIVE = 30;

function typeBonus(type: ThreadType): number {
  switch (type) {
    case 'debate': return 0.3;
    case 'story': return 0.2;
    case 'project': return 0.1;
    case 'ritual': return 0.05;
  }
}

function recencyScore(lastReferencedAt: number, now: number): number {
  const sessionsAgoApprox = (now - lastReferencedAt) / (1000 * 60 * 60 * 24); // days as proxy
  if (sessionsAgoApprox < 2) return 1.0;
  if (sessionsAgoApprox < 5) return 0.7;
  if (sessionsAgoApprox < 10) return 0.4;
  return 0.1;
}

function unresolvedScore(status: ThreadStatus, openQuestion: string): number {
  if (status === 'active' && openQuestion) return 1.0;
  if (status === 'dormant') return 0.5;
  return 0.0;
}

export function computeThreadPriority(thread: ConversationThread, now: number = Date.now()): number {
  return (
    thread.emotionalWeight * 0.4
    + recencyScore(thread.lastReferencedAt, now) * 0.3
    + unresolvedScore(thread.status, thread.openQuestion) * 0.2
    + typeBonus(thread.type) * 0.1
  );
}

/** Heuristic thread detection from user + avatar messages (no LLM). */
export function detectThreadCandidates(
  userMessage: string,
  llmResponse: string,
  avatarId: string,
): Omit<ConversationThread, 'id' | 'createdAt' | 'lastReferencedAt' | 'sessionCount' | 'status'>[] {
  const out: Omit<ConversationThread, 'id' | 'createdAt' | 'lastReferencedAt' | 'sessionCount' | 'status'>[] = [];
  const nowHint = Date.now();

  // Story / open loop from avatar
  const storyMarkers = /I'?ll tell you|remind me to tell|later\.|to be continued|you won'?t believe|so what happened was|\.\.\.\s*$/i;
  if (storyMarkers.test(llmResponse)) {
    out.push({
      type: 'story',
      summary: llmResponse.trim().slice(0, 120),
      openQuestion: 'What happened next in that story?',
      emotionalWeight: 0.55,
      avatarId,
      associatedTerms: [],
    });
  }

  // Project / micro-mission
  const projectMarkers = /\byou should try\b|\bnext time you\b|\bwhen you go\b|\bI'?m going to\b|\bI want to\b|\bI'?ll try\b|\btry saying\b/i;
  if (projectMarkers.test(userMessage) || projectMarkers.test(llmResponse)) {
    const src = projectMarkers.test(userMessage) ? userMessage : llmResponse;
    out.push({
      type: 'project',
      summary: src.trim().slice(0, 120),
      openQuestion: 'Did they follow through on this?',
      emotionalWeight: 0.45,
      avatarId,
      associatedTerms: [],
    });
  }

  // Debate
  const disagree = /\bI don'?t think\b|\bI disagree\b|\bno way\b|\bbut actually\b|\bthat'?s not\b/i;
  if (disagree.test(userMessage) && disagree.test(llmResponse)) {
    out.push({
      type: 'debate',
      summary: `Disagreement: ${userMessage.trim().slice(0, 80)}`,
      openQuestion: 'Where did you both land?',
      emotionalWeight: 0.65,
      avatarId,
      associatedTerms: [],
    });
  }

  void nowHint;
  return out;
}

export function formatThreadsForPrompt(threads: ConversationThread[]): string {
  if (threads.length === 0) return '';
  const blocks = threads.slice(0, 2).map((t, i) => {
    const role =
      t.type === 'story'
        ? 'Continue the story naturally — do not announce "we were talking about…".'
        : t.type === 'project'
          ? 'Ask casually whether they did it, like you\'ve been thinking about it.'
          : t.type === 'debate'
            ? 'Revisit the disagreement lightly — you can still hold your opinion.'
            : 'Keep the ritual warm and brief.';
    return `Thread ${i + 1} (${t.type}, ${t.status}): ${t.summary}\nOpen: ${t.openQuestion}\nYour role: ${role}`;
  });
  return [
    'ACTIVE CONVERSATION THREADS — pick up at least one naturally early in this chat.',
    'Stay mostly in the user\'s language; embed one target phrase per message.',
    ...blocks,
  ].join('\n');
}

export class ConversationThreadStore {
  private threads: ConversationThread[] = [];
  private loaded = false;

  async load(): Promise<void> {
    const stored = await get<ConversationThread[]>(STORAGE_KEY);
    if (stored) this.threads = stored;
    this.loaded = true;
  }

  async save(): Promise<void> {
    await set(STORAGE_KEY, this.threads);
  }

  getForAvatar(avatarId: string): ConversationThread[] {
    return this.threads.filter((t) => t.avatarId === avatarId);
  }

  getActive(avatarId: string): ConversationThread[] {
    return this.getForAvatar(avatarId).filter((t) => t.status === 'active' || t.status === 'dormant');
  }

  topThreads(avatarId: string, limit = 2): ConversationThread[] {
    const now = Date.now();
    return this.getActive(avatarId)
      .map((t) => ({ t, p: computeThreadPriority(t, now) }))
      .sort((a, b) => b.p - a.p)
      .slice(0, limit)
      .map((x) => x.t);
  }

  async add(
    partial: Omit<ConversationThread, 'id' | 'createdAt' | 'lastReferencedAt' | 'sessionCount' | 'status'>,
  ): Promise<ConversationThread> {
    if (!this.loaded) await this.load();

    // Deduplicate near-identical summaries
    const existing = this.getActive(partial.avatarId).find(
      (t) => t.summary.slice(0, 40) === partial.summary.slice(0, 40),
    );
    if (existing) {
      existing.lastReferencedAt = Date.now();
      existing.sessionCount += 1;
      await this.save();
      return existing;
    }

    const thread: ConversationThread = {
      ...partial,
      id: `th_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
      lastReferencedAt: Date.now(),
      sessionCount: 1,
      status: 'active',
    };
    this.threads.push(thread);
    this.enforceCap(partial.avatarId);
    await this.save();
    return thread;
  }

  async markReferenced(threadId: string): Promise<void> {
    if (!this.loaded) await this.load();
    const t = this.threads.find((x) => x.id === threadId);
    if (!t) return;
    t.lastReferencedAt = Date.now();
    t.sessionCount += 1;
    if (t.status === 'dormant') t.status = 'active';
    await this.save();
  }

  async resolve(threadId: string): Promise<void> {
    if (!this.loaded) await this.load();
    const t = this.threads.find((x) => x.id === threadId);
    if (!t) return;
    t.status = 'resolved';
    await this.save();
  }

  /** Age out stale active threads → dormant; trim excess. */
  private enforceCap(avatarId: string): void {
    const now = Date.now();
    const mine = this.threads.filter((t) => t.avatarId === avatarId);
    for (const t of mine) {
      const days = (now - t.lastReferencedAt) / (1000 * 60 * 60 * 24);
      if (t.status === 'active' && days > 14) t.status = 'dormant';
      if (t.status === 'dormant' && days > 45) t.status = 'abandoned';
    }
    const active = mine
      .filter((t) => t.status === 'active')
      .sort((a, b) => computeThreadPriority(b) - computeThreadPriority(a));
    for (const overflow of active.slice(MAX_ACTIVE)) {
      overflow.status = 'dormant';
    }
  }

  async clear(): Promise<void> {
    this.threads = [];
    await this.save();
  }
}
