import type { LocationContext } from '../types/config';
import type { AvatarTemplate } from '../types/character';

export function buildCharacterGenPrompt(
  userDescription: string,
  location: LocationContext | null,
): string {
  const city = location?.city ?? 'an unknown city';
  const country = location?.country ?? '';
  const locationStr = country ? `${city}, ${country}` : city;
  const dialectLine = location?.dialectInfo
    ? `Local dialect: ${location.dialectInfo.dialect}`
    : '';

  return `Generate a companion character for a language and culture app.

User's description: "${userDescription}"
Location: ${locationStr}
${dialectLine}

Respond in exactly this JSON format and nothing else:
{
  "id": "<short-uuid>",
  "name": "<short name, 3-6 letters, culturally fitting for the location>",
  "summary": "<name> — <one sentence: personality + location + how they speak>",
  "detailed": "<2 sentences: behavior, passions, speaking style>",
  "style": "<casual|warm|energetic|mysterious|playful|dry-humor|nurturing|streetwise>",
  "emoji": "<one emoji>",
  "avatar_color": {
    "primary": "<hex color>",
    "secondary": "<hex color>",
    "accent": "<hex color>"
  },
  "avatar_accessory": "<one location/vocation-themed emoji>",
  "speaks_like": "<brief description of HOW they talk — slang level, formality, rhythm>",
  "template_id": null,
  "location_city": "${city}",
  "location_country": "${country}",
  "first_message": "<3-4 sentence greeting IN CHARACTER. Reference the specific city. Show 2 things you can help with naturally. End with something that invites a response.>"
}`;
}

export function buildTemplateCharacterGenPrompt(
  template: AvatarTemplate,
  userAdditions: string,
  location: LocationContext | null,
): string {
  const city = location?.city ?? 'an unknown city';
  const country = location?.country ?? '';
  const locationStr = country ? `${city}, ${country}` : city;
  const dialectLine = location?.dialectInfo
    ? `Local dialect: ${location.dialectInfo.dialect}`
    : '';

  return `Generate a companion character based on this template.

Template: ${template.label} — ${template.base_personality}
User's customization (if any): "${userAdditions || 'none'}"
Location: ${locationStr}
${dialectLine}

Respond in exactly this JSON format and nothing else:
{
  "id": "<short-uuid>",
  "name": "<short name fitting the template vibe + location>",
  "summary": "<name> — <one sentence combining template personality with location>",
  "detailed": "<2 sentences: template personality adapted to this specific city>",
  "style": "${template.default_style}",
  "emoji": "${template.emoji}",
  "avatar_color": {
    "primary": "<hex color that fits the template vibe>",
    "secondary": "<hex color>",
    "accent": "<hex color>"
  },
  "avatar_accessory": "<location-themed emoji fitting the template>",
  "speaks_like": "<how they talk given template + location>",
  "template_id": "${template.id}",
  "location_city": "${city}",
  "location_country": "${country}",
  "first_message": "<3-4 sentences in character, referencing location, showing template expertise>"
}`;
}
