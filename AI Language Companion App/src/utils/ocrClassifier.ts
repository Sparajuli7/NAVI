export type OCRType = 'MENU' | 'SIGN' | 'DOCUMENT' | 'PAGE' | 'LABEL' | 'GENERAL';

const PRICE_PATTERN = /[$€£¥₫₩]?\s?\d+[\.,]\d{2}|\d+[.,]\d{2}\s?[$€£¥₫₩]|\d+\s?(USD|VND|JPY|KRW|EUR|MXN)/i;

export function classifyOCR(
  text: string,
  blockCount: number,
  avgBlockLength: number,
): OCRType {
  const hasPrice = PRICE_PATTERN.test(text);
  const totalLength = text.length;

  if (hasPrice && blockCount >= 3) return 'MENU';
  if (hasPrice && blockCount <= 5) return 'LABEL';
  if (blockCount > 8 && avgBlockLength > 60) return 'DOCUMENT';
  if (blockCount > 5 && avgBlockLength > 40) return 'PAGE';
  if (blockCount <= 3 && totalLength < 200) return 'SIGN';
  return 'GENERAL';
}
