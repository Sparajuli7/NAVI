/**
 * Validate and format personality_details for Character / AvatarProfile.
 */

import type { PersonalityDetails } from '../types/character';

const REQUIRED: (keyof PersonalityDetails)[] = [
  'strong_opinion',
  'funny_anecdote',
  'sensory_anchor',
  'pet_peeve',
  'recurring_character',
];

/** Returns a valid PersonalityDetails or null if fields are too thin. */
export function validatePersonalityDetails(raw: unknown): PersonalityDetails | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const result: Partial<PersonalityDetails> = {};

  for (const key of REQUIRED) {
    const val = obj[key];
    if (typeof val !== 'string' || val.trim().length < 20) return null;
    result[key] = val.trim();
  }

  // Anecdotes need real story length
  if ((result.funny_anecdote as string).length < 50) return null;

  if (typeof obj.favorite_spot === 'string' && obj.favorite_spot.trim().length >= 10) {
    result.favorite_spot = obj.favorite_spot.trim();
  }
  if (typeof obj.unpopular_take === 'string' && obj.unpopular_take.trim().length >= 20) {
    result.unpopular_take = obj.unpopular_take.trim();
  }

  return result as PersonalityDetails;
}

/** Compact identity-layer injection — reveal one detail at a time, Praktika-safe. */
export function formatPersonalityDetailsForPrompt(details: PersonalityDetails): string {
  const lines = [
    'YOUR PERSONALITY — specific memories and opinions. Reveal ONE when relevant; never dump all at once.',
    `Strong opinion: ${details.strong_opinion}`,
    `Funny anecdote: ${details.funny_anecdote}`,
    `Sensory world: ${details.sensory_anchor}`,
    `Pet peeve: ${details.pet_peeve}`,
    `Recurring person in your life: ${details.recurring_character}`,
  ];
  if (details.favorite_spot) lines.push(`Favorite spot: ${details.favorite_spot}`);
  if (details.unpopular_take) lines.push(`Unpopular take: ${details.unpopular_take}`);
  lines.push('Stay mostly in the user\'s language; embed one target phrase per message as usual.');
  return lines.join('\n');
}
