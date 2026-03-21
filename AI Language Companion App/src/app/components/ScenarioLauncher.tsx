import React, { useState } from 'react';
import { X, ChevronRight, ArrowLeft, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { ScenarioKey, ParsedScenarioContext } from '../../types/config';
import scenarioContexts from '../../config/scenarioContexts.json';

// ─── Types ─────────────────────────────────────────────────────

interface ScenarioTemplate {
  key: ScenarioKey | 'custom';
  label: string;
  emoji: string;
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
// Lightweight extraction: no LLM, no network. Reads form fields + raw text.

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
  emoji?: string;
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
        label: 'Custom Situation',
        emoji: '✏️',
        tone_guidance: 'Adapt completely to the situation the user describes.',
      };
    }
    const cfg = SCENARIOS[key];
    return {
      key,
      label: cfg?.label ?? key,
      emoji: cfg?.emoji ?? '💬',
      tone_guidance: cfg?.tone_guidance,
      vocabulary_focus: cfg?.vocabulary_focus,
      cultural_guardrails: cfg?.cultural_guardrails,
      debrief_focus: cfg?.debrief_focus,
    };
  });
}

const TEMPLATES = getTemplates();

// ─── Component ─────────────────────────────────────────────────


const EMPTY_CTX: ParsedScenarioContext = {
  where: '', doing: '', talkingTo: '', nervousAbout: '', customText: '',
};

export function ScenarioLauncher({ onStart, onClose }: ScenarioLauncherProps) {
  // 'pick' = template grid, 'custom' = single text input for custom scenario only
  const [step, setStep] = useState<'pick' | 'custom'>('pick');
  const [situationText, setSituationText] = useState('');

  const handleSelectTemplate = (t: ScenarioTemplate) => {
    if (t.key === 'custom') {
      setSituationText('');
      setStep('custom');
    } else {
      // Template scenarios launch immediately — no context form
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
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          {step === 'custom' && (
            <button
              onClick={() => setStep('pick')}
              className="p-1.5 hover:bg-muted/50 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          <div>
            <h2 className="font-medium text-foreground text-base">
              {step === 'pick' ? 'Practice a Scenario' : 'Custom Situation'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {step === 'pick'
                ? 'Tap a situation to start immediately'
                : 'Describe what\'s happening'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-muted/50 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {step === 'pick' ? (
          /* ── Template grid — tap to launch immediately ──────── */
          <motion.div
            key="pick"
            className="flex-1 overflow-y-auto px-4 py-4"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="grid grid-cols-3 gap-3">
              {TEMPLATES.map((t) => (
                <motion.button
                  key={t.key}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border text-center transition-all
                    ${t.key === 'custom'
                      ? 'border-dashed border-border/60 bg-card/30 hover:border-primary/40 hover:bg-primary/5'
                      : 'border-border bg-card hover:border-primary/40 hover:bg-primary/5'
                    }`}
                  onClick={() => handleSelectTemplate(t)}
                  whileTap={{ scale: 0.96 }}
                >
                  <span className="text-2xl">{t.emoji}</span>
                  <p className="text-xs font-medium text-foreground leading-tight">{t.label}</p>
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          /* ── Custom scenario: single text input ─────────────── */
          <motion.div
            key="custom"
            className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                What's happening?
              </label>
              <textarea
                rows={4}
                value={situationText}
                onChange={(e) => setSituationText(e.target.value)}
                placeholder="e.g. I'm at a market in Istanbul and I need to buy a carpet without getting ripped off"
                className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm resize-none leading-relaxed"
                autoFocus
              />
            </div>

            <motion.button
              className="w-full px-6 py-4 bg-primary text-primary-foreground rounded-2xl font-medium hover:shadow-[0_0_20px_rgba(212,168,83,0.3)] transition-all flex items-center justify-center gap-2 mt-2"
              onClick={handleStartCustom}
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

// Export the context summary builder so other modules can use it
export { buildContextSummary };
