/**
 * Shared location/dialect helpers used across App.tsx, NewOnboardingScreen.tsx, and other UI components.
 * Consolidates: COUNTRY_NAMES, getPresetCities, buildLocationFromPreset, resolveDialectKey, buildLocationContext.
 */
import type { LocationContext, DialectInfo } from '../types/config';
import dialectMapRaw from '../config/dialectMap.json';

type DialectMapType = Record<string, DialectInfo>;
const dialectMap = dialectMapRaw as DialectMapType;

/** ISO country code to human-readable country name */
export const COUNTRY_NAMES: Record<string, string> = {
  JP: 'Japan',
  VN: 'Vietnam',
  FR: 'France',
  MX: 'Mexico',
  KR: 'South Korea',
  NP: 'Nepal',
};

/** A preset city derived from dialectMap.json */
export interface PresetCity {
  key: string;
  city: string;
  country: string;
}

/** Get all preset cities from the dialectMap with human-readable country names. */
export function getPresetCities(): PresetCity[] {
  return Object.keys(dialectMap).map((key) => {
    const [countryCode, city] = key.split('/');
    return {
      key,
      city,
      country: COUNTRY_NAMES[countryCode] ?? countryCode,
    };
  });
}

/** Build a full LocationContext from a dialectMap preset key (e.g. "NP/Kathmandu"). */
export function buildLocationFromPreset(key: string): LocationContext {
  const [countryCode, city] = key.split('/');
  const info = dialectMap[key];
  return {
    city,
    country: COUNTRY_NAMES[countryCode] ?? countryCode,
    countryCode,
    lat: 0,
    lng: 0,
    dialectKey: key,
    dialectInfo: info ?? null,
  };
}

/**
 * Resolve a dialect key for a character. Prefers the stored dialect_key,
 * falls back to scanning dialectMap by city name.
 */
export function resolveDialectKey(storedDialectKey: string | undefined, city: string): string {
  if (storedDialectKey) return storedDialectKey;
  return Object.keys(dialectMap).find(
    (k) => k.split('/')[1]?.toLowerCase() === city.toLowerCase(),
  ) ?? '';
}

/** Look up DialectInfo for a given dialect key. Returns null if not found. */
export function getDialectInfo(dialectKey: string): DialectInfo | null {
  if (!dialectKey) return null;
  return dialectMap[dialectKey] ?? null;
}

/**
 * Build a LocationContext from a character's city/country and a resolved dialect key.
 * Used when switching companions or updating character location.
 */
export function buildLocationContext(
  city: string,
  country: string,
  dialectKey: string,
): LocationContext {
  const countryCode = dialectKey ? dialectKey.split('/')[0] : '';
  return {
    city,
    country,
    countryCode,
    lat: 0,
    lng: 0,
    dialectKey,
    dialectInfo: getDialectInfo(dialectKey),
  };
}
