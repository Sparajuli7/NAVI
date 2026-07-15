import React from 'react';
import { Volume2 } from 'lucide-react';
import { speakPhrase } from '../services/tts';
import { stripThinkTags } from './responseParser';

const PHRASE_CARD_LABELS = /^(Phrase|Say it|Means|Sound tip|Tip):$/i;

type ChipSegment =
  | { type: 'text'; content: string }
  | { type: 'chip'; phrase: string; phonetic?: string };

/** Strip headings/italic but preserve **bold** for chip parsing */
export function prepareTextForPhraseChips(text: string): string {
  return stripThinkTags(text)
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(?<!\w)\*([^*\n]+?)\*(?!\w)/g, '$1')
    .replace(/(?<!\w)_([^_\n]+?)_(?!\w)/g, '$1');
}

export function parsePhraseChips(text: string): ChipSegment[] {
  const prepared = prepareTextForPhraseChips(text);
  const segments: ChipSegment[] = [];
  const pattern = /\*\*([^*]+?)\*\*(?:\s*\(([^)]+)\))?/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(prepared)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: prepared.slice(lastIndex, match.index) });
    }

    const phrase = match[1].trim();
    const phonetic = match[2]?.trim();

    if (PHRASE_CARD_LABELS.test(phrase)) {
      segments.push({ type: 'text', content: match[0] });
    } else {
      segments.push({ type: 'chip', phrase, phonetic });
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < prepared.length) {
    segments.push({ type: 'text', content: prepared.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', content: prepared }];
}

interface PhraseChipTextProps {
  text: string;
  languageName?: string;
  className?: string;
}

export function PhraseChipText({ text, languageName = 'English', className }: PhraseChipTextProps) {
  const segments = parsePhraseChips(text);

  return (
    <span className={className}>
      {segments.map((seg, idx) => {
        if (seg.type === 'text') {
          return <React.Fragment key={idx}>{seg.content}</React.Fragment>;
        }

        return (
          <button
            key={idx}
            type="button"
            onClick={() => speakPhrase(seg.phrase, languageName)}
            className="inline-flex items-center gap-1 mx-0.5 px-2 py-0.5 rounded-lg text-sm font-medium bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition-colors align-baseline not-italic"
            title={seg.phonetic ? `Say: ${seg.phonetic}` : 'Tap to hear'}
          >
            <Volume2 className="w-3 h-3 shrink-0 opacity-70" />
            <span>{seg.phrase}</span>
            {seg.phonetic && (
              <span className="text-xs opacity-70 font-normal italic">({seg.phonetic})</span>
            )}
          </button>
        );
      })}
    </span>
  );
}
