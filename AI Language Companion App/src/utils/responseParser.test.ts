import { describe, it, expect } from 'vitest';
import { parseResponse, stripInlineMarkdown } from './responseParser';

// Real phrase card format as the LLM emits it
const PHRASE_CARD = `**Phrase:** Xin chào
**Say it:** sin CHOW
**Sound tip:** The "ch" sounds like "ch" in "chair", not hard "k"
**Means:** Hello / Hi (casual greeting)
**Tip:** Use this any time of day — it's the universal Vietnamese hello`;

describe('parseResponse', () => {
  // ── Basic phrase card ────────────────────────────────────────────────────────
  describe('phrase card extraction', () => {
    it('extracts a single phrase card', () => {
      const segments = parseResponse(PHRASE_CARD);
      expect(segments).toHaveLength(1);
      expect(segments[0].type).toBe('phrase_card');
    });

    it('maps all phrase card fields correctly', () => {
      const segments = parseResponse(PHRASE_CARD);
      const card = segments[0];
      expect(card.type).toBe('phrase_card');
      if (card.type === 'phrase_card') {
        expect(card.data.phrase).toBe('Xin chào');
        expect(card.data.phonetic).toBe('sin CHOW');
        expect(card.data.soundTip).toContain('chair');
        expect(card.data.meaning).toContain('Hello');
        expect(card.data.tip).toContain('Vietnamese');
      }
    });

    it('extracts phrase card with surrounding text', () => {
      const text = `Sure! Here's the greeting:\n\n${PHRASE_CARD}\n\nTry using it when you enter a shop!`;
      const segments = parseResponse(text);
      expect(segments.length).toBeGreaterThanOrEqual(2);
      const types = segments.map(s => s.type);
      expect(types).toContain('phrase_card');
      expect(types).toContain('text');
    });

    it('preserves text before the phrase card', () => {
      const text = `Here's a common greeting:\n\n${PHRASE_CARD}`;
      const segments = parseResponse(text);
      const textSeg = segments.find(s => s.type === 'text');
      expect(textSeg).toBeDefined();
      if (textSeg?.type === 'text') {
        expect(textSeg.content).toContain('greeting');
      }
    });

    it('preserves text after the phrase card', () => {
      const text = `${PHRASE_CARD}\n\nPractice this with locals!`;
      const segments = parseResponse(text);
      const textSeg = segments.find(s => s.type === 'text');
      expect(textSeg).toBeDefined();
      if (textSeg?.type === 'text') {
        expect(textSeg.content).toContain('Practice');
      }
    });
  });

  // ── Multiple phrase cards ────────────────────────────────────────────────────
  describe('multiple phrase cards', () => {
    it('extracts two phrase cards in sequence', () => {
      const card2 = `**Phrase:** Cảm ơn
**Say it:** gam UHN
**Sound tip:** The "c" is soft like "g"
**Means:** Thank you
**Tip:** Always appreciated — locals love hearing it`;

      const text = `${PHRASE_CARD}\n\n${card2}`;
      const segments = parseResponse(text);
      const cards = segments.filter(s => s.type === 'phrase_card');
      expect(cards).toHaveLength(2);
    });
  });

  // ── Plain text (no phrase card) ──────────────────────────────────────────────
  describe('plain text responses', () => {
    it('returns a single text segment when no phrase card present', () => {
      const text = 'Great question! Let me explain the culture first.';
      const segments = parseResponse(text);
      expect(segments).toHaveLength(1);
      expect(segments[0].type).toBe('text');
    });

    it('never returns an empty segments array', () => {
      expect(parseResponse('hello')).toHaveLength(1);
      expect(parseResponse('')).toHaveLength(1);
    });

    it('returns something even for empty string', () => {
      const segments = parseResponse('');
      expect(segments.length).toBeGreaterThan(0);
    });
  });

  // ── Windows line endings ─────────────────────────────────────────────────────
  describe('line ending tolerance', () => {
    it('parses phrase card with Windows CRLF line endings', () => {
      const crlf = PHRASE_CARD.replace(/\n/g, '\r\n');
      const segments = parseResponse(crlf);
      expect(segments.some(s => s.type === 'phrase_card')).toBe(true);
    });
  });
});

describe('stripInlineMarkdown', () => {
  it('removes ** bold markers', () => {
    expect(stripInlineMarkdown('**bold text**')).toBe('bold text');
  });

  it('removes __ bold markers', () => {
    expect(stripInlineMarkdown('__bold text__')).toBe('bold text');
  });

  it('removes * italic markers', () => {
    expect(stripInlineMarkdown('*italic*')).toBe('italic');
  });

  it('removes _ italic markers', () => {
    expect(stripInlineMarkdown('_italic_')).toBe('italic');
  });

  it('removes ## headings', () => {
    expect(stripInlineMarkdown('## Section Title')).toBe('Section Title');
  });

  it('removes ### headings', () => {
    expect(stripInlineMarkdown('### Deep Heading')).toBe('Deep Heading');
  });

  it('leaves plain text unchanged', () => {
    expect(stripInlineMarkdown('just plain text')).toBe('just plain text');
  });

  it('handles mixed markdown in a single string', () => {
    const result = stripInlineMarkdown('## Title\n**bold** and *italic*');
    expect(result).not.toContain('**');
    expect(result).not.toContain('##');
    expect(result).toContain('bold');
    expect(result).toContain('italic');
  });
});
