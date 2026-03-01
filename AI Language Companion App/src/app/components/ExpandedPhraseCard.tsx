import React from 'react';
import { motion } from 'motion/react';
import { Volume2, Mic, Bookmark, X } from 'lucide-react';

interface ExpandedPhraseCardProps {
  phrase: {
    foreign: string;
    phonetic: string;
    literal: string;
    natural: string;
    formality: 'casual' | 'neutral' | 'formal';
    characterTip: string;
    alternatives?: string[];
  };
  characterName: string;
  onClose: () => void;
}

export function ExpandedPhraseCard({ phrase, characterName, onClose }: ExpandedPhraseCardProps) {
  const formalityPosition = phrase.formality === 'casual' ? 20 : phrase.formality === 'formal' ? 80 : 50;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-md bg-background/95 backdrop-blur-xl rounded-t-3xl border-t border-border max-h-[75vh] overflow-y-auto"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur-xl border-b border-border px-6 py-4 flex items-center justify-between">
          <h3 className="font-medium text-foreground">Phrase Details</h3>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-muted/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-6 space-y-6">
          {/* Main phrase */}
          <div className="text-center">
            <p className="text-3xl font-medium text-foreground mb-3">
              {phrase.foreign}
            </p>
            <p className="text-muted-foreground text-lg italic mb-6">
              {phrase.phonetic}
            </p>

            {/* Audio and practice buttons */}
            <div className="flex gap-3 justify-center mb-6">
              <button className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:shadow-[0_0_20px_rgba(212,168,83,0.3)] transition-all">
                <Volume2 className="w-5 h-5" />
                <span>Listen</span>
              </button>
              <button className="flex items-center gap-2 px-6 py-3 border border-border text-foreground rounded-xl font-medium hover:border-primary/30 transition-colors">
                <Mic className="w-5 h-5" />
                <span>Practice</span>
              </button>
            </div>
          </div>

          {/* Translations */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Literal Translation
              </p>
              <p className="text-foreground">{phrase.literal}</p>
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Natural Translation
              </p>
              <p className="text-foreground font-medium">{phrase.natural}</p>
            </div>
          </div>

          {/* Formality indicator */}
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
              Formality Level
            </p>
            <div className="relative">
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span>Casual</span>
                <span>Formal</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-secondary to-primary transition-all"
                  style={{ width: `${formalityPosition}%` }}
                />
              </div>
              <div 
                className="absolute -top-1 w-4 h-4 bg-primary rounded-full border-2 border-background shadow-lg transition-all"
                style={{ left: `calc(${formalityPosition}% - 8px)` }}
              />
            </div>
          </div>

          {/* Character tip */}
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
            <p className="text-xs text-primary uppercase tracking-wide mb-2 font-medium">
              {characterName}'s tip
            </p>
            <p 
              className="text-foreground italic leading-relaxed"
              style={{ fontFamily: 'var(--font-character)' }}
            >
              {phrase.characterTip}
            </p>
          </div>

          {/* Alternative phrasings */}
          {phrase.alternatives && phrase.alternatives.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-3">
                Other ways to say it:
              </p>
              <div className="space-y-2">
                {phrase.alternatives.map((alt, index) => (
                  <div 
                    key={index}
                    className="bg-card border border-border rounded-lg px-4 py-3 text-sm text-foreground"
                  >
                    {alt}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save button */}
          <button className="w-full flex items-center justify-center gap-2 px-6 py-3 border border-border text-foreground rounded-xl font-medium hover:border-primary/30 transition-colors">
            <Bookmark className="w-5 h-5" />
            <span>Save phrase</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
