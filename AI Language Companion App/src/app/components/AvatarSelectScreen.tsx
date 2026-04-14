/**
 * AvatarSelectScreen — Onboarding + Chat (single page)
 *
 * Phase 1 (selecting): template grid, name input, custom option
 * Phase 2 (chatting): message list + text/audio input bar
 *
 * After avatar selection the model downloads in the background and
 * chat starts on the same page — no separate ConversationScreen.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Pencil, Mic, Send } from 'lucide-react';
import { detectLocation } from '../../services/location';
import { startRecording, stopRecording, isSTTSupported } from '../../services/stt';
import { stripInlineMarkdown } from '../../utils/responseParser';
import { saveCharacterConversation } from '../../utils/storage';
import { useNaviAgent } from '../../agent/react/useNaviAgent';
import { useChatStore } from '../../stores/chatStore';
import { useCharacterStore } from '../../stores/characterStore';
import { useAppStore } from '../../stores/appStore';
import avatarTemplates from '../../config/avatarTemplates.json';
import type { AvatarTemplate } from '../../types/character';
import type { LocationContext } from '../../types/config';

interface AvatarSelectScreenProps {
  /** Called after avatar is selected — parent creates the character + saves to stores */
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
  // ── Selection state ──────────────────────────────────────────
  const [phase, setPhase] = useState<'selecting' | 'chatting'>('selecting');
  const [selected, setSelected] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [locationCtx, setLocationCtx] = useState<LocationContext | null>(null);
  const templates = avatarTemplates as AvatarTemplate[];

  // ── Chat state ───────────────────────────────────────────────
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Stores & agent ───────────────────────────────────────────
  const { agent, isLLMReady, loadLLM } = useNaviAgent();
  const messages = useChatStore(s => s.messages);
  const isGenerating = useChatStore(s => s.isGenerating);
  const addMessage = useChatStore(s => s.addMessage);
  const updateLastMessage = useChatStore(s => s.updateLastMessage);
  const setGenerating = useChatStore(s => s.setGenerating);
  const activeCharacter = useCharacterStore(s => s.activeCharacter);
  const { modelProgress } = useAppStore();

  const isCustom = selected === 'custom';
  const canStart = selected && (!isCustom || customDesc.trim().length > 0);

  // ── GPS on mount ─────────────────────────────────────────────
  useEffect(() => {
    detectLocation()
      .then(setLocationCtx)
      .catch(() => {});
  }, []);

  // ── Auto-scroll on new messages ──────────────────────────────
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Start: create character → download model → chat ──────────
  const handleStart = async () => {
    if (!canStart) return;

    // Build the template to pass to parent
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
      // Apply user-given name if provided
      tmpl = nameInput.trim()
        ? { ...base, label: nameInput.trim() }
        : base;
    }

    // Parent creates the character + saves to stores
    await onSelect(tmpl, locationCtx);

    // Switch to chat immediately
    setPhase('chatting');

    // Download model in background if needed
    if (!agent.isLLMReady()) {
      try { await loadLLM(); } catch (err) { console.error('Model load failed:', err); }
    }
  };

  // ── Send message ─────────────────────────────────────────────
  const handleSend = useCallback(async (textOverride?: string) => {
    const msg = (textOverride ?? inputValue).trim();
    if (!msg || isGenerating || !isLLMReady) return;
    setInputValue('');

    // User message
    addMessage({
      id: Date.now().toString(),
      role: 'user',
      content: msg,
      type: 'text',
      timestamp: Date.now(),
    });

    // Streaming placeholder
    addMessage({
      id: (Date.now() + 1).toString(),
      role: 'character',
      content: '',
      type: 'text',
      timestamp: Date.now(),
      metadata: { isStreaming: true },
    });
    setGenerating(true);

    try {
      const history = messages.slice(-8).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content.length > 400 ? m.content.slice(0, 400) + '…' : m.content,
      }));

      const result = await agent.handleMessage(msg, {
        history,
        onToken: (_tok: string, full: string) => updateLastMessage(full),
      });

      updateLastMessage(result.response, true);

      // Persist conversation
      if (activeCharacter) {
        const allMsgs = useChatStore.getState().messages;
        await saveCharacterConversation(activeCharacter.id, allMsgs);
      }
    } catch {
      updateLastMessage('Something went wrong. Try again.', true);
    }

    setGenerating(false);
  }, [inputValue, isGenerating, isLLMReady, messages, agent, activeCharacter, addMessage, updateLastMessage, setGenerating]);

  // ── Mic (hold-to-record) ─────────────────────────────────────
  const handleMicDown = useCallback(() => {
    if (!isLLMReady) return;
    setIsRecording(true);
    startRecording('en-US', (transcript) => {
      setIsRecording(false);
      if (transcript.trim()) handleSend(transcript.trim());
    }, () => setIsRecording(false));
  }, [isLLMReady, handleSend]);

  const handleMicUp = useCallback(() => {
    stopRecording();
    setIsRecording(false);
  }, []);

  // ════════════════════════════════════════════════════════════
  // RENDER: Selecting phase
  // ════════════════════════════════════════════════════════════
  if (phase === 'selecting') {
    return (
      <div className="min-h-[calc(100vh-57px)] bg-background flex flex-col relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-950/20 via-background to-teal-950/20 dark:from-purple-950/10 dark:via-background dark:to-teal-950/10" />

        <div className="relative z-10 flex-1 flex flex-col px-6 py-8">
          {/* Header */}
          <motion.div
            className="text-center mb-6"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <p className="text-4xl mb-2">🌏</p>
            <h1 className="text-2xl font-bold text-foreground tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Choose your companion
            </h1>
            <p className="text-xs text-muted-foreground mt-1">Pick a preset or create your own</p>
          </motion.div>

          {/* Template grid */}
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

              {/* Create your own */}
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

            {/* Name input — shown when ANY option is selected */}
            <AnimatePresence>
              {selected && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 space-y-3">
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="Give them a name (optional)"
                      className="w-full px-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 text-sm"
                    />

                    {/* Custom description — only for "Create your own" */}
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

  // ════════════════════════════════════════════════════════════
  // RENDER: Chat phase
  // ════════════════════════════════════════════════════════════
  const charName = activeCharacter?.name ?? 'Companion';

  return (
    <div className="min-h-[calc(100vh-57px)] bg-background flex flex-col">
      {/* Model download banner */}
      {!isLLMReady && (
        <motion.div
          className="px-4 py-2 bg-primary/10 border-b border-primary/20 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-xs text-primary font-medium">
            Downloading AI model… {modelProgress > 0 ? `${modelProgress}%` : ''}
          </p>
          <div className="w-full bg-border rounded-full h-1 mt-1 overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{ width: `${Math.max(modelProgress, 2)}%` }}
              transition={{ ease: 'linear', duration: 0.3 }}
            />
          </div>
        </motion.div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {/* Character avatar chip */}
            {msg.role !== 'user' && (
              <span className="text-lg mr-2 mt-1 flex-shrink-0">{activeCharacter?.emoji ?? '🌏'}</span>
            )}
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-card border border-border text-foreground rounded-bl-md'
              }`}
            >
              {msg.content
                ? stripInlineMarkdown(msg.content)
                : msg.metadata?.isStreaming
                  ? <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse rounded-sm" />
                  : ''}
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 border-t border-border bg-card px-4 py-3 flex items-center gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={isLLMReady ? `Message ${charName}…` : 'Waiting for model…'}
          disabled={!isLLMReady || isGenerating}
          className="flex-1 px-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 disabled:opacity-50"
        />

        {/* Mic */}
        {isSTTSupported() && (
          <button
            className={`p-2.5 rounded-xl transition-colors flex-shrink-0 ${
              isRecording ? 'bg-primary' : 'bg-primary/10'
            } ${!isLLMReady ? 'opacity-30' : ''}`}
            onPointerDown={handleMicDown}
            onPointerUp={handleMicUp}
            onPointerLeave={handleMicUp}
            disabled={!isLLMReady}
          >
            <Mic className={`w-5 h-5 ${isRecording ? 'text-primary-foreground animate-pulse' : 'text-primary'}`} />
          </button>
        )}

        {/* Send */}
        {inputValue.trim() && (
          <motion.button
            onClick={() => handleSend()}
            disabled={!isLLMReady || isGenerating}
            className="p-2.5 bg-primary text-primary-foreground rounded-xl flex-shrink-0 disabled:opacity-50"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Send className="w-5 h-5" />
          </motion.button>
        )}
      </div>

      {/* Recording indicator */}
      <AnimatePresence>
        {isRecording && (
          <motion.p
            className="text-center text-xs text-primary py-1 bg-card"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            Listening… release to send
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
