export type ModelStatus = 'not_loaded' | 'downloading' | 'loading' | 'ready' | 'error' | 'unloaded';

export interface InferenceConfig {
  temperature: number;
  top_p: number;
  max_tokens: number;
  presence_penalty: number;
}

export const INFERENCE_CONFIGS: Record<string, InferenceConfig> = {
  chat:          { temperature: 0.7, top_p: 0.8, max_tokens: 512,  presence_penalty: 1.5 },
  phrase:        { temperature: 0.4, top_p: 0.9, max_tokens: 400,  presence_penalty: 1.0 },
  camera:        { temperature: 0.3, top_p: 0.9, max_tokens: 600,  presence_penalty: 1.0 },
  character_gen: { temperature: 0.8, top_p: 0.9, max_tokens: 400,  presence_penalty: 0.5 },
  memory_gen:    { temperature: 0.2, top_p: 0.9, max_tokens: 300,  presence_penalty: 0.5 },
  structured:    { temperature: 0.3, top_p: 0.9, max_tokens: 500,  presence_penalty: 0.5 },
};

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Result of an OCR text extraction operation */
export interface OCRResult {
  text: string;
  blocks: string[];
  blockCount: number;
  avgBlockLength: number;
  /** OCR confidence score (0-1). Present when using VisionProvider, absent in legacy service. */
  confidence?: number;
}
