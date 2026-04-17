import type { ParsedSegment, PhraseCardData } from '../types/chat';

// Use [\r\n]+ as separator so the pattern works with both Unix and Windows line endings,
// and is tolerant of blank lines between fields.
const PHRASE_CARD_PATTERN =
  /\*\*Phrase:\*\*[ \t]*(.+?)[\r\n]+\*\*Say it:\*\*[ \t]*(.+?)[\r\n]+\*\*Sound tip:\*\*[ \t]*(.+?)[\r\n]+\*\*Means:\*\*[ \t]*(.+?)[\r\n]+\*\*Tip:\*\*[ \t]*(.+?)(?:[\r\n]|$)/gs;

/**
 * Detect and truncate repetition loops in model output.
 * If a phrase of 4+ words repeats 3+ times, cut at the first repetition.
 */
export function truncateRepetition(text: string): string {
  // Find any substring of 15+ chars that repeats 3+ times
  const minLen = 15;
  for (let len = Math.min(80, Math.floor(text.length / 3)); len >= minLen; len--) {
    for (let start = 0; start <= text.length - len * 3; start++) {
      const pattern = text.slice(start, start + len);
      // Count occurrences
      let count = 0;
      let searchFrom = 0;
      while (true) {
        const idx = text.indexOf(pattern, searchFrom);
        if (idx === -1) break;
        count++;
        searchFrom = idx + 1;
        if (count >= 3) {
          // Found 3+ repetitions — truncate at the second occurrence
          const secondIdx = text.indexOf(pattern, text.indexOf(pattern) + 1);
          return text.slice(0, secondIdx).trim();
        }
      }
    }
  }
  return text;
}

/** Strip <think>...</think> blocks (and unclosed <think> during streaming) */
export function stripThinkTags(text: string): string {
  // Remove complete <think>...</think> blocks (case-insensitive, dotall)
  let result = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  // Remove unclosed <think>... at end (streaming — model is still thinking)
  result = result.replace(/<think>[\s\S]*$/gi, '');
  return result.trim();
}

export function stripInlineMarkdown(text: string): string {
  return stripThinkTags(text)
    .replace(/^#{1,3}\s+/gm, '')          // ## headings → plain text
    .replace(/\*\*(.+?)\*\*/g, '$1')       // **bold** → bold
    .replace(/__(.+?)__/g, '$1')            // __bold__ → bold
    .replace(/(?<!\w)\*([^*\n]+?)\*(?!\w)/g, '$1')  // *italic* → italic
    .replace(/(?<!\w)_([^_\n]+?)_(?!\w)/g, '$1');   // _italic_ → italic
}

export function parseResponse(text: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(PHRASE_CARD_PATTERN)) {
    const matchStart = match.index ?? 0;

    if (matchStart > lastIndex) {
      const chunk = text.slice(lastIndex, matchStart).trim();
      if (chunk) segments.push({ type: 'text', content: stripInlineMarkdown(chunk) });
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
    if (remainder) segments.push({ type: 'text', content: stripInlineMarkdown(remainder) });
  }

  if (segments.length === 0) {
    segments.push({ type: 'text', content: stripInlineMarkdown(text) });
  }

  return segments;
}
