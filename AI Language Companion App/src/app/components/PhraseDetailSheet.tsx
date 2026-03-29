import React from 'react';
import { motion } from 'motion/react';
import { Check, X } from 'lucide-react';
import type { PhraseMastery } from '../../agent/core/types';

export interface PhraseDetailSheetPhrase {
  foreign: string;
  phonetic: string;
  meaning: string;
  context: string;
  history: boolean[];
  nextReview: string;
}

interface PhraseDetailSheetProps {
  phrase: PhraseDetailSheetPhrase;
  mastery: PhraseMastery;
  onClose: () => void;
  onPractice?: () => void;
}

const masteryLabels: Record<
  PhraseMastery,
  { label: string; color: string }
> = {
  new: { label: 'NEW', color: '#EF4444' },
  learning: { label: 'LEARNING', color: '#F59E0B' },
  practiced: { label: 'PRACTICED', color: '#6BBAA7' },
  mastered: { label: 'MASTERED', color: '#D4A853' },
};

export function PhraseDetailSheet({
  phrase,
  mastery,
  onClose,
  onPractice,
}: PhraseDetailSheetProps) {
  const masteryInfo = masteryLabels[mastery];
  const correctCount = phrase.history.filter(Boolean).length;

  return (
    <>
      <motion.div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-card border-t border-border rounded-t-3xl shadow-2xl max-h-[70vh] overflow-y-auto">
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1 bg-border rounded-full" />
          </div>

          <div className="px-6 pb-6">
            <div className="mb-4">
              <span
                className="inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wider"
                style={{
                  backgroundColor: `${masteryInfo.color}20`,
                  color: masteryInfo.color,
                }}
              >
                {masteryInfo.label}
              </span>
            </div>

            <h2 className="font-serif text-3xl text-foreground mb-2">
              {phrase.foreign}
            </h2>

            {phrase.phonetic ? (
              <p className="text-muted-foreground mb-2">{phrase.phonetic}</p>
            ) : null}

            <p className="text-lg text-foreground mb-6">&ldquo;{phrase.meaning}&rdquo;</p>

            <div className="h-px bg-border mb-6" />

            <div className="bg-muted/30 rounded-2xl p-4 mb-6">
              <p className="text-xs font-bold tracking-wider text-primary mb-2">
                WHEN TO USE
              </p>
              <p className="text-sm text-foreground/90 leading-relaxed">
                {phrase.context}
              </p>
            </div>

            {phrase.history.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex gap-1.5 flex-wrap">
                    {phrase.history.map((correct, idx) => (
                      <div
                        key={idx}
                        className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{
                          backgroundColor: correct ? '#6BBAA720' : '#EF444420',
                          border: `2px solid ${correct ? '#6BBAA7' : '#EF4444'}`,
                        }}
                      >
                        {correct ? (
                          <Check className="w-3 h-3" style={{ color: '#6BBAA7' }} />
                        ) : (
                          <X className="w-3 h-3" style={{ color: '#EF4444' }} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {correctCount} of {phrase.history.length} correct
                </p>
              </div>
            )}

            <div
              className="inline-block px-3 py-1.5 rounded-lg text-sm mb-6"
              style={{
                backgroundColor:
                  phrase.nextReview === 'Mastered' ? '#D4A85320' : '#F59E0B20',
                color: phrase.nextReview === 'Mastered' ? '#D4A853' : '#F59E0B',
              }}
            >
              {phrase.nextReview === 'Mastered'
                ? '✓ Mastered'
                : `⏰ ${phrase.nextReview}`}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 border border-border rounded-xl font-medium text-foreground hover:bg-muted/50 transition-colors"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  onPractice?.();
                  onClose();
                }}
                className="flex-1 px-6 py-3 text-background rounded-xl font-medium hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#D4A853' }}
              >
                Practice Now
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
