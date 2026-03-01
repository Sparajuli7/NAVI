import React, { useState, useRef, useEffect } from 'react';
import { Settings, Sun, Moon, Camera, Mic } from 'lucide-react';
import { NewChatBubble } from './NewChatBubble';
import { BlockyAvatar } from './BlockyAvatar';
import { QuickActionPill } from './QuickActionPill';
import { ExpandedPhraseCard } from './ExpandedPhraseCard';
import { AnimatePresence, motion } from 'motion/react';
import { useChatStore } from '../../stores/chatStore';
import { useCharacterStore } from '../../stores/characterStore';
import { useAppStore } from '../../stores/appStore';
import { streamMessage, generateMemorySummary } from '../../services/llm';
import { buildSystemPrompt } from '../../prompts/systemBuilder';
import { buildMessages } from '../../utils/contextManager';
import { parseResponse } from '../../utils/responseParser';
import { saveConversation, saveMemories } from '../../utils/storage';
import { startRecording, stopRecording, isSTTSupported } from '../../services/stt';
import type { Message, PhraseCardData } from '../../types/chat';
import type { ScenarioKey } from '../../types/config';
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

export function ConversationScreen({ character, location, onOpenCamera, onToggleTheme, isDark }: ConversationScreenProps) {
  const [inputValue, setInputValue]   = useState('');
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [expandedPhrase, setExpandedPhrase]     = useState<any>(null);
  const [showProfile, setShowProfile]           = useState(false);
  const [isRecording, setIsRecording]           = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, isGenerating, activeScenario, addMessage, updateLastMessage, setGenerating, setScenario } = useChatStore();
  const { activeCharacter, memories, addMemory } = useCharacterStore();
  const { userPreferences, currentLocation }     = useAppStore();

  // Language name for TTS/STT
  const languageName = currentLocation?.dialectInfo?.language ?? 'English';

  // Auto-scroll on new messages or typing state change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  const handleSend = async (textOverride?: string) => {
    const msgText = (textOverride ?? inputValue).trim();
    if (!msgText || isGenerating) return;

    const richChar = activeCharacter;
    if (!richChar) return;

    // Scenario detection
    const detected = detectScenario(msgText);
    if (detected) setScenario(detected);

    // Snapshot history BEFORE adding the new user message
    const historySnapshot = useChatStore.getState().messages;

    // Add user message to store
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: msgText,
      type: 'text',
      timestamp: Date.now(),
    };
    addMessage(userMsg);
    setInputValue('');
    setGenerating(true);
    setShowQuickActions(false);

    // Add empty streaming placeholder (filtered out of render until first token)
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
      const systemPrompt = buildSystemPrompt(
        richChar,
        userPreferences,
        currentLocation,
        detected ?? activeScenario,
        memories,
      );

      // Build LLM message list from history snapshot + new user message
      const llmMessages = buildMessages(systemPrompt, historySnapshot, msgText);

      let fullText = '';
      await streamMessage(llmMessages, undefined, (_token, text) => {
        fullText = text;
        updateLastMessage(fullText, false);
      });

      // Parse phrase cards and finalize the streaming message
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

      // Persist conversation
      const allMessages = useChatStore.getState().messages;
      await saveConversation(allMessages);

      // Background memory generation every 5 user messages
      const userMsgCount = allMessages.filter(m => m.role === 'user').length;
      if (userMsgCount > 0 && userMsgCount % 5 === 0) {
        const recentLLMMessages = buildMessages(systemPrompt, allMessages.slice(-10), '');
        generateMemorySummary(recentLLMMessages)
          .then(async (newMemories) => {
            newMemories.forEach(m => addMemory(m));
            await saveMemories(useCharacterStore.getState().memories);
          })
          .catch(() => {});
      }
    } catch {
      updateLastMessage("Sorry, I couldn't process that. Try again!", true);
    } finally {
      setGenerating(false);
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

  // Mic: hold to record
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

  // Scenario-aware quick action pills
  const pills: Array<{ icon: string; label: string; isCamera?: boolean; text?: string }> =
    activeScenario && SCENARIOS[activeScenario]
      ? SCENARIOS[activeScenario].auto_suggestions.map(s => ({ icon: '💬', label: s, text: s }))
      : [
          { icon: '📸', label: 'Scan a menu',         isCamera: true },
          { icon: '🗣',  label: 'Teach me a phrase',  text: 'Teach me a useful local phrase for right now' },
          { icon: '🧭', label: "What's nearby?",      text: "What's interesting nearby that locals love?" },
        ];

  // Only show typing dots when generating but no streaming content yet
  const hasStreamingContent = messages.some(m => m.metadata?.isStreaming && m.content.length > 0);
  const showTypingDots = isGenerating && !hasStreamingContent;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-card sticky top-0 z-10">
        <button
          onClick={() => setShowProfile(!showProfile)}
          className="flex items-center gap-3 flex-1 hover:opacity-80 transition-opacity"
        >
          <BlockyAvatar
            character={character}
            size="sm"
            animate={false}
          />
          <div className="text-left">
            <p className="font-medium text-foreground">{character.name}</p>
            <p className="text-xs text-muted-foreground">{location}</p>
          </div>
        </button>

        <div className="flex items-center gap-2">
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
          <button className="p-2 hover:bg-muted/50 rounded-lg transition-colors">
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
              <BlockyAvatar
                character={character}
                size="md"
                animate={true}
              />
              <p className="mt-3 text-sm text-muted-foreground italic">
                "{character.personality}"
              </p>
              <button className="mt-3 text-sm text-secondary hover:underline">
                Regenerate companion
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-6"
      >
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
            <BlockyAvatar
              character={character}
              size="xs"
              animate={false}
            />
            <div className="bg-card border-l-2 border-l-primary/30 border-y border-r border-border rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                <motion.div
                  className="w-2 h-2 bg-primary rounded-full"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                />
                <motion.div
                  className="w-2 h-2 bg-primary rounded-full"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                />
                <motion.div
                  className="w-2 h-2 bg-primary rounded-full"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border bg-card">
        {/* Quick action pills */}
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

          <button
            className={`p-2.5 rounded-lg transition-colors flex-shrink-0 ${isRecording ? 'bg-primary' : 'bg-primary/10 hover:bg-primary/20'}`}
            onPointerDown={handleMicDown}
            onPointerUp={handleMicUp}
            onPointerLeave={handleMicUp}
          >
            <Mic className={`w-5 h-5 ${isRecording ? 'text-primary-foreground' : 'text-primary'}`} />
          </button>

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
    </div>
  );
}
