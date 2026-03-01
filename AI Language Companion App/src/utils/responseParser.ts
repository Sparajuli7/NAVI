import type { ParsedSegment, PhraseCardData } from '../types/chat';

const PHRASE_CARD_PATTERN =
  /\*\*Phrase:\*\*\s*(.+?)\n\*\*Say it:\*\*\s*(.+?)\n\*\*Sound tip:\*\*\s*(.+?)\n\*\*Means:\*\*\s*(.+?)\n\*\*Tip:\*\*\s*(.+?)(?:\n|$)/gs;

export function parseResponse(text: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(PHRASE_CARD_PATTERN)) {
    const matchStart = match.index ?? 0;

    if (matchStart > lastIndex) {
      const chunk = text.slice(lastIndex, matchStart).trim();
      if (chunk) segments.push({ type: 'text', content: chunk });
    }

    const data: PhraseCardData = {
      phrase:    match[1].trim(),
      phonetic:  match[2].trim(),
      soundTip:  match[3].trim(),
      meaning:   match[4].trim(),
      tip:       match[5].trim(),
    };
    segments.push({ type: 'phrase_card', data });

    lastIndex = matchStart + match[0].length;
  }

  if (lastIndex < text.length) {
    const remainder = text.slice(lastIndex).trim();
    if (remainder) segments.push({ type: 'text', content: remainder });
  }

  if (segments.length === 0) {
    segments.push({ type: 'text', content: text });
  }

  return segments;
}
