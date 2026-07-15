/**
 * Shared location/dialect helpers used across App.tsx and other UI components.
 * Consolidates: COUNTRY_NAMES, resolveDialectKey, getDialectInfo, buildLocationContext.
 */
import type { LocationContext, DialectInfo, DialectMap } from '../types/config';
import dialectMapRaw from '../config/dialectMap.json';

const dialectMap = dialectMapRaw as DialectMap;

/** ISO country code to human-readable country name */
export const COUNTRY_NAMES: Record<string, string> = {
  JP: 'Japan', VN: 'Vietnam', FR: 'France', MX: 'Mexico', KR: 'South Korea',
  NP: 'Nepal', ES: 'Spain', IT: 'Italy', TH: 'Thailand', DE: 'Germany',
  BR: 'Brazil', CN: 'China', AR: 'Argentina', US: 'United States', GB: 'United Kingdom',
  AU: 'Australia', CA: 'Canada', IN: 'India', RU: 'Russia', PL: 'Poland',
  CZ: 'Czech Republic', UA: 'Ukraine', GR: 'Greece', TR: 'Turkey', EG: 'Egypt',
  SA: 'Saudi Arabia', AE: 'UAE', IL: 'Israel', PH: 'Philippines', ID: 'Indonesia',
  MY: 'Malaysia', SG: 'Singapore', KH: 'Cambodia', MM: 'Myanmar', LA: 'Laos',
  SE: 'Sweden', NO: 'Norway', DK: 'Denmark', FI: 'Finland', NL: 'Netherlands',
  BE: 'Belgium', PT: 'Portugal', CH: 'Switzerland', AT: 'Austria', IE: 'Ireland',
  CO: 'Colombia', PE: 'Peru', CL: 'Chile', EC: 'Ecuador', VE: 'Venezuela',
  KE: 'Kenya', TZ: 'Tanzania', UG: 'Uganda', RW: 'Rwanda', BI: 'Burundi',
};

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
