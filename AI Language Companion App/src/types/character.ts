export interface AvatarPrefs {
  skinColor: string;       // Tanned | Yellow | Pale | Light | Brown | DarkBrown | Black
  topType: string;         // hair style
  hairColor: string;       // Auburn | Black | Blonde | BlondeGolden | Brown | BrownDark | PastelPink | Blue | Platinum | Red | SilverGray
  eyeType: string;         // Close | Cry | Default | Dizzy | EyeRoll | Happy | Hearts | Side | Squint | Surprised | Wink | WinkWacky
  clotheType: string;      // BlazerShirt | BlazerSweater | CollarSweater | GraphicShirt | Hoodie | Overall | ShirtCrewNeck | ShirtScoopNeck | ShirtVNeck
  clotheColor: string;     // Black | Blue01 | ... | White
  accessoriesType: string; // Blank | Kurt | Prescription01 | Prescription02 | Round | Sunglasses | Wayfarers
  facialHairType: string;  // Blank | BeardMedium | BeardLight | BeardMajestic | MoustacheFancy | MoustacheMagnum
  eyebrowType: string;     // Angry | AngryNatural | Default | DefaultNatural | FlatNatural | RaisedExcited | ...
  mouthType: string;       // Concerned | Default | Disbelief | Eating | Grimace | Sad | ScreamOpen | Serious | Smile | Tongue | Twinkle | Vomit
}

export const VALID_AVATAR_PREFS: Record<keyof AvatarPrefs, readonly string[]> = {
  skinColor:       ['Pale', 'Light', 'Tanned', 'Brown', 'DarkBrown', 'Black', 'Yellow'],
  topType:         ['ShortHairShortWaved', 'ShortHairShortFlat', 'ShortHairShortCurly', 'ShortHairDreads01', 'LongHairStraight', 'LongHairBob', 'LongHairCurly', 'LongHairBun', 'NoHair'],
  hairColor:       ['Black', 'BrownDark', 'Brown', 'Auburn', 'Blonde', 'BlondeGolden', 'Red', 'PastelPink', 'Platinum', 'SilverGray'],
  eyeType:         ['Default', 'Happy', 'Wink', 'Surprised', 'Squint', 'Side', 'Dizzy'],
  clotheType:      ['BlazerShirt', 'BlazerSweater', 'CollarSweater', 'GraphicShirt', 'Hoodie', 'Overall', 'ShirtCrewNeck', 'ShirtScoopNeck', 'ShirtVNeck'],
  clotheColor:     ['PastelBlue', 'PastelGreen', 'PastelYellow', 'PastelOrange', 'PastelRed', 'White', 'Black'],
  accessoriesType: ['Blank', 'Kurt', 'Prescription01', 'Prescription02', 'Round', 'Sunglasses', 'Wayfarers'],
  facialHairType:  ['Blank', 'BeardMedium', 'BeardLight', 'BeardMajestic', 'MoustacheFancy', 'MoustacheMagnum'],
  eyebrowType:     ['Default', 'DefaultNatural', 'FlatNatural', 'RaisedExcited', 'AngryNatural', 'Angry'],
  mouthType:       ['Smile', 'Default', 'Serious', 'Twinkle', 'Tongue', 'Sad', 'Concerned', 'Grimace'],
};

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

/** Lightweight UI representation of a character, used across multiple components */
export interface GeneratedCharacter {
  name: string;
  personality: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  accessory?: string;
}

/** Map a rich Character to the simplified GeneratedCharacter UI shape. */
export function mapCharacterToUI(c: Character): GeneratedCharacter {
  return {
    name: c.name,
    personality: c.summary,
    colors: (c.avatar_color && typeof c.avatar_color === 'object')
      ? c.avatar_color
      : { primary: '#4A5568', secondary: '#F6AD55', accent: '#48BB78' },
    accessory: c.avatar_accessory || undefined,
  };
}

/** Visual state of the avatar animation */
export type AvatarState = 'idle' | 'generating' | 'speaking' | 'success' | 'thinking';

/** Type alias for the dialect map JSON shape */
export type DialectMap = Record<string, import('./config').DialectInfo>;
