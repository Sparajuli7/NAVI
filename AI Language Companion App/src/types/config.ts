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

export interface ScenarioContext {
  label: string;
  vocabulary_focus: string[];
  tone_shift: string;
  formality_adjustment: number;
  auto_suggestions: string[];
  pronunciation_priority: string[];
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
  | 'government';

export interface LocationContext {
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  dialectKey: string | null;
  dialectInfo: DialectInfo | null;
}
