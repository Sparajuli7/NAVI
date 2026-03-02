import type { LocationContext } from '../types/config';
import type { AvatarTemplate } from '../types/character';
import { promptLoader } from '../agent/prompts/promptLoader';

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

  return promptLoader.get('characterGen.freeText.template', {
    description: userDescription,
    location: locationStr,
    dialectLine,
    city,
    country,
  });
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

  return promptLoader.get('characterGen.fromTemplate.template', {
    templateLabel: template.label,
    templatePersonality: template.base_personality,
    userAdditions: userAdditions || 'none',
    location: locationStr,
    dialectLine,
    templateStyle: template.default_style,
    templateEmoji: template.emoji,
    templateId: template.id,
    city,
    country,
  });
}
