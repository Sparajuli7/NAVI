import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Plus, ArrowRight, Brain, Zap, Trash2 } from 'lucide-react';
import { CompanionFace } from './CompanionFace';
import { scenarioIcon } from '../../utils/scenarioIcons';
import type { Character } from '../../types/character';
import scenarioContexts from '../../config/scenarioContexts.json';

const SCENARIOS = scenarioContexts as Record<string, { label: string }>;
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

const bgAtmosphere =
  'absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-secondary/10 dark:from-primary/5 dark:via-background dark:to-secondary/8';

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

  const ScenarioStrip = () => (
    <motion.div
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.25, duration: 0.35 }}
    >
      <div className="flex items-center gap-2 mb-2.5 px-1">
        <Zap className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Scenarios
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
        {ALL_SCENARIO_KEYS.map((key, i) => {
          const cfg = SCENARIOS[key];
          if (!cfg) return null;
          const Icon = scenarioIcon(key);
          return (
            <motion.button
              key={key}
              onClick={() => onOpenScenarios(key)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 + i * 0.02 }}
              whileTap={{ scale: 0.96 }}
              className="flex-shrink-0 flex flex-col items-center gap-1.5 px-3 py-2.5 bg-card/80 rounded-xl border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-colors text-center min-w-[72px]"
            >
              <Icon className="w-4 h-4 text-primary" strokeWidth={1.75} />
              <p className="text-[10px] text-muted-foreground leading-tight w-full">{cfg.label}</p>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );

  if (companions.length === 0) {
    return (
      <div className="min-h-[calc(100vh-57px)] bg-background flex flex-col items-center justify-center px-8 relative overflow-hidden">
        <div className={bgAtmosphere} />
        <div className="relative z-10 text-center max-w-sm">
          <motion.h1
            className="text-4xl text-foreground tracking-tight mb-3"
            style={{ fontFamily: 'var(--font-display)' }}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            NAVI
          </motion.h1>
          <motion.p
            className="text-muted-foreground text-sm mb-10"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.35 }}
          >
            A local friend. Anywhere.
          </motion.p>
          <motion.button
            className="w-full px-8 py-4 bg-primary text-primary-foreground rounded-full font-medium transition-all flex items-center justify-center gap-3"
            onClick={onNewCompanion}
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.01 }}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.35 }}
          >
            <Plus className="w-5 h-5" />
            Create companion
          </motion.button>
        </div>
      </div>
    );
  }

  if (companions.length === 1) {
    const solo = companions[0];
    return (
      <div className="min-h-[calc(100vh-57px)] bg-background flex flex-col px-6 py-8 relative overflow-hidden">
        <div className={bgAtmosphere} />

        <div className="relative z-10 flex-1 flex flex-col gap-5 max-w-sm mx-auto w-full">
          <motion.div
            className="bg-card/90 border border-border/60 rounded-2xl p-6 text-center"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.35 }}
          >
            <CompanionFace
              imageUrl={solo.avatarImageUrl}
              name={solo.name}
              size="lg"
              accentColor={{
                primary: solo.avatar_color?.primary ?? '#6BBAA7',
                secondary: solo.avatar_color?.secondary ?? '#D4A853',
              }}
              className="mx-auto"
            />
            <h2
              className="text-xl mt-4 text-foreground"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {solo.name}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {solo.location_city}, {solo.location_country}
            </p>
            {solo.summary && (
              <p className="text-sm text-foreground/60 mt-3 line-clamp-2">{solo.summary}</p>
            )}
          </motion.div>

          {messageCount > 0 && (
            <motion.div
              className="bg-card/90 border border-border/60 rounded-2xl px-5 py-4"
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.35 }}
            >
              <div className="flex items-center gap-3 mb-2">
                <MessageSquare className="w-3.5 h-3.5 text-primary" />
                <span className="text-sm text-foreground font-medium">
                  {messageCount} msg{messageCount !== 1 ? 's' : ''}
                </span>
                {memoryCount > 0 && (
                  <>
                    <span className="text-border">·</span>
                    <Brain className="w-3.5 h-3.5 text-secondary" />
                    <span className="text-sm text-foreground font-medium">
                      {memoryCount}
                    </span>
                  </>
                )}
              </div>
              {lastMessagePreview && (
                <p className="text-sm text-muted-foreground line-clamp-2">{lastMessagePreview}</p>
              )}
            </motion.div>
          )}

          <ScenarioStrip />

          <div className="flex flex-col gap-3 mt-auto">
            <motion.button
              className="w-full px-6 py-4 bg-primary text-primary-foreground rounded-full font-medium transition-all flex items-center justify-center gap-3"
              onClick={messageCount > 0 ? onContinueChat : () => onSelectCompanion(solo.id)}
              whileTap={{ scale: 0.97 }}
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.35 }}
            >
              {messageCount > 0 ? 'Continue' : 'Start chatting'}
              <ArrowRight className="w-5 h-5" />
            </motion.button>

            <motion.button
              className="w-full px-6 py-3 bg-card border border-border/60 text-foreground rounded-full font-medium hover:bg-muted/40 transition-all flex items-center justify-center gap-3"
              onClick={onNewCompanion}
              whileTap={{ scale: 0.97 }}
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.42, duration: 0.35 }}
            >
              <Plus className="w-4 h-4" />
              New companion
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  // Multiple companions — a picker: tap an existing avatar to continue with it
  // (or jump straight back into the active chat), or make a new one.
  const heading = companions.length === 1 ? 'Your companion' : 'Your companions';

  return (
    <div className="min-h-[calc(100vh-57px)] bg-background flex flex-col px-6 py-8 relative overflow-hidden">
      <div className={bgAtmosphere} />

      <div className="relative z-10 flex flex-col gap-3 max-w-sm mx-auto w-full">
        <motion.p
          className="text-xs text-muted-foreground uppercase tracking-wider px-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {heading}
        </motion.p>

        {companions.map((comp, i) => {
          const isActive = comp.id === activeCharacterId;
          return (
          <motion.div
            key={comp.id}
            className="w-full bg-card/90 border border-border/60 rounded-2xl overflow-hidden"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.06 + i * 0.05, duration: 0.3 }}
          >
            <AnimatePresence mode="wait">
              {confirmDeleteId === comp.id ? (
                <motion.div
                  key="confirm"
                  className="p-4 flex items-center gap-3"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                >
                  <p className="flex-1 text-sm text-foreground">
                    Delete <span className="font-semibold">{comp.name}</span>?
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
                  <div className="flex items-center gap-3">
                    <button
                      className="flex-1 flex items-center gap-3.5 text-left min-w-0"
                      onClick={() => (isActive ? onContinueChat() : onSelectCompanion(comp.id))}
                    >
                      <CompanionFace
                        imageUrl={comp.avatarImageUrl}
                        name={comp.name}
                        size="md"
                        accentColor={{
                          primary: comp.avatar_color?.primary ?? '#6BBAA7',
                          secondary: comp.avatar_color?.secondary ?? '#D4A853',
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                          {comp.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {comp.location_city}, {comp.location_country}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" />
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
          className="w-full px-6 py-3 bg-card border border-border/60 text-foreground rounded-full font-medium hover:bg-muted/40 transition-all flex items-center justify-center gap-3 mt-1"
          onClick={onNewCompanion}
          whileTap={{ scale: 0.97 }}
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 + companions.length * 0.05 }}
        >
          <Plus className="w-4 h-4" />
          New companion
        </motion.button>
      </div>
    </div>
  );
}
