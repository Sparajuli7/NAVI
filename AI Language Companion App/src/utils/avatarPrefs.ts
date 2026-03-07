// Avatar customization preferences — stored in localStorage.
// These drive the <AvatarDisplay /> component across the entire app.

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
