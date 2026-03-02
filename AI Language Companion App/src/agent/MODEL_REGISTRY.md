# NAVI Agent Framework — Model Registry

## Current Models

### LLM (Language Generation)

| Model | ID | Size | Runtime | Status | Notes |
|---|---|---|---|---|---|
| Qwen 2.5 1.5B (Primary) | `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` | ~1.1GB | WebLLM (WebGPU) | Implemented | Multilingual, q4f16 quantized |
| Qwen 2.5 0.5B (Lite) | `Qwen2.5-0.5B-Instruct-q4f16_1-MLC` | ~394MB | WebLLM (WebGPU) | Implemented | Power saver mode fallback |
| Qwen 2.5 1.5B (Ollama) | `qwen2.5:1.5b` | ~986MB | Ollama | Implemented | Local server, same model via Ollama |
| Qwen 2.5 3B (Ollama) | `qwen2.5:3b` | ~1.9GB | Ollama | Implemented | Better quality, local server |
| Qwen 2.5 7B (Ollama) | `qwen2.5:7b` | ~4.7GB | Ollama | Implemented | Best quality, needs 8GB RAM |
| Llama 3.2 3B (Ollama) | `llama3.2:3b` | ~2GB | Ollama | Implemented | Good alternative for English-heavy |
| Mistral 7B (Ollama) | `mistral:7b` | ~4.1GB | Ollama | Implemented | Strong multilingual performance |

**Why Qwen 2.5:** Best multilingual performance at 1.5B parameter count. Supports 100+ languages including CJK, Vietnamese, French, Spanish, Korean. 4-bit quantization runs in <2GB VRAM.

### Dual Backend: WebLLM vs Ollama

| Feature | WebLLM | Ollama |
|---|---|---|
| **Runtime** | In-browser via WebGPU | Local server at localhost:11434 |
| **Offline** | Fully offline after download | Needs Ollama running locally |
| **Model Size** | Limited to ~1.5B (browser VRAM) | Any size your hardware supports |
| **Setup** | Zero setup (browser only) | Install Ollama + pull model |
| **Best For** | Mobile/tablet, demo, PWA | Development, desktop, testing larger models |
| **Interface** | `ChatLLM` | `ChatLLM` (same interface) |

Both backends implement the `ChatLLM` interface — all tools and pipelines work identically with either backend. Use `backend: 'auto'` (default) to auto-detect Ollama and fall back to WebLLM.

### TTS (Text-to-Speech)

| Model | ID | Size | Runtime | Status | Notes |
|---|---|---|---|---|---|
| Browser TTS | `browser-speech-synthesis` | 0 | Browser API | Implemented | Free, no download, works offline |

**Future upgrade:** Piper TTS via WASM (~20MB per voice). Higher quality, more consistent across browsers.

### STT (Speech-to-Text)

| Model | ID | Size | Runtime | Status | Notes |
|---|---|---|---|---|---|
| Browser STT | `browser-speech-recognition` | 0 | Browser API | Implemented | Chrome/Edge only |

**Future upgrade:** Whisper.cpp via WASM (~75MB). Browser-agnostic, works offline on all platforms.

### Vision (OCR)

| Model | ID | Size | Runtime | Status | Notes |
|---|---|---|---|---|---|
| Tesseract.js | `tesseract-ocr` | ~15MB | WASM | Implemented | 6 languages: eng, vie, jpn, kor, fra, chi_sim |

**Future upgrade:** Florence-2 or PaliGemma for scene understanding (not just text extraction). Requires WebGPU vision model support.

### Embedding (Semantic Search)

| Model | ID | Size | Runtime | Status | Notes |
|---|---|---|---|---|---|
| Stub Embedding | `stub-embedding` | 0 | Custom (hash) | Stub | Character-level hashing, not semantic |

**Phase 2 upgrade:** all-MiniLM-L6-v2 via ONNX Runtime Web (~23MB). Real semantic similarity for memory retrieval.

### Translation

| Model | ID | Size | Runtime | Status | Notes |
|---|---|---|---|---|---|
| LLM Translation | `llm-translation-stub` | 0 | Custom (LLM prompt) | Stub | Reuses the loaded LLM for translation |

**Phase 2 upgrade:** NLLB-200-distilled via ONNX (~300MB). Dedicated, faster translation model supporting 200 languages.

## Model Swap Guide

### How to Add a New Model

1. Create a new provider class implementing `ModelProvider<T>`:

```typescript
import type { ModelInfo, ModelProvider, ModelStatus } from '../core/types';

export class MyNewProvider implements ModelProvider<MyEngine> {
  info(): ModelInfo { /* ... */ }
  async load(onProgress?): Promise<void> { /* ... */ }
  async unload(): Promise<void> { /* ... */ }
  isReady(): boolean { /* ... */ }
  getEngine(): MyEngine | null { /* ... */ }
}
```

2. Register in `NaviAgent` constructor or at runtime:

```typescript
const provider = new MyNewProvider(config);
agent.models.register(provider);
```

3. Tools automatically pick up the new provider via `ModelRegistry.getByCapability()`.

## Quantization Targets

For on-device deployment, these quantization formats are recommended:

| Format | Bits | Size Reduction | Quality Loss | Best For |
|---|---|---|---|---|
| q4f16 | 4-bit weights, fp16 activations | ~4x smaller | Minimal | LLM inference |
| q4f32 | 4-bit weights, fp32 activations | ~4x smaller | Very minimal | Higher precision tasks |
| q8f16 | 8-bit weights, fp16 activations | ~2x smaller | Negligible | When quality matters most |
| int8 | 8-bit integer | ~4x smaller | Low | ONNX embedding models |

## Runtime Requirements

| Runtime | Technology | Browser Support | Hardware |
|---|---|---|---|
| WebLLM | WebGPU | Chrome 113+, Edge 113+ | GPU with 4GB+ VRAM |
| ONNX Runtime Web | WASM + WebGPU | All modern browsers | CPU or GPU |
| Tesseract.js | WASM | All modern browsers | CPU |
| Web Speech API | Browser native | Chrome/Edge (STT), All (TTS) | None |

## Energy Mode Impact on Models

| Mode | Max Concurrent | Prefer Lite | Max Response Tokens |
|---|---|---|---|
| Performance | 4 | No | 512 |
| Balanced | 2 | No | 400 |
| Power Saver | 1 | Yes | 256 |

## TODO

- [ ] Benchmark Qwen 2.5 1.5B vs Phi-3 Mini for multilingual quality
- [ ] Evaluate NLLB-200-distilled vs LLM translation latency
- [ ] Test Whisper.cpp WASM for STT (browser-agnostic)
- [ ] Evaluate Piper TTS WASM for consistent voice quality
- [ ] Benchmark all-MiniLM-L6-v2 ONNX for semantic memory
- [ ] Measure battery impact of concurrent model loads
- [ ] Test on mid-tier Android devices (Snapdragon 7 Gen 1)
