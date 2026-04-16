import Tesseract from 'tesseract.js';
import type { OCRResult } from '../types/inference';

export type { OCRResult } from '../types/inference';

export async function extractText(
  image: File | Blob | string,
  onProgress?: (progress: number) => void,
): Promise<OCRResult> {
  const result = await Tesseract.recognize(image, 'eng+vie+jpn+kor+fra+chi_sim', {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });

  const text = result.data.text.trim();
  const blocks = result.data.blocks
    ?.map((b) => b.text.trim())
    .filter((t) => t.length > 0) ?? text.split('\n').filter((l) => l.trim());

  const blockCount = blocks.length;
  const avgBlockLength =
    blockCount > 0
      ? Math.round(blocks.reduce((sum, b) => sum + b.length, 0) / blockCount)
      : 0;

  return { text, blocks, blockCount, avgBlockLength };
}
