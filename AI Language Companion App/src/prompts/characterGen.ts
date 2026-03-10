import type { LocationContext } from '../types/config';
import type { AvatarTemplate } from '../types/character';
import { promptLoader } from '../agent/prompts/promptLoader';

export function buildCharacterGenPrompt(
  userDescription: string,
  location: LocationContext | null,
  preferredName?: string,
): string {
  const city = location?.city ?? 'an unknown city';
  const country = location?.country ?? '';
  const locationStr = country ? `${city}, ${country}` : city;
  const dialectLine = location?.dialectInfo
    ? `Local dialect: ${location.dialectInfo.dialect}`
    : '';
  const nameLine = preferredName?.trim()
    ? `Preferred name: ${preferredName.trim()} — use this exact name.`
    : '';

  return promptLoader.get('characterGen.freeText.template', {
    description: userDescription,
    location: locationStr,
    dialectLine,
    nameLine,
    city,
    country,
  });
}

export function buildTemplateCharacterGenPrompt(
  template: AvatarTemplate,
  userAdditions: string,
  location: LocationContext | null,
  preferredName?: string,
): string {
  const city = location?.city ?? 'an unknown city';
  const country = location?.country ?? '';
  const locationStr = country ? `${city}, ${country}` : city;
  const dialectLine = location?.dialectInfo
    ? `Local dialect: ${location.dialectInfo.dialect}`
    : '';
  const nameLine = preferredName?.trim()
    ? `Preferred name: ${preferredName.trim()} — use this exact name.`
    : '';

  return promptLoader.get('characterGen.fromTemplate.template', {
    templateLabel: template.label,
    templatePersonality: template.base_personality,
    userAdditions: userAdditions || 'none',
    location: locationStr,
    dialectLine,
    nameLine,
    templateStyle: template.default_style,
    templateEmoji: template.emoji,
    templateId: template.id,
    city,
    country,
  });
}
