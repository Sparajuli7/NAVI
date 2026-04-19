/**
 * NAVI Agent Framework — Embedding Model Provider (Stub)
 *
 * Stub implementation using bag-of-characters hashing for semantic memory search.
 * Swap with an ONNX-based model (e.g., all-MiniLM-L6-v2) for real embeddings.
 */

import type { ModelInfo, ModelProvider, ModelStatus } from '../core/types';

const EMBEDDING_DIM = 64; // Small dimension for stub

export class EmbeddingProvider implements ModelProvider<null> {
  private status: ModelStatus = 'ready';

  info(): ModelInfo {
    return {
      id: 'stub-embedding',
      name: 'Stub Embedding (hash-based)',
      capability: 'embedding',
      sizeBytes: 0,
      runtime: 'custom',
      required: false,
      status: this.status,
      languages: ['multilingual'],
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
    return null;
  }

  /**
   * Generate an embedding vector for text.
   * Stub: uses character-level hashing to produce a deterministic vector.
   * Replace with real model for semantic quality.
   */
  embed(text: string): number[] {
    const vector = new Float32Array(EMBEDDING_DIM).fill(0);
    const normalized = text.toLowerCase().trim();

    for (let i = 0; i < normalized.length; i++) {
      const charCode = normalized.charCodeAt(i);
      const idx = charCode % EMBEDDING_DIM;
      vector[idx] += 1;

      // Add bigram signal
      if (i < normalized.length - 1) {
        const bigramCode = charCode * 31 + normalized.charCodeAt(i + 1);
        const bigramIdx = bigramCode % EMBEDDING_DIM;
        vector[bigramIdx] += 0.5;
      }
    }

    // L2 normalize
    let norm = 0;
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < EMBEDDING_DIM; i++) {
        vector[i] /= norm;
      }
    }

    return Array.from(vector);
  }

  /** Batch embed multiple texts */
  embedBatch(texts: string[]): number[][] {
    return texts.map((t) => this.embed(t));
  }
}
