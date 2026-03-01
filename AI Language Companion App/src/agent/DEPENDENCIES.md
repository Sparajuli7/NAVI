# NAVI Agent Framework — Dependencies

## Current Dependencies (Already Installed)

### AI / Inference
| Package | Version | Purpose | Size |
|---|---|---|---|
| `@mlc-ai/web-llm` | 0.2.81 | On-device LLM via WebGPU | ~2MB (runtime) |
| `tesseract.js` | 7.0.0 | Client-side OCR (WASM) | ~3MB (runtime) |

### Storage
| Package | Version | Purpose | Size |
|---|---|---|---|
| `idb-keyval` | 6.2.2 | IndexedDB wrapper | ~1KB |

### State Management
| Package | Version | Purpose | Size |
|---|---|---|---|
| `zustand` | 5.0.11 | Global state (3 stores) | ~3KB |

### UI Framework
| Package | Version | Purpose | Size |
|---|---|---|---|
| `react` | 18.3.1 | UI framework | ~40KB |
| `react-dom` | 18.3.1 | DOM rendering | ~120KB |
| `motion` | 12.23.24 | Animations | ~30KB |

### Styling
| Package | Version | Purpose | Size |
|---|---|---|---|
| `tailwindcss` | 4.1.12 | CSS framework | Build-time only |
| `@tailwindcss/vite` | — | Vite plugin | Build-time only |

### Build
| Package | Version | Purpose | Size |
|---|---|---|---|
| `vite` | 6.3.5 | Build tool + dev server | Dev only |
| `typescript` | 5.9.3 | Type checking | Dev only |

## No New Dependencies Added

The agent framework is built using **zero additional npm packages**. Everything uses:
- Native browser APIs (SpeechSynthesis, SpeechRecognition, Geolocation)
- Already-installed packages (idb-keyval, WebLLM, Tesseract.js)
- Pure TypeScript (cosine similarity, ring buffer, event bus)

This is intentional. On a mobile device, every KB matters.

## Future Dependencies (Phase 2+)

### When Needed
| Package | Purpose | Size | When |
|---|---|---|---|
| `onnxruntime-web` | Run ONNX models (embedding, translation) | ~5MB | When adding real embeddings or NLLB |
| `piper-wasm` | On-device TTS with consistent voices | ~20MB/voice | When browser TTS quality isn't enough |
| `whisper-wasm` | Browser-agnostic STT | ~75MB | When supporting Firefox/Safari for STT |
| `sqlite-wasm` | Structured local database | ~500KB | If IndexedDB gets unwieldy at scale |

### Not Needed (Intentionally Avoided)
| Package | Why Not |
|---|---|
| `langchain` | Too heavy for on-device, designed for cloud |
| `@pinecone-database/pinecone` | Cloud vector DB, we're local-first |
| `openai` | Cloud API, we run on-device |
| `redis` | Server-side, we use IndexedDB |
| `express` / `fastify` | No server needed — all in-process |

## Platform Bindings

### Browser APIs Used
| API | Purpose | Support |
|---|---|---|
| WebGPU | LLM inference acceleration | Chrome 113+, Edge 113+ |
| IndexedDB | Persistent storage | All modern browsers |
| SpeechSynthesis | Text-to-speech | All modern browsers |
| SpeechRecognition | Speech-to-text | Chrome/Edge only |
| Geolocation | Location detection | All (requires permission) |
| Web Workers | WASM model execution | All modern browsers |
| SharedArrayBuffer | Tesseract.js parallel processing | Requires COOP/COEP headers |

### Storage Layer
| Store | Technology | Max Size | Persistence |
|---|---|---|---|
| Working Memory | In-memory (Ring Buffer) | ~32 slots | Session only |
| Episodic Memory | IndexedDB (`idb-keyval`) | ~100 entries | Permanent |
| Semantic Memory | IndexedDB (`idb-keyval`) | ~500 entries | Permanent |
| Profile Memory | IndexedDB (`idb-keyval`) | ~10KB | Permanent |
| Model Cache | Cache API (managed by WebLLM) | ~1.5GB | Permanent |
| Conversations | IndexedDB (`idb-keyval`) | Unbounded | Permanent |

## Installation

```bash
# Already set up — no new installs needed
cd "AI Language Companion App"
pnpm install
pnpm run dev
```

## Model Downloads (First Run)

On first app launch, the LLM model downloads from the MLC model hub:

| Model | Download Size | Cached Size |
|---|---|---|
| Qwen2.5-1.5B-Instruct-q4f16_1-MLC | ~1.1GB | ~1.1GB |
| Qwen2.5-0.5B-Instruct-q4f16_1-MLC | ~394MB | ~394MB |
| Tesseract language data (on demand) | ~2-15MB/lang | ~2-15MB/lang |

After initial download, models are cached by the browser and load from disk.
