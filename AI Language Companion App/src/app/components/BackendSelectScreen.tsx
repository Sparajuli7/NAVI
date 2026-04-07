/**
 * BackendSelectScreen — First-launch model picker
 *
 * Simple flat list: pick a model, hit Start.
 * Shown once when no `navi_backend_pref` exists in localStorage.
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { useNaviAgent } from '../../agent/react/useNaviAgent';
import { LLM_PRESETS } from '../../agent/models';

interface BackendSelectScreenProps {
  onDone: () => void;
}

interface CloudModel {
  id: string;
  name: string;
  desc: string;
  free: boolean;
}

const CLOUD_MODELS: CloudModel[] = [
  { id: 'google/gemma-4-27b-it:free',                    name: 'Gemma 4 27B',      desc: 'free · great multilingual',    free: true  },
  { id: 'openai/gpt-4o-mini',                            name: 'GPT-4o mini',      desc: 'fast · cheap · capable',       free: false },
  { id: 'openai/gpt-4o',                                 name: 'GPT-4o',           desc: 'best quality',                 free: false },
  { id: 'qwen/qwen3-32b:free',                           name: 'Qwen3 32B',        desc: 'free · strong multilingual',   free: true  },
  { id: 'deepseek/deepseek-r1:free',                     name: 'DeepSeek R1',      desc: 'free · strong reasoning',      free: true  },
  { id: 'deepseek/deepseek-v3:free',                     name: 'DeepSeek V3',      desc: 'free · fast + capable',        free: true  },
  { id: 'meta-llama/llama-3.3-70b-instruct:free',        name: 'Llama 3.3 70B',   desc: 'free · reliable',              free: true  },
  { id: 'mistralai/mistral-small-3.1-24b-instruct:free', name: 'Mistral Small',   desc: 'free · solid',                 free: true  },
  { id: 'microsoft/phi-4:free',                          name: 'Phi-4',            desc: 'free · fast + smart',          free: true  },
];

type Selection =
  | { type: 'cloud'; model: CloudModel }
  | { type: 'ondevice'; presetKey: string };

export function BackendSelectScreen({ onDone }: BackendSelectScreenProps) {
  const { switchBackend } = useNaviAgent();

  const [selected, setSelected] = useState<Selection>({ type: 'cloud', model: CLOUD_MODELS[0] });
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    if (isSwitching) return;
    setIsSwitching(true);
    setError(null);
    try {
      if (selected.type === 'cloud') {
        const tier = selected.model.free ? 'free' : 'paid';
        await switchBackend('openrouter', { openRouterTier: tier, openRouterModels: [selected.model.id] });
      } else {
        await switchBackend('webllm', { webllmPreset: selected.presetKey });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set up model');
      setIsSwitching(false);
    }
  };

  const isSelected = (s: Selection) => {
    if (s.type !== selected.type) return false;
    if (s.type === 'cloud' && selected.type === 'cloud') return s.model.id === selected.model.id;
    if (s.type === 'ondevice' && selected.type === 'ondevice') return s.presetKey === selected.presetKey;
    return false;
  };

  return (
    <div className="relative w-full max-w-md mx-auto min-h-screen bg-background flex flex-col px-6 py-12 gap-6">
      {/* Branding */}
      <motion.div
        className="text-center mb-2"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <p className="text-4xl mb-2">🌏</p>
        <h1 className="text-2xl font-bold text-foreground tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          Choose a model
        </h1>
        <p className="text-xs text-muted-foreground mt-1">You can change this anytime in Settings</p>
      </motion.div>

      <motion.div
        className="flex-1 space-y-5 overflow-y-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        {/* Cloud models */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
            Cloud — instant, no download
          </p>
          <div className="space-y-1.5">
            {CLOUD_MODELS.map((model) => {
              const sel: Selection = { type: 'cloud', model };
              const active = isSelected(sel);
              return (
                <button
                  key={model.id}
                  onClick={() => setSelected(sel)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${
                    active
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card hover:border-primary/40'
                  }`}
                >
                  <div>
                    <span className={`text-sm font-medium ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {model.name}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">{model.desc}</span>
                  </div>
                  <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ml-3 ${
                    active ? 'border-primary bg-primary' : 'border-border'
                  }`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* On-device models */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
            On-Device — private, one-time download
          </p>
          <div className="space-y-1.5">
            {Object.entries(LLM_PRESETS).map(([key, cfg]) => {
              const sel: Selection = { type: 'ondevice', presetKey: key };
              const active = isSelected(sel);
              return (
                <button
                  key={key}
                  onClick={() => setSelected(sel)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${
                    active
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card hover:border-primary/40'
                  }`}
                >
                  <div>
                    <span className={`text-sm font-medium ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {cfg.name}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {(cfg.sizeBytes / 1e9).toFixed(1)} GB
                    </span>
                  </div>
                  <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ml-3 ${
                    active ? 'border-primary bg-primary' : 'border-border'
                  }`} />
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, delay: 0.2 }}
      >
        {error && <p className="text-xs text-destructive text-center mb-2">{error}</p>}
        <button
          onClick={handleStart}
          disabled={isSwitching}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-primary text-primary-foreground rounded-2xl text-sm font-semibold disabled:opacity-50 transition-opacity"
        >
          {isSwitching
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Setting up…</>
            : 'Start →'
          }
        </button>
        {selected.type === 'ondevice' && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            Model downloads after this step and is cached for future use
          </p>
        )}
      </motion.div>
    </div>
  );
}
