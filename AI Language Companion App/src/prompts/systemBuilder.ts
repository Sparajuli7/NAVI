import type { Character, MemoryEntry, UserPreferences } from '../types/character';
import type { LocationContext, ScenarioKey } from '../types/config';
import type { ScenarioContext } from '../types/config';
import scenarioContexts from '../config/scenarioContexts.json';
import userPreferenceSchema from '../config/userPreferenceSchema.json';

const SCENARIOS = scenarioContexts as Record<ScenarioKey, ScenarioContext>;
const SCHEMA = userPreferenceSchema as Record<string, { prompt_injection: string; default: string | string[] }>;

const AGE_TO_GENERATION: Record<string, 'gen_z' | 'millennial' | 'older'> = {
  teen: 'gen_z',
  '20s': 'gen_z',
  '30s': 'millennial',
  '40s': 'millennial',
  '50s': 'older',
  '60s+': 'older',
};

const CORE_RULES = `Rules:
- You are a knowledgeable local friend and tour guide, NOT a translator or AI.
- Stay in character always. Never say "As an AI."
- When teaching ANY phrase, ALWAYS use this format:

**Phrase:** [text in local language/dialect]
**Say it:** [phonetic pronunciation for English speakers]
**Sound tip:** [mouth shape, tongue position, emphasis, tone direction — HOW to physically say it]
**Means:** [natural meaning, not literal word-for-word]
**Tip:** [when to use it, cultural context, common mistakes]

- Pronunciation and enunciation are critical. Teach HOW to say it:
  - Break down difficult sounds ("roll the r", "nasal sound like French 'en'")
  - Mark stress/emphasis ("stress the SECOND syllable")
  - For tonal languages: always describe the tone ("rising tone — like asking a question")
  - Flag sounds that don't exist in English and explain how to approximate
- Use local dialect and slang, not textbook language.
- If asked about generational language: provide age-specific slang with context on who uses it.
- Be concise. Under 150 words unless asked for detail.
- If unsure about something, say so.
- Adapt tone to scenario: casual for food/social, precise for documents, playful for nightlife.`;

export function buildSystemPrompt(
  character: Character,
  preferences: UserPreferences,
  location: LocationContext | null,
  scenario: ScenarioKey | null,
  memories: MemoryEntry[],
): string {
  const layers: string[] = [];

  // Layer 1 — Base identity
  layers.push(`You are ${character.name}. ${character.summary}\nYou speak like: ${character.speaks_like}`);

  // Layer 2 — User preferences (inject non-default only)
  const prefLines: string[] = [];
  for (const [key, val] of Object.entries(preferences)) {
    const schema = SCHEMA[key];
    if (!schema) continue;
    const defaultVal = Array.isArray(schema.default)
      ? schema.default.join(',')
      : schema.default;
    const currentVal = Array.isArray(val) ? val.join(',') : String(val);
    if (currentVal === defaultVal) continue;
    prefLines.push(schema.prompt_injection.replace('{value}', currentVal));
  }
  if (prefLines.length > 0) layers.push(prefLines.join(' '));

  // Layer 3 — Location + dialect
  if (location) {
    let locationLayer = `Location: ${location.city}, ${location.country}.`;
    if (location.dialectInfo) {
      const { dialect, cultural_notes, slang_era } = location.dialectInfo;
      locationLayer += ` Speak in ${dialect}, not standard/textbook.`;
      if (cultural_notes) locationLayer += ` ${cultural_notes}`;
      const generation = AGE_TO_GENERATION[preferences.avatar_age] ?? 'millennial';
      const slang = slang_era[generation];
      if (slang) locationLayer += ` Use age-appropriate slang: ${slang}`;
    }
    layers.push(locationLayer);
  }

  // Layer 4 — Scenario
  if (scenario && SCENARIOS[scenario]) {
    const sc = SCENARIOS[scenario];
    layers.push(
      `Current scenario: ${sc.label}. Vocabulary focus: ${sc.vocabulary_focus.join(', ')}. Tone: ${sc.tone_shift}.`,
    );
  }

  // Layer 5 — Memories
  if (memories.length > 0) {
    const recent = memories.slice(-8);
    layers.push(`What you remember:\n${recent.map((m) => `- ${m.value}`).join('\n')}`);
  }

  // Layer 6 — Core rules
  layers.push(CORE_RULES);

  return layers.join('\n\n');
}
