# NAVI Agent Framework — Energy Optimization Notes

## Why Energy Matters

NAVI runs on phones. On-device LLM inference is GPU-intensive. Users in travel scenarios may not have access to chargers. Every design decision must account for battery impact.

## Current Energy Modes

### Performance Mode
- **Use case:** Plugged in, or short sessions
- **Max concurrent models:** 4
- **Model variant:** Full (1.5B)
- **Max response tokens:** 512
- **Aggressive caching:** Yes
- **Estimated impact:** High battery drain, fastest responses

### Balanced Mode (Default)
- **Use case:** Normal usage
- **Max concurrent models:** 2
- **Model variant:** Full (1.5B)
- **Max response tokens:** 400
- **Aggressive caching:** No
- **Estimated impact:** Moderate battery drain

### Power Saver Mode
- **Use case:** Low battery, extended travel days
- **Max concurrent models:** 1
- **Model variant:** Lite (0.5B)
- **Max response tokens:** 256
- **Aggressive caching:** No
- **Estimated impact:** Minimal battery drain, reduced quality

## Optimization Strategies

### 1. Lazy Model Loading
Models are only loaded when first used. The LLM loads on app start (required), but TTS, STT, and Vision load on demand. This saves ~15MB of WASM initialization for users who only type.

### 2. Model Unloading
In power saver mode, non-essential models are unloaded after use. The LLM stays loaded (it's the core product), but Vision, TTS, and STT are unloaded when idle.

### 3. Response Length Control
Token limits are reduced in power saver mode. Shorter responses = fewer GPU cycles = less battery. The avatar is instructed to be more concise.

### 4. Ring Buffer Working Memory
Fixed-size working memory (32 slots) prevents unbounded memory growth during long sessions. Memory pressure on phones causes the OS to kill background processes, which increases battery usage through re-initialization.

### 5. Async Memory Updates
Episodic memory summaries are generated after the response is shown to the user, not during the response. This avoids blocking the UI and spreads GPU load over time.

### 6. Rule-Based Routing (vs LLM Routing)
The router uses keyword matching instead of LLM inference. This saves ~200-500ms and ~100 tokens per request. Over a 30-minute session with 20 exchanges, that's 2,000 tokens saved.

### 7. Stub Embeddings
The hash-based embedding stub uses zero GPU. Real embedding models would add ~20ms per query. At the current scale (<500 entries), brute-force hash search is adequate and free.

## Measurements Needed (TODO)

- [ ] **Battery drain per 10-minute conversation** — continuous chat, measure mA
- [ ] **GPU memory usage** — Qwen 1.5B loaded, peak during inference
- [ ] **Thermal throttling threshold** — how many consecutive inferences before throttling
- [ ] **Cold start time** — app launch to first response (model cached vs not)
- [ ] **WebGPU vs WASM performance** — compare inference paths
- [ ] **Background power draw** — app in background with model loaded vs unloaded
- [ ] **Network vs cached model load** — first download battery cost

## Device Targets

| Device Tier | Example | RAM | GPU | Target Performance |
|---|---|---|---|---|
| High-end | iPhone 15 Pro, Pixel 8 Pro | 8GB+ | A17/Tensor G3 | Full experience, performance mode viable |
| Mid-range | Pixel 7a, Galaxy A54 | 6GB | Mali-G710/Adreno 619 | Balanced mode, occasional power saver |
| Budget | Galaxy A14, Redmi Note 12 | 4GB | Mali-G52/Adreno 610 | Power saver mode only, lite model |

## WebGPU Considerations

- WebGPU is the fastest path for on-device LLM but not all devices support it
- Fallback to WASM (via WebLLM's built-in fallback) for unsupported devices
- WASM inference is 3-10x slower but works everywhere
- WebGPU uses dedicated GPU memory — cannot be swapped to RAM
- GPU memory is limited (usually 25-50% of total device RAM)

## Recommendations

1. **Default to balanced mode** — good enough for most users
2. **Auto-switch to power saver** when battery < 20% (future feature)
3. **Preload only the LLM** — everything else loads on demand
4. **Unload models aggressively** in power saver mode
5. **Batch memory operations** — don't write to IndexedDB after every message
6. **Use streaming** — first token appears fast, total generation can be shorter
7. **Monitor thermal state** — if device is hot, reduce max_tokens automatically
