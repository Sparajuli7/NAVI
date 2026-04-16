import React, { useState } from 'react';
import { CharacterAvatar } from './CharacterAvatar';
import { Volume2 } from 'lucide-react';
import { motion } from 'motion/react';
import { speakPhrase } from '../../services/tts';
import type { ParsedSegment, PhraseCardData, Message, PhraseHighlight } from '../../types/chat';
import type { GeneratedCharacter } from '../../types/character';
import { stripInlineMarkdown } from '../../utils/responseParser';

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

// ─── Error detection helper ────────────────────────────────────────────────

function isNaviError(content: string): boolean {
  return content.startsWith('NAVI is experiencing') ||
         content.startsWith('OpenRouter error') ||
         content.startsWith('OpenRouter request timed out');
}

// ─── Shared phrase card renderer ───────────────────────────────────────────

function PhraseCardFull({
  data,
  languageName,
  onPhraseCardClick,
}: {
  data: PhraseCardData;
  languageName: string;
  onPhraseCardClick?: (d: PhraseCardData) => void;
}) {
  return (
    <motion.button
      className="w-full bg-primary/10 border border-primary/30 rounded-xl p-4 space-y-2 text-left hover:bg-primary/15 transition-colors"
      onClick={() => onPhraseCardClick?.(data)}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center justify-between">
        <p className="text-lg font-medium text-foreground">{data.phrase}</p>
        <button
          className="p-1.5 hover:bg-primary/20 rounded-lg transition-colors"
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); speakPhrase(data.phrase, languageName); }}
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
}

function PhraseCardCompact({
  data,
  onPhraseCardClick,
}: {
  data: PhraseCardData;
  onPhraseCardClick?: (d: PhraseCardData) => void;
}) {
  return (
    <button
      className="inline-flex items-center gap-1.5 text-xs text-primary font-medium bg-primary/10 rounded-lg px-2 py-1 hover:bg-primary/20 transition-colors"
      onClick={() => onPhraseCardClick?.(data)}
    >
      <Volume2 className="w-3 h-3" />
      {data.phrase} · <span className="italic opacity-70">{data.phonetic}</span>
    </button>
  );
}

// ─── SpeechBubble ─────────────────────────────────────────────────────────
// Shown in the avatar zone as the character's active speech.
// Has a left-pointing "tail" (via rounded-tl-none + small diamond connector).
// Expandable if content > 220 chars.

const EXPAND_THRESHOLD = 220;

interface SpeechBubbleProps {
  message: Message;
  character?: GeneratedCharacter;
  languageName?: string;
  onPhraseCardClick?: (data: PhraseCardData) => void;
}

export function SpeechBubble({
  message,
  languageName = 'English',
  onPhraseCardClick,
}: SpeechBubbleProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isStreaming = message.metadata?.isStreaming ?? false;
  const segments = message.metadata?.segments;
  const hasSegments = segments && segments.length > 0 && !isStreaming;

  const isLong = !hasSegments && message.content.length > EXPAND_THRESHOLD;
  const showFull = isExpanded || !isLong;
  const displayContent = stripInlineMarkdown(
    showFull ? message.content : message.content.slice(0, EXPAND_THRESHOLD) + '…'
  );

  return (
    <motion.div
      className="relative ml-3"
      initial={{ opacity: 0, x: 8, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -8, scale: 0.94 }}
      transition={{ duration: 0.2 }}
    >
      {/* Diamond connector pointing left toward avatar */}
      <div
        className="absolute -left-[7px] top-4 w-3.5 h-3.5 bg-card border-l border-b border-border"
        style={{ transform: 'rotate(45deg)' }}
      />

      {/* Bubble body */}
      <div className="bg-card border border-border rounded-2xl rounded-tl-none px-4 py-3 shadow-md">
        {isNaviError(displayContent) ? (
          <p className="text-sm text-amber-400 flex items-start gap-1.5">
            <span>⚠️</span>
            <span>NAVI is experiencing high demand right now. Please try again in a moment.</span>
          </p>
        ) : hasSegments ? (
          <div className="space-y-3">
            {segments.map((seg, idx) => (
              <React.Fragment key={idx}>
                {seg.type === 'phrase_card' && seg.data ? (
                  <PhraseCardFull
                    data={seg.data}
                    languageName={languageName}
                    onPhraseCardClick={onPhraseCardClick}
                  />
                ) : (
                  <p
                    className="text-foreground italic leading-relaxed text-sm"
                    style={{ fontFamily: 'var(--font-character)' }}
                  >
                    {stripInlineMarkdown(seg.content)}
                  </p>
                )}
              </React.Fragment>
            ))}
          </div>
        ) : (
          <>
            <p
              className="text-foreground italic leading-relaxed text-sm"
              style={{ fontFamily: 'var(--font-character)' }}
            >
              {displayContent}
              {isStreaming && (
                <span className="inline-block w-0.5 h-4 bg-primary/60 ml-1 animate-pulse align-middle" />
              )}
            </p>
            {isLong && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-2 text-xs text-primary/70 hover:text-primary underline-offset-2 underline"
              >
                {isExpanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

// ─── ThoughtBubble ────────────────────────────────────────────────────────
// Shown in the avatar zone while the character is thinking/generating.
// Dashed border + animated dots + small chain of circles on the left.

export function ThoughtBubble() {
  return (
    <motion.div
      className="relative ml-3"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
    >
      {/* Thought chain – small circles pointing left toward the avatar */}
      <div className="absolute -left-5 top-5 flex flex-col items-center gap-1 pointer-events-none">
        <div className="w-1.5 h-1.5 rounded-full bg-border" />
        <div className="w-2 h-2 rounded-full bg-border/70" />
      </div>

      {/* Thought bubble body */}
      <div className="bg-card/80 border-2 border-dashed border-primary/40 rounded-3xl px-5 py-3 shadow-sm">
        <div className="flex gap-2 items-center">
          {[0, 0.18, 0.36].map((delay, i) => (
            <motion.div
              key={i}
              className="w-2.5 h-2.5 bg-primary/50 rounded-full"
              animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.7, repeat: Infinity, delay, ease: 'easeInOut' }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── ChatLogEntry ─────────────────────────────────────────────────────────
// Compact history entry used in the scrollable chat log below the avatar zone.
// User messages: right-aligned small pill.
// Character messages: left-aligned with tiny avatar, compact bubble.

interface ChatLogEntryProps {
  message: Message;
  character?: GeneratedCharacter;
  languageName?: string;
  onPhraseCardClick?: (data: PhraseCardData) => void;
}

export function ChatLogEntry({
  message,
  character,
  languageName: _languageName = 'English',
  onPhraseCardClick,
}: ChatLogEntryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (message.role === 'user') {
    return (
      <motion.div
        className="flex justify-end mb-2"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="bg-muted/60 rounded-2xl rounded-tr-sm px-3 py-2 max-w-[75%]">
          <p className="text-foreground/80 text-sm">{message.content}</p>
        </div>
      </motion.div>
    );
  }

  // Character log entry
  const isStreaming = message.metadata?.isStreaming ?? false;
  const segments = message.metadata?.segments;
  const hasSegments = segments && segments.length > 0 && !isStreaming;

  const isLong = !hasSegments && message.content.length > EXPAND_THRESHOLD;
  const showFull = isExpanded || !isLong;
  const displayContent = stripInlineMarkdown(
    showFull ? message.content : message.content.slice(0, EXPAND_THRESHOLD) + '…'
  );

  return (
    <motion.div
      className="flex items-start gap-2 mb-2"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {character && (
        <div className="flex-shrink-0 mt-0.5">
          <CharacterAvatar character={character} size="xs" animationState="none" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="bg-card/60 border border-border/50 rounded-xl rounded-tl-sm px-3 py-2">
          {isNaviError(displayContent) ? (
            <p className="text-sm text-amber-400 flex items-start gap-1.5">
              <span>⚠️</span>
              <span>NAVI is experiencing high demand right now. Please try again in a moment.</span>
            </p>
          ) : hasSegments ? (
            <div className="space-y-2">
              {segments.map((seg, idx) => (
                <React.Fragment key={idx}>
                  {seg.type === 'phrase_card' && seg.data ? (
                    <PhraseCardCompact
                      data={seg.data}
                      onPhraseCardClick={onPhraseCardClick}
                    />
                  ) : (
                    <p
                      className="text-foreground/70 text-sm italic leading-relaxed"
                      style={{ fontFamily: 'var(--font-character)' }}
                    >
                      {stripInlineMarkdown(seg.content)}
                    </p>
                  )}
                </React.Fragment>
              ))}
            </div>
          ) : (
            <>
              <p
                className="text-foreground/70 text-sm italic leading-relaxed"
                style={{ fontFamily: 'var(--font-character)' }}
              >
                {displayContent}
                {isStreaming && (
                  <span className="inline-block w-0.5 h-3.5 bg-primary/50 ml-1 animate-pulse align-middle" />
                )}
              </p>
              {isLong && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="mt-1 text-xs text-primary/60 hover:text-primary underline"
                >
                  {isExpanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── NewChatBubble ────────────────────────────────────────────────────────
// Original component kept for backward compatibility.

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
    <React.Fragment key={idx}>
      <PhraseCardFull
        data={data}
        languageName={languageName}
        onPhraseCardClick={onPhraseCardClick}
      />
    </React.Fragment>
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
          <CharacterAvatar character={character} size="xs" animationState="none" />
        </div>
      )}
      {!showAvatar && <div className="w-8" />}

      <div className="flex-1 max-w-[75%]">
        <div className="bg-card border-l-2 border-l-primary/30 border-y border-r border-border rounded-2xl rounded-tl-sm px-4 py-3">
          {hasSegments ? (
            <div className="space-y-3">
              {segments.map((seg, idx) =>
                seg.type === 'phrase_card' && seg.data ? (
                  renderPhraseCard(seg.data, idx)
                ) : (
                  <p key={idx} className="text-foreground italic leading-relaxed" style={{ fontFamily: 'var(--font-character)' }}>
                    {stripInlineMarkdown(seg.content)}
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
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); speakPhrase(phraseHighlight.text, languageName); }}
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
              {stripInlineMarkdown(content)}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
