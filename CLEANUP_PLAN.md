# NAVI — Cleanup Plan

> Audit date: 2026-04-08. All file paths relative to `AI Language Companion App/src/`.

---

## Core Features (by codebase complexity)

1. **Conversation routing + tool execution** — `agent/index.ts` → `agent/core/router.ts` → `agent/core/executionEngine.ts` → 11 registered tools in `agent/tools/`
2. **Character generation + avatar context** — `app/components/NewOnboardingScreen.tsx` → `prompts/characterGen.ts` → `agent/avatar/contextController.ts` (11-layer system prompt, 19KB)
3. **9-tier memory system + KnowledgeGraph** — `agent/memory/` (10 files: working, episodic, semantic, profile, learner, relationships, situation, graph, memoryMaker, situationAssessor)

---

## Functional Requirements (discovered)

- **FR-1** Generate AI companion character via LLM (name, personality, dialect, avatar prefs, first message, portrait)
- **FR-2** Route user messages to correct tool (chat, translate, pronounce, phrase, slang, culture, camera, scenario, location, TTS, STT)
- **FR-3** Maintain conversation history with phrase card extraction and TTS playback
- **FR-4** Track learner progress: spaced repetition, topic proficiency, warmth/relationship progression
- **FR-5** Switch between 3 LLM backends at runtime: WebLLM (on-device), Ollama (local server), OpenRouter (cloud)
- **FR-6** Read and explain images/signs via OCR → LLM pipeline
- **FR-7** Detect user location and dialect; adapt avatar language accordingly
- **FR-8** Persist all state to IndexedDB; restore on reload (characters, messages, memories, preferences, location)

## Non-Functional Requirements (discovered)

- **NFR-1** Bundle must build cleanly (`npx vite build`) — no TS errors
- **NFR-2** LLM calls must retry across all key×model combinations before failing (OpenRouter: 1 key × 8 models = 8 attempts)
- **NFR-3** Error messages must not persist to IndexedDB across sessions
- **NFR-4** System prompt must stay under 3072 tokens (enforced in `agent/avatar/contextController.ts`)
- **NFR-5** App must function offline when WebLLM backend is selected (no external fetch in hot path)
- **NFR-6** Character generation must never crash — 4-fallback chain with synthetic character as last resort

---

## Tech Debt Inventory

### Duplicate Logic

- **LLM chat pattern** duplicated across 3 providers:
  - `agent/models/llmProvider.ts:178-228` (WebLLM)
  - `agent/models/ollamaProvider.ts:180-245` (Ollama)
  - `agent/models/openRouterProvider.ts:100-227` (OpenRouter)
  - All duplicate: message logging, temperature defaults (0.7/512/0.8), stream handling, response parsing (`choices[0].message.content`)

- **IndexedDB persistence pattern** duplicated across 4 memory stores (identical `STORAGE_KEY + get/set idb-keyval` structure):
  - `agent/memory/episodicMemory.ts:18-37`
  - `agent/memory/semanticMemory.ts:19`
  - `agent/memory/relationshipStore.ts:23-52`
  - `agent/memory/knowledgeGraph.ts:77-108`

- **Tool execution pattern** duplicated across 4 language tools (get dialect → fetch promptLoader config → build system prompt → call `llmProvider.chat()` → return `{ response }`):
  - `agent/tools/pronounceTool.ts:30-54`
  - `agent/tools/phraseTool.ts:29-61`
  - `agent/tools/slangTool.ts` (same pattern)
  - `agent/tools/cultureTool.ts` (same pattern)

- **Scenario keyword detection** exists in two places:
  - `app/components/ConversationScreen.tsx:52-78` (`SCENARIO_KEYWORDS` + `detectScenario()`) — active
  - `prompts/scenario.ts:20-28` (`detectScenario()`) — dead, never imported

- **Mirror state** in `app/App.tsx` — local state duplicates what's already in Zustand stores:
  - `companions` (line 70) ↔ `characterStore.characters`
  - `character` (line 63) ↔ `characterStore.activeCharacter`
  - `location` (line 64) ↔ `appStore.currentLocation.city`

### Orphaned Code (confirmed zero imports)

**Service files:**
- `services/llm.ts` — 146 lines: `sendMessage()`, `streamMessage()`, `generateCharacter()`, `generateMemorySummary()` — replaced by `agent/` framework
- `services/ocr.ts` — Tesseract.js wrapper — replaced by `agent/pipelines/image.ts`

**Prompt builders** (all replaced by `agent/prompts/promptLoader.ts` + JSON configs in `config/prompts/`):
- `prompts/camera.ts` — `buildCameraPrompt()`
- `prompts/phrase.ts` — `buildPhrasePrompt()`
- `prompts/memory.ts` — `buildMemoryPrompt()`
- `prompts/slang.ts` — `buildSlangPrompt()`
- `prompts/scenario.ts` — `buildScenarioSwitchPrompt()`, `buildLocationChangePrompt()`, `detectScenario()`

**React components** (deprecated, replaced, never imported):
- `app/components/ActionCard.tsx` — replaced by `QuickActionPill.tsx`
- `app/components/BlockyAvatar.tsx` — replaced by `AIAvatarDisplay.tsx`
- `app/components/AvatarRenderer.tsx` — replaced by `AIAvatarDisplay.tsx`
- `app/components/AnimatedCharacter.tsx` — Lottie wrapper, never activated (Lottie files missing)
- `app/components/ContextualCard.tsx` — UI pattern abandoned
- `app/components/AvatarDisplay.tsx` — replaced by `AIAvatarDisplay.tsx`

**Agent exports:**
- `agent/models/geminiEmbedding.ts:93-108` — `getGeminiEmbedding()` and `updateGeminiApiKey()` exported but never imported
- `agent/index.ts:737-740` — `NaviAgent.getSuggestions()` public method, never called from any component

### Vibe-Debt

**Hardcoded magic numbers (should be in config):**
- `agent/index.ts:176` — mode decay every `5` messages
- `agent/index.ts:184` — mode lock threshold `2` keyword hits
- `agent/index.ts:276` — working memory capacity `32`
- `agent/index.ts:494` — session start detection `historyLen <= 2`
- `agent/memory/episodicMemory.ts:21` — `MAX_EPISODES = 100`
- `agent/memory/episodicMemory.ts:22` — `IMPORTANCE_THRESHOLD = 0.3`
- `agent/director/conversationDirector.ts:88-93` — tier thresholds `3`, `2`, `3`
- `app/App.tsx:415` — `setTimeout(..., 2500)` with comment "Short delay to let the launcher mount"

**Hardcoded strings (should be constants):**
- `'navi_backend_pref'` used directly in `app/App.tsx:189,571,598` — not imported from `utils/storage.ts`
- `agent/index.ts:144-148` — `MODE_SIGNALS` keyword arrays hardcoded in NaviAgent class body
- `agent/memory/relationshipStore.ts:26-30` — 5 warmth constants (`WARMTH_PER_INTERACTION=0.005`, `WARMTH_PER_SESSION=0.02`, `WARMTH_PER_MILESTONE=0.05`, `WARMTH_DECAY_PER_DAY=0.003`, `WARMTH_FLOOR=0.15`) inline in file

**Missing error handling:**
- `agent/tools/chatTool.ts:94,122` — `llmProvider.chat()` called with no try/catch (executionEngine catches globally but loses stack)
- `agent/tools/pronounceTool.ts:49`, `phraseTool.ts:55`, `slangTool.ts`, `cultureTool.ts` — same naked await pattern on all LLM calls
- `agent/models/geminiEmbedding.ts:48-71` — `fetch()` error uncaught
- `agent/index.ts:642-657` — `memoryMaker.processExchange()` `.catch(() => ...)` swallows all errors silently
- `app/components/NewOnboardingScreen.tsx:425-464` — portrait generation failures caught but not logged (empty catch blocks)

**Type safety holes:**
- `app/components/ConversationScreen.tsx:103` — `useState<any>(null)` for `expandedPhrase`
- `app/App.tsx:278,287,298,299,388` — 5 separate type casts for dialectMap/humorStyle

**TODOs left in code:**
- `agent/pipelines/pronunciation.ts:22-23` — forced alignment model, accent accuracy
- `agent/models/embeddingProvider.ts:15` — replace mock embeddings with real ONNX model
- `agent/models/translationProvider.ts:18-19` — NLLB-200 evaluation

**Unresolved CLAUDE.md known gaps:**
- `CameraOverlay.tsx` OCR/LLM pipeline not wired — `agent.handleImage()` exists but CameraOverlay still uses mocked scan flow
- `ExpandedPhraseCard` TTS/STT still calls `services/tts.ts`/`services/stt.ts` directly, not agent tools
- `generateCharacter()` in `services/llm.ts` is acknowledged dead code

---

## Test Map & Gaps

### Existing Tests

| File | Framework | Assertions | Covers |
|---|---|---|---|
| `agent/__tests__/agentOverhaul.test.ts` | Custom tsx (NOT Vitest) | 64 | KnowledgeGraphStore CRUD, MemoryMaker, MemoryRetrievalAgent, ResearchAgent |
| `app/components/__tests__/dialectIndicator.test.ts` | Vitest | 16 | Country flag generation, dialect indicator rendering |
| `app/components/__tests__/Navbar.test.tsx` | Vitest | 12 | Navbar button rendering + click callbacks |
| `app/components/__tests__/NavbarHomePhase.test.tsx` | Vitest | 9 | Navbar in home vs chat phase |
| `utils/tokenEstimator.test.ts` | Vitest | 14 | Token estimation for Latin/Devanagari/Arabic/CJK |
| `utils/ocrClassifier.test.ts` | Vitest | 19 | OCR classification (MENU/SIGN/DOCUMENT/PAGE/LABEL/GENERAL) |
| `utils/responseParser.test.ts` | Vitest | 33 | Phrase card extraction, markdown stripping |
| `agent/models/openRouterProvider.test.ts` | Vitest | 46 | Retry logic, key/model rotation, non-retryable errors |

**Total: 213 assertions across 8 files**

**`agentOverhaul.test.ts` is not Vitest-compatible** — run manually: `npx tsx src/agent/__tests__/agentOverhaul.test.ts`. Not discovered by `npm run test`.

### Core Features with Zero Test Coverage

- **Conversation routing** — `agent/core/router.ts`, `agent/core/executionEngine.ts` — routing is keyword-based and deterministic; wrong-tool selection fails silently
- **Avatar context controller** — `agent/avatar/contextController.ts` (19KB, 11-layer prompt builder) — bugs here corrupt every LLM response
- **Character generation** — `app/components/NewOnboardingScreen.tsx` (490 lines, 4-fallback LLM chain)
- **Mode classification** — `agent/index.ts:144-186` (`ModeClassifier`, keyword accumulator)
- **Situation assessment** — `agent/memory/situationAssessor.ts` (13KB)
- **Warmth/relationship progression** — `agent/memory/relationshipStore.ts` (warmth math, decay, milestones)
- **Learner profile + spaced repetition** — `agent/memory/learnerProfile.ts` (13KB, dual SR tracks: `STRUGGLE_INTERVALS`, `SUCCESS_INTERVALS`)
- **TTS/STT pipeline** — `agent/models/ttsProvider.ts`, `agent/models/sttProvider.ts`
- **Location intelligence + dialect resolution** — `agent/location/locationIntelligence.ts` (UI layer tested, logic layer not)
- **SessionPlanner + ProactiveEngine** — `agent/director/SessionPlanner.ts`, `agent/director/ProactiveEngine.ts`

---

## Prioritized Action Plan

### Critical

- **C-1** Wire `CameraOverlay.tsx` to `agent.handleImage()` — documented incomplete since initial build; current mocked scan flow means camera is non-functional end-to-end
- **C-2** Wire `ExpandedPhraseCard` TTS/STT to agent tools — currently bypasses agent, breaking tool event system and memory tracking

### High

- **H-1** Delete 13 confirmed dead files (zero imports verified — safe to delete):
  - `services/llm.ts`, `services/ocr.ts`
  - `prompts/camera.ts`, `prompts/phrase.ts`, `prompts/memory.ts`, `prompts/slang.ts`, `prompts/scenario.ts`
  - `app/components/ActionCard.tsx`, `app/components/BlockyAvatar.tsx`, `app/components/AvatarRenderer.tsx`, `app/components/AnimatedCharacter.tsx`, `app/components/ContextualCard.tsx`, `app/components/AvatarDisplay.tsx`

- **H-2** Fix `ConversationScreen.tsx:103` — replace `useState<any>(null)` with the correct type from `types/chat.ts`

- **H-3** Add test: `agent/core/router.test.ts` — unit test keyword routing (chat vs translate vs pronounce etc.); router is pure/deterministic, straightforward to test

- **H-4** Add test: `agent/avatar/contextController.test.ts` — verify `buildSystemPrompt()` includes expected layers; token budget enforcement (>3072 tokens pruned); dialect resolution from dialectKey vs city

- **H-5** Migrate `agent/__tests__/agentOverhaul.test.ts` to Vitest — replace custom `assert()` with `expect()`, wrap in `describe`/`it` — makes 64 assertions run with `npm run test`

### Maintenance

- **M-1** Centralize localStorage keys — extract `'navi_backend_pref'`, `'navi_openrouter_key'`, `'navi_openrouter_tier'`, `'navi_webllm_preset'` as exported constants in `utils/storage.ts`; remove raw string usage from `app/App.tsx:189,571,598` and `agent/index.ts:847,853-855`

- **M-2** Remove App.tsx mirror state — `companions` (line 70), `character` (line 63), `location` (line 64) duplicate Zustand store data; eliminate sync bugs by reading from stores directly

- **M-3** Add error logging to silent catches — `NewOnboardingScreen.tsx:425-464` (portrait failures) and `agent/index.ts:642-657` (memoryMaker) — minimum `console.error` so dev failures surface

- **M-4** Delete orphaned agent exports — `geminiEmbedding.ts:93-108` (`getGeminiEmbedding`, `updateGeminiApiKey`); `agent/index.ts:737-740` (`getSuggestions()`)

- **M-5** Add test: `agent/memory/learnerProfile.test.ts` — dual SR tracks, `getUrgentReviewPhrases()`, `getRoutineReviewPhrases()`, mastery progression

- **M-6** Add test: `agent/memory/relationshipStore.test.ts` — warmth math (per-interaction, per-session, decay, floor), milestone detection, tier transitions

---

## Verification Plan

```bash
# After H-1 (deleting dead files) — confirm no broken imports
cd "AI Language Companion App" && npx vite build 2>&1 | grep -iE "error"

# After H-2 (fixing any type) — TypeScript clean
npx tsc --noEmit 2>&1 | grep -v "^Version" | head -20

# Run full Vitest suite
npm run test

# Run legacy manual test (separate — not Vitest)
npx tsx src/agent/__tests__/agentOverhaul.test.ts

# Confirm dead files gone (should return empty)
find src -name "llm.ts" -path "*/services/*"
find src -name "BlockyAvatar*"
find src -name "ActionCard*"
find src -name "AvatarDisplay.tsx" -not -name "AIAvatarDisplay.tsx"

# Confirm no remaining imports of deleted files
grep -r "from.*services/llm" src/
grep -r "from.*services/ocr" src/
grep -r "from.*prompts/camera" src/
grep -r "from.*BlockyAvatar" src/
grep -r "from.*AvatarRenderer" src/
grep -r "from.*AvatarDisplay" src/ | grep -v "AIAvatarDisplay"

# Confirm localStorage keys centralized after M-1 (should return empty)
grep -rn "'navi_backend_pref'" src/ --include="*.ts" --include="*.tsx"
```
