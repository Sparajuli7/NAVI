import type { Character } from '../types/character';
import type { LocationContext } from '../types/config';
import { promptLoader } from '../agent/prompts/promptLoader';

export function buildSlangPrompt(
  topic: string,
  character: Character,
  location: LocationContext | null,
): string {
  const dialect = location?.dialectInfo?.dialect ?? 'the local language';
  const city = location?.city ?? 'this city';
  const language = location?.dialectInfo?.language ?? 'the local language';

  return promptLoader.get('systemLayers.legacySlang.template', {
    characterName: character.name,
    city,
    dialect,
    language,
    topic,
  });
}
