/**
 * Shared helper for building avatar profile parameters from a Character.
 * Consolidates the style-to-energy/humor/slang mapping that was duplicated
 * across App.tsx (2 sites) and NewOnboardingScreen.tsx (1 site).
 */
import type { Character } from '../types/character';
import type { AvatarProfile } from '../agent/core/types';

/** The partial AvatarProfile shape expected by contextController.createFromDescription() */
type AvatarProfileParams = Partial<AvatarProfile>;

/**
 * Derive energy level from character style.
 */
function deriveEnergyLevel(style: string): 'low' | 'medium' | 'high' {
  if (['energetic', 'playful'].includes(style)) return 'high';
  if (['mysterious', 'dry-humor'].includes(style)) return 'low';
  return 'medium';
}

/**
 * Derive humor style from character style.
 */
function deriveHumorStyle(style: string): string {
  if (['playful', 'dry-humor'].includes(style)) return style;
  return 'warm';
}

/**
 * Derive slang level from character style.
 */
function deriveSlangLevel(style: string): number {
  return ['casual', 'streetwise', 'energetic', 'playful'].includes(style) ? 0.7 : 0.4;
}

/**
 * Build the partial AvatarProfile params for a Character, suitable for passing
 * to `agent.avatar.createFromDescription(description, params, location)`.
 *
 * @param char - The full Character object
 * @param dialectKey - Resolved dialect key (e.g. "NP/Kathmandu")
 * @param culturalNotes - Cultural notes from DialectInfo (optional)
 * @param dialectName - Dialect display name from DialectInfo (optional)
 */
export function buildAvatarProfileParams(
  char: Character,
  dialectKey: string,
  culturalNotes?: string,
  dialectName?: string,
): AvatarProfileParams {
  return {
    name: char.name,
    personality: char.detailed || char.summary,
    speaksLike: char.speaks_like || 'a friendly local',
    energyLevel: deriveEnergyLevel(char.style),
    humorStyle: deriveHumorStyle(char.style) as AvatarProfile['humorStyle'],
    slangLevel: deriveSlangLevel(char.style),
    dialect: dialectKey || dialectName || '',
    culturalContext: culturalNotes ?? '',
    location: char.location_city,
    scenario: '',
    visual: {
      primaryColor: char.avatar_color?.primary ?? '#6BBAA7',
      secondaryColor: char.avatar_color?.secondary ?? '#D4A853',
      accentColor: char.avatar_color?.accent ?? '#F5F0EB',
      accessory: char.avatar_accessory ?? char.emoji ?? '\u{1F30D}',
      emoji: char.emoji ?? '\u{1F30D}',
    },
  };
}
