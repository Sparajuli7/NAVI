/**
 * TBLT scenario arc helpers — resolve beat-specific prompts from
 * per-scenario arc definitions in scenarioContexts.json.
 *
 * Pure functions (no LLM). Falls back to generic OPENING/MIDDLE/WRAPPING
 * when a scenario has no arc config.
 */

import type { ScenarioArc, ScenarioArcPhase, ScenarioPretaskPhrase } from '../../types/config';
import scenarioContextsRaw from '../../config/scenarioContexts.json';

/** Structured debrief instruction shared by End Scenario + arc-complete wrap. */
export const STRUCTURED_DEBRIEF_INSTRUCTION = `DEBRIEF MODE: Step completely out of scenario mode. Your debrief MUST follow this structure:
(1) NAME ONE SPECIFIC THING THEY SAID CORRECTLY — quote their actual words. "When you said '...' — that was spot on."
(2) NAME ONE SPECIFIC THING TO IMPROVE — give the corrected form. "When you tried to say X, the natural way is Y. Here's how: **Y** (pronunciation)."
(3) Present 2 phrase cards for the most useful phrases from this scenario (use full **Phrase:**/**Say it:**/**Sound tip:**/**Means:**/**Tip:** format).
Be honest and warm, not generic. QUOTE what the user actually said — this makes it real, not cheerleading.`;

export interface ScenarioArcBeat {
  phaseId: string;
  turn: number;
  expectedTurns: number;
  /** Beat-specific prompt for the avatar (coach-on-the-side). */
  phasePrompt: string;
  /** Pretask phrases to surface (opening / pretask beats). */
  pretaskPhrases: ScenarioPretaskPhrase[];
  /** Whether this beat is the debrief / wrap phase. */
  isDebrief: boolean;
  /** Arc is complete — UI should suggest wrapping. */
  suggestWrap: boolean;
  /** Optional complication to inject this turn (at most once per scenario). */
  complication: string | null;
}

type ScenarioConfigWithArc = {
  label?: string;
  debrief_focus?: string;
  arc?: ScenarioArc;
};

const SCENARIOS = scenarioContextsRaw as Record<string, ScenarioConfigWithArc>;

const COMPLETION_SIGNALS =
  /\b(thank you|thanks|got it|ok great|sounds good|perfect|see you|bye|that's all|i'm done|all good|got what i needed)\b/i;

/** Look up arc definition for a scenario key (undefined if none). */
export function getScenarioArc(scenarioKey: string): ScenarioArc | undefined {
  return SCENARIOS[scenarioKey]?.arc;
}

export function getScenarioDebriefFocus(scenarioKey: string): string | undefined {
  return SCENARIOS[scenarioKey]?.debrief_focus;
}

export function getScenarioLabel(scenarioKey: string): string {
  return SCENARIOS[scenarioKey]?.label ?? scenarioKey;
}

/** Whether a phase applies to the given turn number. */
export function phaseMatchesTurn(phase: ScenarioArcPhase, turn: number): boolean {
  if (typeof phase.turn === 'number') return phase.turn === turn;
  if (Array.isArray(phase.turns)) return phase.turns.includes(turn);
  return false;
}

/** Find the active phase for a turn; if past last phase, return the last (usually debrief). */
export function resolvePhase(arc: ScenarioArc, turn: number): ScenarioArcPhase | null {
  const { phases } = arc;
  if (!phases.length) return null;

  const exact = phases.find((p) => phaseMatchesTurn(p, turn));
  if (exact) return exact;

  // Past expected turns → last phase (debrief)
  if (turn >= arc.expected_turns) {
    return phases[phases.length - 1] ?? null;
  }

  // Between defined turns — pick nearest prior phase
  let best: ScenarioArcPhase | null = null;
  let bestTurn = -1;
  for (const p of phases) {
    const t = typeof p.turn === 'number' ? p.turn : Math.min(...(p.turns ?? [Infinity]));
    if (t <= turn && t > bestTurn) {
      best = p;
      bestTurn = t;
    }
  }
  return best;
}

function isDebriefPhase(phase: ScenarioArcPhase | null): boolean {
  if (!phase) return false;
  return phase.id === 'debrief' || /debrief|wrap/i.test(phase.id);
}

/**
 * Resolve the arc beat for this turn. When `arc` is missing, returns a
 * generic OPENING / MIDDLE / WRAPPING beat (EXP-061 fallback).
 */
export function resolveScenarioArcBeat(options: {
  scenarioKey: string;
  turn: number;
  userMessage: string;
  /** True if a complication was already injected this scenario session. */
  complicationAlreadyUsed?: boolean;
  /** RNG for complication roll; inject for tests. Default Math.random. */
  random?: () => number;
}): ScenarioArcBeat {
  const {
    scenarioKey,
    turn,
    userMessage,
    complicationAlreadyUsed = false,
    random = Math.random,
  } = options;

  const arc = getScenarioArc(scenarioKey);
  const userSignaledCompletion = turn > 3 && COMPLETION_SIGNALS.test(userMessage);

  if (!arc) {
    return resolveGenericBeat(turn, userSignaledCompletion);
  }

  const phase = resolvePhase(arc, turn);
  const atOrPastEnd = turn >= arc.expected_turns || userSignaledCompletion;
  const debrief = isDebriefPhase(phase) || atOrPastEnd;

  const pretaskPhrases =
    turn <= 2 || phase?.id === 'scene_set' || phase?.id === 'pretask'
      ? arc.pretask_phrases
      : [];

  let complication: string | null = null;
  if (
    !complicationAlreadyUsed &&
    !debrief &&
    turn >= 3 &&
    turn < arc.expected_turns &&
    arc.complications.length > 0 &&
    random() < 0.28
  ) {
    const idx = Math.floor(random() * arc.complications.length);
    complication = arc.complications[idx] ?? null;
  }

  const phasePrompt = phase?.prompt
    ?? (debrief
      ? 'Step out of the scenario. Debrief honestly with one specific win and one improvement.'
      : 'Stay in coach-on-the-side mode. Let the user practice; recast errors.');

  return {
    phaseId: phase?.id ?? (debrief ? 'debrief' : 'task'),
    turn,
    expectedTurns: arc.expected_turns,
    phasePrompt,
    pretaskPhrases,
    isDebrief: debrief,
    suggestWrap: atOrPastEnd,
    complication,
  };
}

function resolveGenericBeat(turn: number, userSignaledCompletion: boolean): ScenarioArcBeat {
  const expectedTurns = 8;
  let phaseId: string;
  let phasePrompt: string;
  let suggestWrap = false;

  if (turn <= 2) {
    phaseId = 'opening';
    phasePrompt =
      'SCENARIO PHASE: OPENING — Set the scene, introduce key phrases for this situation. Ground the user in where they are and what\'s about to happen.';
  } else if (turn <= 5 && !userSignaledCompletion) {
    phaseId = 'middle';
    phasePrompt =
      'SCENARIO PHASE: MIDDLE — This is the core interaction. Let the user practice. Coach them through the real moments. Correct by recasting, not lecturing.';
  } else {
    phaseId = 'wrapping';
    phasePrompt =
      'SCENARIO PHASE: WRAPPING UP — Start closing the scenario naturally. Hint that a debrief is coming. If the user hasn\'t used a key phrase yet, create one last natural opportunity.';
    suggestWrap = true;
  }

  return {
    phaseId,
    turn,
    expectedTurns,
    phasePrompt,
    pretaskPhrases: [],
    isDebrief: suggestWrap,
    suggestWrap,
    complication: null,
  };
}

/** Build the prompt injection block for a resolved beat. */
export function buildArcPromptInjection(
  scenarioKey: string,
  beat: ScenarioArcBeat,
): string {
  const label = getScenarioLabel(scenarioKey);
  const parts: string[] = [];

  parts.push(
    `SCENARIO ARC (${label}): beat "${beat.phaseId}" — turn ${beat.turn}/${beat.expectedTurns}`,
  );
  parts.push(
    'COACH-ON-THE-SIDE: Stay the user\'s companion. Describe what the other person says/does; never become the waiter/vendor/officer. Teach by modeling and recasting.',
  );
  parts.push(`BEAT: ${beat.phasePrompt}`);

  if (beat.pretaskPhrases.length > 0) {
    const list = beat.pretaskPhrases
      .map((p) => `- "${p.phrase}" (${p.context})`)
      .join('\n');
    parts.push(
      `PRETASK PHRASES — preview these in the user's language, then embed ONE as **phrase** (phonetic) in the target language this turn:\n${list}`,
    );
  }

  if (beat.complication) {
    parts.push(
      `COMPLICATION (inject naturally this turn as something the other person does/says — keep it brief, then coach the user through it): ${beat.complication}`,
    );
  }

  if (beat.suggestWrap) {
    const focus = getScenarioDebriefFocus(scenarioKey);
    parts.push(
      `ARC COMPLETE — Softly invite wrapping up ("Want to debrief what we just practiced?"). Do not force-end. If they agree or signal done, begin the structured debrief.`,
    );
    if (focus) {
      parts.push(`DEBRIEF FOCUS for this scenario: ${focus}`);
    }
    parts.push(STRUCTURED_DEBRIEF_INSTRUCTION);
  }

  return parts.join('\n');
}

/** Full debrief override text for End Scenario / arc wrap. */
export function buildStructuredDebriefContext(scenarioKey: string): string {
  const label = getScenarioLabel(scenarioKey);
  const focus = getScenarioDebriefFocus(scenarioKey);
  const focusLine = focus ? `\nFocus this debrief on: ${focus}.` : '';
  return `DEBRIEF MODE: The user just finished a '${label}' practice session.${focusLine}\n${STRUCTURED_DEBRIEF_INSTRUCTION}`;
}
