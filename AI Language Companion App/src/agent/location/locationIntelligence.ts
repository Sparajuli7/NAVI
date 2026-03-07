/**
 * NAVI Agent Framework — Location-Aware Intelligence
 *
 * Wraps the existing location service and enhances it with:
 * - Automatic dialect/language inference
 * - Location-aware memory retrieval
 * - Context injection for avatar prompts
 * - Manual location override support
 *
 * Design decision: Wrap the existing location.ts service.
 * The geolocation + city lookup + dialect mapping logic already works.
 * This module adds the intelligence layer on top — deciding what
 * location context to inject into conversations.
 */

import type { LocationContext } from '../../types/config';
import { detectLocation, getCityFromCoords, lookupDialect } from '../../services/location';
import { agentBus } from '../core/eventBus';
import { get, set } from 'idb-keyval';

const STORAGE_KEY = 'navi_agent_location';

export interface LocationIntelligenceState {
  /** Current detected or manually set location */
  current: LocationContext | null;
  /** Whether location was auto-detected or manually set */
  source: 'auto' | 'manual' | 'none';
  /** Location history for context */
  history: Array<{ location: LocationContext; timestamp: number }>;
}

export class LocationIntelligence {
  private state: LocationIntelligenceState = {
    current: null,
    source: 'none',
    history: [],
  };

  /** Initialize — try to restore saved location, then detect */
  async initialize(): Promise<LocationContext | null> {
    // Try to restore saved location
    const saved = await get<LocationIntelligenceState>(STORAGE_KEY);
    if (saved) {
      this.state = saved;
    }

    // If no saved location, try auto-detect
    if (!this.state.current) {
      try {
        const detected = await detectLocation();
        this.setLocation(detected, 'auto');
      } catch {
        // Geolocation failed — will need manual input
      }
    }

    return this.state.current;
  }

  /** Set location (from auto-detect or manual override) */
  setLocation(location: LocationContext, source: 'auto' | 'manual' = 'manual'): void {
    const previous = this.state.current;
    this.state.current = location;
    this.state.source = source;

    // Add to history (keep last 10)
    this.state.history.push({ location, timestamp: Date.now() });
    if (this.state.history.length > 10) {
      this.state.history = this.state.history.slice(-10);
    }

    // Persist
    set(STORAGE_KEY, this.state).catch(console.error);

    agentBus.emit('location:change', {
      previous,
      current: location,
      source,
    });
  }

  /** Set location by city name (looks up coordinates and dialect) */
  setLocationByCity(
    city: string,
    country: string,
    countryCode: string,
    lat: number,
    lng: number,
  ): void {
    const dialectResult = lookupDialect(countryCode, city);

    const location: LocationContext = {
      city,
      country,
      countryCode,
      lat,
      lng,
      dialectKey: dialectResult?.key ?? null,
      dialectInfo: dialectResult?.info ?? null,
    };

    this.setLocation(location, 'manual');
  }

  /** Get current location */
  getLocation(): LocationContext | null {
    return this.state.current;
  }

  /** Get location source */
  getSource(): 'auto' | 'manual' | 'none' {
    return this.state.source;
  }

  /** Get location history */
  getHistory(): Array<{ location: LocationContext; timestamp: number }> {
    return [...this.state.history];
  }

  /** Get the primary language for the current location */
  getPrimaryLanguage(): string {
    return this.state.current?.dialectInfo?.language ?? 'Unknown';
  }

  /** Get the dialect for the current location */
  getDialect(): string {
    return this.state.current?.dialectInfo?.dialect ?? 'Standard';
  }

  /**
   * Build location context string for prompt injection.
   * Includes city, country, dialect, cultural notes.
   */
  buildContextForPrompt(): string {
    const loc = this.state.current;
    if (!loc) return 'Location: Unknown. Use the local language when available.';

    const lines: string[] = [];
    lines.push(`Location: ${loc.city}, ${loc.country}`);

    if (loc.dialectInfo) {
      lines.push(`Language: ${loc.dialectInfo.language} (${loc.dialectInfo.dialect})`);
      lines.push(`Cultural notes: ${loc.dialectInfo.cultural_notes}`);
    }

    return lines.join('\n');
  }

  /** Re-detect location from GPS */
  async refreshLocation(): Promise<LocationContext> {
    const detected = await detectLocation();
    this.setLocation(detected, 'auto');
    return detected;
  }
}
