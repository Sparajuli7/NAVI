import React, { useState, useRef, useEffect } from 'react';
import {
  Settings, Sun, Moon, Camera, Mic, RotateCcw, Zap, Send,
  X as XIcon, BookOpen, MessageCircle, MapPin, MessageSquare, Sparkles,
} from 'lucide-react';
import { scenarioIcon } from '../../utils/scenarioIcons';
import { ChatLogEntry } from './NewChatBubble';
import { CompanionFace } from './CompanionFace';
import { QuickActionPill } from './QuickActionPill';
import { ExpandedPhraseCard } from './ExpandedPhraseCard';
import { SettingsPanel } from './SettingsPanel';
import { FlashcardDeck } from './FlashcardDeck';
import { KnowledgeGraphScreen } from './KnowledgeGraphScreen';
import { KnowledgeGraphExplorer } from './KnowledgeGraphExplorer';
import { AnimatePresence, motion } from 'motion/react';
import { useChatStore } from '../../stores/chatStore';
import { useCharacterStore } from '../../stores/characterStore';
import { countryFlag } from '../../utils/countryFlag';
import { useAppStore } from '../../stores/appStore';
import { useNaviAgent } from '../../agent/react/useNaviAgent';
import { parseResponse, stripThinkTags, truncateRepetition } from '../../utils/responseParser';
import { saveCharacterConversation } from '../../utils/storage';
import { startRecording, stopRecording, isSTTSupported, getSTTLangCode } from '../../services/stt';
import type { Message, PhraseCardData } from '../../types/chat';
import type { ScenarioKey } from '../../types/config';
import type { Character, GeneratedCharacter } from '../../types/character';
import { mapCharacterToUI } from '../../types/character';
import scenarioContexts from '../../config/scenarioContexts.json';
import { getLanguageByCode } from '../../config/supportedLanguages';
import { buildStructuredDebriefContext } from '../../agent/director/scenarioArc';

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
  onShowAuth?: () => void;
  onSignOut?: () => void;
  onDeleteCompanion?: (charId: string) => Promise<void>;
  isDark: boolean;
}

// Only a subset of scenarios have keyword-based auto-detection; the rest are
// launched explicitly via the ScenarioLauncher.
const SCENARIO_KEYWORDS: Partial<Record<ScenarioKey, string[]>> = {
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
  onShowAuth,
  onSignOut,
  onDeleteCompanion,
  isDark,
}: ConversationScreenProps) {
  const [inputValue, setInputValue]   = useState('');
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [expandedPhrase, setExpandedPhrase]     = useState<{
    foreign: string; phonetic: string; literal: string; natural: string;
    formality: 'casual' | 'neutral' | 'formal'; characterTip: string; alternatives?: string[];
  } | null>(null);
  const [showSettings, setShowSettings]         = useState(false);
  const [showFlashcards, setShowFlashcards]     = useState(false);
  const [showKnowledgeGraph, setShowKnowledgeGraph] = useState(false);
  const [showMemoryGraph, setShowMemoryGraph]   = useState(false);
  const [isRecording, setIsRecording]           = useState(false);
  const [isAmbientListening, setIsAmbientListening] = useState(false);
  const [llmError, setLlmError]                 = useState(false);
  const [retryText, setRetryText]               = useState('');
  const [suggestScenarioWrap, setSuggestScenarioWrap] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const proactiveShownRef = useRef(false);

  const {
    messages, isGenerating, activeScenario, isScenarioActive, pendingUserMessage,
    addMessage, updateLastMessage, setGenerating, setScenario,
    setScenarioActive, setScenarioContext, setPendingUserMessage,
  } = useChatStore();
  const { activeCharacter, addMemory: _addMemory } = useCharacterStore();
  const { currentLocation } = useAppStore();

  const { agent, isLLMReady } = useNaviAgent();
  const { userMode } = useAppStore();

  useEffect(() => {
    if (!isScenarioActive) setSuggestScenarioWrap(false);
  }, [isScenarioActive]);

  const languageName =
    currentLocation?.dialectInfo?.language
    ?? (activeCharacter?.target_language ? getLanguageByCode(activeCharacter.target_language)?.name : null)
    ?? 'English';

  // Auto-scroll chat log
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

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
      metadata: { isProactive: true },
    });
  }, [agent, isLLMReady]);

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

    // Only run detectScenario if no scenario is already active and not in guide mode
    const detected = (!activeScenario && userMode !== 'guide') ? detectScenario(msgText) : null;
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

    if (!isLLMReady) {
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
        .filter(m => (m.role === 'user' || m.role === 'character') && !m.metadata?.isProactive)
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
          updateLastMessage(stripThinkTags(fullText), false);
        },
      });

      const fullText = truncateRepetition(stripThinkTags(result.response));

      if (result.suggestScenarioWrap && isScenarioActive) {
        setSuggestScenarioWrap(true);
      }

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
      // Remove the empty streaming placeholder — never show failures as character bubbles
      useChatStore.setState((state) => {
        const msgs = [...state.messages];
        const last = msgs[msgs.length - 1];
        if (last?.metadata?.isStreaming || last?.content === '') {
          msgs.pop();
        }
        return { messages: msgs };
      });
      setLlmError(true);
      setRetryText(msgText);
    } finally {
      setGenerating(false);
    }
  };

  // Send a message queued from outside the input (e.g. a camera scan)
  useEffect(() => {
    if (!pendingUserMessage) return;
    setPendingUserMessage(null);
    handleSend(pendingUserMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingUserMessage]);

  const handleRetry = () => {
    // Drop the last user turn so handleSend can re-append it cleanly
    useChatStore.setState((state) => {
      const msgs = [...state.messages];
      if (msgs[msgs.length - 1]?.role === 'user') msgs.pop();
      return { messages: msgs };
    });
    setLlmError(false);
    handleSend(retryText);
  };

  const handleEndScenario = async () => {
    const scenarioKey = activeScenario;
    const scenarioLabel = scenarioKey ? SCENARIOS[scenarioKey]?.label ?? scenarioKey : 'the scenario';
    setSuggestScenarioWrap(false);
    setScenarioActive(false);
    setScenarioContext(null);
    setScenario(null);
    agent.avatar.applyOverride({
      scenario: '',
      additionalContext: scenarioKey
        ? buildStructuredDebriefContext(scenarioKey)
        : buildStructuredDebriefContext('custom'),
    });
    await handleSend(`[End scenario — debrief: ${scenarioLabel}]`);
    agent.avatar.clearOverrides();

    // Record scenario completion for learning stage progression
    if (scenarioKey) {
      agent.memory.learner.recordScenarioCompletion(scenarioKey).catch(e => console.warn('[NAVI]', e));
      agent.proactiveEngine.markScenarioCompleted(scenarioLabel);
    }
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

  const pills: Array<{
    icon: typeof BookOpen;
    label: string;
    isCamera?: boolean;
    isDictionary?: boolean;
    text?: string;
    variant?: 'default' | 'cta' | 'gold';
  }> =
    activeScenario && SCENARIOS[activeScenario]
      ? SCENARIOS[activeScenario].auto_suggestions.map(s => ({
          icon: MessageSquare,
          label: s,
          text: s,
        }))
      : [
          { icon: BookOpen, label: 'My phrases', isDictionary: true, variant: 'gold' },
          { icon: Camera, label: 'Scan a menu', isCamera: true, variant: 'cta' },
          { icon: MessageCircle, label: 'Teach me a phrase', text: 'Teach me a useful local phrase for right now' },
          { icon: MapPin, label: "What's nearby?", text: "What's interesting nearby that locals love?" },
        ];

  const dialectIndicator = currentLocation?.countryCode
    ? countryFlag(currentLocation.countryCode)
    : null;

  const logMessages = messages.filter(
    m => m.role !== 'system' && !(m.metadata?.isStreaming && m.content.length === 0)
  );

  // ── Header ───────────────────────────────────────────────────────────────
  const header = (
    <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/50">
      {/* Left: avatar + name + scenario badge */}
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Avatar circle */}
        <div className="flex-shrink-0">
          <CompanionFace
            imageUrl={activeCharacter?.avatarImageUrl}
            name={character.name}
            size="sm"
            accentColor={{
              primary: character.colors?.primary ?? '#6BBAA7',
              secondary: character.colors?.secondary ?? '#D4A853',
            }}
          />
        </div>

        <div className="flex flex-col min-w-0">
          <p className="font-medium text-foreground text-sm truncate leading-tight">{character.name}</p>
          {dialectIndicator && (
            <span className="text-[11px] text-muted-foreground leading-tight" title={currentLocation?.dialectInfo?.dialect ?? ''}>
              {dialectIndicator} {currentLocation?.city ?? ''}
            </span>
          )}
        </div>

        {activeScenario && SCENARIOS[activeScenario] && (() => {
          const ScenarioIcon = scenarioIcon(activeScenario);
          return (
            <button
              onClick={isScenarioActive ? handleEndScenario : undefined}
              disabled={!isScenarioActive}
              aria-label={isScenarioActive ? `End ${SCENARIOS[activeScenario].label} scenario` : undefined}
              title={isScenarioActive ? 'Tap to end this scenario' : undefined}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ml-1
                ${isScenarioActive
                  ? 'bg-primary/20 text-primary hover:bg-primary/30'
                  : 'bg-primary/10 text-primary/70 cursor-default'}`}
            >
              <ScenarioIcon className="w-3 h-3" strokeWidth={2} />
              {SCENARIOS[activeScenario].label}
              {isScenarioActive && <XIcon className="w-3 h-3 ml-0.5 opacity-60" />}
            </button>
          );
        })()}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onOpenScenarios}
          className="p-2 hover:bg-muted/50 rounded-lg transition-colors"
          aria-label="Practice a scenario"
          title="Practice a scenario"
        >
          <Zap className="w-4 h-4 text-muted-foreground" />
        </button>
        <button
          onClick={onToggleTheme}
          className="p-2 hover:bg-muted/50 rounded-lg transition-colors"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Light mode' : 'Dark mode'}
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
          aria-label="Open settings"
          title="Settings"
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

      {suggestScenarioWrap && isScenarioActive && (
        <motion.div
          className="flex items-center justify-between gap-3 px-4 py-2 border-b border-border/60 bg-primary/5"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <p className="text-xs text-muted-foreground min-w-0">
            Practice arc complete — ready to wrap up?
          </p>
          <button
            type="button"
            onClick={handleEndScenario}
            className="flex-shrink-0 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Finish & debrief
          </button>
        </motion.div>
      )}

      {/* ── Scrollable chat messages ─────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-3"
      >
        {logMessages.length === 0 ? (
          <motion.div
            className="flex flex-col items-center justify-center pt-16 pb-8 px-6 text-center"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <motion.div
              className="mb-5 w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 18 }}
            >
              <Sparkles className="w-5 h-5 text-primary" strokeWidth={1.75} />
            </motion.div>
            <p
              className="text-base text-foreground mb-1.5"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {character.name} is here
            </p>
            <p className="text-xs text-muted-foreground max-w-[220px]">
              Say hello — or tap a suggestion below
            </p>
          </motion.div>
        ) : (
          logMessages.map((message) => (
            <ChatLogEntry
              key={message.id}
              message={message}
              character={message.role === 'character'
                ? (activeCharacter ? mapCharacterToUI(activeCharacter) : character)
                : undefined}
              languageName={languageName}
              onPhraseCardClick={handlePhraseCardClick}
            />
          ))
        )}

        {llmError && !isGenerating && (
          <motion.div
            className="flex flex-col items-center gap-2 mt-3 px-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-xs text-muted-foreground text-center">
              {!isLLMReady
                ? "The AI model isn't ready yet. Open Settings → AI to connect, then retry."
                : 'Something went wrong sending that message.'}
            </p>
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

      {/* ── Input bar (always visible) ────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-border bg-card">
        {showQuickActions && (
          <div className="px-4 pt-2 pb-1 flex gap-2 overflow-x-auto scrollbar-hide">
            {pills.map((pill, idx) => (
              <QuickActionPill
                key={idx}
                icon={pill.icon}
                label={pill.label}
                variant={pill.variant}
                onClick={
                  pill.isCamera
                    ? onOpenCamera
                    : pill.isDictionary
                      ? () => setShowKnowledgeGraph(true)
                      : () => handleSend(pill.text!)
                }
              />
            ))}
          </div>
        )}

        <div className="px-4 py-3 flex items-center gap-2">
          <button
            onClick={onOpenCamera}
            aria-label="Scan a menu or sign with the camera"
            title="Scan with camera"
            className="p-2.5 hover:bg-muted/50 rounded-lg transition-colors flex-shrink-0"
          >
            <Camera className="w-5 h-5 text-muted-foreground" />
          </button>

          <input
            type="text"
            value={inputValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleSend()}
            placeholder={`Message ${character.name}…`}
            className="flex-1 px-4 py-2.5 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 text-sm"
          />

          {isSTTSupported() && (
            <button
              className={`p-2.5 rounded-xl transition-colors flex-shrink-0 ${isRecording ? 'bg-primary' : 'bg-primary/10 hover:bg-primary/20'}`}
              aria-label={userMode === 'guide' ? 'Hold to listen and translate' : 'Hold to speak'}
              title={userMode === 'guide' ? 'Hold to listen & translate' : 'Hold to speak'}
              onPointerDown={handleMicDown}
              onPointerUp={handleMicUp}
              onPointerLeave={handleMicUp}
            >
              <Mic className={`w-5 h-5 ${isRecording ? 'text-primary-foreground animate-pulse' : 'text-primary'}`} />
            </button>
          )}

          {inputValue.trim() && (
            <motion.button
              onClick={() => handleSend()}
              disabled={isGenerating}
              aria-label="Send message"
              className="p-2.5 bg-primary text-primary-foreground rounded-xl flex-shrink-0 disabled:opacity-50"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Send className="w-5 h-5" />
            </motion.button>
          )}
        </div>

        {isRecording && (
          <motion.p
            className="text-center text-xs text-primary pb-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {isAmbientListening ? 'Translating…' : 'Listening… release to send'}
          </motion.p>
        )}
      </div>

      {/* ── Expanded phrase card modal ───────────────────────────────── */}
      <AnimatePresence>
        {expandedPhrase && (
          <ExpandedPhraseCard
            phrase={expandedPhrase}
            characterName={character.name}
            languageName={languageName}
            onClose={() => setExpandedPhrase(null)}
            onSave={async () => {
              await agent.memory.learner.recordPhraseAttempt({
                phrase: expandedPhrase.foreign,
                language: languageName,
                outcome: 'learned',
                timestamp: Date.now(),
                context: currentLocation?.city ?? 'chat',
              });
            }}
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
            onShowAuth={onShowAuth}
            onSignOut={onSignOut}
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
              onOpenMemoryGraph={() => setShowMemoryGraph(true)}
              character={character}
              location={location}
              countryCode={currentLocation?.countryCode}
              trackedPhrases={languageName ? agent.memory.learner.getPhrasesForLanguage(languageName) : agent.memory.learner.phrases}
              languageLabel={languageName}
              onPracticePhrase={(phrase) => {
                setShowKnowledgeGraph(false);
                handleSend(`Can we practice this phrase? "${phrase}"`);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Memory graph explorer (rich KnowledgeGraph view) ─────────── */}
      <AnimatePresence>
        {showMemoryGraph && (
          <KnowledgeGraphExplorer
            key="memory-graph"
            graph={agent.memory.graph}
            characterName={character.name}
            onBack={() => setShowMemoryGraph(false)}
            onPracticePhrase={(phrase) => {
              setShowMemoryGraph(false);
              setShowKnowledgeGraph(false);
              handleSend(`Can we practice this phrase? "${phrase}"`);
            }}
          />
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
              phrases={languageName ? agent.memory.learner.getPhrasesForLanguage(languageName) : agent.memory.learner.phrases}
              onClose={() => setShowFlashcards(false)}
              onPractice={(phrase) => {
                setShowFlashcards(false);
                handleSend(`Can we practice this phrase? "${phrase.phrase}"`);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
