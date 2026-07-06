import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Plus, ArrowRight, Brain, Zap, Trash2 } from 'lucide-react';
import { CharacterAvatar } from './CharacterAvatar';
import type { Character } from '../../types/character';
import scenarioContexts from '../../config/scenarioContexts.json';

const SCENARIOS = scenarioContexts as Record<string, { label: string; emoji?: string }>;
const ALL_SCENARIO_KEYS = Object.keys(SCENARIOS);

interface HomeScreenProps {
  companions: Character[];
  activeCharacterId?: string | null;
  messageCount: number;
  lastMessagePreview: string;
  memoryCount: number;
  onSelectCompanion: (charId: string) => void;
  onContinueChat: () => void;
  onNewCompanion: () => void;
  onOpenScenarios: (key?: string) => void;
  onDeleteCompanion?: (charId: string) => Promise<void>;
}

function charToAvatarShape(c: Character) {
  return {
    name: c.name,
    avatar_color: (c.avatar_color && typeof c.avatar_color === 'object')
      ? c.avatar_color
      : { primary: '#4A5568', secondary: '#F6AD55', accent: '#48BB78' },
    template_id: c.template_id ?? undefined,
    location_country: c.location_country,
  };
}

export function HomeScreen({
  companions,
  activeCharacterId,
  messageCount,
  lastMessagePreview,
  memoryCount,
  onSelectCompanion,
  onContinueChat,
  onNewCompanion,
  onOpenScenarios,
  onDeleteCompanion,
}: HomeScreenProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // Scenario quick-pick strip — horizontal scroll, all scenarios
  const ScenarioStrip = () => (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.35 }}
    >
      <div className="flex items-center gap-2 mb-2 px-1">
        <Zap className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-foreground">Jump into a scenario</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
        {ALL_SCENARIO_KEYS.map((key) => {
          const cfg = SCENARIOS[key];
          if (!cfg) return null;
          return (
            <button
              key={key}
              onClick={() => onOpenScenarios(key)}
              className="flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2.5 bg-card rounded-xl border border-border/60 hover:border-primary/40 transition-colors text-center min-w-[72px]"
            >
              <span className="text-xl">{cfg.emoji ?? '💬'}</span>
              <p className="text-xs text-muted-foreground leading-tight w-full" style={{ fontSize: '10px' }}>{cfg.label}</p>
            </button>
          );
        })}
      </div>
    </motion.div>
  );

  // No companions yet — show welcome state
  if (companions.length === 0) {
    return (
      <div className="min-h-[calc(100vh-57px)] bg-background flex flex-col items-center justify-center px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-950/20 via-background to-teal-950/20 dark:from-purple-950/10 dark:via-background dark:to-teal-950/10" />

        <div className="relative z-10 text-center max-w-sm">
          <motion.p
            className="text-foreground/70 text-lg mb-8"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Your local friend, anywhere in the world.
          </motion.p>

          <motion.button
            className="w-full px-8 py-4 bg-primary text-primary-foreground rounded-full font-medium hover:shadow-[0_0_20px_rgba(212,168,83,0.3)] transition-all flex items-center justify-center gap-3"
            onClick={onNewCompanion}
            whileTap={{ scale: 0.97 }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Plus className="w-5 h-5" />
            Create your first companion
          </motion.button>
        </div>
      </div>
    );
  }

  // One or more companions — a picker: tap an existing avatar, or make a new one.
  // Works the same whether you have a single companion or many.
  const heading = companions.length === 1 ? 'Your companion' : 'Your companions';
  return (
    <div className="min-h-[calc(100vh-57px)] bg-background flex flex-col px-6 py-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-950/20 via-background to-teal-950/20 dark:from-purple-950/10 dark:via-background dark:to-teal-950/10" />

      <div className="relative z-10 flex flex-col gap-4 max-w-sm mx-auto w-full">
        <motion.p
          className="text-sm text-muted-foreground uppercase tracking-wide"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {heading}
        </motion.p>

        {companions.map((comp, i) => {
          const isActive = comp.id === activeCharacterId;
          return (
          <motion.div
            key={comp.id}
            className="w-full bg-card border border-border rounded-2xl overflow-hidden"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 + i * 0.07 }}
          >
            <AnimatePresence mode="wait">
              {confirmDeleteId === comp.id ? (
                <motion.div
                  key="confirm"
                  className="p-4 flex items-center gap-3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <p className="flex-1 text-sm text-foreground">
                    Delete <span className="font-semibold">{comp.name}</span>? This can't be undone.
                  </p>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="px-3 py-1.5 text-xs rounded-full border border-border text-muted-foreground hover:bg-muted/50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => { setConfirmDeleteId(null); await onDeleteCompanion?.(comp.id); }}
                    className="px-3 py-1.5 text-xs rounded-full bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-colors"
                  >
                    Delete
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="normal"
                  className="p-4 flex flex-col gap-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="flex items-center gap-4">
                    <button
                      className="flex-1 flex items-center gap-4 text-left min-w-0"
                      onClick={() => (isActive ? onContinueChat() : onSelectCompanion(comp.id))}
                    >
                      <CharacterAvatar character={charToAvatarShape(comp)} size="md" animationState={isActive ? 'idle' : 'none'} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                          {comp.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {comp.location_city}, {comp.location_country}
                        </p>
                        <p className="text-xs text-foreground/60 mt-1 line-clamp-1 italic">
                          {comp.summary}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </button>
                    {onDeleteCompanion && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(comp.id); }}
                        className="p-2 rounded-full hover:bg-red-500/10 transition-colors flex-shrink-0"
                        title="Delete companion"
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-red-400 transition-colors" />
                      </button>
                    )}
                  </div>

                  {/* Conversation stats for the companion you last chatted with */}
                  {isActive && messageCount > 0 && (
                    <div className="pt-3 border-t border-border/60">
                      <div className="flex items-center gap-3 mb-1.5">
                        <MessageSquare className="w-4 h-4 text-primary" />
                        <span className="text-xs text-foreground font-medium">
                          {messageCount} message{messageCount !== 1 ? 's' : ''}
                        </span>
                        {memoryCount > 0 && (
                          <>
                            <span className="text-border">|</span>
                            <Brain className="w-4 h-4 text-secondary" />
                            <span className="text-xs text-foreground font-medium">
                              {memoryCount} memor{memoryCount !== 1 ? 'ies' : 'y'}
                            </span>
                          </>
                        )}
                      </div>
                      {lastMessagePreview && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{lastMessagePreview}</p>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          );
        })}

        <ScenarioStrip />

        <motion.button
          className="w-full px-6 py-4 bg-primary text-primary-foreground rounded-full font-medium hover:shadow-[0_0_20px_rgba(212,168,83,0.3)] transition-all flex items-center justify-center gap-3"
          onClick={onNewCompanion}
          whileTap={{ scale: 0.97 }}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 + companions.length * 0.07 }}
        >
          <Plus className="w-4 h-4" />
          New avatar
        </motion.button>
      </div>
    </div>
  );
}
