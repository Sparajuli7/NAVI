
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
│   │   ├── agent/                    # AGENT FRAMEWORK
│   │   │   ├── core/                 # Router, ExecutionEngine, ToolRegistry, EventBus, Types
│   │   │   ├── memory/              # 6-tier memory (working, episodic, semantic, profile, learner, relationships)
│   │   │   ├── models/              # Model providers (LLM, TTS, STT, Vision, Embedding)
│   │   │   ├── avatar/              # AvatarContextController + template configs
│   │   │   ├── location/            # LocationIntelligence module
│   │   │   ├── director/            # ConversationDirector (learning goals, pre/post processing)
│   │   │   ├── prompts/             # PromptLoader + phraseDetector
│   │   │   ├── pipelines/           # Multi-step pipelines (image, pronunciation)
│   │   │   ├── tools/               # 13 registered tools
│   │   │   ├── react/               # useNaviAgent() hook
│   │   │   └── index.ts             # NaviAgent class + createNaviAgent()
│   │   ├── app/
│   │   │   ├── App.tsx               # Root component — phase state machine
│   │   │   └── components/           # 15+ custom components
│   │   │       ├── ui/               # 50+ shadcn/ui primitives
│   │   │       ├── ConversationScreen.tsx   # Main chat interface
│   │   │       ├── NewOnboardingScreen.tsx  # Character creation flow
│   │   │       ├── CameraOverlay.tsx        # Camera + OCR UI
│   │   │       ├── ExpandedPhraseCard.tsx   # Phrase detail bottom sheet
│   │   │       ├── NewChatBubble.tsx        # Chat message bubbles
│   │   │       ├── BlockyAvatar.tsx         # 8-bit avatar renderer
│   │   │       ├── SettingsPanel.tsx        # Settings UI
│   │   │       ├── ModelDownloadScreen.tsx  # Model download progress
│   │   │       └── QuickActionPill.tsx      # Contextual action buttons
│   │   ├── services/                 # Legacy service layer (wrapped by agent)
│   │   │   ├── llm.ts               # On-device LLM wrapper (WebLLM)
│   │   │   ├── modelManager.ts      # Model download/load/status
│   │   │   ├── ocr.ts               # Tesseract.js OCR
│   │   │   ├── tts.ts               # Text-to-speech (Web Speech API)
│   │   │   ├── stt.ts               # Speech-to-text (Web Speech API)
│   │   │   └── location.ts          # Geolocation + city/dialect lookup
│   │   ├── stores/                   # Zustand state management
│   │   │   ├── appStore.ts          # Global app config + model status
│   │   │   ├── characterStore.ts    # Active AI character + memories
│   │   │   └── chatStore.ts         # Messages + scenario state
│   │   ├── prompts/                  # LLM prompt templates (legacy, uses PromptLoader)
│   │   │   ├── systemBuilder.ts     # 6-layer system prompt engine
│   │   │   ├── characterGen.ts      # Character generation prompts
│   │   │   ├── camera.ts            # Camera/OCR prompt builder
│   │   │   ├── phrase.ts            # Phrase card prompt builder
│   │   │   ├── slang.ts             # Slang prompt builder
│   │   │   ├── scenario.ts          # Scenario/location change prompts
│   │   │   └── memory.ts            # Memory extraction prompt
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
│   │   │       └── characterGen.json    # Character generation prompts
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
  ├── no_webgpu (error screen)
  └── downloading (model download)
       └── onboarding (character creation)
            └── chat (main conversation interface)
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

### Agent Framework (`src/agent/`)
The agent framework sits underneath the UI as an orchestration layer:
- **NaviAgent** — Unified entry point (`createNaviAgent()`)
- **Router** — Rule-based intent routing (keyword matching, deterministic)
- **ExecutionEngine** — Bounded tool execution (recursion limits, token budgets, timeouts)
- **ToolRegistry** — 13 registered tools (chat, translate, pronounce, camera, culture, slang, etc.)
- **MemoryManager** — 6-system memory (working, episodic, semantic, profile, learner, relationships)
- **ModelRegistry** — Provider pattern for all models (LLM, TTS, STT, Vision, Embedding, Translation)
- **AvatarContextController** — Config-driven avatar behavior (JSON-editable, 11-layer prompt builder)
- **ConversationDirector** — Pre/post-processing for learning goals (no extra LLM calls)
- **LearnerProfileStore** — Phrase tracking + spaced repetition (Leitner-style intervals)
- **RelationshipStore** — Per-avatar warmth progression (~200 interactions stranger → family)
- **PromptLoader** — Build-time JSON imports + `{{variable}}` interpolation + A/B testing
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
- ~~**Avatar opens in English for Kathmandu/Nepali characters**~~ — Added Kathmandu/Devanagari example (`नमस्ते! (na-MAS-tay) आज Thamel maa ekdam bheed chha...`) to all 3 FIRST MESSAGE RULE sections in `characterGen.json` (`firstMsgRules`, `freeText.template` rule 2, `fromTemplate.template` rule 2). Added script instructions: Nepali → Devanagari with romanization; Japanese/Korean/Thai/Arabic → native script with romanization; never default to English.

### Resolved Feature Gaps (2026-03-28c)
- ~~**No session-level goal persistence**~~ — `SessionPlanner` added to `src/agent/director/SessionPlanner.ts`. Picks one goal per session using 7-priority algorithm, stored in WorkingMemory with 2h TTL. `ConversationDirector.setSessionPlanner()` wires it in; `preProcess()` injects session goal instruction; `postProcess()` marks goal achieved when target phrase/topic appears in exchange.
- ~~**No proactive messages on app open**~~ — `ProactiveEngine` added to `src/agent/director/ProactiveEngine.ts`. Four triggers: 7-day absence, 2-day absence, streak milestones (7/14/30), struggling phrases. `NaviAgent.getProactiveMessage()` exposed as public method. Wired into `ConversationScreen`: fires once on mount when `isLLMReady` and `messages.length > 0` (returning users only); result injected as a `'character'` message.
- ~~**Single SR track for all phrases**~~ — `LearnerProfileStore` now has dual tracks: `STRUGGLE_INTERVALS` (urgent: 6h→2w) and `SUCCESS_INTERVALS` (relaxed: 2d→2mo). `struggleCount` field on `TrackedPhrase` (optional, backwards-compat). `getUrgentReviewPhrases()` and `getRoutineReviewPhrases()` methods added.
- ~~**No personal context surfacing in system prompt**~~ — `ConversationDirector.surfacePersonalContext()` pulls top-3 high-importance episodic memories (importance >= 0.5) and injects as "PERSONAL CONTEXT" block into `promptInjection`.
- ~~**No flashcard review UI**~~ — `FlashcardDeck.tsx` at `src/app/components/FlashcardDeck.tsx`. Card flip, filters, mastery colors, Practice → chat. Wired via **`LayoutList`** header button; `agent.memory.learner.phrases` is the data source. Full-screen `motion` overlay (`z-[43]`).
- ~~**No phrase knowledge graph / dictionary map**~~ — `KnowledgeGraphScreen.tsx` + `PhraseDetailSheet.tsx`: graph nodes from learner phrases (category links, same-flag when using `countryCode`); demo packs for Vietnam / France / Japan when phrases are empty; search + filters; **`BookOpen`** opens graph; graph header can jump to card deck; **My phrases** quick pill opens graph; Practice queues the same practice prompt as flashcards.
- ~~**`reconnect` goal missing from systemLayers.json**~~ — Added to `conversationGoals` in `src/config/prompts/systemLayers.json`.

### Known Feature Gaps
- **CameraOverlay OCR/LLM pipeline not wired** — Prompt 7 incomplete. `CameraOverlay.tsx` still uses a mocked scan flow; `agent.handleImage()` pipeline exists but is not connected.
- **`generateCharacter()` in `llm.ts` is dead code** — onboarding uses `agent.getLLM().chat()` directly; `generateCharacter()` updated to return `{ character, avatarPrefs }` for consistency but has no active callers.
- **Cloudflare Worker D1 database ID not set** — `web/wrangler.toml` contains `database_id = "YOUR_D1_DATABASE_ID"` placeholder. Run `wrangler d1 create navi-feedback`, copy the returned ID, and update `wrangler.toml`. Then run the CREATE TABLE command from `web/worker.js` header comments before deploying.
- **Feedback worker URL** — `web/feedback.html` references `https://navi-feedback.shreyashparajuli.workers.dev`. Update this constant if the worker is deployed under a different subdomain.
- **Pending feedback sync** — `feedback.html` stores offline submissions in `localStorage` as `navi_pending_feedback`, but there is no retry mechanism to flush them when the user comes back online.
- **AnimatedCharacter Lottie files missing** — `AnimatedCharacter.tsx` is built and falls back gracefully to emoji avatar. To activate: (1) `pnpm add lottie-react`, (2) place 4 Lottie JSON files in `public/lottie/`: `char_idle.json`, `char_speaking.json`, `char_thinking.json`, `char_success.json` (free downloads from lottiefiles.com). Component auto-activates when files are present.
- **Existing characters lack `portrait_prompt`** — Characters created before 2026-03-27 do not have `portrait_prompt` set, so "Regenerate Portrait" in Settings will show as disabled. Workaround: create a new character.

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
