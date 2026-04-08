import { describe, it, expect } from 'vitest';

// Extracted from ConversationScreen — same implementation
function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '';
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

// Mirrors the new dialectIndicator logic in ConversationScreen
function buildDialectIndicator(currentLocation: {
  countryCode?: string;
  dialectInfo?: { dialect: string } | null;
} | null): string | null {
  return currentLocation?.countryCode
    ? countryFlag(currentLocation.countryCode)
    : null;
}

// OLD logic (what it used to be — kept for regression comparison)
function buildDialectIndicatorOld(currentLocation: {
  countryCode: string;
  dialectInfo?: { dialect: string } | null;
} | null): string | null {
  return currentLocation?.dialectInfo
    ? `${countryFlag(currentLocation.countryCode)} ${currentLocation.dialectInfo.dialect}`
    : null;
}

describe('dialectIndicator', () => {
  it('returns the flag emoji for a valid country code', () => {
    const result = buildDialectIndicator({ countryCode: 'NP' });
    expect(result).toBe('🇳🇵');
  });

  it('returns the flag for FR (France)', () => {
    const result = buildDialectIndicator({ countryCode: 'FR' });
    expect(result).toBe('🇫🇷');
  });

  it('returns the flag for JP (Japan)', () => {
    const result = buildDialectIndicator({ countryCode: 'JP' });
    expect(result).toBe('🇯🇵');
  });

  it('returns null when countryCode is absent', () => {
    const result = buildDialectIndicator({ countryCode: '' });
    expect(result).toBeNull();
  });

  it('returns null when currentLocation is null', () => {
    const result = buildDialectIndicator(null);
    expect(result).toBeNull();
  });

  it('returns flag even when dialectInfo is null (new behavior)', () => {
    // Old behavior: null when dialectInfo was absent. New: flag from countryCode alone.
    const result = buildDialectIndicator({ countryCode: 'NP', dialectInfo: null });
    expect(result).toBe('🇳🇵');
  });

  it('does NOT include the dialect name in the result (regression: old format)', () => {
    // Old format was e.g. "🇳🇵 Standard Nepali (Kathmandu)" — new format is just the flag
    const result = buildDialectIndicator({
      countryCode: 'NP',
      dialectInfo: { dialect: 'Standard Nepali (Kathmandu)' },
    });
    expect(result).not.toContain('Standard Nepali');
    expect(result).toBe('🇳🇵');
  });

  it('old format used to include dialect name (documents regression baseline)', () => {
    const old = buildDialectIndicatorOld({
      countryCode: 'NP',
      dialectInfo: { dialect: 'Standard Nepali (Kathmandu)' },
    });
    // This is what it used to produce — now gone
    expect(old).toBe('🇳🇵 Standard Nepali (Kathmandu)');
  });
});

describe('countryFlag', () => {
  it('converts 2-letter code to regional indicator emoji pair', () => {
    expect(countryFlag('US')).toBe('🇺🇸');
    expect(countryFlag('GB')).toBe('🇬🇧');
    expect(countryFlag('VN')).toBe('🇻🇳');
  });

  it('handles lowercase codes', () => {
    expect(countryFlag('np')).toBe('🇳🇵');
  });

  it('returns empty string for invalid codes', () => {
    expect(countryFlag('')).toBe('');
    expect(countryFlag('USA')).toBe(''); // 3-letter = invalid
    expect(countryFlag('X')).toBe('');  // 1-letter = invalid
  });
});
