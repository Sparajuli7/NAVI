/**
 * CityPicker — searchable autocomplete for selecting any city worldwide.
 *
 * Features:
 * - Type-ahead search filtering cities.json by city name, country name, or country code
 * - Country flag emoji for each result
 * - "Detect my location" GPS button
 * - Debounced search (300ms)
 * - Limits dropdown to 8 results for performance
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Search, Navigation, MapPin, X } from 'lucide-react';
import citiesData from '../../data/cities.json';
import { detectLocation } from '../../services/location';
import { countryFlag } from '../../utils/countryFlag';

export interface CityEntry {
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
}

interface CityPickerProps {
  value: CityEntry | null;
  onChange: (city: CityEntry | null) => void;
  placeholder?: string;
  /** Show the GPS detect button (default: true) */
  showGPS?: boolean;
  /** Additional CSS class for the container */
  className?: string;
}

// Normalize the cities.json shape (it uses "name" and "country_code")
const ALL_CITIES: CityEntry[] = (citiesData as Array<{ name: string; country: string; country_code: string; lat: number; lng: number }>)
  .map(c => ({
    city: c.name,
    country: c.country,
    countryCode: c.country_code,
    lat: c.lat,
    lng: c.lng,
  }));

// Deduplicate by city+countryCode (cities.json has some dupes like Kathmandu)
const CITIES: CityEntry[] = [];
const _seen = new Set<string>();
for (const c of ALL_CITIES) {
  const key = `${c.city}|${c.countryCode}`;
  if (!_seen.has(key)) {
    _seen.add(key);
    CITIES.push(c);
  }
}

const MAX_RESULTS = 8;

export function CityPicker({ value, onChange, placeholder = 'Search cities...', showGPS = true, className = '' }: CityPickerProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [detectingGPS, setDetectingGPS] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter cities
  const filtered = useMemo(() => {
    if (!debouncedQuery.trim()) {
      // When no search, show popular cities
      return CITIES.slice(0, MAX_RESULTS);
    }
    const q = debouncedQuery.toLowerCase().trim();
    const results: CityEntry[] = [];
    // Exact city name starts-with gets priority
    for (const c of CITIES) {
      if (results.length >= MAX_RESULTS) break;
      if (c.city.toLowerCase().startsWith(q)) {
        results.push(c);
      }
    }
    // Then contains matches
    for (const c of CITIES) {
      if (results.length >= MAX_RESULTS) break;
      if (results.includes(c)) continue;
      if (
        c.city.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.countryCode.toLowerCase() === q
      ) {
        results.push(c);
      }
    }
    return results;
  }, [debouncedQuery]);

  const handleSelect = useCallback((city: CityEntry) => {
    onChange(city);
    setQuery('');
    setIsOpen(false);
    setGpsError(null);
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange(null);
    setQuery('');
    setGpsError(null);
  }, [onChange]);

  const handleDetectLocation = async () => {
    setDetectingGPS(true);
    setGpsError(null);
    try {
      const loc = await detectLocation();
      // Find the closest city in our database, or use the detected location directly
      const match = CITIES.find(
        c => c.city.toLowerCase() === loc.city.toLowerCase() && c.countryCode === loc.countryCode
      );
      if (match) {
        handleSelect(match);
      } else {
        // Use detected location even if not in our city list
        handleSelect({
          city: loc.city,
          country: loc.country,
          countryCode: loc.countryCode,
          lat: loc.lat,
          lng: loc.lng,
        });
      }
    } catch {
      setGpsError('Could not detect location');
    } finally {
      setDetectingGPS(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Selected city display or input */}
      {value ? (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-card border border-border rounded-xl">
          <MapPin className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm text-foreground flex-1">
            {countryFlag(value.countryCode)} {value.city}, {value.country}
          </span>
          <button
            type="button"
            onClick={handleClear}
            className="p-0.5 hover:bg-muted/50 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder={placeholder}
              className="w-full pl-9 pr-3 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          {showGPS && (
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={detectingGPS}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-primary hover:bg-primary/5 transition-colors disabled:opacity-40 border border-dashed border-border"
            >
              <Navigation className={`w-4 h-4 ${detectingGPS ? 'animate-pulse' : ''}`} />
              {detectingGPS ? 'Detecting...' : 'Detect my location'}
            </button>
          )}

          {gpsError && (
            <p className="text-xs text-destructive px-1">{gpsError}</p>
          )}
        </div>
      )}

      {/* City results — inline list (not floating) to avoid overflow clipping */}
      {isOpen && !value && (
        <div className="mt-2 bg-card border border-border rounded-xl overflow-hidden max-h-56 overflow-y-auto">
          {filtered.length > 0 ? (
            filtered.map((c, i) => (
              <button
                key={`${c.city}-${c.countryCode}-${i}`}
                type="button"
                onClick={() => handleSelect(c)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-muted/50 active:bg-primary/10 transition-colors border-b border-border/50 last:border-b-0"
              >
                <span className="text-base shrink-0">{countryFlag(c.countryCode)}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-foreground block truncate">{c.city}</span>
                  <span className="text-xs text-muted-foreground block truncate">{c.country}</span>
                </div>
              </button>
            ))
          ) : (
            <div className="px-3 py-4 text-center">
              <p className="text-xs text-muted-foreground">No cities found for "{query}"</p>
              <p className="text-xs text-muted-foreground mt-1">Try a different spelling or use GPS</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Export the full city list for external use */
export { CITIES };
