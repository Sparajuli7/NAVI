/**
 * AvatarSelectScreen — Onboarding: pick or create a companion, then pick a location.
 *
 * Layout:
 *   1. "Create a companion" card (primary CTA, top of grid)
 *   2. "Quick start" template grid (8 presets)
 *   3. After selection: name input, custom description (if custom), location picker
 *   4. Start button — passes template + LocationContext to App.tsx
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Pencil, MapPin, Search, Navigation, ChevronDown, ChevronUp, Globe } from 'lucide-react';
import { detectLocation } from '../../services/location';
import avatarTemplates from '../../config/avatarTemplates.json';
import { getPresetCities, buildLocationFromPreset } from '../../utils/locationHelpers';
import dialectMapRaw from '../../config/dialectMap.json';
import type { AvatarTemplate } from '../../types/character';
import type { LocationContext } from '../../types/config';

interface AvatarSelectScreenProps {
  onSelect: (template: AvatarTemplate, location: LocationContext | null) => Promise<void>;
}

const TEMPLATE_GRADIENTS: Record<string, string> = {
  street_food:         'from-orange-500/20 to-red-500/10',
  form_helper:         'from-blue-500/20 to-cyan-500/10',
  pronunciation_tutor: 'from-emerald-500/20 to-green-500/10',
  office_navigator:    'from-slate-500/20 to-indigo-500/10',
  market_haggler:      'from-purple-500/20 to-fuchsia-500/10',
  night_guide:         'from-violet-500/20 to-purple-500/10',
  elder_speaker:       'from-amber-500/20 to-yellow-500/10',
  youth_translator:    'from-pink-500/20 to-rose-500/10',
  custom:              'from-teal-500/20 to-cyan-500/10',
};

/** Group preset cities by language for the picker */
interface CityGroup {
  language: string;
  cities: { key: string; city: string; country: string; dialect: string }[];
}

function useCityGroups() {
  return useMemo(() => {
    const presets = getPresetCities();
    const dialects = dialectMapRaw as Record<string, { language: string; dialect: string }>;
    const byLang: Record<string, CityGroup['cities']> = {};
    for (const p of presets) {
      const info = dialects[p.key];
      if (!info) continue;
      const lang = info.language;
      if (!byLang[lang]) byLang[lang] = [];
      byLang[lang].push({ key: p.key, city: p.city, country: p.country, dialect: info.dialect });
    }
    return Object.entries(byLang)
      .map(([language, cities]) => ({ language, cities }))
      .sort((a, b) => a.language.localeCompare(b.language));
  }, []);
}

export function AvatarSelectScreen({ onSelect }: AvatarSelectScreenProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [selectedCityKey, setSelectedCityKey] = useState<string | null>(null);
  const [locationPickerOpen, setLocationPickerOpen] = useState(true);
  const [citySearch, setCitySearch] = useState('');
  const [detectingGPS, setDetectingGPS] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<LocationContext | null>(null);

  const templates = avatarTemplates as AvatarTemplate[];
  const cityGroups = useCityGroups();

  const isCustom = selected === 'custom';
  const hasSelection = selected !== null;
  const hasDescription = !isCustom || customDesc.trim().length > 0;
  const hasLocation = selectedCityKey !== null || gpsLocation !== null;
  const canStart = hasSelection && hasDescription && hasLocation;

  // Selected city display info
  const selectedCityInfo = useMemo(() => {
    if (!selectedCityKey) return null;
    for (const group of cityGroups) {
      const found = group.cities.find(c => c.key === selectedCityKey);
      if (found) return { ...found, language: group.language };
    }
    return null;
  }, [selectedCityKey, cityGroups]);

  // Filtered cities for search
  const filteredGroups = useMemo(() => {
    if (!citySearch.trim()) return cityGroups;
    const q = citySearch.toLowerCase();
    return cityGroups
      .map(g => ({
        ...g,
        cities: g.cities.filter(
          c => c.city.toLowerCase().includes(q) ||
               c.country.toLowerCase().includes(q) ||
               c.dialect.toLowerCase().includes(q) ||
               g.language.toLowerCase().includes(q)
        ),
      }))
      .filter(g => g.cities.length > 0);
  }, [cityGroups, citySearch]);

  const handleDetectLocation = async () => {
    setDetectingGPS(true);
    try {
      const loc = await detectLocation();
      setGpsLocation(loc);
      setSelectedCityKey(null); // GPS overrides manual pick
    } catch {
      // GPS failed — user can pick manually
    } finally {
      setDetectingGPS(false);
    }
  };

  const handleSelectCity = (key: string) => {
    setSelectedCityKey(key);
    setGpsLocation(null); // Manual pick overrides GPS
    setLocationPickerOpen(false);
  };

  const handleStart = () => {
    if (!canStart) return;

    // Build location context
    let locationCtx: LocationContext | null = null;
    if (selectedCityKey) {
      locationCtx = buildLocationFromPreset(selectedCityKey);
    } else if (gpsLocation) {
      locationCtx = gpsLocation;
    }

    let tmpl: AvatarTemplate;
    if (isCustom) {
      tmpl = {
        id: 'custom',
        emoji: '✨',
        label: nameInput.trim() || 'My Companion',
        base_personality: customDesc.trim(),
        default_style: 'casual',
        default_formality: 'casual',
        vocabulary_focus: [],
        scenario_hint: '',
      };
    } else {
      const base = templates.find(t => t.id === selected)!;
      tmpl = nameInput.trim() ? { ...base, label: nameInput.trim() } : base;
    }

    onSelect(tmpl, locationCtx);
  };

  return (
    <div className="min-h-[calc(100vh-57px)] bg-background flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-950/20 via-background to-teal-950/20 dark:from-purple-950/10 dark:via-background dark:to-teal-950/10" />

      <div className="relative z-10 flex-1 flex flex-col px-6 py-8">
        {/* Header */}
        <motion.div className="text-center mb-6" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <p className="text-4xl mb-2">🌏</p>
          <h1 className="text-2xl font-bold text-foreground tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            Choose your companion
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Create your own or pick a quick start</p>
        </motion.div>

        <motion.div className="flex-1 overflow-y-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          {/* ── Primary CTA: Create a companion ── */}
          <motion.button
            onClick={() => setSelected('custom')}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 text-left transition-all mb-4 ${
              isCustom
                ? 'bg-gradient-to-br from-teal-500/20 to-cyan-500/10 border-primary shadow-lg'
                : 'bg-gradient-to-br from-teal-500/10 to-cyan-500/5 border-primary/40 hover:border-primary/70'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isCustom ? 'bg-primary/20' : 'bg-primary/10'}`}>
              <Pencil className={`w-6 h-6 ${isCustom ? 'text-primary' : 'text-primary/70'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <span className={`text-sm font-semibold block ${isCustom ? 'text-foreground' : 'text-foreground/90'}`}>
                Create a companion
              </span>
              <span className="text-xs text-muted-foreground">Describe who you want by your side</span>
            </div>
            {isCustom && <span className="text-primary text-lg">✓</span>}
          </motion.button>

          {/* ── Quick start templates ── */}
          <motion.p
            className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.18 }}
          >
            Quick start
          </motion.p>
          <div className="grid grid-cols-2 gap-3">
            {templates.map((t, i) => {
              const gradient = TEMPLATE_GRADIENTS[t.id] ?? 'from-gray-500/20 to-gray-500/10';
              const isActive = selected === t.id;
              return (
                <motion.button
                  key={t.id}
                  onClick={() => setSelected(t.id)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i + 0.2 }}
                  className={`flex flex-col items-center p-4 rounded-2xl border-2 text-center transition-all ${
                    isActive
                      ? `bg-gradient-to-br ${gradient} border-primary shadow-lg`
                      : 'bg-card border-border hover:border-primary/30'
                  }`}
                >
                  <span className="text-3xl mb-2">{t.emoji}</span>
                  <span className={`text-sm font-semibold ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{t.label}</span>
                  <span className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.base_personality.split('.')[0]}</span>
                </motion.button>
              );
            })}
          </div>

          {/* ── Name + Description + Location (shown after selection) ── */}
          <AnimatePresence>
            {hasSelection && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="mt-4 space-y-3">
                  {/* Name input */}
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Give them a name (optional)"
                    className="w-full px-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 text-sm"
                  />

                  {/* Custom description (only for custom) */}
                  {isCustom && (
                    <textarea
                      value={customDesc}
                      onChange={(e) => setCustomDesc(e.target.value)}
                      placeholder="Describe your companion... e.g. a chill surfer who loves street food"
                      rows={3}
                      autoFocus
                      className="w-full px-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 text-sm resize-none"
                    />
                  )}

                  {/* ── Location Picker ── */}
                  <div className="border border-border rounded-xl overflow-hidden bg-card">
                    {/* Location header / selected display */}
                    <button
                      type="button"
                      onClick={() => setLocationPickerOpen(!locationPickerOpen)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left"
                    >
                      <MapPin className="w-4 h-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        {selectedCityInfo ? (
                          <>
                            <span className="text-sm font-medium text-foreground">
                              {selectedCityInfo.city}, {selectedCityInfo.country}
                            </span>
                            <span className="text-xs text-muted-foreground block">
                              {selectedCityInfo.dialect} — {selectedCityInfo.language}
                            </span>
                          </>
                        ) : gpsLocation ? (
                          <>
                            <span className="text-sm font-medium text-foreground">
                              {gpsLocation.city}, {gpsLocation.country}
                            </span>
                            <span className="text-xs text-muted-foreground block">
                              Detected via GPS{gpsLocation.dialectInfo ? ` — ${gpsLocation.dialectInfo.dialect}` : ''}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-sm font-medium text-muted-foreground">
                              Where are they located?
                            </span>
                            <span className="text-xs text-muted-foreground block">
                              Pick a city to set language and dialect
                            </span>
                          </>
                        )}
                      </div>
                      {locationPickerOpen ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                    </button>

                    {/* Expanded picker */}
                    <AnimatePresence>
                      {locationPickerOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
                            {/* Detect GPS */}
                            <button
                              type="button"
                              onClick={handleDetectLocation}
                              disabled={detectingGPS}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-primary hover:bg-primary/5 transition-colors disabled:opacity-40"
                            >
                              <Navigation className={`w-4 h-4 ${detectingGPS ? 'animate-pulse' : ''}`} />
                              {detectingGPS ? 'Detecting...' : 'Detect my location'}
                            </button>

                            {/* Search */}
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                              <input
                                type="text"
                                value={citySearch}
                                onChange={(e) => setCitySearch(e.target.value)}
                                placeholder="Search cities..."
                                className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                              />
                            </div>

                            {/* City list grouped by language */}
                            <div className="max-h-52 overflow-y-auto space-y-2">
                              {filteredGroups.map((group) => (
                                <div key={group.language}>
                                  <div className="flex items-center gap-1.5 px-1 py-1">
                                    <Globe className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                      {group.language}
                                    </span>
                                  </div>
                                  {group.cities.map((c) => {
                                    const isSelected = selectedCityKey === c.key;
                                    return (
                                      <button
                                        key={c.key}
                                        type="button"
                                        onClick={() => handleSelectCity(c.key)}
                                        className={`w-full flex items-start gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                                          isSelected
                                            ? 'bg-primary/10 border border-primary/30'
                                            : 'hover:bg-muted/50 border border-transparent'
                                        }`}
                                      >
                                        <div className="flex-1 min-w-0">
                                          <span className={`text-sm block ${isSelected ? 'font-semibold text-foreground' : 'text-foreground/90'}`}>
                                            {c.city}, {c.country}
                                          </span>
                                          <span className="text-xs text-muted-foreground">{c.dialect}</span>
                                        </div>
                                        {isSelected && <span className="text-primary text-sm mt-0.5">✓</span>}
                                      </button>
                                    );
                                  })}
                                </div>
                              ))}
                              {filteredGroups.length === 0 && (
                                <p className="text-xs text-muted-foreground text-center py-4">
                                  No cities match "{citySearch}"
                                </p>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Start button */}
        <motion.button
          onClick={handleStart}
          disabled={!canStart}
          className="w-full mt-4 px-6 py-3.5 bg-primary text-primary-foreground rounded-2xl text-sm font-semibold disabled:opacity-30 transition-opacity"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          whileTap={{ scale: 0.97 }}
        >
          Start →
        </motion.button>
      </div>
    </div>
  );
}
