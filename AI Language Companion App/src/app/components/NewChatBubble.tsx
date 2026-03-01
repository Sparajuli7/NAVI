import React from 'react';
import { BlockyAvatar } from './BlockyAvatar';
import { Volume2 } from 'lucide-react';
import { motion } from 'motion/react';
import { speakPhrase } from '../../services/tts';
import type { ParsedSegment, PhraseCardData } from '../../types/chat';

interface PhraseHighlight {
  text: string;
  phonetic: string;
}

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

interface NewChatBubbleProps {
  type: 'user' | 'character';
  content: string;
  character?: GeneratedCharacter;
  phraseHighlight?: PhraseHighlight;
  showAvatar?: boolean;
  onPhraseClick?: () => void;
  onPhraseCardClick?: (data: PhraseCardData) => void;
  segments?: ParsedSegment[];
  isStreaming?: boolean;
  languageName?: string;
}

export function NewChatBubble({
  type,
  content,
  character,
  phraseHighlight,
  showAvatar = false,
  onPhraseClick,
  onPhraseCardClick,
  segments,
  isStreaming = false,
  languageName = 'English',
}: NewChatBubbleProps) {
  if (type === 'user') {
    return (
      <motion.div
        className="flex justify-end mb-4"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <div className="bg-card border border-border rounded-2xl rounded-tr-sm px-4 py-3 max-w-[75%]">
          <p className="text-foreground">{content}</p>
        </div>
      </motion.div>
    );
  }

  const renderPhraseCard = (data: PhraseCardData, idx: number) => (
    <motion.button
      key={idx}
      className="w-full bg-primary/10 border border-primary/30 rounded-xl p-4 space-y-2 text-left hover:bg-primary/15 transition-colors"
      onClick={() => onPhraseCardClick?.(data)}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center justify-between">
        <p className="text-lg font-medium text-foreground">{data.phrase}</p>
        <button
          className="p-1.5 hover:bg-primary/20 rounded-lg transition-colors"
          onClick={(e) => { e.stopPropagation(); speakPhrase(data.phrase, languageName); }}
        >
          <Volume2 className="w-4 h-4 text-primary" />
        </button>
      </div>
      <p className="text-sm text-muted-foreground">
        Phonetic: <span className="italic">{data.phonetic}</span>
      </p>
      {data.soundTip && (
        <p className="text-sm text-teal-400/90 italic">{data.soundTip}</p>
      )}
      <p className="text-xs text-primary/70 mt-2">Tap to learn more</p>
    </motion.button>
  );

  const hasSegments = segments && segments.length > 0 && !isStreaming;

  return (
    <motion.div
      className="flex gap-3 mb-4"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
    >
      {showAvatar && character && (
        <div className="flex-shrink-0">
          <BlockyAvatar
            character={character}
            size="xs"
            animate={false}
          />
        </div>
      )}
      {!showAvatar && <div className="w-7" />}

      <div className="flex-1 max-w-[75%]">
        <div className="bg-card border-l-2 border-l-primary/30 border-y border-r border-border rounded-2xl rounded-tl-sm px-4 py-3">
          {hasSegments ? (
            <div className="space-y-3">
              {segments.map((seg, idx) =>
                seg.type === 'phrase_card' && seg.data ? (
                  renderPhraseCard(seg.data, idx)
                ) : (
                  <p key={idx} className="text-foreground italic leading-relaxed" style={{ fontFamily: 'var(--font-character)' }}>
                    {seg.content}
                  </p>
                )
              )}
            </div>
          ) : phraseHighlight ? (
            <div className="space-y-3">
              <p className="text-foreground italic leading-relaxed" style={{ fontFamily: 'var(--font-character)' }}>
                {content}
              </p>
              <motion.button
                className="w-full bg-primary/10 border border-primary/30 rounded-xl p-4 space-y-2 text-left hover:bg-primary/15 transition-colors"
                onClick={onPhraseClick}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-lg font-medium text-foreground">{phraseHighlight.text}</p>
                  <button
                    className="p-1.5 hover:bg-primary/20 rounded-lg transition-colors"
                    onClick={(e) => { e.stopPropagation(); speakPhrase(phraseHighlight.text, languageName); }}
                  >
                    <Volume2 className="w-4 h-4 text-primary" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Phonetic: <span className="italic">{phraseHighlight.phonetic}</span>
                </p>
                <p className="text-xs text-primary/70 mt-2">Tap to learn more</p>
              </motion.button>
            </div>
          ) : (
            <p className="text-foreground italic leading-relaxed" style={{ fontFamily: 'var(--font-character)' }}>
              {content}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
