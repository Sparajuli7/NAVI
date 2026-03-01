# NAVI Agent Framework — Architecture

## Overview

The NAVI Agent Framework is a modular, local-first AI agent system designed to run entirely on-device. It provides tool routing, structured memory, model abstraction, avatar context control, and pipeline orchestration — all without network dependencies.

```
┌─────────────────────────────────────────────────────────────────┐
│                        React UI Layer                          │
│   (ConversationScreen, CameraOverlay, SettingsPanel, etc.)     │
├─────────────────────────────────────────────────────────────────┤
│                      useNaviAgent() Hook                       │
│              (Singleton agent, React state sync)               │
├─────────────────────────────────────────────────────────────────┤
│                         NaviAgent                              │
│        (Unified interface — initialize, handleMessage)         │
├────────────┬──────────────┬──────────────┬─────────────────────┤
│   Router   │  Execution   │    Event     │     Tool            │
│            │   Engine     │     Bus      │   Registry          │
├────────────┴──────────────┴──────────────┴─────────────────────┤
│                           TOOLS                                │
│  chat │ translate │ pronounce │ camera_read │ slang │ culture  │
│  generate_phrase │ memory_recall │ memory_store │ tts │ stt    │
│  switch_scenario │ switch_location                             │
├────────────┬──────────────┬──────────────┬─────────────────────┤
│   Avatar   │   Memory     │   Location   │    Pipelines        │
│  Context   │  Manager     │ Intelligence │  (Image, Pronun.)   │
│ Controller │              │              │                     │
├────────────┴──────────────┴──────────────┴─────────────────────┤
│                      Model Registry                            │
│        LLM │ TTS │ STT │ Vision │ Embedding │ Translation      │
├─────────────────────────────────────────────────────────────────┤
│                     On-Device Runtimes                         │
│       WebLLM (WebGPU) │ Tesseract (WASM) │ Browser APIs        │
└─────────────────────────────────────────────────────────────────┘
```

## Design Principles

### 1. Local-First, Offline-First
Every component runs without network access. Cloud escalation exists only as a stub for future hybrid mode. The app must work in airplane mode.

### 2. Config-Driven Behavior
Avatar personalities, scenarios, dialects, and slang are defined in JSON config files — not hardcoded in TypeScript. The product team can tune behavior by editing JSON, not code.

### 3. Provider Pattern for Models
All models implement the `ModelProvider<T>` interface. To swap a model (e.g., replace Qwen with Llama), create a new provider class and register it. No other code changes needed.

### 4. Deterministic Execution
The execution engine enforces hard constraints: max recursion depth, token budgets, timeouts. No autonomous loops. Every tool chain is bounded and traceable.

### 5. Energy-Aware
Three energy modes (performance / balanced / power_saver) control how many models are loaded concurrently, which model variants are used, and response length limits.

### 6. Wrap, Don't Rewrite
Where existing services work (modelManager.ts, location.ts, ocr.ts), the framework wraps them in provider interfaces rather than rewriting. This preserves battle-tested code.

## Module Breakdown

### Core (`agent/core/`)
- **types.ts** — All TypeScript interfaces for the framework
- **eventBus.ts** — Pub/sub for decoupled module communication
- **toolRegistry.ts** — Central registry of available tools
- **executionEngine.ts** — Deterministic tool execution with constraints
- **router.ts** — Rule-based intent routing (keyword matching)

### Memory (`agent/memory/`)
- **workingMemory.ts** — Ring buffer for current session context (auto-expires)
- **episodicMemory.ts** — Summarized conversation episodes (persisted to IndexedDB)
- **semanticMemory.ts** — Vector store for similarity search (cosine similarity)
- **profileMemory.ts** — User preferences and learning progress
- **index.ts** — MemoryManager that unifies all four systems

### Models (`agent/models/`)
- **registry.ts** — ModelRegistry with energy-aware model management
- **llmProvider.ts** — WebLLM wrapper (Qwen2.5-1.5B / 0.5B)
- **ttsProvider.ts** — Browser SpeechSynthesis wrapper
- **sttProvider.ts** — Browser SpeechRecognition wrapper
- **visionProvider.ts** — Tesseract.js OCR wrapper
- **embeddingProvider.ts** — Stub hash-based embeddings (replace with ONNX model)
- **translationProvider.ts** — LLM-based translation (replace with NLLB)

### Avatar (`agent/avatar/`)
- **contextController.ts** — Builds system prompts from layered context
- **templates.json** — Pre-built avatar profiles (6 examples)

### Location (`agent/location/`)
- **locationIntelligence.ts** — GPS detection, dialect inference, location history

### Pipelines (`agent/pipelines/`)
- **imageUnderstanding.ts** — Image → OCR → Classification → LLM explanation
- **pronunciation.ts** — STT recording → LLM evaluation → TTS playback

### Tools (`agent/tools/`)
13 registered tools covering: chat, translate, pronounce, camera_read, explain_culture, teach_slang, generate_phrase, memory_recall, memory_store, switch_scenario, switch_location, tts_speak, stt_listen

### React Integration (`agent/react/`)
- **useNaviAgent.ts** — React hook providing singleton agent instance

## Data Flow

### User Message → Response
```
User types "How do I say hello?"
  → Router: keyword "how to say" → route to 'pronounce' tool
  → ExecutionEngine: check constraints, execute tool
  → PronounceTool: build system prompt (avatar + location + memory)
  → LLMProvider.chat(): WebLLM inference on-device
  → Response with phrase card format
  → UI renders phrase card with TTS button
```

### Image Scan → Explanation
```
User takes photo of menu
  → Router: imageData present → route to 'camera_read' tool
  → CameraReadTool → ImageUnderstandingPipeline:
    1. VisionProvider.extractText() → Tesseract OCR
    2. classifyOCR() → "MENU"
    3. LLMProvider.chat() → contextual explanation
  → Response with translated menu items + recommendations
```

## Constraints & Budgets

| Constraint | Default | Rationale |
|---|---|---|
| Max recursion depth | 3 | Prevents tool call loops |
| Max token budget | 4096 | Keeps inference fast |
| Tool timeout | 30s | Prevents UI hangs |
| Working memory slots | 32 | Fixed memory footprint |
| Max episodic memories | 100 | IndexedDB size limit |
| Max semantic entries | 500 | Brute-force search stays <5ms |
| Memory slot TTL | 10 min | Auto-cleanup |

## Scaling Strategy

### Adding a New Avatar Template
1. Add entry to `avatar/templates.json`
2. Done — no code changes

### Adding a New Language/Dialect
1. Add entry to `config/dialectMap.json`
2. Add TTS/STT language code mapping
3. Done

### Adding a New Scenario
1. Add entry to `config/scenarioContexts.json`
2. Optionally add routing keywords in `router.ts`
3. Done

### Swapping the LLM
1. Create new `LLMProvider` with different model config
2. Register with `ModelRegistry`
3. Done — all tools use the provider interface

### Adding a New Tool
1. Create tool definition (implements `ToolDefinition` interface)
2. Register in `tools/index.ts`
3. Add routing keywords in `router.ts`
4. Done

## Tradeoffs

| Decision | Chosen | Alternative | Why |
|---|---|---|---|
| Router | Rule-based keywords | LLM classifier | Saves inference tokens, lower latency |
| Memory search | Brute-force cosine | HNSW index | <500 entries, brute force is fast enough |
| Embeddings | Hash-based stub | ONNX model | Avoids 30-100MB model download initially |
| Translation | LLM prompt | Dedicated model (NLLB) | Uses already-loaded model, avoids extra 500MB |
| State management | Zustand (existing) | Agent-internal state | Preserves React integration that already works |
| Persistence | IndexedDB | SQLite (via WASM) | Already in use, no extra dependency |
