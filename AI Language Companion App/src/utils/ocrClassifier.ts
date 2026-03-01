export type OCRType = 'MENU' | 'SIGN' | 'DOCUMENT' | 'PAGE' | 'LABEL' | 'GENERAL';

const PRICE_PATTERN = /[$€£¥₫₩]?\s?\d+[\.,]\d{2}|\d+[.,]\d{2}\s?[$€£¥₫₩]|\d+\s?(USD|VND|JPY|KRW|EUR|MXN)/i;

export function classifyOCR(
  text: string,
  blockCount: number,
  avgBlockLength: number,
): OCRType {
  const hasPrice = PRICE_PATTERN.test(text);
  const totalLength = text.length;

  // MENU: prices + more than 3 blocks (multiple items with prices = menu)
  if (hasPrice && blockCount > 3) return 'MENU';
  // DOCUMENT: dense multi-block text, no price focus
  if (blockCount > 8 && avgBlockLength > 60) return 'DOCUMENT';
  // PAGE: moderate multi-block text without prices
  if (blockCount > 5 && avgBlockLength > 40 && !hasPrice) return 'PAGE';
  // SIGN: short, few blocks
  if (blockCount <= 3 && totalLength < 200) return 'SIGN';
  // LABEL: prices but compact (single product, packaging)
  if (hasPrice && blockCount <= 5) return 'LABEL';
  return 'GENERAL';
}
