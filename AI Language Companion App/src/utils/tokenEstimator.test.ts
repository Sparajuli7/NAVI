import { describe, it, expect } from 'vitest';
import { estimateTokens } from './tokenEstimator';

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  // ── Latin / ASCII ────────────────────────────────────────────────────────────
  describe('Latin script', () => {
    it('estimates English text at roughly 1 token per 3-4 chars', () => {
      // "Hello world" = 11 chars → ceil(11/3.5) = 4
      expect(estimateTokens('Hello world')).toBe(4);
    });

    it('handles punctuation and spaces in Latin text', () => {
      const tokens = estimateTokens('How do I get to the train station?');
      expect(tokens).toBeGreaterThan(5);
      expect(tokens).toBeLessThan(20);
    });
  });

  // ── Devanagari (Nepali/Hindi) ────────────────────────────────────────────────
  describe('Devanagari script', () => {
    it('counts Devanagari chars at higher density (1 per 1.5 chars)', () => {
      // "नमस्ते" = 6 chars all Devanagari → ceil(6/1.5) = 4
      expect(estimateTokens('नमस्ते')).toBe(4);
    });

    it('gives MORE tokens than equivalent Latin for same char count', () => {
      const nepali = 'नमस्ते आज कस्तो छ';  // 18 chars Devanagari
      const english = 'hello how are you';    // 18 chars Latin
      expect(estimateTokens(nepali)).toBeGreaterThan(estimateTokens(english));
    });

    it('does NOT undercount a Nepali sentence', () => {
      // Old bug: non-Latin chars were counted as Latin → ~3x undercount
      const sentence = 'नमस्ते! आज Thamel मा एकदम भिड छ।';
      expect(estimateTokens(sentence)).toBeGreaterThan(10);
    });
  });

  // ── Arabic ──────────────────────────────────────────────────────────────────
  describe('Arabic script', () => {
    it('counts Arabic at dense rate', () => {
      // "مرحبا" = 5 Arabic chars → ceil(5/1.5) = 4
      expect(estimateTokens('مرحبا')).toBe(4);
    });
  });

  // ── CJK (Chinese/Japanese/Korean) ───────────────────────────────────────────
  describe('CJK scripts', () => {
    it('counts Chinese characters at dense rate', () => {
      // "你好世界" = 4 CJK → ceil(4/1.5) = 3
      expect(estimateTokens('你好世界')).toBe(3);
    });

    it('counts Korean Hangul at dense rate', () => {
      // "안녕하세요" = 5 Hangul → ceil(5/1.5) = 4
      expect(estimateTokens('안녕하세요')).toBe(4);
    });

    it('counts Japanese hiragana at dense rate', () => {
      // "こんにちは" = 5 hiragana → ceil(5/1.5) = 4
      expect(estimateTokens('こんにちは')).toBe(4);
    });
  });

  // ── Mixed scripts ────────────────────────────────────────────────────────────
  describe('mixed scripts', () => {
    it('handles mixed Latin + Devanagari correctly', () => {
      // Romanization style: "Thamel maa ek" + "दम" (Devanagari)
      const mixed = 'Hello नमस्ते';
      const tokens = estimateTokens(mixed);
      expect(tokens).toBeGreaterThan(3);
    });

    it('is always >= 1 for non-empty input', () => {
      expect(estimateTokens('a')).toBeGreaterThanOrEqual(1);
      expect(estimateTokens('अ')).toBeGreaterThanOrEqual(1);
    });
  });
});
