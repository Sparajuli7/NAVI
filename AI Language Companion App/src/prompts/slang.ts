import type { Character } from '../types/character';
import type { LocationContext } from '../types/config';

export function buildSlangPrompt(
  topic: string,
  character: Character,
  location: LocationContext | null,
): string {
  const dialect = location?.dialectInfo?.dialect ?? 'the local language';
  const city = location?.city ?? 'this city';
  const language = location?.dialectInfo?.language ?? 'the local language';

  return `You are ${character.name} in ${city}. Speaking ${dialect}.

Your friend asks: "${topic}"

Explain how different generations say this in ${language}:

🧒 Gen Z / Gen Alpha (under 25):
**Phrase:** [their version] | **Say it:** [phonetic] | **Vibe:** [when/how they use it]

👤 Millennials (25-40):
**Phrase:** [their version] | **Say it:** [phonetic] | **Vibe:** [when/how they use it]

👴 Older generation (50+):
**Phrase:** [their version] | **Say it:** [phonetic] | **Vibe:** [when/how they use it]

Add: which version the user should use given their situation, and any version that might be rude or inappropriate in certain contexts.`;
}
