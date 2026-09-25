import React, { useState } from 'react';
import { X, ChevronRight, ArrowLeft, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { ScenarioKey, ParsedScenarioContext } from '../../types/config';
import { scenarioIcon } from '../../utils/scenarioIcons';
import scenarioContexts from '../../config/scenarioContexts.json';

// ─── Types ─────────────────────────────────────────────────────

interface ScenarioTemplate {
  key: ScenarioKey | 'custom';
  label: string;
  tone_guidance?: string;
  vocabulary_focus?: string[];
  cultural_guardrails?: string;
  debrief_focus?: string;
}

interface ScenarioLauncherProps {
  onStart: (templateKey: ScenarioKey | 'custom', context: ParsedScenarioContext) => void;
  onClose: () => void;
}

// ─── Context parser ─────────────────────────────────────────────

function buildContextSummary(ctx: ParsedScenarioContext): string {
  const parts: string[] = [];
  if (ctx.where) parts.push(`Location: ${ctx.where}`);
  if (ctx.doing) parts.push(`Goal: ${ctx.doing}`);
  if (ctx.talkingTo) parts.push(`Talking to: ${ctx.talkingTo}`);
  if (ctx.nervousAbout) parts.push(`Nervous about: ${ctx.nervousAbout}`);
  if (ctx.customText && !ctx.where && !ctx.doing) parts.push(`Situation: ${ctx.customText}`);
  return parts.join('. ');
}

// ─── Template data ──────────────────────────────────────────────

const SCENARIOS = scenarioContexts as Record<string, {
  label: string;
  tone_guidance?: string;
  vocabulary_focus?: string[];
  cultural_guardrails?: string;
  debrief_focus?: string;
}>;

const SCENARIO_KEYS: Array<ScenarioKey | 'custom'> = [
  'restaurant', 'directions', 'market', 'hotel', 'social',
  'government', 'transit', 'nightlife', 'hospital', 'office', 'school',
  'customs', 'pharmacy', 'emergency', 'landlord', 'bank',
  'taxi', 'temple', 'street_food', 'date', 'custom',
];

function getTemplates(): ScenarioTemplate[] {
  return SCENARIO_KEYS.map((key) => {
    if (key === 'custom') {
      return {
        key: 'custom',
        label: 'Custom',
        tone_guidance: 'Adapt completely to the situation the user describes.',
      };
    }
    const cfg = SCENARIOS[key];
    return {
      key,
      label: cfg?.label ?? key,
      tone_guidance: cfg?.tone_guidance,
      vocabulary_focus: cfg?.vocabulary_focus,
      cultural_guardrails: cfg?.cultural_guardrails,
      debrief_focus: cfg?.debrief_focus,
    };
  });
}

const TEMPLATES = getTemplates();

const EMPTY_CTX: ParsedScenarioContext = {
  where: '', doing: '', talkingTo: '', nervousAbout: '', customText: '',
};

export function ScenarioLauncher({ onStart, onClose }: ScenarioLauncherProps) {
  const [step, setStep] = useState<'pick' | 'custom'>('pick');
  const [situationText, setSituationText] = useState('');

  const handleSelectTemplate = (t: ScenarioTemplate) => {
    if (t.key === 'custom') {
      setSituationText('');
      setStep('custom');
    } else {
      onStart(t.key, EMPTY_CTX);
    }
  };

  const handleStartCustom = () => {
    const ctx: ParsedScenarioContext = {
      ...EMPTY_CTX,
      customText: situationText,
    };
    onStart('custom', ctx);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 32, stiffness: 320 }}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 flex-shrink-0">
        <div className="flex items-center gap-3">
          {step === 'custom' && (
            <motion.button
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => setStep('pick')}
              aria-label="Back to scenario list"
              className="p-1.5 hover:bg-muted/50 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </motion.button>
          )}
          <div>
            <h2 className="font-medium text-foreground text-base" style={{ fontFamily: 'var(--font-display)' }}>
              {step === 'pick' ? 'Practice' : 'Custom'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {step === 'pick' ? 'Tap to start' : 'Describe the moment'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close scenario launcher"
          className="p-2 hover:bg-muted/50 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {step === 'pick' ? (
          <motion.div
            key="pick"
            className="flex-1 overflow-y-auto px-4 py-4"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
          >
            <div className="grid grid-cols-3 gap-2.5">
              {TEMPLATES.map((t, i) => {
                const Icon = scenarioIcon(t.key);
                return (
                  <motion.button
                    key={t.key}
                    className={`flex flex-col items-center gap-2 p-3.5 rounded-2xl border text-center transition-all
                      ${t.key === 'custom'
                        ? 'border-dashed border-border/50 bg-card/40 hover:border-primary/40 hover:bg-primary/5'
                        : 'border-border/60 bg-card/80 hover:border-primary/40 hover:bg-primary/5'
                      }`}
                    onClick={() => handleSelectTemplate(t)}
                    whileTap={{ scale: 0.96 }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  >
                    <Icon className="w-5 h-5 text-primary" strokeWidth={1.75} />
                    <p className="text-[11px] font-medium text-foreground leading-tight">{t.label}</p>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="custom"
            className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.2 }}
          >
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                What&apos;s happening?
              </label>
              <textarea
                rows={4}
                value={situationText}
                onChange={(e) => setSituationText(e.target.value)}
                placeholder="e.g. Market in Istanbul — need to haggle for a carpet"
                className="w-full px-4 py-3 bg-background border border-border/60 rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm resize-none leading-relaxed"
                autoFocus
              />
            </div>

            <motion.button
              className="w-full px-6 py-4 bg-primary text-primary-foreground rounded-2xl font-medium hover:shadow-[0_0_20px_rgba(212,168,83,0.3)] transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-40 disabled:shadow-none"
              onClick={handleStartCustom}
              disabled={!situationText.trim()}
              whileTap={{ scale: 0.97 }}
            >
              <Sparkles className="w-4 h-4" />
              Start
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export { buildContextSummary };
