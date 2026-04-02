import type { AvatarPrefs } from '../utils/avatarPrefs';

export interface CharacterColors {
  primary: string;
  secondary: string;
  accent: string;
}

export interface Character {
  id: string;
  name: string;
  summary: string;
  detailed: string;
  style: string;
  emoji: string;
  avatar_color: CharacterColors;
  avatar_accessory: string;
  speaks_like: string;
  template_id: string | null;
  location_city: string;
  location_country: string;
  first_message?: string;
  /** Dialect key from dialectMap.json, e.g. "NP/Kathmandu" — persisted for reliable dialect lookup */
  dialect_key?: string;
  /** Target language the user wants to learn with this companion */
  target_language?: string;
  /** Avatar appearance prefs derived from LLM character generation */
  avatar_prefs?: AvatarPrefs;
  /** Physical description for AI portrait generation (fed to Pollinations.ai) */
  portrait_prompt?: string;
  /** Whether an AI-generated portrait has been saved to IndexedDB for this character */
  has_portrait?: boolean;
  /** Base64 data URI from HF FLUX avatar generation during onboarding */
  avatarImageUrl?: string;
}

export interface AvatarTemplate {
  id: string;
  emoji: string;
  label: string;
  base_personality: string;
  default_style: string;
  default_formality: string;
  vocabulary_focus: string[];
  scenario_hint: string;
}

export interface UserPreferences {
  native_language: string;
  target_language?: string;
  avatar_age: 'teen' | '20s' | '30s' | '40s' | '50s' | '60s+';
  avatar_gender: 'male' | 'female' | 'non-binary' | 'no_preference';
  avatar_vocation: 'student' | 'professional' | 'service_worker' | 'retired' | 'traveler' | 'other';
  formality_default: 'casual' | 'neutral' | 'formal';
  learning_focus: Array<'pronunciation' | 'vocabulary' | 'cultural_context' | 'reading' | 'slang'>;
}

export interface MemoryEntry {
  id: string;
  key: string;
  value: string;
  created_at: number;
}
