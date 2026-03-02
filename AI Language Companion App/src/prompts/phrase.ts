import type { Character } from '../types/character';
import type { LocationContext } from '../types/config';
import { promptLoader } from '../agent/prompts/promptLoader';

export function buildPhrasePrompt(
  phraseRequest: string,
  character: Character,
  location: LocationContext | null,
): string {
  const dialect = location?.dialectInfo?.dialect ?? 'the local language';
  const city = location?.city ?? 'this city';

  return promptLoader.get('systemLayers.legacyPhrase.template', {
    characterName: character.name,
    city,
    dialect,
    phraseRequest,
  });
}
