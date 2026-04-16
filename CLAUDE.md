
## STANDING INSTRUCTION FOR CLAUDE CODE
After completing ANY task, before committing:
1. Update the "Known Gaps" section in this file if anything was resolved or added
2. Update audit.md — mark gaps as resolved/in-progress, add new ones discovered
3. Include all doc updates in the same commit as the code change
4. Never commit code without updating these two files


# NAVI — Project Guide

## What Is NAVI?

NAVI is an **AI language companion app** — a local friend in your pocket who speaks the language, knows the slang, understands the culture, and explains everything like a native. It uses a hybrid inference approach: cloud LLMs (OpenRouter) by default for quality and speed, with on-device WebGPU inference (WebLLM) available as a fallback for privacy or offline use.

**The core bet:** Most language tools give you translations. NAVI gives you a companion — one that knows where you are, remembers your conversations, adapts to your level, and teaches you how locals actually speak.

**Target users:** Travelers, immigrants, expats, multilingual families, service workers in multilingual environments.

---

## Project Structure

```
/NAVI/
├── AI Language Companion App/        # Main React app (Vite + TypeScript)
│   ├── src/
│   │   ├── agent/                    # MULTI-AGENT FRAMEWORK (Orchestrator pattern)
│   │   │   ├── core/                 # Router, ExecutionEngine, ToolRegistry, EventBus, Types
│   │   │   ├── agents/              # Sub-agents (MemoryRetrievalAgent, ResearchAgent)
│   │   │   ├── memory/              # 9-tier memory (+ KnowledgeGraph + MemoryMaker)
│   │   │   ├── models/              # Model providers (LLM, TTS, STT, Vision, Embedding)
│   │   │   ├── avatar/              # AvatarContextController + template configs
│   │   │   ├── location/            # LocationIntelligence module
│   │   │   ├── director/            # ConversationDirector (learning goals, pre/post processing)
│   │   │   ├── prompts/             # PromptLoader + phraseDetector
│   │   │   ├── pipelines/           # Multi-step pipelines (image, pronunciation)
│   │   │   ├── tools/               # 13 registered tools
│   │   │   ├── react/               # useNaviAgent() hook
│   │   │   └── index.ts             # NaviAgent (Orchestrator) + createNaviAgent()
│   │   ├── app/
│   │   │   ├── App.tsx               # Root component — phase state machine
│   │   │   └── components/           # 15+ custom components
│   │   │       ├── ui/               # 50+ shadcn/ui primitives
│   │   │       ├── ConversationScreen.tsx   # Main chat interface
│   │   │       ├── AvatarSelectScreen.tsx    # Onboarding — pick avatar template
│   │   │       ├── CameraOverlay.tsx        # Camera + OCR UI
│   │   │       ├── ExpandedPhraseCard.tsx   # Phrase detail bottom sheet
│   │   │       ├── NewChatBubble.tsx        # Chat message bubbles
│   │   │       ├── BlockyAvatar.tsx         # 8-bit avatar renderer
│   │   │       ├── SettingsPanel.tsx        # Settings UI
│   │   │       ├── ModelDownloadScreen.tsx  # Model download progress
│   │   │       └── QuickActionPill.tsx      # Contextual action buttons
│   │   ├── services/                 # Legacy service layer (wrapped by agent)
│   │   │   ├── modelManager.ts      # Model download/load/status + WebGPU check
│   │   │   ├── ocr.ts               # Tesseract.js OCR
│   │   │   ├── tts.ts               # Text-to-speech (Web Speech API)
│   │   │   ├── stt.ts               # Speech-to-text (Web Speech API)
│   │   │   └── location.ts          # Geolocation + city/dialect lookup
│   │   ├── stores/                   # Zustand state management
│   │   │   ├── appStore.ts          # Global app config + model status
│   │   │   ├── characterStore.ts    # Active AI character + memories
│   │   │   └── chatStore.ts         # Messages + scenario state
│   │   ├── utils/                    # Helpers (storage, parsing, tokens, etc.)
│   │   │   ├── locationHelpers.ts   # Shared dialect/location resolution
│   │   │   ├── avatarProfileHelpers.ts # Character → AvatarProfile mapping
│   │   ├── config/                   # Data files (editable without code)
│   │   │   ├── avatarTemplates.json # 8 character templates by vocation
│   │   │   ├── dialectMap.json      # Language/dialect/slang mappings
│   │   │   ├── scenarioContexts.json # 8 scenario types
│   │   │   ├── userPreferenceSchema.json
│   │   │   └── prompts/             # PROMPT CONFIG FILES (edit here to change behavior)
│   │   │       ├── coreRules.json       # Core rules (phrase format, behavior)
│   │   │       ├── toolPrompts.json     # Per-tool prompts + temperature/max_tokens
│   │   │       ├── documentPrompts.json # Image/camera document prompts (6 types)
│   │   │       ├── systemLayers.json    # System prompt layer templates + conversation goals
│   │   │       ├── warmthLevels.json    # 5-tier warmth behavior (stranger → family)
│   │   │       ├── memoryExtraction.json # Memory consolidation prompt
│   │   │       ├── characterGen.json    # Character generation prompts
│   │   │       └── learningProtocols.json # 8 evidence-based language learning protocols
│   │   ├── types/                    # TypeScript interfaces
│   │   ├── utils/                    # Helpers (storage, parsing, tokens, etc.)
│   │   ├── data/cities.json          # Global city database
│   │   └── styles/                   # Tailwind theme + fonts
│   ├── package.json
│   ├── vite.config.ts
│   └── navi-prompts-v3.md            # Prompt templates reference
├── navi-prd-v3.md                    # Full product requirements document
├── navi-claude-code-prompts.md       # Implementation task prompts
├── audit.md                          # Previous code audit
└── CLAUDE.md                         # This file
```

---

## Tech Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| **Framework** | React + TypeScript | React 18.3.1, TS ^5.9.3 | Vite 6.3.5 build tool |
| **Styling** | TailwindCSS + shadcn/ui | TailwindCSS 4.1.12 | 50+ Radix-based components |
| **State** | Zustand | ^5.0.11 | 3 stores: app, character, chat |
| **Storage** | IndexedDB (idb-keyval) | ^6.2.2 | Persists character, messages, memories, prefs |
| **On-Device LLM** | @mlc-ai/web-llm | ^0.2.81 | WebGPU inference, Qwen2.5-1.5B model |
| **Local LLM (Alt)** | Ollama | external | Local server backend, any model (qwen, llama, mistral) |
| **OCR** | tesseract.js | ^7.0.0 | Client-side, 6 languages |
| **TTS** | Web Speech API | browser | Browser SpeechSynthesis |
| **STT** | Web Speech API | browser | Browser SpeechRecognition |
| **Animation** | motion (Framer Motion) | 12.23.24 | Transitions + AnimatePresence |
| **Icons** | lucide-react | 0.487.0 | 400+ icons |
| **Drawer** | vaul | 1.1.2 | Bottom sheet component (used by shadcn/ui) |
| **Toasts** | sonner | 2.0.3 | Notification toasts (used by shadcn/ui) |
| **Avatars** | avataaars | ^2.0.0 | Installed; avatar rendering currently via BlockyAvatar (custom) |

**Installed but not actively used:**
- `react-router` 7.13.0 — navigation is manual via `useState` in App.tsx
- `next-themes` 0.4.6 — dark mode handled manually via `classList`
- `@mui/material` 7.3.5 + `@emotion/react` 11.14.0 — not used in custom components

---

## Architecture

### App Phase State Machine
```
init → [check WebGPU]
  ├── no_webgpu → backend_select (pick cloud model)
  └── First launch (WebGPU OK):
       onboarding (avatar selection) → downloading (model download) → chat
  └── Returning user:
       downloading (if needed) → home / chat
```

### On-Device AI Pipeline
All AI runs locally on the user's device via WebGPU:
- **LLM**: Qwen2.5-1.5B-Instruct (q4f16, ~1.1GB) — chat, character gen, memory extraction
- **OCR**: Tesseract.js — image/document text extraction
- **TTS**: Browser SpeechSynthesis — phrase playback
- **STT**: Browser SpeechRecognition — voice input

### 11-Layer System Prompt Engine
Each LLM call is guided by a layered system prompt (assembled by `AvatarContextController`):
1. **Identity** — Character name, personality, speaking style (from `systemLayers.json`)
2. **User Preferences** — Age, gender, vocation, formality, learning focus
3. **Location + Dialect** — City, country, dialect specifics, generational slang
4. **Scenario** — Context-specific vocab/tone (restaurant, hospital, office, etc.)
5. **Memory** — Episodic memories, profile context, working memory
6. **Personality Override** — Temporary adjustments
7. **Additional Context** — Injected context
8. **Warmth Instruction** — Relationship-tier behavior (from `warmthLevels.json`)
9. **Learning Context** — Learner profile stats, recent phrases, weak topics
10. **Conversation Goals** — Director-injected goals (from `systemLayers.json`)
11. **Core Rules** — Pronunciation format, phrase card structure (from `coreRules.json`)

### Prompt Config System (`src/config/prompts/`)
All prompt text lives in editable JSON files — edit prompts without touching TypeScript:
- `coreRules.json` — Immutable behavior rules and phrase card format
- `toolPrompts.json` — Per-tool prompts with temperature/max_tokens
- `documentPrompts.json` — Image/camera analysis prompts (6 doc types)
- `systemLayers.json` — Layer templates + conversation goal definitions (7 goal types)
- `warmthLevels.json` — 5-tier warmth behavior instructions (stranger → family)
- `memoryExtraction.json` — Memory consolidation prompt
- `characterGen.json` — Character generation prompts (free-text + template)

Templates use `{{variable}}` interpolation via `PromptLoader`:
```typescript
promptLoader.get('toolPrompts.pronounce.template', { language: 'Korean', dialect: 'Seoul' })
promptLoader.get('systemLayers.conversationGoals.review_due_phrases', { phrases: '"xin chào"' })
```

### Data Models
- **Character**: name, personality, avatar colors, speaking style, location context
- **Message**: role (user/character/system), content, type (text/phrase_card/camera_result)
- **LocationContext**: city, country, dialect key, cultural notes, slang era
- **MemoryEntry**: fact extracted from conversation, timestamp
- **TrackedPhrase**: phrase text, pronunciation, mastery level, spaced repetition schedule, location learned
- **RelationshipState**: per-avatar warmth 0-1, milestones, shared references, streak
- **TopicProficiency**: topic name, score 0-1, attempt count

### Agent Framework (`src/agent/`) — Multi-Agent Orchestrator
The agent framework uses an **Orchestrator pattern** with sub-agents:

**Orchestrator (NaviAgent):**
- **NaviAgent** — Orchestrator entry point (`createNaviAgent()`), delegates to sub-agents before each LLM call
- **Router** — Rule-based intent routing (keyword matching, deterministic)
- **ExecutionEngine** — Bounded tool execution (recursion limits, token budgets, timeouts)
- **ToolRegistry** — 13 registered tools (chat, translate, pronounce, camera, culture, slang, etc.)
- **AvatarContextController** — Config-driven avatar behavior (JSON-editable, 15-layer prompt builder)
- **ConversationDirector** — Pre/post-processing for learning goals (no extra LLM calls)
- **Context Injection Protocol** — Merges sub-agent outputs into avatar scaffold layers

**Sub-Agents (`src/agent/agents/`):**
- **MemoryRetrievalAgent** — Traverses Knowledge Graph to surface relevant context (terms, engagement patterns, cross-location bridges)
- **ResearchAgent** — Holds 8 evidence-based language learning protocols (Krashen i+1, Leitner SR, Output Hypothesis, Affective Filter, etc.); recommends which to apply per turn

**Memory System (`src/agent/memory/`):**
- **KnowledgeGraphStore** — Rich graph of ConversationNodes, TermNodes, TopicNodes, ScenarioNodes, AvatarNodes, LocationNodes with edges (LEARNED_IN, TAUGHT_BY, ENCOUNTERED_VIA, etc.)
- **MemoryMaker** — Post-conversation graph writer extracting 5 metadata dimensions: terms learned, engagement score, language/script/avatar, encounter context, inferred reason
- **MemoryManager** — 9-system memory (working, episodic, semantic, profile, learner, relationships, situation, graph, memoryMaker)
- **ModelRegistry** — Provider pattern for all models (LLM, TTS, STT, Vision, Embedding, Translation)
- **LearnerProfileStore** — Phrase tracking + spaced repetition (dual-track Leitner intervals)
- **RelationshipStore** — Per-avatar warmth progression (~200 interactions stranger → family)
- **PromptLoader** — Build-time JSON imports + `{{variable}}` interpolation + A/B testing (now loads 8 configs incl. `learningProtocols.json`)
- **PhraseDetector** — Regex-based phrase card detection in LLM responses
- **LocationIntelligence** — GPS detection + dialect inference + cross-location bridging
- **Pipelines** — Multi-step orchestrations (image understanding, pronunciation evaluation)
- **useNaviAgent()** — React hook exposing singleton agent instance

---

## Current Implementation Status

### Fully Built
- All frontend UI components (15+ custom, 50+ shadcn/ui)
- Zustand stores (app, character, chat) with full type definitions
- IndexedDB persistence layer (character, conversations, memories, preferences, location)
- Service layer functions (LLM, OCR, TTS, STT, location)
- System prompt builder (11-layer engine with config-driven prompts)
- Character generation prompts (config-driven via `characterGen.json`)
- Configuration data (8 avatar templates, 9 dialects incl. Nepali/Kathmandu, 20 scenarios, city database)
- Dark/light theme with custom typography (Playfair Display, DM Sans, Source Serif 4)
- Model download + loading logic (WebLLM + Ollama dual backend)
- **Agent framework** — full infrastructure (router, tools, memory, models, avatar, pipelines)
- **6-system memory** — working (ring buffer), episodic, semantic (vectors), profile, learner, relationships
- **Model abstraction layer** — provider pattern (WebLLM + Ollama + OpenRouter via ChatLLM interface); when `VITE_OPENROUTER_API_KEY` is set, `OpenRouterProvider` becomes the active LLM for all tools and model download is skipped entirely
- **Avatar context controller** — config-driven behavior, 11-layer prompt assembly
- **13 registered tools** — chat, translate, pronounce, camera_read, culture, slang, phrase, memory, scenario, location, tts, stt
- **Image understanding pipeline** — OCR → classification → LLM explanation
- **Pronunciation evaluation pipeline** — STT → LLM evaluation → TTS playback
- **Prompt extraction system** — all prompts in editable JSON configs with PromptLoader
- **Relationship layer** — per-avatar warmth (5 tiers), milestones, shared references
- **Learner profile** — phrase tracking, spaced repetition, topic proficiency, streak tracking
- **Conversation director** — pre/post-processing for learning goals (no extra LLM calls)
- **Cross-location bridging** — episodic memory queries across locations for continuity
- **Phrase detector** — regex-based phrase card detection in LLM responses
- **Mode classifier** — rolling keyword accumulator in `agent/index.ts`; silently locks `userMode` (learn/guide/friend) at threshold=2 signals across rolling window; persists to ProfileMemory
- **Language enforcement** — `languageEnforcement` layer injected in `contextController` after identity layer; hard-locks avatar language regardless of user input
- **Mode instruction layers** — per-mode system prompt overlays (learn=immersion, guide=translate-primary, friend=empathy-first); injected by `contextController` based on `userMode`
- **Guide mode ambient listening** — mic in guide mode captures local speech in avatar's dialect language, sends with `translationMode: 'listen'`, uses `listenAndTranslate` prompt template
- **AvatarRenderer** — `app/components/AvatarRenderer.tsx`; wraps `avataaars` with Framer Motion animated states (idle, generating, speaking, success, thinking); random eye blink
- **Onboarding language picker** — native language selection step added first in `NewOnboardingScreen.tsx` (13 languages + Other); auto-advances on selection
- **Web presence** — `web/index.html` (landing page), `web/feedback.html` (feedback form), `web/worker.js` (Cloudflare Worker + D1 storage)
- **Avatar prefs from LLM character generation** — `characterGen.json` both templates now emit `avatar_prefs` in the same JSON response; `validateAvatarPrefs()` checks all enum values; `deriveAvatarPrefs()` provides deterministic fallback from `style`/gender/age; `Character.avatar_prefs` persisted to IndexedDB; `AvatarBuilder` seeded from LLM output on first render

### Remaining: Wire Agent → UI
The agent framework is fully built. All UI screens still call legacy services directly (Prompts 3–8 wired the UI to `llm.ts`/`tts.ts`/etc., not to `agent.handleMessage()`).

- Connect `useNaviAgent()` hook to ConversationScreen's `handleSend()` → replace `llm.streamMessage()` with `agent.handleMessage()`
- Wire CameraOverlay to `agent.handleImage()` — **OCR/LLM pipeline in CameraOverlay is not yet wired** (Prompt 7 incomplete)
- Wire ExpandedPhraseCard TTS/STT to agent tools
- Wire SettingsPanel to agent memory/location/energy APIs

### Resolved Feature Gaps (2026-03-26)
- ~~**Phrase tool repeats already-taught phrases**~~ — `phraseTool.ts` now reads `memoryManager.learner.phrases`, sorts by `lastPracticed`, takes the 10 most recent, and injects them as `recentPhrases` into `toolPrompts.phrase.template`. The template appends "Do NOT repeat any of these phrases" so the model avoids repetition.
- ~~**Confusion signals ignored — avatar keeps talking in local language**~~ — Added `CONFUSION OVERRIDE (highest priority)` block at the top of `coreRules.rules` in `coreRules.json`. Triggers on "I don't understand", "what?", "what does that mean", etc. — forces immediate switch to `{{userNativeLanguage}}` with one recovery phrase.
- ~~**Markdown asterisks rendering as raw text in segment paths**~~ — Applied `stripInlineMarkdown()` to all 4 previously unprocessed render sites in `NewChatBubble.tsx`: `SpeechBubble` segment text, `ChatLogEntry` segment text, `NewChatBubble` segment text, `NewChatBubble` fallback `{content}`.
- ~~**Avatar opens in wrong language (e.g. French instead of Nepali)**~~ — Fixed dialect key precedence in `NewOnboardingScreen.tsx` line 381: flipped to `dialectKey || dialectInfo?.dialect || ''` so the map key (used for direct lookup in `resolveDialect`) takes priority over the human-readable dialect name. Added `console.warn` in `contextController.ts` `buildLocationLayer` when dialect resolution fails.

### Resolved Feature Gaps (2026-03-28)
- ~~**OpenRouter rate limits exhaust single key**~~ — `VITE_OPENROUTER_API_KEY` now accepts comma-separated keys (e.g. `key1,key2,key3`). `OpenRouterProvider` constructor accepts `string | string[]`. On 429 or 503, the provider increments `currentKeyIndex` and retries the request with the next key within the same `chat()` call. After all keys are exhausted the user-facing "high demand" error is thrown. `agent/index.ts` splits the env value by comma before passing to the constructor.
- ~~**OpenRouter 402 crash + same-account key rotation useless**~~ — Rewrote `chat()` rotation logic in `openRouterProvider.ts`. `RETRYABLE_STATUSES = {402, 429, 500, 502, 503, 504}` — 402 no longer throws. Each retry attempt cycles to the next model in `FALLBACK_MODELS` (qwen3-32b → llama-3.3-70b → mistral-small → gemma-3-27b), so same-account users get 4× effective throughput via per-model rate limit pools. Added 100ms throttle between requests. `empty_response` now also advances `currentKeyIndex`. Error body logged on all retryable failures.
- ~~**"High demand" error despite 10 keys + 4 models configured**~~ — Removed `MAX_ATTEMPTS = 8` hard-cap; now tries all `keys × models` combinations (40 for 10×4). Added `Retry-After` header respect on 429s (sleeps up to 30s). Replaced flat 100ms throttle with exponential backoff (200ms→8s). Raised `DEFAULT_TIMEOUT` 30s→90s for slow free models. Added `408` to `RETRYABLE_STATUSES`.
- ~~**Avatar opens in English for Kathmandu/Nepali characters**~~ — Added Kathmandu/Devanagari example (`नमस्ते! (na-MAS-tay) आज Thamel maa ekdam bheed chha...`) to all 3 FIRST MESSAGE RULE sections in `characterGen.json` (`firstMsgRules`, `freeText.template` rule 2, `fromTemplate.template` rule 2). Added script instructions: Nepali → Devanagari with romanization; Japanese/Korean/Thai/Arabic → native script with romanization; never default to English.

### Resolved Feature Gaps (2026-03-28c)
- ~~**No session-level goal persistence**~~ — `SessionPlanner` added to `src/agent/director/SessionPlanner.ts`. Picks one goal per session using 7-priority algorithm, stored in WorkingMemory with 2h TTL. `ConversationDirector.setSessionPlanner()` wires it in; `preProcess()` injects session goal instruction; `postProcess()` marks goal achieved when target phrase/topic appears in exchange.
- ~~**No proactive messages on app open**~~ — `ProactiveEngine` added to `src/agent/director/ProactiveEngine.ts`. Four triggers: 7-day absence, 2-day absence, streak milestones (7/14/30), struggling phrases. `NaviAgent.getProactiveMessage()` exposed as public method. Wired into `ConversationScreen`: fires once on mount when `isLLMReady` and `messages.length > 0` (returning users only); result injected as a `'character'` message.
- ~~**Single SR track for all phrases**~~ — `LearnerProfileStore` now has dual tracks: `STRUGGLE_INTERVALS` (urgent: 6h→2w) and `SUCCESS_INTERVALS` (relaxed: 2d→2mo). `struggleCount` field on `TrackedPhrase` (optional, backwards-compat). `getUrgentReviewPhrases()` and `getRoutineReviewPhrases()` methods added.
- ~~**No personal context surfacing in system prompt**~~ — `ConversationDirector.surfacePersonalContext()` pulls top-3 high-importance episodic memories (importance >= 0.5) and injects as "PERSONAL CONTEXT" block into `promptInjection`.
- ~~**No flashcard review UI**~~ — `FlashcardDeck.tsx` at `src/app/components/FlashcardDeck.tsx`. Card flip, filters, mastery colors, Practice → chat. Wired via **`LayoutList`** header button; `agent.memory.learner.phrases` is the data source. Full-screen `motion` overlay (`z-[43]`).
- ~~**No phrase knowledge graph / dictionary map**~~ — `KnowledgeGraphScreen.tsx` + `PhraseDetailSheet.tsx`: graph nodes from learner phrases (category links, same-flag when using `countryCode`); demo packs for Vietnam / France / Japan when phrases are empty; search + filters; **`BookOpen`** opens graph; graph header can jump to card deck; **My phrases** quick pill opens graph; Practice queues the same practice prompt as flashcards.
- ~~**`reconnect` goal missing from systemLayers.json**~~ — Added to `conversationGoals` in `src/config/prompts/systemLayers.json`.

### Resolved Feature Gaps (2026-03-29)
- ~~**No user-driven avatar appearance in onboarding**~~ — Added 'appearance' step to `NewOnboardingScreen.tsx` between describe and generation. User types appearance description → `generateAvatarImageFromDescription()` (new export in `generateAvatarImage.ts`) calls OpenRouter Llama 3.3 70B to convert description to image prompt, then HF FLUX.1-schnell generates the image (returned as base64 data URI). `Character.avatarImageUrl` added to type. `ConversationScreen` renders `<img>` when `avatarImageUrl` is set, otherwise falls back to `AIAvatarDisplay` unchanged.
- ~~**Avatar image generation always failing (DiceBear stuck)**~~ — `generateAvatarImageFromDescription` now logs HF FLUX failures to console and falls back to Pollinations.ai (Step C) when HF returns non-ok or empty blob. Pollinations.ai requires no token and is reliable. Error messages: `[NAVI] avatar HF FLUX failed: <status>` or `[NAVI] avatar falling back to Pollinations.ai`.
- ~~**New companion always named "Arjun" in Kathmandu**~~ — Added Kathmandu/Nepal names (`Arjun, Sita, Arun, Priya, Ramesh, Anisha, Santosh, Deepa, Rohan, Maya`) to the NAME RULE in both `freeText.template` and `fromTemplate.template` in `characterGen.json` so the LLM picks varied names. `fallbackNameFor('kathmandu')` now randomly picks from the same list instead of always returning `'Arjun'`.

### Resolved Feature Gaps (2026-04-06)
- ~~**No runtime backend switching**~~ — Added 3-way backend selector to Settings → Model: On-Device (WebGPU), Cloud Free (OpenRouter free models), Cloud Paid (OpenRouter with credits). `NaviAgent.switchBackend()` swaps the active LLM provider at runtime, re-registers all tools, and persists the choice to localStorage (`navi_backend_pref`, `navi_openrouter_key`, `navi_openrouter_tier`, `navi_webllm_preset`). On next startup, the saved backend is restored automatically. `useNaviAgent` exposes `switchBackend`, `webllmPreset`, `openRouterTier`.
- ~~**OpenRouter key in Settings was cosmetic**~~ — The key saved to `localStorage('navi_openrouter_key')` is now wired to the agent. Selecting Cloud Free or Cloud Paid and tapping Apply actually switches inference to OpenRouter using the provided key.
- ~~**Only 2 WebLLM models**~~ — Added 4 new WebLLM presets: Phi-3.5 Mini (3.8B, 2.2GB), Gemma 2 2B (1.5GB), Llama 3.2 1B (0.74GB), Llama 3.2 3B (1.9GB). All verified against the installed `@mlc-ai/web-llm` model list.
- ~~**Model selection never shown to users**~~ — `BackendSelectScreen.tsx` added as a `'backend_select'` AppPhase shown on first launch (when `navi_backend_pref` absent). Presents 3 cards (Cloud Free / Cloud Paid / On-Device) in a clean full-screen UI. After user picks and taps "Get Started →", `switchBackend()` writes the pref and the screen is never shown again. Subsequent launches go straight to the normal flow. Qwen3 presets (1.7B default, 4B, 0.6B) + Gemma 4 as top free model + OpenAI models in paid list.
- ~~**Qwen2.5 as default WebLLM model despite Qwen3 being available**~~ — Default preset changed to `qwen3-1.7b` (better multilingual performance). All 3 Qwen3 sizes added. FALLBACK_MODELS expanded to 8 (Gemma 4 first for best quality). PAID_MODELS includes OpenAI models accessible via OpenRouter integrations.

### Resolved Feature Gaps (2026-04-10)
- ~~**OpenRouter invoked without explicit user choice**~~ — `agent/index.ts` constructor condition tightened from `llmBackend !== 'webllm'` to `llmBackend === 'openrouter'`. `VITE_OPENROUTER_API_KEY` in the build env no longer silently activates OpenRouter on first run (when `navi_backend_pref` is not yet set). Cloud backend now requires the user to explicitly choose it via BackendSelectScreen or Settings.
- ~~**Proactive message repeats and poisons LLM context**~~ — Two-layer fix: (1) `ProactiveEngine` now has a `firedThisSession` instance flag so `getProactiveMessage()` returns null on any call after the first, preventing re-fires if `ConversationScreen` unmounts/remounts. (2) Proactive messages stored in chat history are now tagged with `metadata: { isProactive: true }` and filtered out of the history slice passed to the LLM — prevents cheap free-tier models from pattern-matching the proactive text and echoing it back as a response.

### Resolved Feature Gaps (2026-04-08)
- ~~**Navbar edit/settings buttons non-functional on home screen**~~ — `Navbar.tsx` buttons now conditional on `onEdit`/`onSettings` props (hidden when not provided). `App.tsx` passes handlers on home phase: both pencil and gear open `SettingsPanel` (mounted from `App.tsx` via `showHomeSettings` state). Model picker accessible via home settings → Model tab → "Re-run model setup".
- ~~**Chat screen second bar too cluttered (6 icons)**~~ — Removed Brain (memory graph), BookOpen (phrase map), LayoutList (flashcards) buttons from the header bar. Bar now shows Zap + Sun/Moon + Settings only. Overlays still accessible via in-chat quick pills. Dialect indicator shortened to flag emoji only.

### Resolved Feature Gaps (2026-04-14)
- ~~**LLM hallucinates pronunciation guides**~~ — Added `pronunciationLookup.ts`: Free Dictionary API (dictionaryapi.dev) + IndexedDB cache (`navi_pronunciation_cache`). Supports en/fr/es/ja/ko/hi/de/it/pt/ar/tr/ru/vi. `pronounceTool` pre-looks up IPA and injects as reference into the prompt. Both `pronounceTool` and `phraseTool` post-process responses via `enrichPronunciations()` which replaces hallucinated "Say it:" fields with real IPA data. Prompt templates updated with explicit pronunciation rules: syllables must map to actual sounds, no pronunciation for native-language phrases, CAPS for stress.

### Resolved Feature Gaps (2026-04-13)
- ~~**Multi-step onboarding too complex for first launch**~~ — Replaced 4-step onboarding (target language → native language → describe companion → appearance) with a single `AvatarSelectScreen.tsx` showing 8 avatar template cards (Street Food Guide, Form Helper, etc.). User picks a template and hits Start. Character is created from template defaults (no LLM generation needed). Model auto-defaults to WebGPU Qwen3 1.7B — `backend_select` screen is skipped on first launch (kept accessible via Settings for model changes). GPS location detected in background. `NewOnboardingScreen.tsx` retained but no longer rendered.

### Resolved Feature Gaps (2026-04-16b)
- ~~**Prompt configs lack conversational psychology and advanced SLA techniques**~~ — Engagement overhaul implemented across Tier 1 (config-only) and Tier 2 (small code changes). Details below.
- ~~**coreRules.json missing engagement drivers**~~ — Added: open loop instruction (leave one unresolved thread per conversation), sensory grounding (reference sights/sounds/smells), correction style (recast by default, explicit only after 3+ repeats), response length variance (never same length twice), negative constraints (no generic responses, no repeated patterns), proactivity strengthened.
- ~~**warmthLevels.json describes tone but not behavior mechanics**~~ — Added per-tier: `callbackFrequency` (stranger=never → family=natural), `selfDisclosureDepth` (surface → deep), `imperfectionAllowance` (none → full with typos/self-corrections/hedging). Instructions rewritten with specific behavioral examples: inside joke injection, progressive vulnerability, speech imperfection.
- ~~**systemLayers.json missing emotional mirroring and TBLT**~~ — Added: `emotionalMirroring` instruction (match user energy/mood, mirror message length), `backstoryDisclosure` tiers 0-4 (progressive self-disclosure gated by interaction count), `scenario.tblt_pretask/tblt_task/tblt_posttask` templates for Task-Based Language Teaching cycle.
- ~~**learningProtocols.json missing advanced SLA techniques**~~ — Added 3 new protocols: `expansion` (build on learner output into fuller utterances, Lyster 2004), `elicitation` (prompt self-correction via strategic questioning, Lyster & Ranta 1997), `contextual_reintroduction` (re-surface learned terms in new contexts for flexible knowledge, Nation 2001).
- ~~**toolPrompts.json chat template verbose and missing engagement**~~ — Rewritten: tighter structure, integrated open loops, sensory grounding, response rhythm variance, emotional energy matching, recasting correction. Net neutral token impact.
- ~~**ConversationDirector has no emotional state awareness**~~ — Added `detectEmotionalState()` heuristic: analyzes message length, punctuation density, ALL CAPS ratio, emoji presence, frustration/anxiety/pride/excitement keywords. Injects one-line calibration context into system prompt (e.g. "USER ENERGY: Frustrated — acknowledge it before anything else").
- ~~**RelationshipStore shared references never surfaced proactively**~~ — Added `getCallbackSuggestion()` with warmth-tier-gated frequency (stranger=0%, acquaintance=10%, friend=30%, close_friend=50%, family=70%). Injected as CALLBACK instruction in `formatForPrompt()`. Added `getBackstoryTier()` (0-4, advances every ~50 interactions) with disclosure instructions from `systemLayers.backstoryDisclosure`.
- ~~**ProactiveEngine only has absence-based triggers**~~ — Added: scenario-completion debrief hook (`markScenarioCompleted()`), backstory disclosure openers (gated by tier, 20% chance per session, 5 tiers with 3 openers each).

### Resolved Feature Gaps (2026-04-16)
- ~~**Dead code bloat**~~ — Removed 13 dead files (-1,977 lines): 4 unused avatar components (AnimatedCharacter, AvatarDisplay, AvatarRenderer, BlockyAvatar), NewOnboardingScreen (replaced by AvatarSelectScreen), services/llm.ts (superseded by agent framework), entire src/prompts/ directory (7 legacy prompt builders superseded by config/prompts/*.json + promptLoader).
- ~~**DRY violations**~~ — Extracted 3 shared utilities: `locationHelpers.ts` (dialect key resolution, location context building — was duplicated 3x), `avatarProfileHelpers.ts` (style-to-energy/humor/slang mapping — was copy-pasted 3x), `GeneratedCharacter` + `mapCharacterToUI` moved to types/character.ts (was defined inline in 3 files).
- ~~**Duplicate types**~~ — Consolidated: `GeneratedCharacter`, `AvatarState` → types/character.ts; `PhraseHighlight` → types/chat.ts; `OCRResult` → types/inference.ts; `ScenarioConfig` → reuses ScenarioContext from types/config.ts; `ConversationGoal` + `DirectorContext` → agent/director/types.ts (breaks circular dep).
- ~~**Error-hiding try-catches**~~ — Removed 5 catches that swallowed errors with console.error + fallback to empty objects (director, memory retrieval, research agent, pronunciation bank, conversationDirector calibration).
- ~~**Last `any` type**~~ — `expandedPhrase: any` in ConversationScreen replaced with proper typed interface.

### Resolved Feature Gaps (2026-04-16g — Experiments EXP-006 through EXP-010)
- ~~**Sensory grounding cadence too vague (EXP-006)**~~ — `coreRules.json` SENSORY GROUNDING instruction changed from "at least one per conversation" to "roughly 1 out of every 3-4 messages" with explicit bracketing: "not every message — that's exhausting. Not once per session — that's forgettable."
- ~~**Emotional detector misses laughter (EXP-007)**~~ — `detectEmotionalState()` in `ConversationDirector.ts` now detects lol/lmao/rofl/haha/hehe/ha-repeats and laughter emoji as 'excited'. Short disengaged messages (<5 chars, no punctuation) explicitly handled. Trailing ellipsis documented as intentionally neutral.
- ~~**Code-switching density vs style conflict (EXP-009)**~~ — Added `codeSwitchingPriority` instruction to `systemLayers.json`: learning stage controls DENSITY (how much target language), warmth tier controls STYLE (how you switch). When they conflict, DENSITY wins — it reflects actual ability.
- ~~**Backstory disclosure too slow and not warmth-linked (EXP-010)**~~ — `getBackstoryTier()` in `RelationshipStore.ts` changed from interaction-count-based (every 50 interactions, ~40 sessions to max) to warmth-linked (maps directly to warmth tiers: stranger=0, acquaintance=1, friend=2, close_friend=3, family=4). Surface-level stories now available by session 3 instead of session 10.

### Resolved Feature Gaps (2026-04-16r — EXP-046)
- ~~**Avatar templates have generic personalities**~~ — All 8 `avatarTemplates.json` entries rewritten with rich specific details: strong opinions, pet peeves, funny anecdotes, sensory anchors, and recurring characters. Each template now ~100 words instead of ~20.
- ~~**18 of 20 conversation skills not triggered**~~ — 8 high-impact skills wired into `ConversationDirector.preProcess()`: `emotional_mirror` (non-neutral emotion), `negotiation_of_meaning` (confusion, injected before confusion override), `social_proof` (frustrated/anxious), `language_play` (functional+, 15%), `productive_failure` (functional+, 10%), `register_awareness` (active scenario, once per scenario), `identity_reinforcement` (celebrate_progress), `session_pacing` (>8 messages). `activeScenario` option added to preProcess; session message count tracked via WorkingMemory.
- ~~**Custom characters with sparse personality have no development mechanism**~~ — `sparseCharacterBootstrap` added to `systemLayers.json`. `contextController.buildSystemPrompt()` checks `profile.personality.length < 100` and injects bootstrap instruction for organic personality development over 3-5 exchanges.
- ~~**Surprise competence detection not implemented**~~ — Was already wired in EXP-016 (postProcess detects non-ASCII ratio above comfort tier expectations, stores flag in WorkingMemory, preProcess injects skill). Removed from Known Gaps.

### Resolved Feature Gaps (2026-04-16u — EXP-053 through EXP-055)
- ~~**CRITICAL: Memory stores global, not per-character (EXP-053)**~~ — Phrases learned with a Nepali companion showed up when talking to a French companion. `LearnerProfileStore` query methods (`getPhrasesForReview`, `getStrugglingPhrases`, `getUrgentReviewPhrases`, `getRoutineReviewPhrases`, `formatForPrompt`, `getCurrentStage`) now accept optional `language` parameter. All call sites pass `location.getPrimaryLanguage()`. UI components (`FlashcardDeck`, `KnowledgeGraphScreen`) receive language-filtered phrases. `postProcess` now records phrases with actual language instead of `'unknown'`. Backward compat: `matchesLanguage()` helper includes `'unknown'`-language phrases in queries.
- ~~**Memory retrieval agent leaks cross-language terms (EXP-054)**~~ — `MemoryRetrievalAgent.getStrugglingTermPhrases()` and `buildTeachingContext()` now filter by `query.language`. Other retrieval methods (`getRelatedTerms`, `getBridgeMemories`, `getSessionRecap`, `getEngagementPatterns`) were already correctly filtered.
- ~~**Relationship store per-avatar scoping verified (EXP-055)**~~ — `RelationshipStore` was already correctly keyed by `avatarId`. No fix needed.

### Known Feature Gaps
- **CRITICAL: System prompt token budget blown — MUST layers consume 99.5% (3056/3072)** — Core rules alone are 2594 tokens at MUST priority. With identity (130), language enforcement (86), reinforcement (166), and location (80), the MUST layers total 3056 tokens. This leaves 16 tokens for warmth, memory, goals, learning context, few-shot examples, emotional mirroring, and mode instructions — all of which are silently dropped. Additionally, `chatTool.ts` appends 1023 tokens OUTSIDE budget enforcement, pushing total system prompt to ~4079 tokens (entire 4K context window). Fix: demote core rules to HIGH priority, create tiered prompt variants (compact/standard/full) based on model size, include tool templates inside budget enforcement. See `RESEARCH_ROUND3.md` for full analysis and implementation plan.
- **No model-size-aware prompt tiers** — All models (1.5B to 70B) receive identical prompts. Small models (< 3B) need a compact prompt (~400 tokens of core rules vs 2594) with all-negative framing (which works at 20/20 vs 0/20 for positive instructions). Medium models (3-10B) need a standard tier. See `RESEARCH_ROUND3.md` Area 1-3 for exact prompt text and implementation.
- **CameraOverlay OCR/LLM pipeline not wired** — Prompt 7 incomplete. `CameraOverlay.tsx` still uses a mocked scan flow; `agent.handleImage()` pipeline exists but is not connected.
- **Cloudflare Worker D1 database ID not set** — `web/wrangler.toml` contains `database_id = "YOUR_D1_DATABASE_ID"` placeholder.
- **Feedback worker URL** — `web/feedback.html` references `https://navi-feedback.shreyashparajuli.workers.dev`. Update if deployed under a different subdomain.
- **Pending feedback sync** — `feedback.html` stores offline submissions in `localStorage` but has no retry mechanism.
- **Knowledge Graph migration from flat stores not yet triggered** — Existing data not auto-migrated to graph nodes.
- **ResearchAgent web lookup not implemented** — Protocols are config-driven and sufficient for now.
- **ExpandedPhraseCard TTS/STT still uses legacy services** — Not yet wired to agent TTS/STT tools.
- **TBLT scenario phase tracking partially wired** — `tblt_pretask` is injected on first scenario message (EXP-052) and also via ConversationDirector skill injection on scenario start (EXP-050). `tblt_posttask` is now wired in ConversationDirector via `previousScenario` tracking (EXP-050) — fires when activeScenario changes from a previous value. However, there is no `scenarioPhase` state in chatStore and no turn-based progression through task/posttask phases. Full phase-aware scenario arcs (as designed in RESEARCH_ROUND5.md) still require a phase tracker and phase-specific prompt injection per turn.
- **Cross-session micro-mission tracking not implemented** — `coreRules.json` now instructs the LLM to follow up on micro-missions within the same conversation (EXP-015), but cross-session tracking requires code to detect mission assignment and store it in EpisodicMemory or WorkingMemory. Same-session follow-up covers the 80% case.
- **Character backstory seeds partially addressed** — EXP-038 added BACKSTORY SEEDS rule 5 to both `characterGen.json` templates. EXP-043 upgraded `freeText.template` to emit structured `personality_details` object (strong_opinion, funny_anecdote, sensory_anchor, pet_peeve, recurring_character) with PERSONALITY DEPTH rule 3 providing concrete examples per field. Validated: gemma4:e2b produces 5/5 specific fields on first attempt. Still pending: `personality_details` not yet added to the `Character` TypeScript interface, `fromTemplate.template` not yet updated with personality_details schema, and system prompt injection of personality_details into avatar identity layer not implemented.
- **OllamaProvider lacks `think: false` for conversation mode** — Thinking models (gemma4, qwen3) via Ollama spend their entire token budget on reasoning when thinking is enabled, producing empty responses. EXP-035 added a fallback for empty content, but the root fix is to pass `think: false` in the request body for conversation (non-reasoning) use cases. Currently only the test harness uses `think: false`; the production OllamaProvider does not.
- **Automated scorer misses non-English sensory/personality content** — Both `hasSensory` and `hasPersonality` in `liveConversationTest.ts` use English keywords only. EXP-051 confirmed: production scenarios (Vietnamese HCMC) scored 0/15 sensory and 6/15 personality automated, but manual audit shows Vietnamese sensory content ("nồi phở đang sôi" = boiling pho pot, "mùi thơm" = delicious smell) and personality ("bá đạo nhất" = most legendary, "menu paparazzi"). Same issue for Seoul Korean (EXP-041). The -0.3 gap between production (3.9) and hand-crafted (4.2) is primarily scorer limitation. Fix: add Vietnamese/Korean/Japanese/French/Nepali sensory and personality word patterns to the scorer.
- **Extended conversation quality degradation** — EXP-040 and EXP-045 both found consistent quality degradation after turn 8 in 12-turn conversations. EXP-045 showed improvement over EXP-040 (4.3 vs 3.8 overall, sensory 6/12 vs 0/12) from cumulative prompt work, but the degradation pattern is consistent: -0.7 point drop in second half, with hooks (5/6 -> 2/6) and sensory (4/6 -> 2/6) collapsing first. NEVER rules and target language remain 100%. SESSION PACING at 8-10 turns is validated across 2 independent runs. A mid-conversation system prompt refresh or hook-collapse detection could help for sessions that exceed 10 exchanges.
- **Compact prompt tier not yet integrated into production** — EXP-039 measured 3.8/5.0 and EXP-044 measured 3.0/5.0 on qwen2.5:1.5b with identical compact rules (~460 tokens). High variance (0.8 point swing between runs) confirms 1.5B is unreliable for persona conversation. The compact rules exist in `liveConversationTest.ts` but are not integrated into `contextController.ts` or `coreRules.json`. Target language regressed (85% -> 40%) and needs a stronger LANGUAGE line. Few-shot echo problem persists (model reproduces examples verbatim instead of generating appropriate responses). Investment should go toward 5B+ model availability rather than 1.5B prompt optimization.
- **Emotional override partially addressed** — EXP-037 added FRUSTRATION vs CONFUSION distinction to `coreRules.json`. EXP-042 strengthened Kathmandu test prompt with "Nepali IS the comfort" framing and per-response Devanagari requirement. Target language holds at 5/5 (100%) even during "I give up" emotional peak across both EXP-037 and EXP-042 runs. However, personality regressed 4/5 -> 2/5 in EXP-042 (tradeoff: stronger language instructions crowd out character voice). Other emotional states (grief, homesickness, anxiety unrelated to language) are not yet handled -- only language-related frustration has explicit override logic.
- **chatBehavior bypasses token budget** — `chatTool.ts` appends the full chat.template outside `buildSystemPrompt()`'s budget enforcement. For Qwen3 1.7B, total system message may exceed effective attention window. This is a subset of the CRITICAL budget issue above.
- **No automated conversational quality regression suite** — `TEST_RUBRIC.md` defines 18 quality dimensions with scoring criteria; `TEST_BASELINE.md` provides estimated baseline scores and 10 test scenarios. No automated test runner yet.
- **Fluency Journey stage tracking not fully wired** — `FLUENCY_JOURNEY.md` defines 4-stage progression (Survival/Functional/Conversational/Fluent) with concrete advancement criteria. The basic `LearningStage` type and `getCurrentStage()` exist (2026-04-16e), but the full implementation checklist in `FLUENCY_JOURNEY.md` Appendix B identifies remaining work: `currentStage` field on LearnerProfile, `userProductionCount`/`selfCorrectionCount`/`multiTurnSessionCount`/`extendedDiscourseSessionCount` stats, stage-specific goal priority stacks in ConversationDirector, stage-specific SR interval selection, scenario difficulty levels (basic/intermediate/advanced), and stage-specific prompt injection selection.
- **Scenario difficulty levels not implemented** — `FLUENCY_JOURNEY.md` defines 3 difficulty levels per scenario (basic/intermediate/advanced) but `scenarioContexts.json` has no difficulty field. Each scenario should have escalated versions for different stages.
- **Self-correction detection missing** — No code detects when a user corrects their own previous message (e.g., "wait, I meant X" or resending a corrected version). Needed for Stage 2->3 advancement milestone.
- **User production counting missing** — No code tracks how many user messages contain target language words across sessions. Needed for Stage 1->2 advancement milestone.
- **Open loop persistence missing** — `FLUENCY_JOURNEY.md` recommends storing unfinished conversational threads in WorkingMemory with 48h TTL for cross-session continuity. Not yet implemented.
- **Scenario arc continuity missing** — Multi-session scenario arcs (e.g., apartment hunting over 3 sessions) are not tracked. SessionPlanner picks fresh goals each session with no memory of ongoing scenario narratives.
- **No conversation threading system** — Sessions have no awareness of unfinished conversational threads (stories, debates, projects, rituals). **RESEARCH_ROUND4.md Area 2** designs a full `ConversationThread` data model with 4 thread types, lifecycle management (active/resolved/dormant/abandoned), prioritization algorithm, detection heuristics (no LLM needed), and system prompt injection format. Stored in IndexedDB, max 30 active threads per avatar.
- **No emotional memory system** — Memory stores facts and episodes but not how the user FELT. Emotional peaks (frustration, breakthrough, pride, vulnerability) are the strongest bonding moments and are currently lost. **RESEARCH_ROUND4.md Area 4** designs an `EmotionalMemory` type with emotion detection heuristics (lexical + behavioral + contextual signals), referenceability scoring, 4 reference trigger types (contrast, echo, anniversary, vulnerability reciprocity), and safety rules (never reference negative memories without positive contrast). Max 50 per avatar.
- **No month 3 retention interventions** — Users at sessions 60-100 with increasing session gaps get no special treatment. **RESEARCH_ROUND4.md Area 3** designs 3 interventions: Journey Reflection (specific then-vs-now contrast), Identity Upgrade (permanent shift from learner to peer frame), Unfinished Story (high-stakes open loop via ProactiveEngine using recurring_character from personality_details).
- **personality_details not in Character type** — The `Character` interface in `types/` has no `personality_details` field. EXP-043 validated that gemma4:e2b produces the schema correctly (5/5 specific fields). `characterGen.json` `freeText.template` now requests `personality_details` in the JSON output. Still needed: add `personality_details` to Character interface, parse it during character creation, inject into identity layer for system prompt. See RESEARCH_ROUND4.md Area 1.

### Resolved Feature Gaps (2026-04-16b)
- ~~**Variable reward scheduling not implemented**~~ — EXP-011: `ConversationDirector.preProcess()` now fires variable reward injection on ~1-in-5 messages (`Math.random() < 0.2`). Reads skill text from `conversationSkills.json` via `promptLoader`. `conversationSkills.json` registered in `PromptLoader` config map.
- ~~**No explicit open-loop instruction**~~ — Already resolved in prior EXP-006/coreRules.json edits: OPEN LOOPS section with explicit pull-based instructions. EXP-015 micro-missions add a complementary follow-up mechanism.
- ~~**Inside joke callbacks have no timing logic**~~ — EXP-012: `SharedReference` type with timing metadata. `getCallbackSuggestion()` uses 3 priority windows: 1st callback 3-8 msgs after creation, 2nd 15-25 msgs, 3rd 50+ msgs since last. Backward-compat with legacy `string[]` data.
- ~~**Survival stage blocks all scenarios**~~ — EXP-014: `STAGE_SCENARIO_ACCESS.survival` now includes `['restaurant', 'emergency']`. Brand-new users in real-world situations get immediate scenario help with the survival stage's heavy native-language scaffolding.

### Resolved Feature Gaps (2026-04-16)
- ~~**No learning stage progression system**~~ — `LearningStage` type (`survival`/`functional`/`conversational`/`fluent`) and `LearningStageInfo` interface added to `core/types.ts`. `LearnerProfileStore.getCurrentStage(interactionCount, completedScenarios)` computes stage from composite score (interactions 30%, mastered phrases 35%, comfort tier 25%, scenario completions 10%). `systemLayers.json` gains `learningStages` section with per-stage prompt instructions. `ConversationDirector.preProcess()` detects the stage, injects the instruction at HIGH priority (before all other goals), and returns `LearningStageInfo` in `DirectorContext`. Scenario progression: survival=none, functional=restaurant/market/directions/hotel, conversational/fluent=all scenarios. Fluent stage includes peer role-play mode via `scenarioLock_fluent`.

### Resolved Feature Gaps (2026-04-16)
- ~~**scenarioOpener fires on first-ever message only**~~ — `contextController.buildSystemPrompt()` now accepts `isFirstScenarioMessage` option. `agent/index.ts` computes this by comparing `currentScenario !== previousScenario`. The opener and TBLT pretask now fire whenever a new scenario starts, not only on the user's first-ever message. Wired through `chatTool.ts`.
- ~~**detectScenario() overrides manually-set scenarios**~~ — `ConversationScreen.handleSend()` now skips `detectScenario()` when `activeScenario` is already set, preventing keyword detection from overriding ScenarioLauncher selections.
- ~~**TBLT pretask never injected**~~ — `contextController.ts` now injects `systemLayers.scenario.tblt_pretask` template at HIGH priority on first scenario message, giving the user key phrases and scene-setting before the task phase.
- ~~**Scenario completion never tracked**~~ — `LearnerProfileStore.recordScenarioCompletion(scenarioKey)` added. `LearnerProfile.stats.completedScenarios` field added (optional, backwards-compat). `handleEndScenario()` now calls both `recordScenarioCompletion()` and `proactiveEngine.markScenarioCompleted()` (was dead code). Feeds into `getCurrentStage()` composite scoring.
- ~~**detectScenario runs in guide mode**~~ — `detectScenario()` is now skipped when `userMode === 'guide'`, preventing accidental scenario triggers when the user mentions scenario keywords while asking for translation help.

### Resolved Feature Gaps (2026-03-30)
- ~~**No multi-agent architecture**~~ — NaviAgent refactored into Orchestrator pattern with MemoryRetrievalAgent (graph traversal) and ResearchAgent (learning protocols) as sub-agents. Context Injection Protocol merges sub-agent outputs into avatar scaffold before every LLM call.
- ~~**Flat memory with no relationships**~~ — `KnowledgeGraphStore` added with 6 node types (Conversation, Term, Topic, Scenario, Avatar, Location) and 9 edge types. `MemoryMaker` writes rich metadata (engagement score, encounter type, inferred reason, language/script/avatar) after every exchange.
- ~~**No language learning research protocols**~~ — `learningProtocols.json` defines 8 evidence-based protocols (Krashen i+1, Leitner SR, Output Hypothesis, Affective Filter, Recasting, Noticing, Contextual Learning, Multimodal Encoding). ResearchAgent selects and interpolates per-turn.
- ~~**No engagement tracking**~~ — MemoryMaker scores engagement 0-1 per exchange using heuristic signals (message length, questions, target language use, emotion markers). Stored on ConversationNode and TermNode metadata.
- ~~**No encounter context on learned terms**~~ — TermNode now tracks `encounterType` (scenario/organic/requested/corrected/overheard) and `inferredReason` (why the user needs this term).
- ~~**No visual KG display in chat UI**~~ — `KnowledgeGraphExplorer.tsx` added as expandable overlay from chat screen (Brain icon, teal, `z-[44]`). Three views: Terms grid (mastery colors, encounter badges, engagement bars, inferred reasons), Term Detail (full context: location, scenario, avatar, related terms, conversation history), Timeline (conversations with engagement heatmap). Wired into `ConversationScreen.tsx` alongside existing `KnowledgeGraphScreen`.

### Resolved Feature Gaps (2026-03-27)
- ~~**Generic cartoon avatar (avataaars) not bondable**~~ — `AIAvatarDisplay.tsx` replaces `AvatarRenderer` in `ConversationScreen`. 3-tier rendering: (1) AI portrait from Pollinations.ai (stored as base64 in IndexedDB), (2) DiceBear "notionists" editorial illustration (offline, deterministic from characterId seed), (3) letter fallback. DiceBear shows immediately on every render; AI portrait crossfades in async when available.
- ~~**No AI portrait generation**~~ — `src/utils/generateAvatarImage.ts` fetches from Pollinations.ai with Pixar 3D portrait style wrapper. Called non-blocking after char gen in `NewOnboardingScreen.tsx` with 3-attempt retry (0s, 5s, 15s). Stored in IndexedDB via `saveAvatarImage(charId, base64)`. Failure silent — DiceBear remains the experience.
- ~~**No portrait_prompt in character gen**~~ — `characterGen.json` both templates now emit `portrait_prompt` (physical description: age/gender/ethnicity/feature/clothing/background/lighting). `Character.portrait_prompt` and `Character.has_portrait` added to type.
- ~~**No OpenRouter key UI**~~ — Settings → Model section now has "OpenRouter API Key" input (saves to `localStorage('navi_openrouter_key')`) and "Regenerate Portrait" button that re-calls `generateAvatarImage` for the active character.

### Resolved Feature Gaps (2026-03-21e)
- ~~**Wrong language after location change**~~ — `handleUpdateCharacter()` in `App.tsx` now resolves dialect key from `updated.dialect_key` or dialectMap city scan, builds a `LocationContext`, and calls `agent.location.setLocation()` + `useAppStore.setCurrentLocation()` so the next LLM call uses the new dialect.
- ~~**Garbage responses for non-Latin scripts (Devanagari, Arabic, Thai, etc.)**~~ — `tokenEstimator.ts` expanded `CJK_RANGE` → `DENSE_SCRIPT_RANGE` covering Devanagari, Arabic, Thai, Cyrillic, Hangul, Hiragana/Katakana, Hebrew, Latin-Extended, and all CJK ranges. Fixes ~2.3× token undercount that caused system prompt pruning for non-Latin characters. Also strengthened `languageEnforcement.template` in `systemLayers.json` for the 1.5B model.
- ~~**Character switching loses language and personality**~~ — Removed `if (dialectKey)` guard in `handleSelectCompanion()`. Agent location is now always synced on character switch, even for cities not in dialectMap.
- ~~**Emoji circle avatar instead of illustrated human**~~ — `ConversationScreen.tsx` avatar mode now uses `AvatarRenderer` (avataaars-based illustrated human) instead of `CharacterAvatar` (emoji circle). Import swapped; `AvatarRenderer` props wired with `avatar_prefs`, `accentColor`, and animated `state`.
- ~~**AvatarPrefs not used for rendering**~~ — `AvatarRenderer` now receives `activeCharacter?.avatar_prefs ?? DEFAULT_PREFS` so the LLM-generated hair/skin/clothing choices are reflected in the avatar illustration.
- ~~**Language calibration too slow to adapt**~~ — `MIN_EXCHANGES_FOR_TIER_CHANGE` reduced 5→3 in `ConversationDirector`; default `languageComfortTier` set to 1 (beginner support) in `LearnerProfileStore.defaultProfile()` for new users.

### Resolved Feature Gaps (2026-03-21d)
- ~~**Companion switch restoration**~~ — `handleSelectCompanion` in `App.tsx` now resolves dialect key from stored value or dialectMap scan, calls `agent.avatar.createFromDescription()` with full personality/visual context instead of the shallow `createAvatarFromTemplate` path, and syncs `agent.location` + `appStore.currentLocation` when a dialect key is resolved. Imports added: `dialectMap.json`, `DialectInfo`, `LocationContext`.
- ~~**Inline markdown in chat responses**~~ — `stripInlineMarkdown()` added to `utils/responseParser.ts`; strips `##` headings, `**bold**`, `__bold__`, `*italic*`, `_italic_`. Applied at all three `segments.push({ type: 'text' })` call sites in `parseResponse()`. Also applied to `displayContent` in both `SpeechBubble` and `ChatLogEntry` in `NewChatBubble.tsx`.
- ~~**Dynamic language calibration**~~ — `ConversationDirector` now tracks a 5-message rolling window of user input. After each exchange, `computeCalibrationTier()` scores target-language density (0–4) and writes the result into `WorkingMemory` (key `calibration_tier`, TTL 30 min). `preProcess()` reads the WM tier first and falls back to `learner.languageComfortTier` only when absent. `WorkingMemory` instance passed as 4th constructor argument from `agent/index.ts`.

### Resolved Feature Gaps (2026-03-21c)
- ~~**Avatar prefs not seeded from character generation**~~ — LLM prompt now requests `avatar_prefs` in the same JSON call; `validateAvatarPrefs()` + `deriveAvatarPrefs()` added to `avatarPrefs.ts`; `Character.avatar_prefs` field added; `AvatarBuilder` seeded from resolved prefs after char gen in all 3 LLM attempts + final fallback.

### Resolved Feature Gaps (2026-03-21b)
- ~~**Multi-city first_message bug**~~ — `characterGen.json` `firstMsgRules`, `freeText.template` rule 2, and `fromTemplate.template` rule 2 all listed 6 labeled city examples side-by-side. Qwen 1.5B reproduced all 6 verbatim. Fixed: replaced with a single Paris example + explicit city-lock instruction ("Generate the first_message for YOUR city only. Do NOT include messages for other cities.").
- ~~**Same-response loop bug**~~ — The multi-city `first_message` (400–800 chars) was included verbatim in every subsequent LLM context window as the first assistant turn. Qwen 1.5B pattern-matched and kept reproducing it. Fixed: `ConversationScreen.tsx` history `.map()` now truncates any character message >400 chars to 400 chars + `…` before passing to LLM.

### Resolved Feature Gaps (2026-03-21)
- ~~**Context window overflow (BREAKING)**~~ — System prompt exceeded 4096-token limit. Fixed: `coreRules.rules` shortened ~495 tokens, `identity.template` ~69 tokens, `languageCalibration` tiers ~143 tokens. Token budget enforcement added to `contextController.buildSystemPrompt()` (budget=3072, greedy layer inclusion by priority).
- ~~**Avatar speaks English despite Nepali being set**~~ — `AvatarProfile.dialect` was always `''`. Fixed: `Character.dialect_key` field added; saved during onboarding; new `dialectKey` param in `createFromTemplate()` and `createAvatarFromTemplate()`; wired at all 3 avatar creation sites in `App.tsx`.
- ~~**Language immersion flow missing**~~ — Target language onboarding step added (step 0); saves to `Character.target_language`, `profileMemory.targetLanguage`, `UserPreferences.target_language`; city presets filter by target language. `ConversationDirector` now auto-advances/drops `languageComfortTier` based on consecutive target-language use vs help requests.
- ~~**Animated avatar**~~ — `AnimatedCharacter.tsx` created as Lottie wrapper with CharacterAvatar fallback. Drop-in replacement. Activates automatically once Lottie files are in `public/lottie/`.

### Resolved Feature Gaps (2026-03-20)
- ~~**Avatar always renders male / SVG-based**~~ — `CharacterAvatar.tsx` created: emoji avatar (template_id + gender → emoji), gradient ring with avatar colors, country flag badge. Reads `avatar_gender` from `appStore.userPreferences`. Replaces `AvatarDisplay` at all call sites. `AvatarDisplay.tsx` retained for `AvatarBuilder` legacy support.
- ~~**ScenarioLauncher extra step for templates**~~ — Template tiles now call `onStart` immediately (zero friction). Only the Custom Situation tile shows a single text-input step. `scenarioOpener` prompt injected by `contextController` on first message when a scenario is active.
- ~~**Native language not collected**~~ — Onboarding now shows a language picker step first (13 languages + Nepali). Selected language saved to `agent.memory.profile` and `appStore.userPreferences.native_language`.
- ~~**Immersion mode not enforced**~~ — Mode system implemented: `ModeClassifier` in `agent/index.ts` runs keyword scoring on every message, silently locks `userMode` (learn/guide/friend) at threshold=2. Mode persists to IndexedDB via `profileMemory`. `ConversationDirector` gates all learning goals by mode. `contextController` injects mode instruction layer.
- ~~**Avatar appearance variants**~~ — `AvatarRenderer.tsx` created: wraps `avataaars` with Framer Motion animated states (idle float, generating rotate, speaking pulse, success bounce, random blink). Uses `AvatarPrefs` fields directly.
- ~~**Language mismatch bug**~~ — `contextController.resolveDialect()` now uses explicit `dialectKey` from `AvatarProfile.dialect` when available, bypassing city string matching entirely.
- ~~**Nepali/Kathmandu not supported**~~ — Added `NP/Kathmandu` to `dialectMap.json`, Kathmandu to `cities.json`, ne-NP to TTS/STT with hi-IN fallback, Devanagari script note injection in `contextController`.
- ~~**Scenario launcher was a rigid form**~~ — Redesigned to single free-text + need chips. 9 new scenario templates added (customs, pharmacy, emergency, landlord, bank, taxi, temple, street_food, date).
- ~~**No web presence**~~ — `web/index.html` (landing page) and `web/feedback.html` + `web/worker.js` (Cloudflare Worker + D1) created.

---

## Platforms

NAVI will ship on three platforms:

| Platform | Status | Notes |
|---|---|---|
| **Web (Vercel)** | Active | Current Vite/React app, deployed via `vercel.json` |
| **iOS** | Planned | TBD — do not assume implementation details |
| **Android** | Planned | TBD — do not assume implementation details |

### Platform Rules

- **Platform-specific code** must live in clearly named platform directories (e.g., `platform/web/`, `platform/ios/`, `platform/android/`) or behind explicit platform feature flags. Do not mix platform code into shared modules.
- **Shared code** (`src/agent/`, `src/stores/`, `src/prompts/`, `src/types/`, `src/config/`) must remain platform-agnostic — no platform-specific imports allowed in shared code.
- **Before any commit touching shared code**, verify it does not assume a web-only API (WebGPU, Web Speech API, DOM, IndexedDB, navigator.geolocation) without a platform-abstracted fallback.
- Never add web-only APIs to shared code without wrapping in a platform check or abstract service. Platform-specific code belongs in `platform/` directories (to be created when iOS/Android work begins).

---

## Key Conventions

### State Management
- Use Zustand stores for all shared state (never prop-drill beyond 1 level)
- `appStore` = global config + model status
- `characterStore` = active character + memories
- `chatStore` = messages + generation state + scenario

### Storage
- All persistence via `utils/storage.ts` (IndexedDB wrapper)
- Keys: `navi_conversation`, `navi_character`, `navi_memories`, `navi_preferences`, `navi_location`

### Prompt System
- All prompt **text** lives in `src/config/prompts/*.json` — edit there to change behavior
- All prompt **builders** in `src/prompts/` use `promptLoader` to load from config
- System prompts assembled via `AvatarContextController.buildSystemPrompt()` — never construct raw prompts in components
- Use `promptLoader.get('path.to.template', { vars })` for interpolated prompts
- Use `promptLoader.getRaw('path')` for raw config objects (temperature, max_tokens, etc.)
- Use `promptLoader.loadConfig('name', newConfig)` for A/B testing / hot-swap

### Inference Configs
| Mode | Temperature | Max Tokens | Purpose |
|---|---|---|---|
| chat | 0.7 | 512 | Conversational responses |
| character_gen | 0.8 | 400 | Creative character creation |
| camera | 0.3 | 600 | Deterministic OCR interpretation |
| memory_gen | 0.2 | 300 | Fact extraction |
| phrase | 0.4 | 400 | Structured phrase cards |

### Styling
- TailwindCSS 4 with custom CSS variables for theming
- Dark mode: luxury black (#0A0A0F), cream (#F5F0EB), gold (#D4A853), teal (#6BBAA7)
- Three font families: Playfair Display (headings), DM Sans (body), Source Serif 4 (character speech)

---

## Development

```bash
cd "AI Language Companion App"
pnpm install    # Install dependencies
pnpm run dev    # Start Vite dev server
pnpm run build  # Production build
```

**Requirements**: Chrome 113+ or Edge 113+ (WebGPU required for on-device LLM)

---

### Agent Framework Usage

```typescript
import { createNaviAgent } from './agent';

// WebLLM (in-browser, default)
const agent = createNaviAgent();

// Ollama (local server)
const agent = createNaviAgent({ backend: 'ollama', ollamaModel: 'qwen2.5:3b' });

// Auto-detect (Ollama if available, else WebLLM)
const agent = createNaviAgent({ backend: 'auto' });

await agent.initialize();     // Load memory + detect location + auto-detect backend
await agent.loadLLM();        // Download/load the LLM model

// Handle user messages (auto-routes to correct tool)
const result = await agent.handleMessage('How do I say hello?');
// → routes to 'pronounce' tool, returns phrase card

// Handle images
const imageResult = await agent.handleImage(photoBlob);
// → OCR → classify → LLM explain

// React hook
const { agent, isLLMReady, backend } = useNaviAgent({ backend: 'ollama' });
```

---

## Reference Documents
- `navi-prd-v3.md` — Full product requirements with user stories, features, and architecture
- `navi-claude-code-prompts.md` — Step-by-step implementation task prompts
- `AI Language Companion App/navi-prompts-v3.md` — System prompt templates for all modes
- `AI Language Companion App/src/agent/ARCHITECTURE.md` — Agent framework architecture
- `AI Language Companion App/src/agent/MODEL_REGISTRY.md` — Model specs + swap guide
- `AI Language Companion App/src/agent/DEPENDENCIES.md` — All dependencies + future needs
- `AI Language Companion App/src/agent/FUTURE_SCALING.md` — Scaling strategy (Phase 2 & 3)
- `AI Language Companion App/src/agent/ENERGY_OPTIMIZATION_NOTES.md` — Battery/performance notes
- `audit.md` — Previous code audit with component-by-component breakdown
