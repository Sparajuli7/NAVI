import React, { useState, useRef, useEffect } from 'react';
import { Settings, Sun, Moon, Camera, Mic, RotateCcw } from 'lucide-react';
import { NewChatBubble } from './NewChatBubble';
import { BlockyAvatar } from './BlockyAvatar';
import { QuickActionPill } from './QuickActionPill';
import { ExpandedPhraseCard } from './ExpandedPhraseCard';
import { SettingsPanel } from './SettingsPanel';
import { AnimatePresence, motion } from 'motion/react';
import { useChatStore } from '../../stores/chatStore';
import { useCharacterStore } from '../../stores/characterStore';
import { useAppStore } from '../../stores/appStore';
import { useNaviAgent } from '../../agent/react/useNaviAgent';
import { parseResponse } from '../../utils/responseParser';
import { saveCharacterConversation, saveCharacterMemories } from '../../utils/storage';
import { startRecording, stopRecording, isSTTSupported } from '../../services/stt';
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
  isDark: boolean;
}

const SCENARIO_KEYWORDS: Record<ScenarioKey, string[]> = {
  restaurant: ['restaurant', 'food', 'menu', 'eat', 'order', 'drink', 'meal', 'bill', 'tip', 'hungry', 'cafe', 'dine', 'cook'],
  hospital:   ['hospital', 'doctor', 'sick', 'pain', 'medicine', 'emergency', 'hurt', 'symptom', 'health', 'clinic', 'pharmacy'],
  market:     ['market', 'buy', 'price', 'cheap', 'expensive', 'haggle', 'bargain', 'shop', 'shopping', 'discount', 'cost'],
  office:     ['office', 'work', 'meeting', 'email', 'boss', 'colleague', 'professional', 'business', 'workplace', 'job'],
  nightlife:  ['bar', 'club', 'drink', 'night', 'party', 'beer', 'dance', 'nightlife', 'pub', 'cocktail', 'beer'],
  transit:    ['bus', 'train', 'taxi', 'station', 'stop', 'ticket', 'direction', 'where', 'subway', 'metro', 'transport', 'ride'],
  school:     ['school', 'teacher', 'class', 'student', 'homework', 'exam', 'university', 'college', 'study', 'learn'],
  government: ['visa', 'passport', 'form', 'permit', 'document', 'id', 'government', 'bureaucracy', 'official', 'immigration'],
};

const SCENARIOS = scenarioContexts as Record<ScenarioKey, { label: string; auto_suggestions: string[] }>;

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
  isDark,
}: ConversationScreenProps) {
  const [inputValue, setInputValue]   = useState('');
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [expandedPhrase, setExpandedPhrase]     = useState<any>(null);
  const [showProfile, setShowProfile]           = useState(false);
  const [showSettings, setShowSettings]         = useState(false);
  const [isRecording, setIsRecording]           = useState(false);
  const [llmError, setLlmError]                 = useState(false);
  const [retryText, setRetryText]               = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, isGenerating, activeScenario, addMessage, updateLastMessage, setGenerating, setScenario } = useChatStore();
  const { activeCharacter, memories, addMemory } = useCharacterStore();
  const { currentLocation } = useAppStore();

  // Agent framework — routes messages through tools, director, memory
  const { agent, isLLMReady } = useNaviAgent();

  const languageName = currentLocation?.dialectInfo?.language ?? 'English';

  // Auto-scroll on new messages or typing state change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  // Show quick action pills again every 5 user messages
  const userMsgCount = messages.filter(m => m.role === 'user').length;
  useEffect(() => {
    if (userMsgCount > 0 && userMsgCount % 5 === 0 && !isGenerating) {
      setShowQuickActions(true);
    }
  }, [userMsgCount, isGenerating]);

  const handleSend = async (textOverride?: string) => {
    const msgText = (textOverride ?? inputValue).trim();
    if (!msgText || isGenerating) return;

    const richChar = activeCharacter;
    if (!richChar) return;

    setLlmError(false);

    // Scenario detection (keep for UI pill switching)
    const detected = detectScenario(msgText);
    if (detected) setScenario(detected);

    // Snapshot history BEFORE adding the new user message
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
      // Build conversation history for the agent
      const history = historySnapshot
        .filter(m => m.role === 'user' || m.role === 'character')
        .slice(-20)
        .map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        }));

      // Use the agent framework — routes through director + tools + memory
      const result = await agent.handleMessage(msgText, {
        history,
        context: {
          scenario: detected ?? activeScenario,
        },
        onToken: (_token, fullText) => {
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

      // Persist conversation (per-character)
      const allMessages = useChatStore.getState().messages;
      if (richChar?.id) await saveCharacterConversation(richChar.id, allMessages);

      // Agent's director handles memory/learning tracking automatically via postProcess,
      // but we still persist the legacy Zustand memories for the UI
      const uCount = allMessages.filter(m => m.role === 'user').length;
      if (uCount > 0 && uCount % 10 === 0) {
        // Episodic memory is handled by the agent's MemoryManager
        // Store a summary episode for cross-session continuity
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
    } catch {
      updateLastMessage("Hmm, let me try that again... 🔄", true);
      setLlmError(true);
      setRetryText(msgText);
    } finally {
      setGenerating(false);
    }
  };

  const handleRetry = () => {
    // Remove the last 2 messages (error bubble + user message) and resend
    useChatStore.setState((state) => ({
      messages: state.messages.slice(0, -2),
    }));
    setLlmError(false);
    handleSend(retryText);
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
    const langMap: Record<string, string> = {
      Vietnamese: 'vi-VN', Japanese: 'ja-JP', French: 'fr-FR',
      Spanish: 'es-MX', Korean: 'ko-KR',
    };
    const lang = languageName in langMap ? langMap[languageName] : 'en-US';
    setIsRecording(true);
    startRecording(lang, (transcript) => {
      setInputValue(transcript);
      setIsRecording(false);
    }, () => {
      setIsRecording(false);
    });
  };

  const handleMicUp = () => {
    stopRecording();
    setIsRecording(false);
  };

  const pills: Array<{ icon: string; label: string; isCamera?: boolean; text?: string }> =
    activeScenario && SCENARIOS[activeScenario]
      ? SCENARIOS[activeScenario].auto_suggestions.map(s => ({ icon: '💬', label: s, text: s }))
      : [
          { icon: '📸', label: 'Scan a menu',         isCamera: true },
          { icon: '🗣',  label: 'Teach me a phrase',  text: 'Teach me a useful local phrase for right now' },
          { icon: '🧭', label: "What's nearby?",      text: "What's interesting nearby that locals love?" },
        ];

  const hasStreamingContent = messages.some(m => m.metadata?.isStreaming && m.content.length > 0);
  const showTypingDots = isGenerating && !hasStreamingContent;

  const dialectIndicator = currentLocation?.dialectInfo
    ? `${countryFlag(currentLocation.countryCode)} ${currentLocation.dialectInfo.dialect}`
    : null;

  return (
    <div className="min-h-[calc(100vh-57px)] bg-background flex flex-col">
      {/* Character info bar */}
      <div className="flex items-center gap-3 px-6 py-2 border-b border-border bg-card/50">
        <button
          onClick={() => setShowProfile(!showProfile)}
          className="flex items-center gap-3 flex-1 hover:opacity-80 transition-opacity min-w-0"
        >
          <BlockyAvatar character={character} size="sm" animate={false} />
          <div className="text-left min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-foreground text-sm">{character.name}</p>
              {activeScenario && SCENARIOS[activeScenario] && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-primary/20 text-primary font-medium whitespace-nowrap">
                  {SCENARIOS[activeScenario].label}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {dialectIndicator ?? location}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onToggleTheme}
            className="p-2 hover:bg-muted/50 rounded-lg transition-colors"
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-muted-foreground" />
            ) : (
              <Moon className="w-5 h-5 text-muted-foreground" />
            )}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-muted/50 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Character profile card */}
      <AnimatePresence>
        {showProfile && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-border bg-card/50 overflow-hidden"
          >
            <div className="px-6 py-4 text-center">
              <BlockyAvatar character={character} size="md" animate={true} />
              <p className="mt-3 text-sm text-muted-foreground italic">
                "{character.personality}"
              </p>
              <button
                className="mt-3 text-sm text-secondary hover:underline"
                onClick={() => { setShowProfile(false); onRegenerate(); }}
              >
                Regenerate companion
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        {messages
          .filter(m => m.role !== 'system' && !(m.metadata?.isStreaming && m.content.length === 0))
          .map((message) => (
            <NewChatBubble
              key={message.id}
              type={message.role === 'user' ? 'user' : 'character'}
              content={message.content}
              character={message.role === 'character' ? character : undefined}
              phraseHighlight={message.phraseHighlight}
              showAvatar={message.showAvatar ?? false}
              onPhraseClick={message.phraseHighlight ? () => {
                if (message.phraseHighlight) {
                  setExpandedPhrase({
                    foreign:      message.phraseHighlight.text,
                    phonetic:     message.phraseHighlight.phonetic,
                    literal:      message.phraseHighlight.text,
                    natural:      message.phraseHighlight.text,
                    formality:    'casual' as const,
                    characterTip: 'Use this phrase confidently!',
                    alternatives: [],
                  });
                }
              } : undefined}
              onPhraseCardClick={handlePhraseCardClick}
              segments={message.metadata?.segments}
              isStreaming={message.metadata?.isStreaming ?? false}
              languageName={languageName}
            />
          ))}

        {showTypingDots && (
          <motion.div
            className="flex gap-3 mb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <BlockyAvatar character={character} size="xs" animate={false} />
            <div className="bg-card border-l-2 border-l-primary/30 border-y border-r border-border rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0, 0.2, 0.4].map((delay, i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 bg-primary rounded-full"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1, repeat: Infinity, delay }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* LLM error retry button */}
        {llmError && !isGenerating && (
          <motion.div
            className="flex justify-center mb-4"
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
      <div className="border-t border-border bg-card">
        {showQuickActions && (
          <div className="px-6 pt-3 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
            {pills.map((pill, idx) => (
              <QuickActionPill
                key={idx}
                icon={pill.icon}
                label={pill.label}
                onClick={pill.isCamera ? onOpenCamera : () => handleSend(pill.text)}
              />
            ))}
          </div>
        )}

        <div className="px-6 py-4 flex items-end gap-3">
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
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              onFocus={() => setShowQuickActions(false)}
              placeholder={`Ask ${character.name} anything...`}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
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
              className="px-4 py-3 bg-primary text-primary-foreground rounded-xl font-medium flex-shrink-0"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              whileTap={{ scale: 0.95 }}
            >
              Send
            </motion.button>
          )}
        </div>

        {!isSTTSupported() && (
          <p className="text-center text-xs text-muted-foreground pb-2">
            Voice input unavailable in this browser
          </p>
        )}
      </div>

      {/* Expanded phrase card modal */}
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

      {/* Settings panel */}
      <AnimatePresence>
        {showSettings && (
          <SettingsPanel
            onClose={() => setShowSettings(false)}
            onRegenerate={onRegenerate}
            onUpdateCharacter={onUpdateCharacter}
            onSaveUserProfile={onSaveUserProfile}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
