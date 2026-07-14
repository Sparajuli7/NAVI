/**
 * ensurePortrait — lazily gives a character a free photorealistic portrait.
 *
 * The portrait makes the LiveAvatar presence feel like a real person. Generation
 * is free (Pollinations.ai, no API key), fired in the background, and fails
 * silently — the animated emoji fallback remains the experience if it can't run
 * (offline, timeout). Template characters carry no `portrait_prompt`, so we build
 * a physical description from the user's avatar preferences + the character's place.
 */
import type { Character, UserPreferences } from '../types/character';
import { generateAvatarImage } from './generateAvatarImage';
import { getAvatarImage, saveAvatarImage, saveCharacter } from './storage';
import { useCharacterStore } from '../stores/characterStore';

const GENDER_NOUN: Record<string, string> = {
  female: 'woman', male: 'man', 'non-binary': 'person', no_preference: 'person',
};

const AGE_CLAUSE: Record<string, string> = {
  teen: 'in their late teens',
  '20s': 'in their twenties',
  '30s': 'in their thirties',
  '40s': 'in their forties',
  '50s': 'in their fifties',
  '60s+': 'in their sixties',
};

/** Build a physical-appearance description (subject only; styling is added downstream). */
export function buildPortraitPrompt(char: Character, prefs: UserPreferences): string {
  const gender = GENDER_NOUN[prefs.avatar_gender] ?? 'person';
  const age = AGE_CLAUSE[prefs.avatar_age] ?? 'adult';
  const place = [char.location_city, char.location_country].filter(Boolean).join(', ');
  return `a ${gender} ${age}, a warm friendly local${place ? ` from ${place}` : ''}, natural approachable expression`;
}

/**
 * Ensure the character has a saved portrait. No-op if one already exists.
 * Fire-and-forget: callers should NOT await this in a user-blocking path.
 */
export async function ensurePortrait(char: Character | null, prefs: UserPreferences): Promise<void> {
  if (!char?.id) return;
  try {
    if (await getAvatarImage(char.id)) return; // already have one
  } catch {
    // IndexedDB read failed — attempt generation anyway
  }

  const prompt = char.portrait_prompt?.trim() || buildPortraitPrompt(char, prefs);
  const base64 = await generateAvatarImage(prompt, char.id);
  if (!base64) return; // offline / timeout → keep emoji fallback

  await saveAvatarImage(char.id, base64);
  // Persist the prompt + flag (without the heavy base64, which lives under its own key).
  await saveCharacter({ ...char, portrait_prompt: prompt, has_portrait: true });

  // If this character is still the active one, surface the portrait immediately.
  const cur = useCharacterStore.getState().activeCharacter;
  if (cur && cur.id === char.id) {
    useCharacterStore.getState().setActiveCharacter({
      ...cur, portrait_prompt: prompt, has_portrait: true, avatarImageUrl: base64,
    });
  }
}
