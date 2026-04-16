/**
 * LanguagePicker — select a target language to learn.
 *
 * Features:
 * - Grid of supported languages
 * - Pre-selects based on city's country when a CityEntry is provided
 * - Shows language name + native name + script info
 * - User can override the suggestion (Brussels user can pick French or Dutch)
 */

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Search, Globe } from 'lucide-react';
import { SUPPORTED_LANGUAGES, getDefaultLanguageForCountry } from '../../config/supportedLanguages';
import type { SupportedLanguage } from '../../config/supportedLanguages';
import type { CityEntry } from './CityPicker';

interface LanguagePickerProps {
  value: string | null; // language code
  onChange: (languageCode: string) => void;
  /** When set, auto-suggests the default language for this city's country */
  cityContext?: CityEntry | null;
  className?: string;
}

export function LanguagePicker({ value, onChange, cityContext, className = '' }: LanguagePickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const hasAutoSelected = useRef(false);

  // Auto-suggest language when city changes
  useEffect(() => {
    if (!cityContext?.countryCode) return;
    // Only auto-select if no value is set yet, or if city changed
    const suggested = getDefaultLanguageForCountry(cityContext.countryCode);
    if (suggested && !hasAutoSelected.current) {
      onChange(suggested.code);
      hasAutoSelected.current = true;
    }
  }, [cityContext?.countryCode]);

  // Reset auto-select flag when city is cleared
  useEffect(() => {
    if (!cityContext) {
      hasAutoSelected.current = false;
    }
  }, [cityContext]);

  // Filter and sort languages
  const languages = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let filtered = SUPPORTED_LANGUAGES;
    if (q) {
      filtered = SUPPORTED_LANGUAGES.filter(
        l => l.name.toLowerCase().includes(q) ||
             l.nativeName.toLowerCase().includes(q) ||
             l.code.toLowerCase() === q ||
             l.scripts.some(s => s.toLowerCase().includes(q))
      );
    }

    // Sort: suggested language first, then selected, then alphabetical
    const suggestedCode = cityContext?.countryCode
      ? getDefaultLanguageForCountry(cityContext.countryCode)?.code
      : null;

    return [...filtered].sort((a, b) => {
      // Suggested first
      if (a.code === suggestedCode && b.code !== suggestedCode) return -1;
      if (b.code === suggestedCode && a.code !== suggestedCode) return 1;
      // Selected second
      if (a.code === value && b.code !== value) return -1;
      if (b.code === value && a.code !== value) return 1;
      // Alphabetical
      return a.name.localeCompare(b.name);
    });
  }, [searchQuery, cityContext?.countryCode, value]);

  const suggestedCode = cityContext?.countryCode
    ? getDefaultLanguageForCountry(cityContext.countryCode)?.code
    : null;

  return (
    <div className={className}>
      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search languages..."
          className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
        />
      </div>

      {/* Language grid */}
      <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
        {languages.map((lang) => {
          const isSelected = value === lang.code;
          const isSuggested = suggestedCode === lang.code && !isSelected;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => onChange(lang.code)}
              className={`flex flex-col items-start px-3 py-2.5 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'bg-primary/15 border-primary/50 shadow-sm'
                  : isSuggested
                  ? 'bg-primary/5 border-primary/20 hover:border-primary/40'
                  : 'bg-card border-border hover:border-primary/30'
              }`}
            >
              <div className="flex items-center gap-1.5 w-full">
                <span className={`text-sm font-medium truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                  {lang.name}
                </span>
                {isSelected && <span className="text-primary text-xs ml-auto shrink-0">&#10003;</span>}
                {isSuggested && <span className="text-xs text-primary/60 ml-auto shrink-0">suggested</span>}
              </div>
              <span className="text-xs text-muted-foreground truncate w-full">
                {lang.nativeName} &middot; {lang.scripts.join(', ')}
              </span>
            </button>
          );
        })}
      </div>

      {languages.length === 0 && (
        <div className="text-center py-6">
          <Globe className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No languages match "{searchQuery}"</p>
        </div>
      )}
    </div>
  );
}

/** Re-export for convenience */
export type { SupportedLanguage };
