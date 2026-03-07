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
  'government', 'transit', 'nightlife', 'hospital', 'office', 'school', 'custom',
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

export function ScenarioLauncher({ onStart, onClose }: ScenarioLauncherProps) {
  const [step, setStep] = useState<'pick' | 'context'>('pick');
  const [selected, setSelected] = useState<ScenarioTemplate | null>(null);
  const [ctx, setCtx] = useState<ParsedScenarioContext>({
    where: '',
    doing: '',
    talkingTo: '',
    nervousAbout: '',
    customText: '',
  });

  const handleSelectTemplate = (t: ScenarioTemplate) => {
    setSelected(t);
    setCtx({ where: '', doing: '', talkingTo: '', nervousAbout: '', customText: '' });
    setStep('context');
  };

  const handleStart = () => {
    if (!selected) return;
    onStart(selected.key, ctx);
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
          {step === 'context' && (
            <button
              onClick={() => setStep('pick')}
              className="p-1.5 hover:bg-muted/50 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          <div>
            <h2 className="font-medium text-foreground text-base">
              {step === 'pick' ? 'Practice a Scenario' : selected?.label}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {step === 'pick'
                ? 'Pick a real-life situation to practice'
                : 'Add context so the session is tailored to you'}
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
          /* ── Step 1: Template grid ─────────────────────────── */
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
          /* ── Step 2: Context form ──────────────────────────── */
          <motion.div
            key="context"
            className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            {/* Selected template reminder */}
            {selected && selected.key !== 'custom' && (
              <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                <span className="text-2xl flex-shrink-0">{selected.emoji}</span>
                <div>
                  <p className="font-medium text-foreground text-sm">{selected.label}</p>
                  {selected.cultural_guardrails && (
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {selected.cultural_guardrails}
                    </p>
                  )}
                </div>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              All fields are optional — more context makes the session better.
            </p>

            {selected?.key === 'custom' ? (
              /* Custom: single free text area */
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Describe the situation ✏️
                </label>
                <textarea
                  rows={5}
                  value={ctx.customText}
                  onChange={(e) => setCtx({ ...ctx, customText: e.target.value })}
                  placeholder="e.g. I'm at a night market in Bangkok. I want to buy a silk scarf but I don't know how to haggle without offending the vendor. I'm nervous about getting ripped off."
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm resize-none leading-relaxed"
                />
              </div>
            ) : (
              /* Template: structured form */
              <>
                <ContextField
                  icon="📍"
                  label="Where exactly are you?"
                  placeholder="e.g. small local restaurant, street market, hotel lobby"
                  value={ctx.where}
                  onChange={(v) => setCtx({ ...ctx, where: v })}
                />
                <ContextField
                  icon="🎯"
                  label="What are you trying to do?"
                  placeholder="e.g. order without a menu in English, check in early, return something"
                  value={ctx.doing}
                  onChange={(v) => setCtx({ ...ctx, doing: v })}
                />
                <ContextField
                  icon="🧑"
                  label="Who are you talking to?"
                  placeholder="e.g. older waiter, young market vendor, front desk receptionist"
                  value={ctx.talkingTo}
                  onChange={(v) => setCtx({ ...ctx, talkingTo: v })}
                />
                <ContextField
                  icon="😬"
                  label="What are you nervous about?"
                  placeholder="e.g. getting the pronunciation wrong, not understanding the response"
                  value={ctx.nervousAbout}
                  onChange={(v) => setCtx({ ...ctx, nervousAbout: v })}
                />
              </>
            )}

            {/* Start button */}
            <motion.button
              className="w-full px-6 py-4 bg-primary text-primary-foreground rounded-2xl font-medium hover:shadow-[0_0_20px_rgba(212,168,83,0.3)] transition-all flex items-center justify-center gap-2 mt-2"
              onClick={handleStart}
              whileTap={{ scale: 0.97 }}
            >
              <Sparkles className="w-4 h-4" />
              Start Scenario
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── ContextField ───────────────────────────────────────────────

function ContextField({
  icon,
  label,
  placeholder,
  value,
  onChange,
}: {
  icon: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-medium text-foreground">
        <span>{icon}</span>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
      />
    </div>
  );
}

// Export the context summary builder so other modules can use it
export { buildContextSummary };
