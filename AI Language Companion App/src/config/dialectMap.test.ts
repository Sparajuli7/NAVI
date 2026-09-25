import { describe, it, expect } from 'vitest';
import dialectMap from './dialectMap.json';
import { SUPPORTED_LANGUAGES, getDefaultLanguageForCountry } from './supportedLanguages';
import { COUNTRY_NAMES, getPresetCities, buildLocationFromPreset, getDialectInfo } from '../utils/locationHelpers';

/** Phase 5 city keys — dialectMap must include these for the new languages. */
const PHASE5_DIALECT_KEYS = [
  'IN/Delhi',
  'IN/Mumbai',
  'ID/Jakarta',
  'ID/Bali',
  'TR/Istanbul',
  'PH/Manila',
  'RU/Moscow',
  'KE/Nairobi',
  'TZ/Dar es Salaam',
] as const;

const PHASE5_LANGUAGES = [
  'Hindi',
  'Indonesian',
  'Turkish',
  'Tagalog',
  'Russian',
  'Swahili',
] as const;

describe('dialectMap Phase 5 languages', () => {
  it('includes all Phase 5 dialect keys', () => {
    for (const key of PHASE5_DIALECT_KEYS) {
      expect(dialectMap, `missing dialect key ${key}`).toHaveProperty(key);
    }
  });

  it('each Phase 5 entry has required DialectInfo fields', () => {
    for (const key of PHASE5_DIALECT_KEYS) {
      const entry = (dialectMap as Record<string, {
        language: string;
        dialect: string;
        formality_default: string;
        cultural_notes: string;
        slang_era: { gen_z: string; millennial: string; older: string };
      }>)[key];

      expect(entry.language).toBeTruthy();
      expect(entry.dialect).toBeTruthy();
      expect(['casual', 'neutral', 'formal']).toContain(entry.formality_default);
      expect(entry.cultural_notes.length).toBeGreaterThan(20);
      expect(entry.slang_era.gen_z).toBeTruthy();
      expect(entry.slang_era.millennial).toBeTruthy();
      expect(entry.slang_era.older).toBeTruthy();
    }
  });

  it('maps Phase 5 cities to the expected languages', () => {
    const expected: Record<string, string> = {
      'IN/Delhi': 'Hindi',
      'IN/Mumbai': 'Hindi',
      'ID/Jakarta': 'Indonesian',
      'ID/Bali': 'Indonesian',
      'TR/Istanbul': 'Turkish',
      'PH/Manila': 'Tagalog',
      'RU/Moscow': 'Russian',
      'KE/Nairobi': 'Swahili',
      'TZ/Dar es Salaam': 'Swahili',
    };
    for (const [key, language] of Object.entries(expected)) {
      expect(getDialectInfo(key)?.language).toBe(language);
    }
  });

  it('buildLocationFromPreset resolves country names for Phase 5 keys', () => {
    expect(buildLocationFromPreset('IN/Delhi').country).toBe('India');
    expect(buildLocationFromPreset('KE/Nairobi').country).toBe('Kenya');
    expect(buildLocationFromPreset('TZ/Dar es Salaam').country).toBe('Tanzania');
    expect(buildLocationFromPreset('PH/Manila').countryCode).toBe('PH');
  });

  it('COUNTRY_NAMES covers Phase 5 country codes', () => {
    for (const code of ['IN', 'ID', 'TR', 'PH', 'RU', 'KE', 'TZ']) {
      expect(COUNTRY_NAMES[code]).toBeTruthy();
    }
  });

  it('getPresetCities includes Phase 5 cities', () => {
    const keys = new Set(getPresetCities().map((c) => c.key));
    for (const key of PHASE5_DIALECT_KEYS) {
      expect(keys.has(key)).toBe(true);
    }
  });
});

describe('supportedLanguages Phase 5', () => {
  it('lists all Phase 5 languages', () => {
    const names = new Set(SUPPORTED_LANGUAGES.map((l) => l.name));
    for (const lang of PHASE5_LANGUAGES) {
      expect(names.has(lang)).toBe(true);
    }
  });

  it('defaults country codes to Phase 5 languages', () => {
    expect(getDefaultLanguageForCountry('IN')?.name).toBe('Hindi');
    expect(getDefaultLanguageForCountry('ID')?.name).toBe('Indonesian');
    expect(getDefaultLanguageForCountry('TR')?.name).toBe('Turkish');
    expect(getDefaultLanguageForCountry('PH')?.name).toBe('Tagalog');
    expect(getDefaultLanguageForCountry('RU')?.name).toBe('Russian');
    expect(getDefaultLanguageForCountry('KE')?.name).toBe('Swahili');
    expect(getDefaultLanguageForCountry('TZ')?.name).toBe('Swahili');
  });
});
