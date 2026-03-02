# NAVI Agent Framework — Future Scaling Strategy

## Phase 2: Model Upgrades

### Real Embedding Model
**Current:** Hash-based stub (character-level, no semantic understanding)
**Target:** all-MiniLM-L6-v2 via ONNX Runtime Web (~23MB)
**Impact:** Enables true semantic memory search — "recall conversations about food" actually works
**Effort:** Create new `OnnxEmbeddingProvider`, register with `ModelRegistry`
**No other code changes needed** — SemanticMemoryStore already uses cosine similarity

### Dedicated Translation Model
**Current:** LLM-based (reuses Qwen for translation prompts)
**Target:** NLLB-200-distilled via ONNX (~300MB)
**Impact:** 5-10x faster translation, better quality for low-resource languages
**Effort:** Create `NLLBProvider`, register with `ModelRegistry`
**TranslationProvider interface stays the same**

### Better TTS
**Current:** Browser SpeechSynthesis API (inconsistent quality across devices)
**Target:** Piper TTS via WASM (~20MB per voice pack)
**Impact:** Consistent, natural-sounding voices across all devices
**Effort:** Create `PiperTTSProvider`, register with `ModelRegistry`
**TTSProvider interface stays the same**

### Browser-Agnostic STT
**Current:** Browser SpeechRecognition API (Chrome/Edge only)
**Target:** Whisper.cpp via WASM (~75MB)
**Impact:** Works on Firefox, Safari, all mobile browsers
**Effort:** Create `WhisperSTTProvider`, register with `ModelRegistry`
**STTProvider interface stays the same**

## Phase 3: Architecture Enhancements

### LLM-Based Router
**Current:** Rule-based keyword matching
**Target:** Small classifier model or LLM routing with a tiny model
**Impact:** Handles ambiguous intents ("I need help" → which tool?)
**Approach:** Train a ~5MB intent classifier or use the 0.5B model for routing
**The router interface stays the same** — just swap the implementation

### Conversation Memory Compression
**Current:** LLM generates episodic summaries
**Target:** Hierarchical summarization (session → day → week → permanent)
**Impact:** Long-term memory that doesn't grow unbounded
**Approach:** Background job after each session summarizes, compresses older entries

### Multi-Avatar Sessions
**Current:** One active avatar at a time
**Target:** Multiple avatars in a scene (e.g., practice ordering with waiter + friend)
**Impact:** More realistic practice scenarios
**Approach:** AvatarContextController already supports profiles — extend to manage multiple active profiles with turn-taking logic

### Real-Time Voice Conversation
**Current:** Type → response → optionally hear TTS
**Target:** Full voice-to-voice conversation (like a phone call)
**Impact:** Hands-free usage, more natural interaction
**Approach:** Continuous STT → Router → LLM → TTS pipeline with interruption handling

## Scaling New Content

### Adding New Languages
1. Add dialect entry to `config/dialectMap.json`:
```json
{
  "BR/São Paulo": {
    "language": "Portuguese",
    "dialect": "Brazilian Portuguese (Paulista)",
    "formality_default": "casual",
    "cultural_notes": "...",
    "slang_era": { "gen_z": "...", "millennial": "...", "older": "..." }
  }
}
```
2. Add TTS language code mapping in `ttsProvider.ts`
3. Add Tesseract language data code in `visionProvider.ts`
4. Done — no other changes

### Adding New Scenarios
1. Add entry to `config/scenarioContexts.json`:
```json
{
  "airport": {
    "label": "At the Airport",
    "vocabulary_focus": ["boarding", "customs", "gates"],
    "tone_shift": "practical, urgent",
    "formality_adjustment": 1,
    "auto_suggestions": ["Where's my gate?", "Customs phrases"],
    "pronunciation_priority": ["excuse me", "passport"]
  }
}
```
2. Optionally add routing keywords in `router.ts`
3. Done

### Adding New Avatar Templates
1. Add entry to `agent/avatar/templates.json`:
```json
{
  "id": "airport_helper",
  "name": "Airport Guide",
  "ageGroup": "30s",
  "dialect": "...",
  ...
}
```
2. Done — no code changes

### Adding New Tools
1. Create a tool definition file in `agent/tools/`:
```typescript
export function createMyTool(deps): ToolDefinition {
  return {
    name: 'my_tool',
    description: '...',
    paramSchema: { ... },
    requiredModels: ['llm'],
    costTier: 'heavy',
    async execute(params) { ... },
  };
}
```
2. Register in `agent/tools/index.ts`
3. Add routing rules in `agent/core/router.ts`
4. Done

## Platform Scaling

### React Native / Mobile
The agent framework is platform-agnostic TypeScript. For React Native:
- Replace WebLLM with `react-native-mlc` or `llama.cpp` bindings
- Replace Browser APIs (TTS/STT) with native modules
- Replace IndexedDB with AsyncStorage or SQLite
- **All interfaces stay the same** — just swap providers

### Electron / Desktop
- WebLLM works in Electron (Chromium WebGPU)
- Larger models possible (more RAM/VRAM)
- Set energy mode to 'performance'

### Progressive Web App (PWA)
- Service worker for offline caching
- Model downloads cached via Cache API
- IndexedDB persistence already works
- Add web app manifest for installability

## Performance Targets

| Metric | Current (Estimate) | Phase 2 Target | Phase 3 Target |
|---|---|---|---|
| First response latency | ~3-5s | ~2-3s | ~1-2s |
| Streaming first token | ~1-2s | ~0.5-1s | ~0.3-0.5s |
| OCR processing | ~2-5s | ~1-3s | ~1-2s |
| Translation | ~3-5s (LLM) | ~0.5-1s (NLLB) | ~0.3s |
| Memory retrieval | <5ms | <10ms (with ONNX embed) | <10ms |
| Model load (cold) | ~30-60s | ~20-40s | ~15-30s |
| Model load (cached) | ~5-10s | ~3-5s | ~2-3s |

## TODO (Research)

- [ ] Benchmark on mid-tier phones (Snapdragon 7 Gen 1, A15 Bionic)
- [ ] Measure battery drain during sustained conversation (30 min)
- [ ] Test model loading on 4G vs cached performance
- [ ] Evaluate MLC model zoo for newer/better small LLMs
- [ ] Profile WebGPU memory usage with concurrent models
- [ ] Test IndexedDB limits on iOS Safari (50MB soft limit)
- [ ] Investigate SharedArrayBuffer requirements for Tesseract
- [ ] Evaluate WebNN API as WebGPU alternative for wider device support
