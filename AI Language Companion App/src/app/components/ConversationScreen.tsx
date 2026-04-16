import React, { useState, useRef, useEffect } from 'react';
import {
  Settings, Sun, Moon, Camera, Mic, RotateCcw, Zap, Send,
  X as XIcon,
} from 'lucide-react';
import { ChatLogEntry } from './NewChatBubble';
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
import { parseResponse, stripThinkTags } from '../../utils/responseParser';
import { saveCharacterConversation } from '../../utils/storage';
import { startRecording, stopRecording, isSTTSupported, getSTTLangCode } from '../../services/stt';
import type { Message, PhraseCardData } from '../../types/chat';
import type { ScenarioKey } from '../../types/config';
import type { Character, GeneratedCharacter } from '../../types/character';
import scenarioContexts from '../../config/scenarioContexts.json';

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
  const [expandedPhrase, setExpandedPhrase]     = useState<{
    foreign: string; phonetic: string; literal: string; natural: string;
    formality: 'casual' | 'neutral' | 'formal'; characterTip: string; alternatives?: string[];
  } | null>(null);
  const [showSettings, setShowSettings]         = useState(false);
  const [showFlashcards, setShowFlashcards]     = useState(false);
  const [showKnowledgeGraph, setShowKnowledgeGraph] = useState(false);
  const [showGraphExplorer, setShowGraphExplorer]   = useState(false);
  const [isRecording, setIsRecording]           = useState(false);
  const [isAmbientListening, setIsAmbientListening] = useState(false);
  const [llmError, setLlmError]                 = useState(false);
  const [retryText, setRetryText]               = useState('');
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

    // Bug fix (EXP-052): Only run detectScenario if no scenario is already active
    // (prevents keyword detection from overriding a manually-selected scenario)
    // and skip detection in guide mode (user mentions "restaurant" for translation,
    // not to start a scenario)
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

      const fullText = stripThinkTags(result.response);

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
    const scenarioKey = activeScenario;
    const scenarioLabel = scenarioKey ? SCENARIOS[scenarioKey]?.label ?? scenarioKey : 'the scenario';
    setScenarioActive(false);
    setScenarioContext(null);
    setScenario(null);
    agent.avatar.applyOverride({
      scenario: '',
      additionalContext: `DEBRIEF MODE: The user just finished a '${scenarioLabel}' practice session. Step completely out of scenario mode. Your debrief MUST follow this structure:\n(1) NAME ONE SPECIFIC THING THEY SAID CORRECTLY — quote their actual words. "When you said '...' — that was spot on."\n(2) NAME ONE SPECIFIC THING TO IMPROVE — give the corrected form. "When you tried to say X, the natural way is Y. Here's how: **Y** (pronunciation)."\n(3) Present 2 phrase cards for the most useful phrases from this scenario (use full **Phrase:**/**Say it:**/**Sound tip:**/**Means:**/**Tip:** format).\nBe honest and warm, not generic. QUOTE what the user actually said — this makes it real, not cheerleading.`,
    });
    await handleSend(`[End scenario — debrief: ${scenarioLabel}]`);
    agent.avatar.clearOverrides();

    // Bug fix (EXP-052): record scenario completion for learning stage progression
    // and wire ProactiveEngine.markScenarioCompleted() (was dead code)
    if (scenarioKey) {
      agent.memory.learner.recordScenarioCompletion(scenarioKey).catch(() => {});
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

  const pills: Array<{ icon: string; label: string; isCamera?: boolean; isDictionary?: boolean; text?: string }> =
    activeScenario && SCENARIOS[activeScenario]
      ? SCENARIOS[activeScenario].auto_suggestions.map(s => ({ icon: '💬', label: s, text: s }))
      : [
          { icon: '📚', label: 'My phrases', isDictionary: true },
          { icon: '📸', label: 'Scan a menu',         isCamera: true },
          { icon: '🗣',  label: 'Teach me a phrase',  text: 'Teach me a useful local phrase for right now' },
          { icon: '🧭', label: "What's nearby?",      text: "What's interesting nearby that locals love?" },
        ];

  const dialectIndicator = currentLocation?.countryCode
    ? countryFlag(currentLocation.countryCode)
    : null;

  const logMessages = messages.filter(
    m => m.role !== 'system' && !(m.metadata?.isStreaming && m.content.length === 0)
  );

  // ── Header ───────────────────────────────────────────────────────────────
  const header = (
    <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
      <div className="flex items-center gap-2 min-w-0">
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

      {/* ── Scrollable chat messages ─────────────────────────────────── */}
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
            <ChatLogEntry
              key={message.id}
              message={message}
              character={message.role === 'character' ? character : undefined}
              languageName={languageName}
              onPhraseCardClick={handlePhraseCardClick}
            />
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

      {/* ── Input bar (always visible) ────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-border bg-card">
        {showQuickActions && (
          <div className="px-4 pt-2 pb-1 flex gap-2 overflow-x-auto scrollbar-hide">
            {pills.map((pill, idx) => (
              <QuickActionPill
                key={idx}
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
            ))}
          </div>
        )}

        <div className="px-4 py-3 flex items-center gap-2">
          <button
            onClick={onOpenCamera}
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
              className="p-2.5 bg-primary text-primary-foreground rounded-xl flex-shrink-0"
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
