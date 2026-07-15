import type { Character } from '../types/character';
import { generateAvatarImage } from './generateAvatarImage';
import { loadAvatarImage, saveAvatarImage } from './storage';

/** Build a portrait_prompt when the character has none (template onboarding path). */
export function buildPortraitPrompt(
  char: Pick<Character, 'name' | 'summary' | 'location_city' | 'location_country' | 'template_id'>,
  templateLabel?: string,
): string {
  const role = templateLabel
    ?? (char.template_id ? char.template_id.replace(/_/g, ' ') : 'local guide');
  const city = char.location_city || 'their city';
  const country = char.location_country || '';
  const personality = (char.summary || 'warm and friendly').slice(0, 140);
  const location = country ? `${city}, ${country}` : city;
  return `${char.name}, a ${role} living in ${location}. ${personality}. Warm natural expression, local character, editorial portrait.`;
}

/** Load cached portrait from IndexedDB; backfill via generateAvatarImage when missing. */
export async function resolveCompanionPortrait(char: Character): Promise<Character> {
  const cached = await loadAvatarImage(char.id);
  if (cached) {
    if (char.avatarImageUrl === cached && char.has_portrait) return char;
    return { ...char, avatarImageUrl: cached, has_portrait: true };
  }

  if (char.avatarImageUrl) {
    await saveAvatarImage(char.id, char.avatarImageUrl);
    return { ...char, has_portrait: true };
  }

  const prompt = char.portrait_prompt || buildPortraitPrompt(char);
  const base64 = await generateAvatarImage(prompt, char.id);
  if (!base64) {
    return char.portrait_prompt ? char : { ...char, portrait_prompt: prompt };
  }

  await saveAvatarImage(char.id, base64);
  return {
    ...char,
    avatarImageUrl: base64,
    has_portrait: true,
    portrait_prompt: char.portrait_prompt || prompt,
  };
}

/** Generate a new portrait and persist to IndexedDB. Returns updated character. */
export async function generateAndSaveCompanionPortrait(
  char: Character,
  templateLabel?: string,
): Promise<Character> {
  const prompt = char.portrait_prompt || buildPortraitPrompt(char, templateLabel);
  const base64 = await generateAvatarImage(prompt, char.id);
  if (!base64) {
    return char.portrait_prompt ? char : { ...char, portrait_prompt: prompt };
  }

  await saveAvatarImage(char.id, base64);
  return {
    ...char,
    avatarImageUrl: base64,
    has_portrait: true,
    portrait_prompt: prompt,
  };
}

/** Persist portrait updates across companions list + active character store. */
export function applyPortraitToList(
  companions: Character[],
  updated: Character,
): Character[] {
  const idx = companions.findIndex((c) => c.id === updated.id);
  if (idx === -1) return [...companions, updated];
  const next = [...companions];
  next[idx] = updated;
  return next;
}
