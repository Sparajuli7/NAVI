/**
 * NAVI Agent Framework — Vision Model Provider
 *
 * Wraps Tesseract.js OCR behind the ModelProvider interface.
 * Provides image → text extraction for documents, menus, signs, etc.
 *
 * Design decision: Tesseract.js is a WASM OCR engine.
 * It's not a vision model in the modern sense (no scene understanding),
 * but for NAVI's use cases (reading text from photos), it's sufficient
 * and runs fully offline. For scene understanding, we'd add a
 * separate multimodal model provider later.
 *
 * Future: When WebGPU vision models are viable (e.g., Florence-2),
 * register a new provider alongside this one.
 */

import type { ModelInfo, ModelProvider, ModelStatus } from '../core/types';
import type { OCRResult } from '../../types/inference';
import Tesseract from 'tesseract.js';

export type { OCRResult } from '../../types/inference';

export class VisionProvider implements ModelProvider<null> {
  private status: ModelStatus = 'ready'; // Tesseract loads on demand

  info(): ModelInfo {
    return {
      id: 'tesseract-ocr',
      name: 'Tesseract.js OCR',
      capability: 'vision',
      sizeBytes: 15_000_000, // ~15MB for language data
      runtime: 'wasm',
      required: false,
      status: this.status,
      languages: ['eng', 'vie', 'jpn', 'kor', 'fra', 'chi_sim'],
    };
  }

  async load(): Promise<void> {
    this.status = 'ready';
  }

  async unload(): Promise<void> {
    this.status = 'unloaded';
  }

  isReady(): boolean {
    return this.status === 'ready';
  }

  getEngine(): null {
    return null; // Tesseract uses static methods
  }

  /** Extract text from an image */
  async extractText(
    image: File | Blob | string,
    languages: string = 'eng+vie+jpn+kor+fra+chi_sim',
    onProgress?: (progress: number) => void,
  ): Promise<OCRResult> {
    const result = await Tesseract.recognize(image, languages, {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(Math.round(m.progress * 100));
        }
      },
    });

    const text = result.data.text.trim();
    const blocks =
      result.data.blocks
        ?.map((b) => b.text.trim())
        .filter((t) => t.length > 0) ??
      text.split('\n').filter((l) => l.trim());

    const blockCount = blocks.length;
    const avgBlockLength =
      blockCount > 0
        ? Math.round(blocks.reduce((sum, b) => sum + b.length, 0) / blockCount)
        : 0;

    return {
      text,
      blocks,
      blockCount,
      avgBlockLength,
      confidence: result.data.confidence,
    };
  }
}
