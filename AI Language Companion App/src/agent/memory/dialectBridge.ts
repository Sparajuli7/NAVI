/**
 * Dialect Bridge — when city/language shifts to a related dialect,
 * inject adaptation coaching for the first N messages (not from-scratch teaching).
 */

import dialectMap from '../../config/dialectMap.json';
import type { DialectBridgeContext } from '../core/types';
import type { WorkingMemory } from './workingMemory';

const WM_KEY = 'dialect_bridge';
const WM_PREV_KEY = 'dialect_bridge_prev';
const BRIDGE_MESSAGES = 4;
const TTL_MS = 48 * 60 * 60 * 1000; // 48h

type DialectEntry = {
  language: string;
  dialect: string;
};

const map = dialectMap as Record<string, DialectEntry>;

/** Languages where dialect shifts should be treated as full language switches (no bridge). */
const NO_BRIDGE_LANGUAGES = new Set(['Arabic', 'Chinese', 'Mandarin']);

export function resolveDialectMeta(dialectKey: string, cityFallback = ''): {
  language: string;
  dialectLabel: string;
  city: string;
} {
  const entry = map[dialectKey];
  const city = dialectKey.includes('/')
    ? dialectKey.split('/')[1] ?? cityFallback
    : cityFallback;
  return {
    language: entry?.language ?? '',
    dialectLabel: entry?.dialect ?? (dialectKey || cityFallback),
    city: city || cityFallback,
  };
}

/**
 * Call when location/dialect may have changed. Activates bridge mode if
 * previous and current share a language (and aren't in NO_BRIDGE set).
 */
export function updateDialectBridge(
  working: WorkingMemory,
  current: { dialectKey: string; city: string; language?: string },
): DialectBridgeContext | null {
  const curMeta = resolveDialectMeta(current.dialectKey, current.city);
  const curLang = current.language || curMeta.language;
  if (!current.dialectKey && !curLang) return null;

  const existing = working.get(WM_KEY) as DialectBridgeContext | undefined;
  if (existing && existing.messagesRemaining > 0) {
    // Same bridge still active
    if (
      existing.currentDialectKey === current.dialectKey
      || (existing.currentLanguage === curLang && existing.currentCity === current.city)
    ) {
      return existing;
    }
  }

  const prev = working.get(WM_PREV_KEY) as {
    dialectKey: string;
    city: string;
    language: string;
  } | undefined;

  // Always remember current as previous for next shift
  working.set(
    WM_PREV_KEY,
    { dialectKey: current.dialectKey, city: current.city, language: curLang },
    TTL_MS,
  );

  if (!prev) return null;
  if (!prev.language || !curLang) return null;
  if (prev.dialectKey === current.dialectKey && prev.city === current.city) return null;
  if (prev.language !== curLang) return null; // different language = not a dialect bridge
  if (NO_BRIDGE_LANGUAGES.has(curLang)) return null;

  const prevMeta = resolveDialectMeta(prev.dialectKey, prev.city);
  const bridge: DialectBridgeContext = {
    previousDialectKey: prev.dialectKey,
    previousDialectLabel: prevMeta.dialectLabel,
    previousLanguage: prev.language,
    previousCity: prev.city,
    currentDialectKey: current.dialectKey,
    currentDialectLabel: curMeta.dialectLabel,
    currentLanguage: curLang,
    currentCity: current.city,
    messagesRemaining: BRIDGE_MESSAGES,
    sharedLanguage: true,
  };
  working.set(WM_KEY, bridge, TTL_MS);
  return bridge;
}

/** Consume one bridge turn; returns injection text or null when exhausted. */
export function consumeDialectBridge(working: WorkingMemory): string | null {
  const bridge = working.get(WM_KEY) as DialectBridgeContext | undefined;
  if (!bridge || bridge.messagesRemaining <= 0) return null;

  bridge.messagesRemaining -= 1;
  working.set(WM_KEY, bridge, TTL_MS);

  return [
    `DIALECT BRIDGE: This user already knows ${bridge.previousDialectLabel} (${bridge.previousCity}) and is now with you in ${bridge.currentCity} (${bridge.currentDialectLabel}).`,
    'DO NOT start from scratch — they know the language. Help them ADAPT.',
    `In the next few messages, naturally surface 1–2 KEY differences (pronouns, slang, pronunciation) between ${bridge.previousDialectLabel} and ${bridge.currentDialectLabel}.`,
    'Celebrate what they already know. Offer one local marker phrase that signals they get THIS variant.',
    'Stay mostly in their native language; embed exactly one target phrase per message as **phrase** (phonetic).',
  ].join('\n');
}

export function getActiveDialectBridge(working: WorkingMemory): DialectBridgeContext | null {
  const bridge = working.get(WM_KEY) as DialectBridgeContext | undefined;
  if (!bridge || bridge.messagesRemaining <= 0) return null;
  return bridge;
}
