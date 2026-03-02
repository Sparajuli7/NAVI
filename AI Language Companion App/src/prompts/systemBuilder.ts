import type { Character, MemoryEntry, UserPreferences } from '../types/character';
import type { LocationContext, ScenarioKey } from '../types/config';
import type { ScenarioContext } from '../types/config';
import scenarioContexts from '../config/scenarioContexts.json';
import userPreferenceSchema from '../config/userPreferenceSchema.json';
import { promptLoader } from '../agent/prompts/promptLoader';

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

export function buildSystemPrompt(
  character: Character,
  preferences: UserPreferences,
  location: LocationContext | null,
  scenario: ScenarioKey | null,
  memories: MemoryEntry[],
  userProfile?: string,
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

  // Layer 6 — User profile / context notes
  if (userProfile && userProfile.trim()) {
    layers.push(`About the person you're talking to:\n${userProfile.trim()}`);
  }

  // Layer 7 — Core rules
  layers.push(promptLoader.get('coreRules.rules'));

  return layers.join('\n\n');
}
