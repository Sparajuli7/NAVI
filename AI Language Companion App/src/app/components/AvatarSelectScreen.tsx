/**
 * AvatarSelectScreen — Simplified onboarding (selection only)
 *
 * Shows a grid of 8 avatar templates plus a "Create your own" option.
 * All options allow giving a custom name. After selection, hands off
 * to App.tsx which routes to ConversationScreen (same screen for everyone).
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Pencil } from 'lucide-react';
import { detectLocation } from '../../services/location';
import avatarTemplates from '../../config/avatarTemplates.json';
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

export function AvatarSelectScreen({ onSelect }: AvatarSelectScreenProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [locationCtx, setLocationCtx] = useState<LocationContext | null>(null);
  const templates = avatarTemplates as AvatarTemplate[];

  const isCustom = selected === 'custom';
  const canStart = selected && (!isCustom || customDesc.trim().length > 0);

  useEffect(() => {
    detectLocation()
      .then(setLocationCtx)
      .catch(() => {});
  }, []);

  const handleStart = () => {
    if (!canStart) return;

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
        <motion.div className="text-center mb-6" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <p className="text-4xl mb-2">🌏</p>
          <h1 className="text-2xl font-bold text-foreground tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            Choose your companion
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Pick a preset or create your own</p>
        </motion.div>

        <motion.div className="flex-1 overflow-y-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
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
                  transition={{ delay: 0.05 * i + 0.15 }}
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

            <motion.button
              onClick={() => setSelected('custom')}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * templates.length + 0.15 }}
              className={`flex flex-col items-center p-4 rounded-2xl border-2 text-center transition-all col-span-2 ${
                isCustom
                  ? 'bg-gradient-to-br from-teal-500/20 to-cyan-500/10 border-primary shadow-lg'
                  : 'bg-card border-dashed border-border hover:border-primary/30'
              }`}
            >
              <Pencil className={`w-7 h-7 mb-2 ${isCustom ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={`text-sm font-semibold ${isCustom ? 'text-foreground' : 'text-muted-foreground'}`}>Create your own</span>
              <span className="text-xs text-muted-foreground mt-1">Describe exactly who you want</span>
            </motion.button>
          </div>

          <AnimatePresence>
            {selected && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="mt-4 space-y-3">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Give them a name (optional)"
                    className="w-full px-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 text-sm"
                  />
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
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

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
