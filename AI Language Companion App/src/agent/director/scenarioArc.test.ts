import { describe, it, expect } from 'vitest';
import {
  buildArcPromptInjection,
  buildStructuredDebriefContext,
  getScenarioArc,
  phaseMatchesTurn,
  resolvePhase,
  resolveScenarioArcBeat,
  STRUCTURED_DEBRIEF_INSTRUCTION,
} from './scenarioArc';

describe('scenarioArc', () => {
  it('loads arcs for the six Phase 3 scenarios', () => {
    for (const key of ['restaurant', 'market', 'directions', 'hotel', 'emergency', 'street_food']) {
      const arc = getScenarioArc(key);
      expect(arc, key).toBeDefined();
      expect(arc!.pretask_phrases.length).toBeGreaterThanOrEqual(2);
      expect(arc!.phases.length).toBeGreaterThanOrEqual(3);
      expect(arc!.expected_turns).toBeGreaterThan(0);
      expect(arc!.complications.length).toBeGreaterThan(0);
    }
  });

  it('phaseMatchesTurn handles single turn and ranges', () => {
    expect(phaseMatchesTurn({ id: 'a', turn: 2, prompt: 'x' }, 2)).toBe(true);
    expect(phaseMatchesTurn({ id: 'a', turn: 2, prompt: 'x' }, 3)).toBe(false);
    expect(phaseMatchesTurn({ id: 'b', turns: [3, 4], prompt: 'x' }, 4)).toBe(true);
    expect(phaseMatchesTurn({ id: 'b', turns: [3, 4], prompt: 'x' }, 5)).toBe(false);
  });

  it('resolvePhase picks exact beat then falls through to debrief past expected_turns', () => {
    const arc = getScenarioArc('restaurant')!;
    expect(resolvePhase(arc, 1)?.id).toBe('scene_set');
    expect(resolvePhase(arc, 4)?.id).toBe('ordering');
    expect(resolvePhase(arc, 8)?.id).toBe('debrief');
    expect(resolvePhase(arc, 12)?.id).toBe('debrief');
  });

  it('restaurant turn 1 injects pretask phrases and scene_set beat', () => {
    const beat = resolveScenarioArcBeat({
      scenarioKey: 'restaurant',
      turn: 1,
      userMessage: 'hi',
      random: () => 0.99, // no complication
    });
    expect(beat.phaseId).toBe('scene_set');
    expect(beat.pretaskPhrases.length).toBe(3);
    expect(beat.suggestWrap).toBe(false);
    expect(beat.complication).toBeNull();

    const injection = buildArcPromptInjection('restaurant', beat);
    expect(injection).toMatch(/PRETASK PHRASES/);
    expect(injection).toMatch(/COACH-ON-THE-SIDE/);
    expect(injection).toMatch(/A table for/);
  });

  it('suggests wrap at expected_turns and includes structured debrief', () => {
    const beat = resolveScenarioArcBeat({
      scenarioKey: 'directions',
      turn: 6,
      userMessage: 'ok',
      random: () => 0.99,
    });
    expect(beat.suggestWrap).toBe(true);
    expect(beat.isDebrief).toBe(true);

    const injection = buildArcPromptInjection('directions', beat);
    expect(injection).toMatch(/ARC COMPLETE/);
    expect(injection).toContain(STRUCTURED_DEBRIEF_INSTRUCTION.slice(0, 40));
  });

  it('suggests wrap early when user signals completion after turn 3', () => {
    const beat = resolveScenarioArcBeat({
      scenarioKey: 'market',
      turn: 4,
      userMessage: "thanks, that's all for now",
      random: () => 0.99,
    });
    expect(beat.suggestWrap).toBe(true);
  });

  it('injects a complication once when RNG fires and not already used', () => {
    let calls = 0;
    const random = () => {
      calls += 1;
      // first call: < 0.28 → fire; second: pick index 0
      return calls === 1 ? 0.1 : 0;
    };
    const beat = resolveScenarioArcBeat({
      scenarioKey: 'restaurant',
      turn: 3,
      userMessage: 'one coffee',
      complicationAlreadyUsed: false,
      random,
    });
    expect(beat.complication).toBeTruthy();
    expect(buildArcPromptInjection('restaurant', beat)).toMatch(/COMPLICATION/);
  });

  it('skips complication when already used', () => {
    const beat = resolveScenarioArcBeat({
      scenarioKey: 'restaurant',
      turn: 3,
      userMessage: 'one coffee',
      complicationAlreadyUsed: true,
      random: () => 0,
    });
    expect(beat.complication).toBeNull();
  });

  it('falls back to generic OPENING/MIDDLE/WRAPPING without an arc', () => {
    const opening = resolveScenarioArcBeat({
      scenarioKey: 'nightlife',
      turn: 1,
      userMessage: 'hey',
    });
    expect(opening.phaseId).toBe('opening');
    expect(opening.phasePrompt).toMatch(/OPENING/);

    const wrap = resolveScenarioArcBeat({
      scenarioKey: 'nightlife',
      turn: 7,
      userMessage: 'ok',
    });
    expect(wrap.suggestWrap).toBe(true);
    expect(wrap.phaseId).toBe('wrapping');
  });

  it('buildStructuredDebriefContext includes scenario focus', () => {
    const text = buildStructuredDebriefContext('hotel');
    expect(text).toMatch(/Hotel Check-In/);
    expect(text).toMatch(/Focus this debrief on/);
    expect(text).toMatch(/quote their actual words/i);
  });
});
