# NAVI — Project Guide

## Standing instructions for Claude Code
- Keep this file and `audit.md` current. When you resolve or discover a gap, edit the **Known Gaps** list in place (remove what's done, add what's new) — do **not** append dated "Resolved" changelog sections; git history is the changelog.
- Record what changed in the commit message, not in this file.
- Doc updates ship in the same commit as the code change.
- Before committing shared code (`src/agent/`, `src/stores/`, `src/types/`, `src/config/`), confirm it stays platform-agnostic (no direct WebGPU / Web Speech / DOM / IndexedDB / geolocation without a platform abstraction).

---

## What is NAVI?
An **AI language companion app** — a local friend who speaks the language, knows the slang and culture, and explains things like a native. It knows where you are, remembers your conversations, adapts to your level, and teaches how locals actually speak (not textbook translations).

**Inference is hybrid:** on-device WebGPU (WebLLM, default) for privacy/offline, with Ollama (local server) and OpenRouter (cloud) as user-selectable backends. Cloud is only used when the user explicitly chooses it.

**Target users:** travelers, immigrants, expats, multilingual families, service workers.

**Platforms:** Web (Vercel, active). iOS / Android planned — platform-specific code must live in `platform/<os>/` dirs (to be created); shared code stays platform-agnostic.

---

## Develop
```bash
cd "AI Language Companion App"
pnpm install
pnpm run dev        # Vite dev server
pnpm run build      # production build
pnpm run typecheck  # tsc --noEmit (strict)
pnpm test           # vitest (104 tests)
```
Requires Chrome/Edge 113+ (WebGPU) for on-device LLM. Package manager is **pnpm**.

**Quality gates** (run before every commit): `build` + `typecheck` (0 errors) + `test` (all pass) + `npx madge --circular --extensions ts,tsx src` (0 cycles).

---

## Structure
```
AI Language Companion App/src/
├── agent/                  # Multi-agent orchestrator framework
│   ├── core/               # Router, ExecutionEngine, ToolRegistry, EventBus, types.ts
│   ├── agents/             # MemoryRetrievalAgent, ResearchAgent
│   ├── memory/             # 9-system memory + KnowledgeGraph + MemoryMaker
│   ├── models/             # Providers: LLM (WebLLM/Ollama/OpenRouter), TTS, STT, Vision, Embedding
│   ├── avatar/             # AvatarContextController (layered system-prompt builder)
│   ├── director/           # ConversationDirector, SessionPlanner, ProactiveEngine
│   ├── location/           # LocationIntelligence (GPS + dialect inference)
│   ├── prompts/            # PromptLoader, PhraseDetector
│   ├── pipelines/          # imageUnderstanding, pronunciation
│   ├── tools/              # 12 registered tools + toolHelpers.ts
│   ├── react/useNaviAgent.ts
│   └── index.ts            # NaviAgent (createNaviAgent)
├── app/
│   ├── App.tsx             # Root — phase state machine
│   └── components/         # Screens + chat UI (see below)
├── auth/                   # Supabase auth: AuthScreen, AccountPanel, authStore, useAuth
├── db/                     # Repository pattern: local (IndexedDB) / cloud (Supabase) / sync
├── services/               # Thin browser-API wrappers: location, stt, tts
├── stores/                 # Zustand: appStore, characterStore, chatStore
├── types/                  # Shared TS types (character, chat, config, inference, speech.d.ts)
├── utils/                  # storage, responseParser, tokenEstimator, countryFlag,
│                           #   formatBytes, locationHelpers, avatarProfileHelpers, platform, ...
├── config/                 # Editable data: avatarTemplates, dialectMap, scenarioContexts, cities
│   └── prompts/            # *.json prompt configs (edit here to change model behavior)
└── styles/
```
Key UI components: `AvatarSelectScreen` (onboarding), `ConversationScreen` (chat), `CameraOverlay`, `SettingsPanel`, `HomeScreen`, `Navbar`, `FlashcardDeck`, `KnowledgeGraph{Screen,Explorer}`, `ScenarioLauncher`, `ExpandedPhraseCard`, `CityPicker`/`LanguagePicker`, `BackendSelectScreen`, `ModelDownloadScreen`.

Top-level docs: `navi-prd-v3.md` (PRD), `audit.md` (code audit), `EXPERIMENT_LOG.md` + `RESEARCH_ROUND*.md` + `FLUENCY_JOURNEY.md` (prompt-engineering research & designs), `src/agent/ARCHITECTURE.md` / `MODEL_REGISTRY.md`.

---

## Tech stack
| Layer | Tech | Notes |
|---|---|---|
| Framework | React 18.3 + TypeScript 5.9 | Vite 6.3 (esbuild). `tsconfig.json` enables strict typecheck. |
| Styling | TailwindCSS 4.1 | via `@tailwindcss/vite`; custom components (no shadcn/ui) |
| State | Zustand 5 | `appStore`, `characterStore`, `chatStore` |
| Storage | IndexedDB (idb-keyval) | character, conversations, memories, prefs, location |
| Accounts / cloud sync | Supabase (@supabase/supabase-js) | optional; guest mode when env vars unset |
| On-device LLM | @mlc-ai/web-llm | WebGPU; default preset `qwen3-1.7b` |
| OCR | tesseract.js | client-side |
| TTS / STT | Web Speech API | browser SpeechSynthesis / SpeechRecognition |
| Animation | motion (Framer Motion) | |
| Icons | lucide-react | |

Runtime deps are intentionally minimal (cleanup removed ~54 unused packages). Don't add a dependency without a clear need.

Theme: dark luxury black `#0A0A0F`, cream `#F5F0EB`, gold `#D4A853`, teal `#6BBAA7`; fonts Playfair Display (headings), DM Sans (body), Source Serif 4 (character speech).

---

## Architecture

**App phases** (`App.tsx`): `init` → (first launch) `onboarding`/`backend_select` → `downloading` → `chat`; returning users go straight to `home`/`chat`.

**Agent orchestrator** (`NaviAgent`): on each message, the Router picks a tool (deterministic keyword routing), sub-agents (MemoryRetrieval, Research) and the ConversationDirector enrich context, AvatarContextController assembles the layered system prompt, ExecutionEngine runs the tool under recursion/token/timeout bounds. No extra LLM calls for directing.

```typescript
import { createNaviAgent } from './agent';
const agent = createNaviAgent();                       // WebLLM (default)
// createNaviAgent({ backend: 'ollama', ollamaModel }) // local server
// createNaviAgent({ backend: 'auto' })                // Ollama if up, else WebLLM
await agent.initialize();   // load memory + detect location + backend
await agent.loadLLM();      // download/load model
await agent.handleMessage('How do I say hello?');      // auto-routes to a tool
await agent.handleImage(photoBlob);                    // OCR → classify → explain
// React: const { agent, isLLMReady, backend } = useNaviAgent()
```

**Layered system prompt** (`AvatarContextController.buildSystemPrompt`): identity → language enforcement → user prefs → location/dialect → scenario → memory → warmth → learning context → director goals → core rules. Assembled under a token budget (greedy inclusion by priority). All layer **text** lives in `src/config/prompts/*.json`; never build raw prompts in components — use `promptLoader.get('path', { vars })` (interpolated) or `getRaw('path')` (config objects like temperature/max_tokens).

**Memory** (`MemoryManager`, 9 systems): working (ring buffer + TTL), episodic, semantic (vectors), profile, learner (phrase tracking + dual-track Leitner SR), relationships (per-avatar warmth, 5 tiers), situation, KnowledgeGraph (typed nodes/edges), MemoryMaker (post-exchange graph writer). Learner/relationship/graph data is **scoped per language and per avatar**.

**Inference configs** (temperature / max_tokens, in `toolPrompts.json`): chat 0.7/512, character_gen 0.8/400, camera 0.3/600, memory_gen 0.2/300, phrase 0.4/400.

**Accounts & sync** (`src/auth/`, `src/db/`): optional Supabase account layer, local-first. `useAuth` gates the `auth` phase (sign in / skip → guest). `getDatabase()` returns `LocalDatabase` (IndexedDB) for guests and `CloudDatabase` after login. Cloud repos mirror the *same* `navi_*` IndexedDB keys the app already writes, so first login seeds/pulls and a full-snapshot flush (on tab background/close, `useAuth`) carries ongoing changes up — the app and agent stores keep writing straight to IndexedDB (agent memory stays platform-agnostic; it never imports the db layer). Requires `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (see `.env.example`); unset ⇒ guest-only. `navi_semantic_memory` (regenerable vectors) is not cloud-synced.

**Conventions:**
- Shared state via Zustand stores (no prop-drilling beyond 1 level). All persistence via `utils/storage.ts` (keys prefixed `navi_`).
- Type definitions live once: domain types in `src/types/`, agent-core types in `src/agent/core/types.ts`. Import them; don't redefine.
- try/catch only at real boundaries (I/O, network, browser-API availability, LLM-output parsing) and must handle visibly (surface or log with context) — no silent swallow.

---

## Status
The agent framework, memory, providers, prompt engine, and all UI screens are built and the UI is wired to the agent. The codebase has been through a full cleanup pass (dead code removed, types strong, 0 type errors, 0 circular deps).

### Known Gaps
**Agent ↔ UI wiring (incomplete):**
- `ExpandedPhraseCard` TTS/STT still calls `services/` directly instead of agent tools; "Practice" records speech but discards the transcript (no scoring/feedback).
- KnowledgeGraph data isn't auto-migrated from the flat stores into graph nodes (the graph is populated going forward by MemoryMaker; the `KnowledgeGraphExplorer` view reads it via the Brain button in My Dictionary).
- Flashcards and the memory graph are reachable from the My phrases pill → My Dictionary header (2 taps); consider first-class entry points if usage warrants.

**Model / prompt quality:**
- No model-size-aware prompt tiers — all models (1.5B–70B) get the same prompt. Small models (<3B) need a compact, all-negative tier (see `RESEARCH_ROUND3.md`). 1.5B is unreliable for persona conversation; invest in 5B+ availability over 1.5B tuning.
- `chatTool.ts` appends the chat template outside `buildSystemPrompt()`'s token budget — can overflow small models' attention window.
- `OllamaProvider` doesn't pass `think: false` for conversation mode, so thinking models (qwen3, gemma) can spend their whole budget reasoning and return empty.
- Quality degrades after ~turn 8 in long sessions (hooks/sensory collapse first); session pacing kicks in at 8–10 turns. Sensory grounding is the weakest dimension (~30–60%, high variance).
- Script enforcement and emotional-override (beyond language frustration) are only partially handled outside the production language-enforcement layer.

**Testing infrastructure:**
- No automated conversational-quality regression suite (rubric defined in `TEST_RUBRIC.md`, not yet a runner). The dev test harnesses in `src/agent/__tests__/*` score English keywords only (miss non-English and Latin-script target-language content) — fix the scorer before trusting its sensory/personality/target-language numbers.
- No real-user testing infrastructure (session length, return rate, retention). See `RESEARCH_ROUND7.md`.

**Fluency-journey & continuity (designed, partially built):**
- `LearningStage`/`getCurrentStage()` exist but the full progression (per-stage goal stacks, SR intervals, scenario difficulty levels, self-correction + user-production counting) isn't wired. See `FLUENCY_JOURNEY.md`.
- No cross-session continuity for open loops / conversation threads / scenario arcs.
- `personality_details` is emitted by `characterGen.json` but not on the `Character` type or injected into the identity layer.
- Engagement systems (avatar moods, world events, relationship-language stages, identity anchors) ship a basic form in the prompt configs; the richer multi-session designs in `RESEARCH_ROUND4/6.md` (emotional memory, narrative arcs, retention interventions, vulnerability detection, dialect bridging, city-knowledge tiers) are not built.

**Language support (not yet added):** Hindi & Indonesian (P1, low effort), Turkish, Tagalog, Russian, Swahili. See `RESEARCH_ROUND7.md`.

**Web/deploy:** `web/wrangler.toml` has a `YOUR_D1_DATABASE_ID` placeholder; `feedback.html` has no offline-submission retry and a hard-coded worker URL.
