// Avatar customization preferences — stored in localStorage.
// These drive the <AvatarDisplay /> component across the entire app.
import type { UserPreferences } from '../types/character';

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

export const DEFAULT_PREFS: AvatarPrefs = {
  skinColor: 'Light',
  topType: 'ShortHairShortWaved',
  hairColor: 'Brown',
  eyeType: 'Default',
  clotheType: 'Hoodie',
  clotheColor: 'PastelBlue',
  accessoriesType: 'Blank',
  facialHairType: 'Blank',
  eyebrowType: 'Default',
  mouthType: 'Smile',
};

const STORAGE_KEY = 'navi_avatar_prefs';

export function loadAvatarPrefs(): AvatarPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveAvatarPrefs(prefs: AvatarPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage unavailable (e.g. private browsing) — silent fail
  }
}

const VALID_AVATAR_PREFS: Record<keyof AvatarPrefs, readonly string[]> = {
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

export function validateAvatarPrefs(raw: unknown): AvatarPrefs | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  for (const key of Object.keys(VALID_AVATAR_PREFS) as Array<keyof AvatarPrefs>) {
    const val = r[key];
    if (typeof val !== 'string' || !VALID_AVATAR_PREFS[key].includes(val)) return null;
  }
  return r as unknown as AvatarPrefs;
}

export function deriveAvatarPrefs(
  character: { style?: string; summary?: string },
  userPrefs?: Partial<UserPreferences>,
): AvatarPrefs {
  const style  = character.style ?? 'casual';
  const gender = userPrefs?.avatar_gender ?? 'no_preference';
  const age    = userPrefs?.avatar_age    ?? '20s';

  const isFemale = gender === 'female';

  const topType: string = isFemale
    ? (age === '60s+' ? 'ShortHairShortFlat' : 'LongHairStraight')
    : (age === '60s+' || age === '50s' ? 'ShortHairShortFlat' : 'ShortHairShortWaved');

  const clotheType: string =
    style === 'warm' || style === 'nurturing' ? 'BlazerSweater' :
    style === 'streetwise' || style === 'energetic' ? 'Hoodie' :
    style === 'mysterious' ? 'CollarSweater' :
    style === 'playful' ? 'GraphicShirt' :
    style === 'dry-humor' ? 'ShirtVNeck' :
    'ShirtCrewNeck';

  const mouthType: string =
    style === 'dry-humor' || style === 'mysterious' ? 'Serious' :
    style === 'playful' || style === 'energetic' ? 'Twinkle' :
    'Smile';

  const eyeType: string =
    style === 'playful' || style === 'energetic' ? 'Happy' :
    style === 'mysterious' ? 'Squint' :
    'Default';

  const facialHairType: string =
    isFemale ? 'Blank' :
    (age === '30s' || age === '40s') ? 'BeardLight' :
    'Blank';

  return {
    ...DEFAULT_PREFS,
    topType,
    clotheType,
    mouthType,
    eyeType,
    facialHairType,
  };
}
