/**
 * NAVI Agent Framework — LLM Model Provider
 *
 * Wraps the existing WebLLM integration (services/modelManager.ts)
 * behind the ModelProvider interface. This is the bridge between
 * the new agent framework and the existing model loading code.
 *
 * Design decision: Wrap, don't rewrite.
 * The existing modelManager.ts works. Instead of rewriting it,
 * we wrap it in the provider interface. This preserves the existing
 * download/progress/caching logic while making it swappable.
 *
 * To test a different LLM (e.g., Phi-3, Gemma, Llama):
 * 1. Create a new provider with different MODEL_ID
 * 2. Register it with the ModelRegistry
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
  'qwen2.5-1.5b': {
    modelId: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    name: 'Qwen 2.5 1.5B (Primary)',
    sizeBytes: 1_100_000_000,
    quantization: 'q4f16_1',
    languages: ['multilingual'],
    required: true,
  },
  'qwen2.5-0.5b': {
    modelId: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    name: 'Qwen 2.5 0.5B (Lite)',
    sizeBytes: 394_000_000,
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
