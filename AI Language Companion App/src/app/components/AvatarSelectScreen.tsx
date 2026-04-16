/**
 * AvatarSelectScreen — Onboarding: pick or create a companion, then pick a location + language.
 *
 * Layout:
 *   1. "Create a companion" card (primary CTA, top of grid)
 *   2. "Quick start" template grid (8 presets)
 *   3. After selection: name input, custom description (if custom), city picker, language picker
 *   4. Start button — passes template + LocationContext + language to App.tsx
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Pencil, MapPin, Globe } from 'lucide-react';
import avatarTemplates from '../../config/avatarTemplates.json';
import { getLanguageByCode } from '../../config/supportedLanguages';
import { CityPicker } from './CityPicker';
import { LanguagePicker } from './LanguagePicker';
import type { CityEntry } from './CityPicker';
import type { AvatarTemplate } from '../../types/character';
import type { LocationContext } from '../../types/config';

interface AvatarSelectScreenProps {
  onSelect: (template: AvatarTemplate, location: LocationContext | null, languageCode?: string) => Promise<void>;
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

export function AvatarSelectScreen({ onSelect }: AvatarSelectScreenProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [selectedCity, setSelectedCity] = useState<CityEntry | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);

  const templates = avatarTemplates as AvatarTemplate[];

  const isCustom = selected === 'custom';
  const hasSelection = selected !== null;
  const hasDescription = !isCustom || customDesc.trim().length > 0;
  const hasLocation = selectedCity !== null;
  const hasLanguage = selectedLanguage !== null;
  const canStart = hasSelection && hasDescription && hasLocation && hasLanguage;

  // Build display text for selected language
  const selectedLanguageInfo = useMemo(() => {
    if (!selectedLanguage) return null;
    return getLanguageByCode(selectedLanguage);
  }, [selectedLanguage]);

  const handleStart = () => {
    if (!canStart) return;

    // Build location context from selected city
    const locationCtx: LocationContext = {
      city: selectedCity!.city,
      country: selectedCity!.country,
      countryCode: selectedCity!.countryCode,
      lat: selectedCity!.lat,
      lng: selectedCity!.lng,
      dialectKey: null,
      dialectInfo: null,
    };

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

    onSelect(tmpl, locationCtx, selectedLanguage ?? undefined);
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
          {/* -- Primary CTA: Create a companion -- */}
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
            {isCustom && <span className="text-primary text-lg">&#10003;</span>}
          </motion.button>

          {/* -- Quick start templates -- */}
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

          {/* -- Name + Description + City + Language (shown after selection) -- */}
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

                  {/* -- City Picker -- */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 px-1">
                      <MapPin className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Where are they located?
                      </span>
                    </div>
                    <CityPicker
                      value={selectedCity}
                      onChange={(city) => {
                        setSelectedCity(city);
                        // When city changes, reset language auto-select
                        if (!city) setSelectedLanguage(null);
                      }}
                      placeholder="Search any city..."
                      showGPS={true}
                    />
                  </div>

                  {/* -- Language Picker (shown after city selection) -- */}
                  <AnimatePresence>
                    {selectedCity && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 px-1">
                            <Globe className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              What language to learn?
                            </span>
                            {selectedLanguageInfo && (
                              <span className="text-xs text-primary ml-auto">
                                {selectedLanguageInfo.name}
                              </span>
                            )}
                          </div>
                          <div className="bg-card border border-border rounded-xl p-3">
                            <LanguagePicker
                              value={selectedLanguage}
                              onChange={setSelectedLanguage}
                              cityContext={selectedCity}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
          Start &rarr;
        </motion.button>
      </div>
    </div>
  );
}
