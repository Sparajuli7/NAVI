/**
 * NAVI Agent Framework — WebLLM Provider
 *
 * In-browser LLM inference via WebGPU using @mlc-ai/web-llm.
 * Implements ModelProvider + ChatLLM interfaces for the agent framework.
 * 3. Done — no other code changes needed
 */

import type { ModelInfo, ModelProvider, ModelStatus } from '../core/types';
import type { ChatLLM, ChatOptions } from './chatLLM';
import * as webllm from '@mlc-ai/web-llm';

export interface LLMProviderConfig {
  modelId: string;
  name: string;
  sizeBytes: number;
  quantization: string;
  languages: string[];
  required: boolean;
}

export const PRESET_CONFIGS = {
  // ── Qwen3 (best multilingual, recommended) ──────────────────────
  'qwen3-1.7b': {
    modelId: 'Qwen3-1.7B-q4f16_1-MLC',
    name: 'Qwen3 1.7B (Default)',
    sizeBytes: 1_100_000_000,
    quantization: 'q4f16_1',
    languages: ['multilingual'],
    required: true,
  },
  'qwen3-4b': {
    modelId: 'Qwen3-4B-q4f16_1-MLC',
    name: 'Qwen3 4B (Best Quality)',
    sizeBytes: 2_500_000_000,
    quantization: 'q4f16_1',
    languages: ['multilingual'],
    required: false,
  },
  'qwen3-0.6b': {
    modelId: 'Qwen3-0.6B-q4f16_1-MLC',
    name: 'Qwen3 0.6B (Ultra-Light)',
    sizeBytes: 400_000_000,
    quantization: 'q4f16_1',
    languages: ['multilingual'],
    required: false,
  },
  // ── Qwen2.5 (kept for compatibility) ────────────────────────────
  'qwen2.5-1.5b': {
    modelId: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    name: 'Qwen 2.5 1.5B',
    sizeBytes: 1_100_000_000,
    quantization: 'q4f16_1',
    languages: ['multilingual'],
    required: false,
  },
  // ── Llama 3.2 ────────────────────────────────────────────────────
  'llama-3.2-3b': {
    modelId: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    name: 'Llama 3.2 3B',
    sizeBytes: 1_900_000_000,
    quantization: 'q4f16_1',
    languages: ['multilingual'],
    required: false,
  },
  'llama-3.2-1b': {
    modelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    name: 'Llama 3.2 1B (Fastest)',
    sizeBytes: 740_000_000,
    quantization: 'q4f16_1',
    languages: ['multilingual'],
    required: false,
  },
  // ── Other ────────────────────────────────────────────────────────
  'phi-3.5-mini': {
    modelId: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
    name: 'Phi-3.5 Mini (3.8B)',
    sizeBytes: 2_200_000_000,
    quantization: 'q4f16_1',
    languages: ['multilingual'],
    required: false,
  },
  'gemma-2-2b': {
    modelId: 'gemma-2-2b-it-q4f16_1-MLC',
    name: 'Gemma 2 2B',
    sizeBytes: 1_500_000_000,
    quantization: 'q4f16_1',
    languages: ['multilingual'],
    required: false,
  },
  'ministral-3b': {
    modelId: 'Ministral-3-3B-Instruct-2512-BF16-q4f16_1-MLC',
    name: 'Ministral 3B',
    sizeBytes: 2_000_000_000,
    quantization: 'q4f16_1',
    languages: ['multilingual'],
    required: false,
  },
} satisfies Record<string, LLMProviderConfig>;

export class LLMProvider implements ModelProvider<webllm.MLCEngine>, ChatLLM {
  private engine: webllm.MLCEngine | null = null;
  private status: ModelStatus = 'not_loaded';
  private config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
  }

  info(): ModelInfo {
    return {
      id: this.config.modelId,
      name: this.config.name,
      capability: 'llm',
      sizeBytes: this.config.sizeBytes,
      runtime: 'webllm',
      required: this.config.required,
      status: this.status,
      quantization: this.config.quantization,
      languages: this.config.languages,
    };
  }

  async load(onProgress?: (progress: number, text: string) => void): Promise<void> {
    if (this.engine && this.status === 'ready') return;

    this.status = 'downloading';
    this.engine = new webllm.MLCEngine();

    this.engine.setInitProgressCallback((report: webllm.InitProgressReport) => {
      const progress = Math.round(report.progress * 100);
      onProgress?.(progress, report.text);

      const text = report.text.toLowerCase();
      if (report.progress >= 1) {
        this.status = 'ready';
      } else if (text.includes('loading') || text.includes('shader') || text.includes('compil')) {
        this.status = 'loading';
      } else {
        this.status = 'downloading';
      }
    });

    try {
      await this.engine.reload(this.config.modelId);
      this.status = 'ready';
    } catch (err) {
      this.status = 'error';
      this.engine = null;
      throw err;
    }
  }

  async unload(): Promise<void> {
    this.engine = null;
    this.status = 'unloaded';
  }

  isReady(): boolean {
    return this.status === 'ready' && this.engine !== null;
  }

  getEngine(): webllm.MLCEngine | null {
    return this.engine;
  }

  /** Run chat completion via WebLLM engine */
  async chat(
    messages: Array<{ role: string; content: string }>,
    options?: ChatOptions,
  ): Promise<string> {
    if (!this.engine || !this.isReady()) {
      throw new Error(`LLM not ready: ${this.config.modelId}`);
    }

    const chatMessages = messages as webllm.ChatCompletionMessageParam[];

    if (options?.stream && options?.onToken) {
      const stream = await this.engine.chat.completions.create({
        messages: chatMessages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 512,
        top_p: options.top_p ?? 0.8,
        stream: true,
      });

      let fullText = '';
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? '';
        if (delta) {
          fullText += delta;
          options.onToken(delta, fullText);
        }
      }
      return fullText;
    }

    const reply = await this.engine.chat.completions.create({
      messages: chatMessages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 512,
      top_p: options?.top_p ?? 0.8,
      stream: false,
    });

    return reply.choices[0]?.message?.content ?? '';
  }
}
