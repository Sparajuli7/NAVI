/**
 * BackendSelectScreen — First-launch backend picker
 *
 * Shown once before onboarding when no `navi_backend_pref` exists in
 * localStorage. After the user picks a backend and clicks "Get Started",
 * switchBackend() writes the pref and this screen is never shown again.
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { useNaviAgent } from '../../agent/react/useNaviAgent';
import { LLM_PRESETS, OPENROUTER_FREE_MODELS, OPENROUTER_PAID_MODELS } from '../../agent/models';

interface BackendSelectScreenProps {
  onDone: () => void;
}

type Card = 'cloud-free' | 'cloud-paid' | 'webllm';

export function BackendSelectScreen({ onDone }: BackendSelectScreenProps) {
  const { switchBackend } = useNaviAgent();

  const [selectedCard, setSelectedCard] = useState<Card>('cloud-free');
  const [pendingPreset, setPendingPreset] = useState<string>(Object.keys(LLM_PRESETS)[0]);
  const [pendingApiKey, setPendingApiKey] = useState('');
  const [pendingPaidModel, setPendingPaidModel] = useState<string>(OPENROUTER_PAID_MODELS[0]);
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    if (isSwitching) return;
    setIsSwitching(true);
    setError(null);
    try {
      if (selectedCard === 'webllm') {
        await switchBackend('webllm', { webllmPreset: pendingPreset });
      } else if (selectedCard === 'cloud-free') {
        await switchBackend('openrouter', { openRouterTier: 'free', openRouterModels: OPENROUTER_FREE_MODELS });
      } else {
        await switchBackend('openrouter', { apiKey: pendingApiKey, openRouterTier: 'paid', openRouterModels: [pendingPaidModel] });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set up backend');
      setIsSwitching(false);
    }
  };

  const cards: Array<{ key: Card; label: string; sub: string }> = [
    { key: 'cloud-free',  label: 'Cloud Free',  sub: 'OpenRouter · no credits needed · instant start' },
    { key: 'cloud-paid',  label: 'Cloud Paid',   sub: 'OpenRouter key · GPT-4o, Claude, Gemini & more' },
    { key: 'webllm',      label: 'On-Device',    sub: 'Runs in your browser · private · ~1GB download' },
  ];

  return (
    <div className="relative w-full max-w-md mx-auto min-h-screen bg-background flex flex-col items-center justify-center px-6 gap-8">
      {/* Branding */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <p className="text-5xl mb-3">🌏</p>
        <h1 className="text-3xl font-bold text-foreground tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          NAVI
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Your AI language companion</p>
      </motion.div>

      {/* Card selector */}
      <motion.div
        className="w-full space-y-3"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <p className="text-center text-sm font-medium text-muted-foreground mb-1">How would you like to run NAVI?</p>

        {cards.map(({ key, label, sub }) => (
          <button
            key={key}
            onClick={() => setSelectedCard(key)}
            className={`w-full text-left px-4 py-3.5 rounded-2xl border transition-all ${
              selectedCard === key
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-primary/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-semibold ${selectedCard === key ? 'text-foreground' : ''}`}>{label}</p>
                <p className="text-xs mt-0.5 leading-relaxed">{sub}</p>
              </div>
              <div className={`w-4 h-4 rounded-full border-2 shrink-0 ml-3 transition-colors ${
                selectedCard === key ? 'border-primary bg-primary' : 'border-border'
              }`} />
            </div>

            {/* Expanded config for selected card */}
            {selectedCard === key && key === 'webllm' && (
              <div className="mt-3 pt-3 border-t border-border/60" onClick={(e) => e.stopPropagation()}>
                <div className="relative">
                  <select
                    value={pendingPreset}
                    onChange={(e) => setPendingPreset(e.target.value)}
                    className="w-full appearance-none px-3 py-2.5 pr-8 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                  >
                    {Object.entries(LLM_PRESETS).map(([k, cfg]) => (
                      <option key={k} value={k}>
                        {cfg.name} — {(cfg.sizeBytes / 1e9).toFixed(1)} GB
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">Only one model downloads. Cached after first run.</p>
              </div>
            )}

            {selectedCard === key && key === 'cloud-free' && (
              <div className="mt-3 pt-3 border-t border-border/60">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                  <p className="text-xs text-foreground">{OPENROUTER_FREE_MODELS.length} models auto-rotated for max availability</p>
                </div>
              </div>
            )}

            {selectedCard === key && key === 'cloud-paid' && (
              <div className="mt-3 pt-3 border-t border-border/60 space-y-2" onClick={(e) => e.stopPropagation()}>
                <input
                  type="password"
                  value={pendingApiKey}
                  onChange={(e) => setPendingApiKey(e.target.value)}
                  placeholder="sk-or-... (OpenRouter key with credits)"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <div className="relative">
                  <select
                    value={pendingPaidModel}
                    onChange={(e) => setPendingPaidModel(e.target.value)}
                    className="w-full appearance-none px-3 py-2.5 pr-8 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                  >
                    {OPENROUTER_PAID_MODELS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Link your OpenAI key at openrouter.ai/settings/integrations to unlock GPT-4o
                </p>
              </div>
            )}
          </button>
        ))}
      </motion.div>

      {/* CTA */}
      <motion.div
        className="w-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        {error && <p className="text-xs text-destructive text-center mb-2">{error}</p>}
        <button
          onClick={handleContinue}
          disabled={isSwitching || (selectedCard === 'cloud-paid' && !pendingApiKey.trim())}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-primary text-primary-foreground rounded-2xl text-sm font-semibold disabled:opacity-50 transition-opacity"
        >
          {isSwitching ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Setting up…</>
          ) : 'Get Started →'}
        </button>
        {selectedCard === 'webllm' && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            Model will download after this step
          </p>
        )}
      </motion.div>
    </div>
  );
}
