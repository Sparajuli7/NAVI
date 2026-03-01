import dialectMapRaw from '../config/dialectMap.json';
import citiesData from '../data/cities.json';
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

const BUNDLED_CITIES: CityEntry[] = citiesData as CityEntry[];

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
