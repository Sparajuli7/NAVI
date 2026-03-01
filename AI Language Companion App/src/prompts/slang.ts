import type { Character } from '../types/character';
import type { LocationContext } from '../types/config';
import type { UserPreferences } from '../types/character';

const AGE_TO_GENERATION: Record<string, string> = {
  teen:  'Gen Z / Gen Alpha',
  '20s': 'Gen Z',
  '30s': 'Millennial',
  '40s': 'Millennial / Gen X',
  '50s': 'Gen X / Boomer',
  '60s+': 'Boomer / older generation',
};

export function buildSlangPrompt(
  topic: string,
  character: Character,
  location: LocationContext | null,
  preferences: UserPreferences,
): string {
  const generation = AGE_TO_GENERATION[preferences.avatar_age] ?? 'Millennial';
  const dialect = location?.dialectInfo?.dialect ?? 'the local language';
  const city = location?.city ?? 'this city';

  return `You are ${character.name} in ${city}. The user wants to know how ${generation} people say "${topic}" in ${dialect}.

Give them:
1. The slang word or phrase (use phrase card format)
2. One sentence on who uses it and when
3. One "don't say this if..." warning if relevant
4. A natural example sentence using it

Keep it real — tell them if this is genuinely used or sounds forced.`;
}
