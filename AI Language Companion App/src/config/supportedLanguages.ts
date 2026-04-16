/**
 * Supported languages for NAVI.
 * Each entry maps to what LLMs can actually support well for language learning.
 * `defaultForCountries` maps ISO country codes to this language as a default suggestion.
 */

export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
  scripts: string[];
  /** ISO 3166-1 alpha-2 country codes where this is the default language */
  defaultForCountries: string[];
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'ja', name: 'Japanese', nativeName: '日本語', scripts: ['Hiragana', 'Katakana', 'Kanji'], defaultForCountries: ['JP'] },
  { code: 'ko', name: 'Korean', nativeName: '한국어', scripts: ['Hangul'], defaultForCountries: ['KR', 'KP'] },
  { code: 'fr', name: 'French', nativeName: 'Français', scripts: ['Latin'], defaultForCountries: ['FR', 'BE', 'SN', 'CI', 'CM', 'CD', 'CG', 'GA', 'ML', 'BF', 'NE', 'TD', 'MG', 'DJ', 'LU'] },
  { code: 'es', name: 'Spanish', nativeName: 'Español', scripts: ['Latin'], defaultForCountries: ['ES', 'MX', 'AR', 'CO', 'PE', 'CL', 'VE', 'EC', 'BO', 'PY', 'UY', 'PA', 'CR', 'GT', 'CU', 'DO', 'PR', 'HN', 'SV', 'NI'] },
  { code: 'de', name: 'German', nativeName: 'Deutsch', scripts: ['Latin'], defaultForCountries: ['DE', 'AT', 'CH'] },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', scripts: ['Latin'], defaultForCountries: ['IT', 'MT'] },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', scripts: ['Latin'], defaultForCountries: ['PT', 'BR', 'AO', 'MZ'] },
  { code: 'zh', name: 'Mandarin Chinese', nativeName: '中文', scripts: ['Simplified', 'Traditional'], defaultForCountries: ['CN', 'TW', 'SG'] },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', scripts: ['Thai'], defaultForCountries: ['TH'] },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', scripts: ['Latin (with diacritics)'], defaultForCountries: ['VN'] },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', scripts: ['Devanagari'], defaultForCountries: ['NP'] },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', scripts: ['Devanagari'], defaultForCountries: ['IN'] },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', scripts: ['Arabic'], defaultForCountries: ['SA', 'AE', 'EG', 'IQ', 'JO', 'KW', 'QA', 'OM', 'BH', 'LB', 'LY', 'TN', 'DZ', 'MA', 'SD', 'MR', 'SO'] },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', scripts: ['Cyrillic'], defaultForCountries: ['RU', 'BY', 'KZ', 'KG'] },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', scripts: ['Latin'], defaultForCountries: ['TR', 'CY'] },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', scripts: ['Latin'], defaultForCountries: ['ID'] },
  { code: 'tl', name: 'Tagalog', nativeName: 'Tagalog', scripts: ['Latin'], defaultForCountries: ['PH'] },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', scripts: ['Latin'], defaultForCountries: ['KE', 'TZ', 'UG', 'RW', 'BI'] },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', scripts: ['Latin'], defaultForCountries: ['NL'] },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', scripts: ['Latin'], defaultForCountries: ['PL'] },
  { code: 'ca', name: 'Catalan', nativeName: 'Català', scripts: ['Latin'], defaultForCountries: [] },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', scripts: ['Cyrillic'], defaultForCountries: ['UA'] },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', scripts: ['Greek'], defaultForCountries: ['GR'] },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština', scripts: ['Latin'], defaultForCountries: ['CZ'] },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', scripts: ['Latin'], defaultForCountries: ['HU'] },
  { code: 'ro', name: 'Romanian', nativeName: 'Română', scripts: ['Latin'], defaultForCountries: ['RO', 'MD'] },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', scripts: ['Latin'], defaultForCountries: ['SE'] },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', scripts: ['Latin'], defaultForCountries: ['DK'] },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk', scripts: ['Latin'], defaultForCountries: ['NO'] },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi', scripts: ['Latin'], defaultForCountries: ['FI'] },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', scripts: ['Latin'], defaultForCountries: ['MY', 'BN'] },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', scripts: ['Hebrew'], defaultForCountries: ['IL'] },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', scripts: ['Arabic'], defaultForCountries: ['IR'] },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', scripts: ['Bengali'], defaultForCountries: ['BD'] },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', scripts: ['Arabic'], defaultForCountries: ['PK'] },
  { code: 'si', name: 'Sinhala', nativeName: 'සිංහල', scripts: ['Sinhala'], defaultForCountries: ['LK'] },
  { code: 'km', name: 'Khmer', nativeName: 'ខ្មែរ', scripts: ['Khmer'], defaultForCountries: ['KH'] },
  { code: 'my', name: 'Burmese', nativeName: 'မြန်မာဘာသာ', scripts: ['Myanmar'], defaultForCountries: ['MM'] },
  { code: 'lo', name: 'Lao', nativeName: 'ລາວ', scripts: ['Lao'], defaultForCountries: ['LA'] },
  { code: 'mn', name: 'Mongolian', nativeName: 'Монгол', scripts: ['Cyrillic'], defaultForCountries: ['MN'] },
  { code: 'ka', name: 'Georgian', nativeName: 'ქართული', scripts: ['Georgian'], defaultForCountries: ['GE'] },
  { code: 'hy', name: 'Armenian', nativeName: 'Հայերեն', scripts: ['Armenian'], defaultForCountries: ['AM'] },
  { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski', scripts: ['Latin'], defaultForCountries: ['HR'] },
  { code: 'sr', name: 'Serbian', nativeName: 'Српски', scripts: ['Cyrillic', 'Latin'], defaultForCountries: ['RS'] },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български', scripts: ['Cyrillic'], defaultForCountries: ['BG'] },
  { code: 'en', name: 'English', nativeName: 'English', scripts: ['Latin'], defaultForCountries: ['US', 'GB', 'AU', 'NZ', 'CA', 'IE', 'JM', 'GH', 'NG', 'ZA', 'ZW', 'BW', 'NA', 'FJ', 'PG'] },
];

/** Lookup the default language for a country code. Returns the first match or null. */
export function getDefaultLanguageForCountry(countryCode: string): SupportedLanguage | null {
  if (!countryCode) return null;
  const upper = countryCode.toUpperCase();
  return SUPPORTED_LANGUAGES.find(l => l.defaultForCountries.includes(upper)) ?? null;
}

/** Get a language by its code. */
export function getLanguageByCode(code: string): SupportedLanguage | null {
  if (!code) return null;
  return SUPPORTED_LANGUAGES.find(l => l.code === code) ?? null;
}
