import React, { useState, useRef, useEffect } from 'react';
import {
  Settings, Sun, Moon, Camera, Mic, RotateCcw, RefreshCw, Zap,
  X as XIcon, MessageSquare, ChevronDown,
} from 'lucide-react';
import { SpeechBubble, ThoughtBubble, ChatLogEntry } from './NewChatBubble';
import { AIAvatarDisplay } from './AIAvatarDisplay';
import { QuickActionPill } from './QuickActionPill';
import { ExpandedPhraseCard } from './ExpandedPhraseCard';
import { SettingsPanel } from './SettingsPanel';
import { FlashcardDeck } from './FlashcardDeck';
import { KnowledgeGraphScreen } from './KnowledgeGraphScreen';
import { KnowledgeGraphExplorer } from './KnowledgeGraphExplorer';
import { AnimatePresence, motion } from 'motion/react';
import { useChatStore } from '../../stores/chatStore';
import { useCharacterStore } from '../../stores/characterStore';
import { useAppStore } from '../../stores/appStore';
import { useNaviAgent } from '../../agent/react/useNaviAgent';
import { parseResponse } from '../../utils/responseParser';
import { saveCharacterConversation } from '../../utils/storage';
import { startRecording, stopRecording, isSTTSupported, getSTTLangCode } from '../../services/stt';
import type { Message, PhraseCardData } from '../../types/chat';
import type { ScenarioKey } from '../../types/config';
import type { Character } from '../../types/character';
import scenarioContexts from '../../config/scenarioContexts.json';

interface GeneratedCharacter {
  name: string;
  personality: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  accessory?: string;
}

interface ConversationScreenProps {
  character: GeneratedCharacter;
  location: string;
  onOpenCamera: () => void;
  onToggleTheme: () => void;
  onRegenerate: () => void;
  onGoHome: () => void;
  onUpdateCharacter: (updates: Partial<Character>) => Promise<void>;
  onSaveUserProfile: (text: string) => Promise<void>;
  onOpenScenarios: () => void;
  onShowModelPicker?: () => void;
  onDeleteCompanion?: (charId: string) => Promise<void>;
  isDark: boolean;
}

const SCENARIO_KEYWORDS: Record<ScenarioKey, string[]> = {
  restaurant:  ['restaurant', 'food', 'menu', 'eat', 'order', 'drink', 'meal', 'bill', 'tip', 'hungry', 'cafe', 'dine', 'cook'],
  hospital:    ['hospital', 'doctor', 'sick', 'pain', 'medicine', 'emergency', 'hurt', 'symptom', 'health', 'clinic', 'pharmacy'],
  market:      ['market', 'buy', 'price', 'cheap', 'expensive', 'haggle', 'bargain', 'shop', 'shopping', 'discount', 'cost'],
  office:      ['office', 'work', 'meeting', 'email', 'boss', 'colleague', 'professional', 'business', 'workplace', 'job'],
  nightlife:   ['bar', 'club', 'drink', 'night', 'party', 'beer', 'dance', 'nightlife', 'pub', 'cocktail', 'beer'],
  transit:     ['bus', 'train', 'taxi', 'station', 'stop', 'ticket', 'direction', 'where', 'subway', 'metro', 'transport', 'ride'],
  school:      ['school', 'teacher', 'class', 'student', 'homework', 'exam', 'university', 'college', 'study', 'learn'],
  government:  ['visa', 'passport', 'form', 'permit', 'document', 'id', 'government', 'bureaucracy', 'official', 'immigration'],
  directions:  ['directions', 'lost', 'find', 'navigate', 'turn', 'left', 'right', 'straight', 'how far', 'nearest', 'where is'],
  hotel:       ['hotel', 'check in', 'check-in', 'checkout', 'room', 'reservation', 'lobby', 'reception', 'concierge', 'key card'],
  social:      ['meet', 'introduce', 'party', 'event', 'stranger', 'friend', 'small talk', 'social', 'networking', 'people'],
};

const SCENARIOS = scenarioContexts as Record<string, { label: string; emoji?: string; auto_suggestions: string[] }>;

function detectScenario(text: string): ScenarioKey | null {
  const lower = text.toLowerCase();
  let best: ScenarioKey | null = null;
  let bestCount = 0;
  for (const [key, keywords] of Object.entries(SCENARIO_KEYWORDS) as [ScenarioKey, string[]][]) {
    const count = keywords.filter(k => lower.includes(k)).length;
    if (count > bestCount) { bestCount = count; best = key; }
  }
  return bestCount > 0 ? best : null;
}

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '';
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

export function ConversationScreen({
  character,
  location,
  onOpenCamera,
  onToggleTheme,
  onRegenerate,
  onGoHome: _onGoHome,
  onUpdateCharacter,
  onSaveUserProfile,
  onOpenScenarios,
  onShowModelPicker,
  onDeleteCompanion,
  isDark,
}: ConversationScreenProps) {
  const [inputValue, setInputValue]   = useState('');
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [expandedPhrase, setExpandedPhrase]     = useState<any>(null);
  const [showSettings, setShowSettings]         = useState(false);
  const [showFlashcards, setShowFlashcards]     = useState(false);
  const [showKnowledgeGraph, setShowKnowledgeGraph] = useState(false);
  const [showGraphExplorer, setShowGraphExplorer]   = useState(false);
  const [isRecording, setIsRecording]           = useState(false);
  const [isAmbientListening, setIsAmbientListening] = useState(false);
  const [llmError, setLlmError]                 = useState(false);
  const [retryText, setRetryText]               = useState('');
  // Two-mode layout: 'avatar' = full-screen avatar + voice, 'chat' = scrollable history + text input
  const [viewMode, setViewMode]                 = useState<'avatar' | 'chat'>('avatar');
  const scrollRef = useRef<HTMLDivElement>(null);
  const proactiveShownRef = useRef(false);

  const {
    messages, isGenerating, activeScenario, isScenarioActive,
    addMessage, updateLastMessage, setGenerating, setScenario,
    setScenarioActive, setScenarioContext,
  } = useChatStore();
  const { activeCharacter, addMemory: _addMemory } = useCharacterStore();
  const { currentLocation } = useAppStore();

  const { agent, isLLMReady } = useNaviAgent();
  const { userMode } = useAppStore();

  const languageName = currentLocation?.dialectInfo?.language ?? 'English';

  // Auto-scroll chat log when in chat mode
  useEffect(() => {
    if (viewMode === 'chat' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isGenerating, viewMode]);

  // Proactive message on app open (returning users only)
  useEffect(() => {
    if (proactiveShownRef.current) return;
    if (!agent || !isLLMReady) return;

    const msgs = useChatStore.getState().messages;
    if (msgs.length === 0) return; // First-ever session — skip proactive

    const proactiveMsg = agent.getProactiveMessage();
    if (!proactiveMsg) return;

    proactiveShownRef.current = true;
    const { addMessage } = useChatStore.getState();
    addMessage({
      id: `proactive_${Date.now()}`,
      role: 'character',
      content: proactiveMsg,
      timestamp: Date.now(),
      type: 'text',
    });
  }, [agent, isLLMReady]);

  // Auto-switch to chat mode when user starts typing
  const handleInputFocus = () => {
    setViewMode('chat');
    setShowQuickActions(false);
  };

  // Show quick action pills again every 5 user messages
  const userMsgCount = messages.filter(m => m.role === 'user').length;
  useEffect(() => {
    if (userMsgCount > 0 && userMsgCount % 5 === 0 && !isGenerating) {
      setShowQuickActions(true);
    }
  }, [userMsgCount, isGenerating]);

  const handleSend = async (textOverride?: string, sendOptions?: { translationMode?: 'listen' | 'speak' }) => {
    const msgText = (textOverride ?? inputValue).trim();
    if (!msgText || isGenerating) return;

    const richChar = activeCharacter;
    if (!richChar) return;

    setLlmError(false);

    const detected = detectScenario(msgText);
    if (detected) setScenario(detected);

    const historySnapshot = useChatStore.getState().messages;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: msgText,
      type: 'text',
      timestamp: Date.now(),
    };
    addMessage(userMsg);
    setInputValue('');
    setShowQuickActions(false);

    // Switch to avatar mode to show the response visually
    setViewMode('avatar');

    if (!isLLMReady) {
      const helpMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'character',
        content:
          "The AI model isn't loaded yet. Open Settings (gear icon) → AI Model to download or retry.",
        type: 'text',
        timestamp: Date.now(),
        showAvatar: true,
      };
      addMessage(helpMsg);
      setLlmError(true);
      setRetryText(msgText);
      return;
    }

    setGenerating(true);

    const placeholderMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'character',
      content: '',
      type: 'text',
      timestamp: Date.now() + 1,
      showAvatar: true,
      metadata: { isStreaming: true },
    };
    addMessage(placeholderMsg);

    try {
      const history = historySnapshot
        .filter(m => m.role === 'user' || m.role === 'character')
        .slice(-8)
        .map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          // Truncate long character messages — prevents verbose first_messages from
          // poisoning the LLM context and causing same-response loop
          content: m.role === 'character' && m.content.length > 400
            ? m.content.slice(0, 400) + '…'
            : m.content,
        }));

      const result = await agent.handleMessage(msgText, {
        history,
        context: {
          scenario: detected ?? activeScenario,
          translationMode: sendOptions?.translationMode,
        },
        onToken: (_token: string, fullText: string) => {
          updateLastMessage(fullText, false);
        },
      });

      const fullText = result.response;

      const segments = parseResponse(fullText);
      useChatStore.setState((state) => {
        const msgs = [...state.messages];
        const last = msgs[msgs.length - 1];
        if (!last) return state;
        msgs[msgs.length - 1] = {
          ...last,
          content: fullText,
          metadata: { isStreaming: false, segments },
        };
        return { messages: msgs };
      });

      const allMessages = useChatStore.getState().messages;
      if (richChar?.id) await saveCharacterConversation(richChar.id, allMessages);

      const uCount = allMessages.filter(m => m.role === 'user').length;
      if (uCount > 0 && uCount % 10 === 0) {
        const recentMsgs = allMessages.slice(-10)
          .filter(m => m.role === 'user' || m.role === 'character')
          .map(m => m.content)
          .join(' ');
        const summary = recentMsgs.slice(0, 200);
        agent.memory.storeEpisodeAsync(summary, {
          location: currentLocation?.city,
          scenario: detected ?? activeScenario ?? undefined,
          importance: 0.5,
        });
      }
    } catch (err) {
      console.error('[NAVI:chat] handleSend error:', err);
      updateLastMessage("Hmm, let me try that again... 🔄", true);
      setLlmError(true);
      setRetryText(msgText);
    } finally {
      setGenerating(false);
    }
  };

  const handleRetry = () => {
    useChatStore.setState((state) => ({
      messages: state.messages.slice(0, -2),
    }));
    setLlmError(false);
    handleSend(retryText);
  };

  const handleEndScenario = async () => {
    const scenarioLabel = activeScenario ? SCENARIOS[activeScenario]?.label ?? activeScenario : 'the scenario';
    setScenarioActive(false);
    setScenarioContext(null);
    setScenario(null);
    agent.avatar.applyOverride({
      scenario: '',
      additionalContext: `DEBRIEF MODE: The user just finished a '${scenarioLabel}' practice session. Step out of scenario mode. Give a brief, honest debrief: what went well, one or two specific things to work on, and any phrases worth saving. Reference specific things from the conversation. 3-4 sentences max. No cheerleading.`,
    });
    await handleSend(`[End scenario — debrief: ${scenarioLabel}]`);
    agent.avatar.clearOverrides();
  };

  const handlePhraseCardClick = (data: PhraseCardData) => {
    setExpandedPhrase({
      foreign:       data.phrase,
      phonetic:      data.phonetic,
      literal:       data.meaning,
      natural:       data.meaning,
      formality:     'neutral' as const,
      characterTip:  data.tip,
      alternatives:  data.soundTip ? [data.soundTip] : [],
    });
  };

  const handleMicDown = () => {
    if (!isSTTSupported()) return;

    // In guide mode: hold mic = ambient listening (listens in avatar's language for translation)
    if (userMode === 'guide') {
      const avatarLang = languageName || 'English';
      const avatarLangCode = getSTTLangCode(avatarLang);
      setIsAmbientListening(true);
      setIsRecording(true);
      startRecording(avatarLangCode, (transcript) => {
        setIsAmbientListening(false);
        setIsRecording(false);
        if (transcript.trim()) {
          // Send as a translation request with translationMode: 'listen'
          handleSend(transcript.trim(), { translationMode: 'listen' });
        }
      }, () => {
        setIsAmbientListening(false);
        setIsRecording(false);
      });
      return;
    }

    const lang = languageName || 'English';
    setIsRecording(true);
    startRecording(lang, (transcript) => {
      setInputValue(transcript);
      setIsRecording(false);
      // Auto-send voice input
      if (transcript.trim()) {
        handleSend(transcript.trim());
      }
    }, () => {
      setIsRecording(false);
    });
  };

  const handleMicUp = () => {
    stopRecording();
    setIsRecording(false);
  };

  const pills: Array<{ icon: string; label: string; isCamera?: boolean; isDictionary?: boolean; text?: string }> =
    activeScenario && SCENARIOS[activeScenario]
      ? SCENARIOS[activeScenario].auto_suggestions.map(s => ({ icon: '💬', label: s, text: s }))
      : [
          { icon: '📚', label: 'My phrases', isDictionary: true },
          { icon: '📸', label: 'Scan a menu',         isCamera: true },
          { icon: '🗣',  label: 'Teach me a phrase',  text: 'Teach me a useful local phrase for right now' },
          { icon: '🧭', label: "What's nearby?",      text: "What's interesting nearby that locals love?" },
        ];

  const hasStreamingContent = messages.some(m => m.metadata?.isStreaming && m.content.length > 0);
  const showTypingDots = isGenerating && !hasStreamingContent;

  const dialectIndicator = currentLocation?.countryCode
    ? countryFlag(currentLocation.countryCode)
    : null;

  const latestCharMsg = [...messages]
    .reverse()
    .find(m =>
      m.role === 'character' &&
      !(m.metadata?.isStreaming && m.content.length === 0)
    ) ?? null;

  const logMessages = messages.filter(
    m => m.role !== 'system' && !(m.metadata?.isStreaming && m.content.length === 0)
  );

  // ── Shared header ────────────────────────────────────────────────────────
  const header = (
    <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
      <div className="flex items-center gap-2 min-w-0">
        {viewMode === 'chat' && (
          <button
            onClick={() => setViewMode('avatar')}
            className="p-1.5 hover:bg-muted/50 rounded-lg transition-colors mr-1 flex-shrink-0"
            title="Back to avatar"
          >
            <ChevronDown className="w-4 h-4 text-muted-foreground rotate-90" />
          </button>
        )}
        <p className="font-medium text-foreground text-sm truncate">{character.name}</p>
        {activeScenario && SCENARIOS[activeScenario] && (
          <button
            onClick={isScenarioActive ? handleEndScenario : undefined}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors
              ${isScenarioActive
                ? 'bg-primary/20 text-primary hover:bg-primary/30'
                : 'bg-primary/10 text-primary/70'}`}
          >
            {(SCENARIOS[activeScenario] as { emoji?: string }).emoji && (
              <span className="text-xs">{(SCENARIOS[activeScenario] as { emoji?: string }).emoji}</span>
            )}
            {SCENARIOS[activeScenario].label}
            {isScenarioActive && <XIcon className="w-3 h-3 ml-0.5 opacity-60" />}
          </button>
        )}
        {dialectIndicator && (
          <span className="text-sm" title={currentLocation?.dialectInfo?.dialect ?? ''}>
            {dialectIndicator}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onOpenScenarios}
          className="p-2 hover:bg-muted/50 rounded-lg transition-colors"
          title="Practice a scenario"
        >
          <Zap className="w-4 h-4 text-muted-foreground" />
        </button>
        <button
          onClick={onToggleTheme}
          className="p-2 hover:bg-muted/50 rounded-lg transition-colors"
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-muted-foreground" />
          ) : (
            <Moon className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 hover:bg-muted/50 rounded-lg transition-colors"
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="flex flex-col bg-background overflow-hidden"
      style={{ height: 'calc(100vh - 57px)' }}
    >
      {header}

      <AnimatePresence mode="wait">

        {/* ══════════════════════════════════════════════════════════════
            AVATAR MODE — full screen avatar + voice interaction
        ══════════════════════════════════════════════════════════════ */}
        {viewMode === 'avatar' && (
          <motion.div
            key="avatar-mode"
            className="flex-1 flex flex-col min-h-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Avatar + name */}
            <div className="flex flex-col items-center justify-center pt-6 pb-2 flex-shrink-0">
              {activeCharacter?.avatarImageUrl ? (
                <div style={{ width: 112, height: 112 }} className="rounded-full overflow-hidden">
                  <img
                    src={activeCharacter.avatarImageUrl}
                    alt="avatar"
                    className="rounded-full object-cover w-full h-full"
                  />
                </div>
              ) : (
                <AIAvatarDisplay
                  characterId={activeCharacter?.id ?? ''}
                  prefs={activeCharacter?.avatar_prefs}
                  accentColor={activeCharacter?.avatar_color?.accent ?? character.colors.accent}
                  state={isGenerating ? 'generating' : isRecording ? 'speaking' : 'idle'}
                  size={112}
                  name={character.name}
                />
              )}
              <div className="mt-2 text-center">
                <p className="text-sm font-semibold text-foreground">{character.name}</p>
                <p
                  className="text-xs text-muted-foreground italic line-clamp-1 px-6"
                  style={{ fontSize: '11px' }}
                >
                  {character.personality}
                </p>
              </div>
              <button
                onClick={onRegenerate}
                className="mt-1 p-1.5 hover:bg-muted/50 rounded-lg transition-colors"
                title="Regenerate companion"
              >
                <RefreshCw className="w-3.5 h-3.5 text-muted-foreground/50" />
              </button>
            </div>

            {/* Speech bubble — grows to fill available space, scrolls if needed */}
            <div className="flex-1 min-h-0 flex flex-col justify-center px-5 pb-2 overflow-hidden">
              <div className="overflow-y-auto max-h-full">
                <AnimatePresence mode="wait">
                  {showTypingDots ? (
                    <motion.div
                      key="thought"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <ThoughtBubble />
                    </motion.div>
                  ) : latestCharMsg ? (
                    <motion.div
                      key={latestCharMsg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <SpeechBubble
                        message={latestCharMsg}
                        character={character}
                        languageName={languageName}
                        onPhraseCardClick={handlePhraseCardClick}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="welcome"
                      className="relative ml-3"
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      <div
                        className="absolute -left-[7px] top-4 w-3.5 h-3.5 bg-card border-l border-b border-border"
                        style={{ transform: 'rotate(45deg)' }}
                      />
                      <div className="bg-card border border-border rounded-2xl rounded-tl-none px-4 py-3 shadow-md">
                        <p
                          className="text-foreground/70 italic text-sm leading-relaxed"
                          style={{ fontFamily: 'var(--font-character)' }}
                        >
                          Hey! I'm {character.name}. Hold the mic and talk, or tap the chat icon to type.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* LLM error retry */}
                {llmError && !isGenerating && (
                  <motion.div
                    className="flex justify-center mt-3"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <button
                      onClick={handleRetry}
                      className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 text-primary rounded-xl text-sm font-medium hover:bg-primary/20 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Retry
                    </button>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Quick action pills */}
            {showQuickActions && (
              <div className="flex-shrink-0 px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
                {pills.map((pill, idx) => (
                  <React.Fragment key={idx}>
                    <QuickActionPill
                      icon={pill.icon}
                      label={pill.label}
                      onClick={
                        pill.isCamera
                          ? onOpenCamera
                          : pill.isDictionary
                            ? () => setShowKnowledgeGraph(true)
                            : () => handleSend(pill.text!)
                      }
                    />
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* Bottom bar: Camera | big Mic | Chat toggle */}
            <div className="flex-shrink-0 border-t border-border bg-card px-6 py-4">
              <div className="flex items-center justify-between">
                {/* Camera */}
                <button
                  onClick={onOpenCamera}
                  className="p-3 hover:bg-muted/50 rounded-full transition-colors"
                  title="Scan with camera"
                >
                  <Camera className="w-6 h-6 text-muted-foreground" />
                </button>

                {/* Large centered mic button — gold in guide mode when listening */}
                {isSTTSupported() ? (
                  <motion.button
                    className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-colors
                      ${isAmbientListening
                        ? 'scale-110'
                        : isRecording
                        ? 'bg-primary scale-110'
                        : 'bg-primary/90 hover:bg-primary'}`}
                    style={isAmbientListening ? { backgroundColor: '#D4A853' } : undefined}
                    onPointerDown={handleMicDown}
                    onPointerUp={handleMicUp}
                    onPointerLeave={handleMicUp}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Mic className={`w-8 h-8 ${isRecording ? 'text-primary-foreground animate-pulse' : 'text-primary-foreground'}`} />
                  </motion.button>
                ) : (
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center bg-muted/30 opacity-40"
                    title="Voice input unavailable in this browser"
                  >
                    <Mic className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}

                {/* Chat toggle */}
                <button
                  onClick={() => setViewMode('chat')}
                  className="p-3 hover:bg-muted/50 rounded-full transition-colors relative"
                  title="Open chat history"
                >
                  <MessageSquare className="w-6 h-6 text-muted-foreground" />
                  {logMessages.length > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
                  )}
                </button>
              </div>

              {isAmbientListening && (
                <motion.div
                  className="flex flex-col items-center gap-1 mt-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <p className="text-center text-xs font-medium" style={{ color: '#D4A853' }}>
                    Listening...
                  </p>
                  <p className="text-center text-xs text-muted-foreground">
                    Live translation needs internet for voice recognition
                  </p>
                </motion.div>
              )}
              {isRecording && !isAmbientListening && (
                <motion.p
                  className="text-center text-xs text-primary mt-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  Listening… release to send
                </motion.p>
              )}
              {!isSTTSupported() && (
                <p className="text-center text-xs text-muted-foreground mt-2">
                  Voice input unavailable — tap chat icon to type
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            CHAT MODE — scrollable history + text input
        ══════════════════════════════════════════════════════════════ */}
        {viewMode === 'chat' && (
          <motion.div
            key="chat-mode"
            className="flex-1 flex flex-col min-h-0"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.22 }}
          >
            {/* Scrollable chat log */}
            <div
              ref={scrollRef}
              className="flex-1 min-h-0 overflow-y-auto px-4 py-3"
            >
              {logMessages.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center pt-8">
                  No messages yet — say something!
                </p>
              ) : (
                logMessages.map((message) => (
                  <React.Fragment key={message.id}>
                    <ChatLogEntry
                      message={message}
                      character={message.role === 'character' ? character : undefined}
                      languageName={languageName}
                      onPhraseCardClick={handlePhraseCardClick}
                    />
                  </React.Fragment>
                ))
              )}

              {llmError && !isGenerating && (
                <motion.div
                  className="flex justify-center mt-3"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <button
                    onClick={handleRetry}
                    className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 text-primary rounded-xl text-sm font-medium hover:bg-primary/20 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Retry
                  </button>
                </motion.div>
              )}
            </div>

            {/* Input area */}
            <div className="flex-shrink-0 border-t border-border bg-card">
              {showQuickActions && (
                <div className="px-4 pt-2 pb-1 flex gap-2 overflow-x-auto scrollbar-hide">
                  {pills.map((pill, idx) => (
                    <React.Fragment key={idx}>
                      <QuickActionPill
                        icon={pill.icon}
                        label={pill.label}
                        onClick={
                          pill.isCamera
                            ? onOpenCamera
                            : pill.isDictionary
                              ? () => setShowKnowledgeGraph(true)
                              : () => handleSend(pill.text!)
                        }
                      />
                    </React.Fragment>
                  ))}
                </div>
              )}

              <div className="px-4 py-3 flex items-end gap-2">
                <button
                  onClick={onOpenCamera}
                  className="p-2.5 hover:bg-muted/50 rounded-lg transition-colors flex-shrink-0"
                >
                  <Camera className="w-5 h-5 text-muted-foreground" />
                </button>

                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
                    onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleSend()}
                    onFocus={handleInputFocus}
                    placeholder={`Ask ${character.name} anything...`}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  />
                </div>

                {isSTTSupported() ? (
                  <button
                    className={`p-2.5 rounded-lg transition-colors flex-shrink-0 ${isRecording ? 'bg-primary' : 'bg-primary/10 hover:bg-primary/20'}`}
                    onPointerDown={handleMicDown}
                    onPointerUp={handleMicUp}
                    onPointerLeave={handleMicUp}
                  >
                    <Mic className={`w-5 h-5 ${isRecording ? 'text-primary-foreground' : 'text-primary'}`} />
                  </button>
                ) : (
                  <div className="p-2.5 flex-shrink-0 opacity-30" title="Voice input unavailable in this browser">
                    <Mic className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}

                {inputValue.trim() && (
                  <motion.button
                    onClick={() => handleSend()}
                    className="px-4 py-3 bg-primary text-primary-foreground rounded-xl font-medium flex-shrink-0 text-sm"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Send
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* ── Expanded phrase card modal ───────────────────────────────── */}
      <AnimatePresence>
        {expandedPhrase && (
          <ExpandedPhraseCard
            phrase={expandedPhrase}
            characterName={character.name}
            languageName={languageName}
            onClose={() => setExpandedPhrase(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Settings panel ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showSettings && (
          <SettingsPanel
            onClose={() => setShowSettings(false)}
            onRegenerate={onRegenerate}
            onUpdateCharacter={onUpdateCharacter}
            onSaveUserProfile={onSaveUserProfile}
            onDeleteCompanion={onDeleteCompanion}
            onShowModelPicker={onShowModelPicker}
          />
        )}
      </AnimatePresence>

      {/* ── Knowledge graph (dictionary map) ─────────────────────────── */}
      <AnimatePresence>
        {showKnowledgeGraph && (
          <motion.div
            key="knowledge-graph"
            className="fixed inset-0 z-[42] flex flex-col bg-background"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <KnowledgeGraphScreen
              onBack={() => setShowKnowledgeGraph(false)}
              onOpenFlashcards={() => {
                setShowKnowledgeGraph(false);
                setShowFlashcards(true);
              }}
              character={character}
              location={location}
              countryCode={currentLocation?.countryCode}
              trackedPhrases={agent.memory.learner.phrases}
              languageLabel={languageName}
              onPracticePhrase={(phrase) => {
                setShowKnowledgeGraph(false);
                handleSend(`Can we practice this phrase? "${phrase}"`);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Flashcard deck overlay ───────────────────────────────────── */}
      <AnimatePresence>
        {showFlashcards && (
          <motion.div
            key="flashcard-overlay"
            className="fixed inset-0 z-[43] flex flex-col bg-background"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <FlashcardDeck
              phrases={agent.memory.learner.phrases}
              onClose={() => setShowFlashcards(false)}
              onPractice={(phrase) => {
                setShowFlashcards(false);
                handleSend(`Can we practice this phrase? "${phrase.phrase}"`);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Knowledge Graph Explorer (rich graph view) ────────────────── */}
      <AnimatePresence>
        {showGraphExplorer && (
          <KnowledgeGraphExplorer
            key="graph-explorer"
            graph={agent.memory.graph}
            onBack={() => setShowGraphExplorer(false)}
            onPracticePhrase={(phrase) => {
              setShowGraphExplorer(false);
              handleSend(`Can we practice this phrase? "${phrase}"`);
            }}
            characterName={character.name}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
