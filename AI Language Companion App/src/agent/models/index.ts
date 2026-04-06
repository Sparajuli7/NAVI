/**
 * NAVI Agent Framework — Model Providers Index
 *
 * Re-exports all model providers and the registry for convenience.
 */

export { ModelRegistry } from './registry';
export type { ChatLLM, ChatOptions } from './chatLLM';
export { LLMProvider, PRESET_CONFIGS as LLM_PRESETS } from './llmProvider';
export { OllamaProvider, OLLAMA_PRESETS, isOllamaAvailable, listOllamaModels } from './ollamaProvider';
export { OpenRouterProvider, FALLBACK_MODELS as OPENROUTER_FREE_MODELS, PAID_MODELS as OPENROUTER_PAID_MODELS } from './openRouterProvider';
export { TTSProvider } from './ttsProvider';
export type { VoiceOption } from './ttsProvider';
export { STTProvider } from './sttProvider';
export { VisionProvider } from './visionProvider';
export { EmbeddingProvider } from './embeddingProvider';
export { TranslationProvider } from './translationProvider';
