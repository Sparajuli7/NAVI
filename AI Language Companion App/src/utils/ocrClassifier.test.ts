import { describe, it, expect } from 'vitest';
import { classifyOCR } from './ocrClassifier';

describe('classifyOCR', () => {
  // ── MENU ────────────────────────────────────────────────────────────────────
  describe('MENU', () => {
    it('classifies text with prices AND more than 3 blocks as MENU', () => {
      const text = 'Pho Bo $8.50\nBanh Mi $5.00\nCha Gio $6.00\nCom Tam $7.50';
      expect(classifyOCR(text, 4, 20)).toBe('MENU');
    });

    it('does NOT classify as MENU when blockCount is exactly 3 (boundary)', () => {
      const text = 'Item A $5.00\nItem B $6.00\nItem C $7.00';
      // blockCount=3 → not MENU (requires >3), falls through to SIGN or LABEL
      expect(classifyOCR(text, 3, 20)).not.toBe('MENU');
    });

    it('does NOT classify as MENU when prices present but only 1 block', () => {
      expect(classifyOCR('Coffee $3.50', 1, 12)).not.toBe('MENU');
    });
  });

  // ── LABEL ───────────────────────────────────────────────────────────────────
  // LABEL triggers when: hasPrice && blockCount <= 5 — but must survive earlier guards:
  //   - MENU: blockCount > 3 && hasPrice → eats blocks 4-5 with price → MENU, not LABEL
  //   - SIGN: blockCount <= 3 && totalLength < 200 → eats short text → SIGN, not LABEL
  // Therefore LABEL only triggers when: hasPrice && blockCount 1-3 && totalLength >= 200
  describe('LABEL', () => {
    it('classifies price + few blocks with long text as LABEL', () => {
      // 2 blocks, has price, text >= 200 chars → skips MENU (≤3), skips SIGN (length≥200) → LABEL
      const longText = 'Shampoo 500ml — Ingredients: Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Glycerin, Fragrance, Citric Acid, Sodium Chloride. $4.99';
      expect(longText.length).toBeGreaterThanOrEqual(100);
      // pad to ensure totalLength >= 200
      const text = longText + ' '.repeat(Math.max(0, 200 - longText.length));
      expect(classifyOCR(text, 2, text.length / 2)).toBe('LABEL');
    });

    it('confirms price + 4-5 blocks hits MENU first (not LABEL)', () => {
      // blockCount > 3 && hasPrice → MENU before LABEL can fire
      const text = 'Brand\nProduct Name\nNet Wt 200g\nPrice $12.99\nMade in Japan';
      expect(classifyOCR(text, 5, 20)).toBe('MENU');
    });
  });

  // ── DOCUMENT ────────────────────────────────────────────────────────────────
  describe('DOCUMENT', () => {
    it('classifies dense multi-block text as DOCUMENT', () => {
      const longBlock = 'This is a long paragraph with many words in it. '.repeat(3);
      expect(classifyOCR(longBlock, 9, 80)).toBe('DOCUMENT');
    });

    it('does NOT classify as DOCUMENT when avgBlockLength is short', () => {
      expect(classifyOCR('Short text', 9, 20)).not.toBe('DOCUMENT');
    });

    it('does NOT classify as DOCUMENT when blockCount is 8 (boundary)', () => {
      // requires >8
      const result = classifyOCR('text', 8, 80);
      expect(result).not.toBe('DOCUMENT');
    });
  });

  // ── PAGE ────────────────────────────────────────────────────────────────────
  describe('PAGE', () => {
    it('classifies moderate multi-block text without prices as PAGE', () => {
      expect(classifyOCR('Some body text here', 6, 50)).toBe('PAGE');
    });

    it('does NOT classify as PAGE when prices are present', () => {
      expect(classifyOCR('Article $5.00', 6, 50)).not.toBe('PAGE');
    });

    it('does NOT classify as PAGE when blockCount is 5 (boundary)', () => {
      // requires >5
      expect(classifyOCR('text', 5, 50)).not.toBe('PAGE');
    });
  });

  // ── SIGN ────────────────────────────────────────────────────────────────────
  describe('SIGN', () => {
    it('classifies short few-block text as SIGN', () => {
      expect(classifyOCR('EXIT', 1, 4)).toBe('SIGN');
    });

    it('classifies street sign with 3 blocks as SIGN', () => {
      expect(classifyOCR('Main St\nDo Not Enter\nSpeed Limit 30', 3, 15)).toBe('SIGN');
    });

    it('does NOT classify as SIGN when text is long (≥200 chars)', () => {
      const longText = 'A'.repeat(200);
      expect(classifyOCR(longText, 2, 100)).not.toBe('SIGN');
    });
  });

  // ── GENERAL ─────────────────────────────────────────────────────────────────
  describe('GENERAL', () => {
    it('falls back to GENERAL for ambiguous cases', () => {
      // No prices, 4 blocks (not enough for DOCUMENT/PAGE), too long for SIGN
      const text = 'A'.repeat(250);
      expect(classifyOCR(text, 4, 30)).toBe('GENERAL');
    });
  });

  // ── Price pattern edge cases ─────────────────────────────────────────────────
  describe('price detection', () => {
    it('detects USD symbol', () => {
      expect(classifyOCR('Lunch $12.50\nDinner $18.00\nDrinks $6.00\nDessert $8.00', 4, 15)).toBe('MENU');
    });

    it('detects EUR symbol', () => {
      expect(classifyOCR('Café €3.50\nCroissant €2.00\nJus €4.50\nSalade €8.00', 4, 15)).toBe('MENU');
    });

    it('detects VND currency code', () => {
      expect(classifyOCR('Pho 45000 VND\nBun Bo 50000 VND\nCom 35000 VND\nCha 40000 VND', 4, 20)).toBe('MENU');
    });
  });
});
