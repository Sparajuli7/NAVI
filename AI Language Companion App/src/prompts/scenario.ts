import type { ScenarioKey } from '../types/config';
import type { Character } from '../types/character';
import type { LocationContext } from '../types/config';
import scenarioContexts from '../config/scenarioContexts.json';
import { promptLoader } from '../agent/prompts/promptLoader';

const SCENARIOS = scenarioContexts as Record<string, { label: string; vocabulary_focus: string[] }>;

const SCENARIO_KEYWORDS: Record<ScenarioKey, string[]> = {
  restaurant: ['restaurant', 'food', 'menu', 'eat', 'hungry', 'order', 'bill', 'cafe', 'coffee', 'drink'],
  hospital:   ['hospital', 'doctor', 'sick', 'pain', 'medicine', 'health', 'emergency', 'clinic', 'pharmacy'],
  market:     ['market', 'shop', 'buy', 'price', 'how much', 'bargain', 'store', 'mall', 'vendor'],
  office:     ['office', 'work', 'meeting', 'email', 'colleague', 'boss', 'business', 'professional'],
  nightlife:  ['bar', 'club', 'night', 'drink', 'party', 'fun', 'nightlife', 'music', 'dance'],
  transit:    ['bus', 'train', 'metro', 'taxi', 'station', 'directions', 'map', 'uber', 'grab', 'transport'],
  school:     ['school', 'class', 'teacher', 'student', 'homework', 'enroll', 'enrollment', 'university'],
  government: ['government', 'visa', 'passport', 'form', 'office', 'document', 'id', 'official'],
};

export function detectScenario(userMessage: string): ScenarioKey | null {
  const lower = userMessage.toLowerCase();
  for (const [scenario, keywords] of Object.entries(SCENARIO_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return scenario as ScenarioKey;
    }
  }
  return null;
}

export function buildScenarioSwitchPrompt(
  newScenario: ScenarioKey,
  character: Character,
  location: LocationContext | null,
): string {
  const sc = SCENARIOS[newScenario];
  const city = location?.city ?? 'this city';

  return promptLoader.get('systemLayers.scenarioSwitch.template', {
    characterName: character.name,
    scenarioLabel: sc.label,
    city,
    vocabulary: sc.vocabulary_focus.join(', '),
  });
}

export function buildLocationChangePrompt(
  newCity: string,
  newCountry: string,
  character: Character,
): string {
  return promptLoader.get('systemLayers.locationChange.template', {
    characterName: character.name,
    city: newCity,
    country: newCountry,
  });
}
