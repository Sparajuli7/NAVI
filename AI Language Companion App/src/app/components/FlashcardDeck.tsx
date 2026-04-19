/**
 * FlashcardDeck — Spaced repetition phrase review UI
 *
 * Shows TrackedPhrase cards in a scrollable deck. Each card shows:
 * - The phrase (large, serif font)
 * - Mastery badge with color coding
 * - Struggle/success history
 * - Next review date
 * - "Practice" button
 *
 * Click a card to flip it and see pronunciation, meaning, and usage tip.
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, XCircle, Clock, Volume2, RefreshCw, X } from 'lucide-react';
import type { TrackedPhrase, PhraseMastery, FilterMode } from '../../agent/core/types';

// ─── Types ──────────────────────────────────────────────────────

interface FlashcardDeckProps {
  phrases: TrackedPhrase[];
  onPractice?: (phrase: TrackedPhrase) => void;
  onClose?: () => void;
  filter?: FilterMode;
}

// ─── Helpers ────────────────────────────────────────────────────

const MASTERY_COLORS: Record<PhraseMastery, string> = {
  new: 'text-red-400 bg-red-400/10 border-red-400/30',
  learning: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  practiced: 'text-teal-400 bg-teal-400/10 border-teal-400/30',
  mastered: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30',
};

const MASTERY_DOT: Record<PhraseMastery, string> = {
  new: 'bg-red-400',
  learning: 'bg-amber-400',
  practiced: 'bg-teal-400',
  mastered: 'bg-yellow-500',
};

function formatNextReview(nextReviewAt: number): string {
  const diff = nextReviewAt - Date.now();
  if (diff <= 0) return 'Due now!';
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const mins = Math.floor(diff / (60 * 1000));
  if (days >= 1) return `Review in ${days}d`;
  if (hours >= 1) return `Review in ${hours}h`;
  return `Review in ${mins}m`;
}

function isDue(phrase: TrackedPhrase): boolean {
  return phrase.nextReviewAt <= Date.now() && phrase.mastery !== 'mastered';
}

// ─── FlashCard (single card) ────────────────────────────────────

interface FlashCardProps {
  phrase: TrackedPhrase;
  onPractice?: (phrase: TrackedPhrase) => void;
}

function FlashCard({ phrase, onPractice }: FlashCardProps) {
  const [flipped, setFlipped] = useState(false);

  const struggleCount = phrase.struggleCount ?? 0;
  const successCount = Math.max(0, phrase.attemptCount - struggleCount);
  const due = isDue(phrase);

  return (
    <div
      className="relative cursor-pointer select-none"
      style={{ perspective: '1000px', minHeight: '220px' }}
      onClick={() => setFlipped((f) => !f)}
    >
      <motion.div
        style={{
          transformStyle: 'preserve-3d',
          position: 'relative',
          width: '100%',
          minHeight: '220px',
        }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.45, ease: 'easeInOut' }}
      >
        {/* ── Front face ─────────────────────────────────────────── */}
        <div
          style={{ backfaceVisibility: 'hidden' }}
          className="absolute inset-0 rounded-2xl border border-white/10 bg-[#12121A] p-5 flex flex-col gap-3"
        >
          {/* Top row: mastery badge + language */}
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full border ${MASTERY_COLORS[phrase.mastery]}`}
            >
              {phrase.mastery}
            </span>
            <span className="text-xs text-white/30 uppercase tracking-widest">
              {phrase.language}
            </span>
          </div>

          {/* Phrase (large, serif) */}
          <div className="flex-1 flex items-center justify-center py-2">
            <p className="font-serif text-2xl text-center text-[#F5F0EB] leading-snug">
              {phrase.phrase}
            </p>
          </div>

          {/* Bottom row: struggle indicator + next review + dot */}
          <div className="flex items-center justify-between gap-2 mt-auto">
            <div className="flex items-center gap-3">
              {struggleCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-red-400">
                  <XCircle className="w-3.5 h-3.5" />
                  {struggleCount}
                </span>
              )}
              {successCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-teal-400">
                  <CheckCircle className="w-3.5 h-3.5" />
                  {successCount}
                </span>
              )}
            </div>

            <span
              className={`flex items-center gap-1 text-xs ${
                due ? 'text-[#D4A853] font-semibold' : 'text-white/40'
              }`}
            >
              <Clock className="w-3 h-3" />
              {formatNextReview(phrase.nextReviewAt)}
            </span>

            <span className={`w-2 h-2 rounded-full ${MASTERY_DOT[phrase.mastery]}`} />
          </div>

          {/* Context snippet */}
          {phrase.learnedAt && (
            <p className="text-xs text-white/25 truncate">
              Learned in {phrase.learnedAt}
            </p>
          )}

          {/* Practice button */}
          <button
            className="mt-1 w-full py-2 rounded-xl bg-[#D4A853]/10 hover:bg-[#D4A853]/20 border border-[#D4A853]/30 text-[#D4A853] text-sm font-medium transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onPractice?.(phrase);
            }}
          >
            Practice
          </button>
        </div>

        {/* ── Back face ──────────────────────────────────────────── */}
        <div
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
          className="absolute inset-0 rounded-2xl border border-[#6BBAA7]/20 bg-[#0D0D14] p-5 flex flex-col gap-4"
        >
          {/* Phrase (smaller, at top) */}
          <p className="font-serif text-lg text-[#F5F0EB]/80 text-center">{phrase.phrase}</p>

          {/* Pronunciation */}
          {phrase.pronunciation && (
            <div className="flex items-start gap-2">
              <Volume2 className="w-4 h-4 text-[#6BBAA7] mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-white/40 mb-0.5">Pronunciation</p>
                <p className="text-sm text-[#6BBAA7]">{phrase.pronunciation}</p>
              </div>
            </div>
          )}

          {/* Meaning */}
          {phrase.meaning && (
            <div>
              <p className="text-xs text-white/40 mb-0.5">Meaning</p>
              <p className="text-sm text-[#F5F0EB]/90">{phrase.meaning}</p>
            </div>
          )}

          {/* Usage tip */}
          <div>
            <p className="text-xs text-white/40 mb-0.5">Use this when...</p>
            <p className="text-xs text-white/50">
              {phrase.learnedAt
                ? `You heard this while in ${phrase.learnedAt}.`
                : 'Practice using this in context with your companion.'}
            </p>
          </div>

          {/* Struggle history */}
          {struggleCount > 0 && (
            <div className="flex items-center gap-1.5 mt-auto">
              <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <p className="text-xs text-red-400/80">
                Struggled {struggleCount} time{struggleCount > 1 ? 's' : ''} — keep at it!
              </p>
            </div>
          )}

          {/* Flip back hint */}
          <p className="text-xs text-white/20 text-center mt-auto">Tap to flip back</p>
        </div>
      </motion.div>
    </div>
  );
}

// ─── FlashcardDeck ──────────────────────────────────────────────

export function FlashcardDeck({
  phrases,
  onPractice,
  onClose,
  filter: initialFilter = 'all',
}: FlashcardDeckProps) {
  const [activeFilter, setActiveFilter] = useState<FilterMode>(initialFilter);

  const now = Date.now();

  const counts = useMemo(
    () => ({
      all: phrases.length,
      struggling: phrases.filter((p) => (p.struggleCount ?? 0) > 0).length,
      due: phrases.filter((p) => p.nextReviewAt <= now && p.mastery !== 'mastered').length,
      mastered: phrases.filter((p) => p.mastery === 'mastered').length,
    }),
    [phrases, now],
  );

  const filtered = useMemo(() => {
    switch (activeFilter) {
      case 'struggling':
        return phrases.filter((p) => (p.struggleCount ?? 0) > 0);
      case 'due':
        return phrases.filter((p) => p.nextReviewAt <= now && p.mastery !== 'mastered');
      case 'mastered':
        return phrases.filter((p) => p.mastery === 'mastered');
      default:
        return phrases;
    }
  }, [phrases, activeFilter, now]);

  const FILTERS: { key: FilterMode; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'struggling', label: 'Struggling' },
    { key: 'due', label: 'Due Now' },
    { key: 'mastered', label: 'Mastered' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0A0A0F] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
        <div>
          <h2 className="font-serif text-lg text-[#F5F0EB]">Phrase Deck</h2>
          <p className="text-xs text-white/40">{phrases.length} phrases tracked</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 px-5 pb-4 overflow-x-auto scrollbar-none shrink-0">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveFilter(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
              activeFilter === key
                ? 'bg-[#D4A853]/15 text-[#D4A853] border-[#D4A853]/40'
                : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10'
            }`}
          >
            {label}
            <span
              className={`text-xs rounded-full px-1.5 py-0.5 ${
                activeFilter === key ? 'bg-[#D4A853]/20 text-[#D4A853]' : 'bg-white/10 text-white/40'
              }`}
            >
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-16 gap-3 text-white/30"
            >
              <RefreshCw className="w-8 h-8" />
              <p className="text-sm">No phrases in this filter</p>
            </motion.div>
          ) : (
            filtered.map((phrase) => (
              <motion.div
                key={`${phrase.phrase}-${phrase.language}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <FlashCard phrase={phrase} onPractice={onPractice} />
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default FlashcardDeck;
