import { describe, it, expect, beforeEach } from 'vitest';
import { WorkingMemory } from './workingMemory';
import {
  extractOpenLoopFromResponse,
  storeOpenLoop,
  getOpenLoops,
  formatOpenLoopsForPrompt,
} from './openLoops';

describe('openLoops', () => {
  let wm: WorkingMemory;

  beforeEach(() => {
    wm = new WorkingMemory(32);
  });

  it('extracts open loops from cliffhanger responses', () => {
    const loop = extractOpenLoopFromResponse(
      "Something crazy happened with the dumpling lady. I'll tell you later.",
      'av1',
    );
    expect(loop).not.toBeNull();
    expect(loop!.summary).toMatch(/tell you later/i);
  });

  it('stores and retrieves per avatar', () => {
    const loop = extractOpenLoopFromResponse(
      "Remind me to tell you about the neighbor...",
      'av1',
    )!;
    storeOpenLoop(wm, loop);
    expect(getOpenLoops(wm, 'av1')).toHaveLength(1);
    expect(getOpenLoops(wm, 'other')).toHaveLength(0);
  });

  it('formats prompt for cross-session continuity', () => {
    storeOpenLoop(wm, {
      summary: 'Story about the market fight',
      createdAt: Date.now(),
      avatarId: 'av1',
    });
    const text = formatOpenLoopsForPrompt(getOpenLoops(wm, 'av1'));
    expect(text).toMatch(/OPEN LOOPS FROM LAST TIME/);
    expect(text).toMatch(/one target phrase/);
  });
});
