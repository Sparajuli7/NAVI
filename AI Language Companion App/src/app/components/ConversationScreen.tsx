import React, { useState, useRef, useEffect } from 'react';
import { Settings, Sun, Moon, Camera, Mic, MoreVertical } from 'lucide-react';
import { NewChatBubble } from './NewChatBubble';
import { BlockyAvatar } from './BlockyAvatar';
import { QuickActionPill } from './QuickActionPill';
import { ExpandedPhraseCard } from './ExpandedPhraseCard';
import { AnimatePresence, motion } from 'motion/react';

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

const initialMessages = [
  {
    id: '1',
    type: 'character' as const,
    content: "Hey! I'm your companion 🏄‍♂️ I know this city inside out. Street food stalls near Bến Thành are firing up right now — want me to help you navigate a menu, teach you some phrases, or just tell you what's good around here?",
    showAvatar: true,
  },
  {
    id: '2',
    type: 'user' as const,
    content: "How do I ask for the bill at a restaurant?",
  },
  {
    id: '3',
    type: 'character' as const,
    content: "In Vietnam you'd say:",
    phraseHighlight: {
      text: "Tính tiền giùm",
      phonetic: "Tin tee-en zoom"
    },
    showAvatar: true,
  },
  {
    id: '4',
    type: 'character' as const,
    content: "But honestly, most locals just do a writing-in-the-air gesture ✍️ and make eye contact. Way more natural.",
  },
  {
    id: '5',
    type: 'user' as const,
    content: "What about tipping?",
  },
  {
    id: '6',
    type: 'character' as const,
    content: "Not a thing here! Leave money on the table and the server might chase you thinking you forgot it 😄 Just pay what's on the bill.",
    showAvatar: true,
  },
];

export function ConversationScreen({ character, location, onOpenCamera, onToggleTheme, isDark }: ConversationScreenProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [expandedPhrase, setExpandedPhrase] = useState<any>(null);
  const [showProfile, setShowProfile] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      type: 'user' as const,
      content: inputValue,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);
    setShowQuickActions(false);

    setTimeout(() => {
      const characterMessage = {
        id: (Date.now() + 1).toString(),
        type: 'character' as const,
        content: "That's a great question! Vietnamese culture has fascinating nuances around that. Let me explain...",
        showAvatar: true,
      };
      setMessages(prev => [...prev, characterMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const handlePhraseClick = () => {
    setExpandedPhrase({
      foreign: "Tính tiền giùm",
      phonetic: "Tin tee-en zoom",
      literal: "Calculate money help",
      natural: "Can I get the bill?",
      formality: 'casual' as const,
      characterTip: "Say this with a smile and you're golden. For fancier places, add 'cho tôi' at the start for extra politeness.",
      alternatives: [
        "Tính tiền cho tôi (more polite)",
        "Bill please (English works in tourist areas)"
      ]
    });
  };

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
        {messages.map((message, index) => (
          <NewChatBubble
            key={message.id}
            type={message.type}
            content={message.content}
            character={message.type === 'character' ? character : undefined}
            phraseHighlight={message.type === 'character' ? (message as any).phraseHighlight : undefined}
            showAvatar={(message as any).showAvatar || false}
            onPhraseClick={handlePhraseClick}
          />
        ))}

        {isTyping && (
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
            <QuickActionPill
              icon="📸"
              label="Scan a menu"
              onClick={onOpenCamera}
            />
            <QuickActionPill
              icon="🗣"
              label="Teach me a phrase"
              onClick={() => {}}
            />
            <QuickActionPill
              icon="🧭"
              label="What's nearby?"
              onClick={() => {}}
            />
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

          <button className="p-2.5 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors flex-shrink-0">
            <Mic className="w-5 h-5 text-primary" />
          </button>

          {inputValue.trim() && (
            <motion.button
              onClick={handleSend}
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
            onClose={() => setExpandedPhrase(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
