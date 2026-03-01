import dialectMapRaw from '../config/dialectMap.json';
import type { LocationContext, DialectInfo } from '../types/config';

type DialectMap = Record<string, DialectInfo>;
const dialectMap = dialectMapRaw as DialectMap;

interface CityEntry {
  name: string;
  country: string;
  country_code: string;
  lat: number;
  lng: number;
}

const BUNDLED_CITIES: CityEntry[] = [
  { name: 'Ho Chi Minh City', country: 'Vietnam',      country_code: 'VN', lat: 10.8231, lng: 106.6297 },
  { name: 'Hanoi',            country: 'Vietnam',      country_code: 'VN', lat: 21.0285, lng: 105.8542 },
  { name: 'Tokyo',            country: 'Japan',        country_code: 'JP', lat: 35.6762, lng: 139.6503 },
  { name: 'Osaka',            country: 'Japan',        country_code: 'JP', lat: 34.6937, lng: 135.5023 },
  { name: 'Paris',            country: 'France',       country_code: 'FR', lat: 48.8566, lng:   2.3522 },
  { name: 'Mexico City',      country: 'Mexico',       country_code: 'MX', lat: 19.4326, lng: -99.1332 },
  { name: 'Seoul',            country: 'South Korea',  country_code: 'KR', lat: 37.5665, lng: 126.9780 },
  { name: 'New York',         country: 'USA',          country_code: 'US', lat: 40.7128, lng: -74.0060 },
  { name: 'London',           country: 'UK',           country_code: 'GB', lat: 51.5074, lng:  -0.1278 },
  { name: 'Bangkok',          country: 'Thailand',     country_code: 'TH', lat: 13.7563, lng: 100.5018 },
  { name: 'Singapore',        country: 'Singapore',    country_code: 'SG', lat:  1.3521, lng: 103.8198 },
  { name: 'Mumbai',           country: 'India',        country_code: 'IN', lat: 19.0760, lng:  72.8777 },
  { name: 'Beijing',          country: 'China',        country_code: 'CN', lat: 39.9042, lng: 116.4074 },
  { name: 'Shanghai',         country: 'China',        country_code: 'CN', lat: 31.2304, lng: 121.4737 },
  { name: 'Berlin',           country: 'Germany',      country_code: 'DE', lat: 52.5200, lng:  13.4050 },
];

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getCityFromCoords(lat: number, lng: number): CityEntry {
  let nearest = BUNDLED_CITIES[0];
  let minDist = Infinity;
  for (const city of BUNDLED_CITIES) {
    const dist = haversineDistance(lat, lng, city.lat, city.lng);
    if (dist < minDist) {
      minDist = dist;
      nearest = city;
    }
  }
  return nearest;
}

export function lookupDialect(countryCode: string, city: string): { key: string; info: DialectInfo } | null {
  const key = `${countryCode}/${city}`;
  const info = dialectMap[key];
  if (info) return { key, info };

  const fallbackKey = Object.keys(dialectMap).find((k) => k.startsWith(`${countryCode}/`));
  if (fallbackKey) return { key: fallbackKey, info: dialectMap[fallbackKey] };

  return null;
}

export async function detectLocation(): Promise<LocationContext> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const city = getCityFromCoords(latitude, longitude);
        const dialectResult = lookupDialect(city.country_code, city.name);

        resolve({
          city:        city.name,
          country:     city.country,
          countryCode: city.country_code,
          lat:         latitude,
          lng:         longitude,
          dialectKey:  dialectResult?.key ?? null,
          dialectInfo: dialectResult?.info ?? null,
        });
      },
      (err) => reject(err),
      { timeout: 8000 },
    );
  });
}
