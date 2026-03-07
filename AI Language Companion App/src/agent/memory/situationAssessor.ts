/**
 * NAVI Agent Framework — Situation Assessor
 *
 * Builds and continuously updates an internal model of the user's situation.
 * Instead of asking the user to pick a profile type, the avatar figures out
 * what they need through natural conversation signals.
 *
 * The model updates every conversation — not just at onboarding.
 * Signals are extracted from user messages via keyword/pattern matching
 * (no extra LLM calls).
 */

import type {
  SituationModel,
  Urgency,
  ComfortLevel,
  PrimaryGoal,
} from '../core/types';
import { get, set } from 'idb-keyval';
import { agentBus } from '../core/eventBus';

const STORAGE_KEY = 'navi_situation_model';

const DEFAULT_MODEL: SituationModel = {
  urgency: 'unknown',
  comfortLevel: 'unknown',
  primaryGoal: 'unknown',
  nextSituation: '',
  inCountry: null,
  assessmentConfidence: 0,
  signalsCollected: 0,
  signals: [],
  lastUpdated: 0,
};

// ─── Signal Detection Patterns ──────────────────────────────────

const URGENCY_PATTERNS: Array<{ pattern: RegExp; value: Urgency; weight: number }> = [
  // Immediate
  { pattern: /right now|today|tonight|this (morning|afternoon|evening)|in an hour|emergency|urgent|asap|immediately/i, value: 'immediate', weight: 0.8 },
  { pattern: /i('m| am) (at|in) (the|a) (restaurant|hospital|airport|station|hotel|store|market|office)/i, value: 'immediate', weight: 0.7 },
  { pattern: /help me (say|order|ask|tell|explain)/i, value: 'immediate', weight: 0.6 },
  // Short term
  { pattern: /this week|next week|in a few days|tomorrow|soon|before (my|the) trip|getting ready/i, value: 'short_term', weight: 0.7 },
  { pattern: /moving (to|there)|relocating|starting (a |my )(new )?(job|school|work)/i, value: 'short_term', weight: 0.6 },
  // Long term
  { pattern: /eventually|someday|no rush|just (curious|interested|exploring)|for fun|hobby/i, value: 'long_term', weight: 0.7 },
  { pattern: /want to learn|thinking about|planning to|maybe (next|one day)/i, value: 'long_term', weight: 0.5 },
];

const COMFORT_PATTERNS: Array<{ pattern: RegExp; value: ComfortLevel; weight: number }> = [
  // Zero
  { pattern: /never (spoken|tried|learned)|don('t| not) (know|speak) any|completely new|total beginner|starting from (scratch|zero|nothing)|no (idea|clue)/i, value: 'zero', weight: 0.8 },
  { pattern: /first time|what does .+ mean|how do (you|I) (even|say)/i, value: 'zero', weight: 0.5 },
  // Basic
  { pattern: /know (a few|some|basic)|can say (hello|hi|thank)|picked up (a bit|some)|a little( bit)?/i, value: 'basic', weight: 0.7 },
  { pattern: /beginner|just started|learning for (a few|couple) (weeks|months)/i, value: 'basic', weight: 0.6 },
  // Conversational
  { pattern: /can (hold|have) a (basic )?(conversation|chat)|understand (most|some) of what|been (learning|studying|speaking) for (a |several )?(year|month)/i, value: 'conversational', weight: 0.7 },
  { pattern: /intermediate|getting (better|comfortable)|can (manage|get by)/i, value: 'conversational', weight: 0.6 },
  // Advanced
  { pattern: /fluent|advanced|grew up (speaking|with)|native|speak .+ (well|fluently)|lived (there|here) for years/i, value: 'advanced', weight: 0.8 },
  { pattern: /just need (the slang|cultural|nuance)|polish|refine|sound (more )?natural/i, value: 'advanced', weight: 0.6 },
];

const GOAL_PATTERNS: Array<{ pattern: RegExp; value: PrimaryGoal; weight: number }> = [
  // Survive — immediate practical needs
  { pattern: /survive|get by|basic needs|not (get |be )(lost|scammed|ripped off)|navigate|find my way|order food|see a doctor/i, value: 'survive', weight: 0.7 },
  { pattern: /tourist|visiting|vacation|holiday|trip|traveling/i, value: 'survive', weight: 0.5 },
  // Belong — integration
  { pattern: /fit in|belong|make friends|meet (people|locals)|live here|moved here|immigrant|expat|new (to|in) (this|the) (city|country)/i, value: 'belong', weight: 0.7 },
  { pattern: /work here|school here|staying (long|permanently|for a while)|settling/i, value: 'belong', weight: 0.6 },
  // Connect — with specific people
  { pattern: /partner|spouse|boyfriend|girlfriend|husband|wife|in-laws|family|parents|grandparents|coworkers|friends/i, value: 'connect', weight: 0.6 },
  { pattern: /talk to (my|the)|communicate with|understand (my|what my)/i, value: 'connect', weight: 0.5 },
  // Reconnect — heritage
  { pattern: /heritage|roots|ancestors|parents('|s)? (language|tongue)|grew up (hearing|around)|lost (my|the)|used to speak/i, value: 'reconnect', weight: 0.8 },
  { pattern: /family (speaks|spoke)|reconnect|reclaim|remember/i, value: 'reconnect', weight: 0.6 },
];

const IN_COUNTRY_PATTERNS = {
  yes: /i('m| am) (here|in|already|currently)|just (arrived|landed|got here)|living (here|in)|moved (here|to)|staying (in|at|here)/i,
  no: /going (to|there)|planning (to|a) (visit|trip|go)|before (i|my) (go|trip|leave|travel)|haven('t| not) (been|gone|left) yet|from (home|here)/i,
};

const SITUATION_PATTERNS: Array<{ pattern: RegExp; situation: string }> = [
  { pattern: /restaurant|eat|food|order|menu|dinner|lunch|breakfast/i, situation: 'ordering food at a restaurant' },
  { pattern: /hospital|doctor|sick|pain|emergency|medicine|pharmacy/i, situation: 'medical situation' },
  { pattern: /airport|flight|boarding|customs|immigration|luggage/i, situation: 'navigating the airport' },
  { pattern: /hotel|check.?in|room|reservation|stay/i, situation: 'hotel check-in' },
  { pattern: /taxi|uber|bus|train|metro|subway|direction|get to/i, situation: 'getting around / transit' },
  { pattern: /shop|market|buy|price|how much|bargain|haggle/i, situation: 'shopping or at the market' },
  { pattern: /work|office|meeting|boss|colleague|interview|job/i, situation: 'workplace interaction' },
  { pattern: /school|class|teacher|student|university/i, situation: 'school or university' },
  { pattern: /visa|passport|permit|government|form|document/i, situation: 'dealing with paperwork or officials' },
  { pattern: /neighbor|landlord|apartment|rent|move in/i, situation: 'housing or settling in' },
  { pattern: /date|bar|club|party|night out|drink/i, situation: 'social outing' },
];

// ─── SituationAssessor ──────────────────────────────────────────

export class SituationAssessor {
  private model: SituationModel = { ...DEFAULT_MODEL };
  private loaded = false;

  async load(): Promise<void> {
    const stored = await get<SituationModel>(STORAGE_KEY);
    if (stored) {
      this.model = { ...DEFAULT_MODEL, ...stored };
    }
    this.loaded = true;
  }

  async save(): Promise<void> {
    await set(STORAGE_KEY, this.model);
    agentBus.emit('memory:update', { type: 'situation', model: this.model });
  }

  getModel(): SituationModel {
    return { ...this.model };
  }

  /** Whether we still need to assess the user (confidence < 0.6) */
  needsAssessment(): boolean {
    return this.model.assessmentConfidence < 0.6;
  }

  /** Whether we have zero signals yet (brand new user) */
  isNewUser(): boolean {
    return this.model.signalsCollected === 0;
  }

  /**
   * Extract signals from a user message and update the model.
   * No LLM call — pure pattern matching.
   * Returns true if the model changed.
   */
  async extractSignals(message: string): Promise<boolean> {
    if (!this.loaded) await this.load();

    let changed = false;
    const prevModel = { ...this.model };

    // Urgency
    for (const { pattern, value, weight } of URGENCY_PATTERNS) {
      if (pattern.test(message)) {
        if (this.model.urgency === 'unknown' || weight > 0.6) {
          this.model.urgency = value;
          this.addSignal(`urgency:${value} from "${message.slice(0, 60)}"`);
          changed = true;
        }
        break;
      }
    }

    // Comfort level
    for (const { pattern, value, weight } of COMFORT_PATTERNS) {
      if (pattern.test(message)) {
        if (this.model.comfortLevel === 'unknown' || weight > 0.6) {
          this.model.comfortLevel = value;
          this.addSignal(`comfort:${value} from "${message.slice(0, 60)}"`);
          changed = true;
        }
        break;
      }
    }

    // Primary goal
    for (const { pattern, value, weight } of GOAL_PATTERNS) {
      if (pattern.test(message)) {
        if (this.model.primaryGoal === 'unknown' || weight > 0.6) {
          this.model.primaryGoal = value;
          this.addSignal(`goal:${value} from "${message.slice(0, 60)}"`);
          changed = true;
        }
        break;
      }
    }

    // In country?
    if (this.model.inCountry === null) {
      if (IN_COUNTRY_PATTERNS.yes.test(message)) {
        this.model.inCountry = true;
        this.addSignal(`inCountry:yes from "${message.slice(0, 60)}"`);
        changed = true;
      } else if (IN_COUNTRY_PATTERNS.no.test(message)) {
        this.model.inCountry = false;
        this.addSignal(`inCountry:no from "${message.slice(0, 60)}"`);
        changed = true;
      }
    }

    // Next situation
    for (const { pattern, situation } of SITUATION_PATTERNS) {
      if (pattern.test(message)) {
        this.model.nextSituation = situation;
        changed = true;
        break;
      }
    }

    if (changed) {
      this.model.signalsCollected++;
      this.model.lastUpdated = Date.now();
      this.recalculateConfidence();
      await this.save();

      if (prevModel.assessmentConfidence < 0.6 && this.model.assessmentConfidence >= 0.6) {
        console.log(`[NAVI:situation] Assessment threshold reached: ${JSON.stringify(this.model)}`);
      }
    }

    return changed;
  }

  /**
   * Format the situation model for injection into the system prompt.
   * Only included when we have enough confidence.
   */
  formatForPrompt(): string {
    if (this.model.assessmentConfidence < 0.2) return '';

    const lines: string[] = [];

    lines.push('USER SITUATION ASSESSMENT (use this to calibrate your responses):');

    if (this.model.inCountry !== null) {
      lines.push(`- The user is ${this.model.inCountry ? 'CURRENTLY IN the target country' : 'NOT YET in the target country (still preparing)'}.`);
    }

    if (this.model.urgency !== 'unknown') {
      const urgencyDesc: Record<Urgency, string> = {
        immediate: 'They need help RIGHT NOW — give them exactly what they need, fast. No lessons, just the words.',
        short_term: 'They have days or weeks. Balance practical phrases with building understanding.',
        long_term: 'No rush. Focus on depth, culture, and building real fluency over time.',
        unknown: '',
      };
      lines.push(`- Urgency: ${urgencyDesc[this.model.urgency]}`);
    }

    if (this.model.comfortLevel !== 'unknown') {
      const comfortDesc: Record<ComfortLevel, string> = {
        zero: 'Complete beginner — give maximum support in their native language. Start with survival phrases. Celebrate every attempt.',
        basic: 'Knows the basics — build on what they have. Push them gently past greetings into real exchanges.',
        conversational: 'Can hold a conversation — challenge them. Use more local language, less scaffolding. Introduce nuance and slang.',
        advanced: 'Speaks well — treat them like a peer. Focus on sounding natural, cultural depth, and edge cases.',
        unknown: '',
      };
      lines.push(`- Comfort: ${comfortDesc[this.model.comfortLevel]}`);
    }

    if (this.model.primaryGoal !== 'unknown') {
      const goalDesc: Record<PrimaryGoal, string> = {
        survive: 'Goal is survival — practical phrases, avoiding mistakes, getting through real situations safely.',
        belong: 'Goal is belonging — help them sound less like a tourist and more like someone who lives here.',
        connect: 'Goal is connection — help them communicate with specific people they care about.',
        reconnect: 'Goal is reconnecting with heritage — be sensitive, this is personal. Help them reclaim something they feel they lost.',
        unknown: '',
      };
      lines.push(`- Goal: ${goalDesc[this.model.primaryGoal]}`);
    }

    if (this.model.nextSituation) {
      lines.push(`- Their next real-world situation: ${this.model.nextSituation}. Prioritize phrases for THIS.`);
    }

    return lines.join('\n');
  }

  /** Reset to defaults */
  async reset(): Promise<void> {
    this.model = { ...DEFAULT_MODEL };
    await this.save();
  }

  // ── Private ──────────────────────────────────────────────────

  private addSignal(signal: string): void {
    this.model.signals.push(signal);
    if (this.model.signals.length > 20) {
      this.model.signals = this.model.signals.slice(-20);
    }
  }

  private recalculateConfidence(): void {
    let score = 0;
    if (this.model.urgency !== 'unknown') score += 0.25;
    if (this.model.comfortLevel !== 'unknown') score += 0.25;
    if (this.model.primaryGoal !== 'unknown') score += 0.25;
    if (this.model.inCountry !== null) score += 0.15;
    if (this.model.nextSituation) score += 0.1;
    this.model.assessmentConfidence = Math.min(1, score);
  }
}
