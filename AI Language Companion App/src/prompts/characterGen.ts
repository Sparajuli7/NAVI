import type { LocationContext } from '../types/config';

export function buildCharacterGenPrompt(
  userDescription: string,
  location: LocationContext | null,
  templateBasePersonality?: string,
): string {
  const locationStr = location
    ? `${location.city}, ${location.country}`
    : 'an unknown city';

  const base = templateBasePersonality
    ? `Base personality archetype: ${templateBasePersonality}\nUser customisation: ${userDescription}`
    : `User description: ${userDescription}`;

  return `Create a local guide companion for ${locationStr}.

${base}

Respond ONLY with this JSON (no markdown, no extra text):
{
  "id": "<uuid-style string>",
  "name": "<first name, local to the city>",
  "summary": "<one sentence: what makes them special as a guide>",
  "detailed": "<2-3 sentences: their backstory, what they know, their vibe>",
  "style": "<one word: casual|warm|energetic|streetwise|nurturing|playful|formal>",
  "emoji": "<one emoji that represents them>",
  "avatar_color": {
    "primary": "<hex color>",
    "secondary": "<hex color>",
    "accent": "<hex color>"
  },
  "avatar_accessory": "<one emoji accessory>",
  "speaks_like": "<one sentence describing their voice and speech pattern>",
  "template_id": null,
  "location_city": "${location?.city ?? ''}",
  "location_country": "${location?.country ?? ''}",
  "first_message": "<their opening message to the user, in character, 1-2 sentences>"
}`;
}

export function buildTemplateCharacterGenPrompt(
  templateId: string,
  basePersonality: string,
  location: LocationContext | null,
): string {
  return buildCharacterGenPrompt('', location, basePersonality);
}
