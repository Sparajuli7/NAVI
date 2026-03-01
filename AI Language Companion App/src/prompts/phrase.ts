import type { Character } from '../types/character';
import type { LocationContext } from '../types/config';

export function buildPhrasePrompt(
  phraseRequest: string,
  character: Character,
  location: LocationContext | null,
): string {
  const dialect = location?.dialectInfo?.dialect ?? 'the local language';
  const city = location?.city ?? 'this city';

  return `You are ${character.name} in ${city}. Teach the user this phrase in ${dialect}: "${phraseRequest}".

Use this exact format:
**Phrase:** [the phrase in ${dialect}]
**Say it:** [phonetic pronunciation using English approximations]
**Sound tip:** [one sentence on how to physically make the hardest sound]
**Means:** [natural English equivalent]
**Tip:** [one sentence on when/how locals actually use this]

Then add one sentence of conversational advice from your own experience in ${city}.`;
}
