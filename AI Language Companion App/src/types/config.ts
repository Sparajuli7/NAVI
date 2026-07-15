export interface SlangEra {
  gen_z: string;
  millennial: string;
  older: string;
}

export interface DialectInfo {
  language: string;
  dialect: string;
  formality_default: 'casual' | 'neutral' | 'formal';
  cultural_notes: string;
  slang_era: SlangEra;
}

/** Type alias for the dialect map JSON shape (keyed by dialect key). */
export type DialectMap = Record<string, DialectInfo>;

/** Pretask phrase seed for a TBLT scenario arc (localized by the avatar at runtime). */
export interface ScenarioPretaskPhrase {
  phrase: string;
  context: string;
  priority: number;
}

/** One beat in a scenario arc — turn or turns range + coach prompt. */
export interface ScenarioArcPhase {
  id: string;
  /** Single turn this phase applies to */
  turn?: number;
  /** Inclusive turn range this phase applies to */
  turns?: number[];
  /** Coach-on-the-side instruction for this beat */
  prompt: string;
}

/** Per-scenario TBLT arc: pretask → task beats → complication pool → debrief. */
export interface ScenarioArc {
  pretask_phrases: ScenarioPretaskPhrase[];
  phases: ScenarioArcPhase[];
  expected_turns: number;
  complications: string[];
}

export interface ScenarioContext {
  label: string;
  emoji?: string;
  vocabulary_focus: string[];
  tone_shift: string;
  formality_adjustment: number;
  tone_guidance?: string;
  cultural_guardrails?: string;
  debrief_focus?: string;
  auto_suggestions: string[];
  pronunciation_priority: string[];
  /** Optional TBLT arc — when present, ConversationDirector injects beat-specific hints */
  arc?: ScenarioArc;
}

/** User-provided context before starting a scenario session */
export interface ParsedScenarioContext {
  where: string;
  doing: string;
  talkingTo: string;
  nervousAbout: string;
  customText: string;
}

export interface PreferenceField {
  type: 'select' | 'multi_select';
  options: string[];
  default: string | string[];
  prompt_injection: string;
}

export type ScenarioKey =
  | 'restaurant'
  | 'hospital'
  | 'market'
  | 'office'
  | 'nightlife'
  | 'transit'
  | 'school'
  | 'government'
  | 'directions'
  | 'hotel'
  | 'social'
  | 'customs'
  | 'pharmacy'
  | 'emergency'
  | 'landlord'
  | 'bank'
  | 'taxi'
  | 'temple'
  | 'street_food'
  | 'date';

export interface LocationContext {
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  dialectKey: string | null;
  dialectInfo: DialectInfo | null;
}
