# NAVI — Project Guide

## Standing instructions for Claude Code
- Keep this file and `audit.md` current. When you resolve or discover a gap, edit the **Known Gaps** list in place (remove what's done, add what's new) — do **not** append dated "Resolved" changelog sections; git history is the changelog.
- Record what changed in the commit message, not in this file.
- Doc updates ship in the same commit as the code change.
- Before committing shared code (`src/agent/`, `src/stores/`, `src/types/`, `src/config/`), confirm it stays platform-agnostic (no direct WebGPU / Web Speech / DOM / IndexedDB / geolocation without a platform abstraction).

---

## What Is NAVI?

NAVI is an **AI language companion app** — a local friend in your pocket who speaks the language, knows the slang, understands the culture, and explains everything like a native. **Cloud-first:** production inference is OpenRouter via `/api/chat`; Ollama is local-dev only. **Mandatory Supabase auth** — no guest / continue-without-account path. **Portraits only** — CompanionFace (no DiceBear/avataaars emoji heroes). Teaching doctrine is Praktika-style: reply mostly in the user's language, embed one target phrase per message.

**The core bet:** Most language tools give you translations. NAVI gives you a companion — one that knows where you are, remembers your conversations, adapts to your level, and teaches you how locals actually speak.

**Target users:** Travelers, immigrants, expats, multilingual families, service workers in multilingual environments.

**Platforms:** Web (Vercel, active) — public `/` LandingPage + the `/app` companion experience. iOS / Android planned — platform-specific code must live in `platform/<os>/` dirs (to be created); shared code stays platform-agnostic.

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
Requires `OPENROUTER_API_KEY` (and optionally `BFL_API_KEY`) in `.env.local` for the chat/avatar proxies; Ollama is optional for local-dev inference. Package manager is **pnpm**.

**Quality gates** (run before every commit): `build` + `typecheck` (0 errors) + `test` (all pass) + `npx madge --circular --extensions ts,tsx src` (0 cycles).

---

## Structure
```
AI Language Companion App/src/
├── agent/                  # Multi-agent orchestrator framework
│   ├── core/               # Router, ExecutionEngine, ToolRegistry, EventBus, types.ts
│   ├── agents/             # MemoryRetrievalAgent, ResearchAgent
│   ├── memory/             # 9-system memory + KnowledgeGraph + MemoryMaker
│   ├── models/             # Providers: LLM (OpenRouter/Ollama), TTS, STT, Vision, Embedding
│   ├── avatar/             # AvatarContextController (layered system-prompt builder)
│   ├── director/           # ConversationDirector, SessionPlanner, ProactiveEngine
│   ├── location/           # LocationIntelligence (GPS + dialect inference)
│   ├── prompts/            # PromptLoader, PhraseDetector
│   ├── pipelines/          # imageUnderstanding, pronunciation
│   ├── tools/              # 12 registered tools + toolHelpers.ts
│   ├── react/useNaviAgent.ts
│   └── index.ts            # NaviAgent (createNaviAgent)
├── app/
│   ├── App.tsx             # Root — phase state machine (the companion experience, served at /app)
│   └── components/         # Screens + chat UI (see below)
├── marketing/              # Public responsive LandingPage (served at /)
├── auth/                   # Supabase auth: AuthScreen, AccountPanel, authStore, useAuth
├── db/                     # Repository pattern: local (IndexedDB) / cloud (Supabase) / sync
├── services/               # Thin browser-API wrappers: location, stt, tts
├── stores/                 # Zustand: appStore, characterStore, chatStore
├── types/                  # Shared TS types (character, chat, config, inference, speech.d.ts)
├── utils/                  # storage, responseParser, tokenEstimator, countryFlag,
│                           #   formatBytes, locationHelpers, avatarProfileHelpers, platform, ...
├── config/                 # Editable data: avatarTemplates, dialectMap, scenarioContexts, cities
│   ├── monetization.ts     # SINGLE source of truth for free/paid tiers, caps, pool (see MONETIZATION.md)
│   └── prompts/            # *.json prompt configs (edit here to change model behavior)
└── styles/
```
Top-level (outside `src/`): `api/` — Vercel Edge functions (`chat.ts` = managed-cloud proxy, `usage.ts` = allowance readout); `supabase/migrations/` — SQL schema (`cloud_usage`, `subscriptions`). Neither is covered by `tsc`/vite (Vercel builds `api/` separately).
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
| Accounts / cloud sync | Supabase (@supabase/supabase-js) | **mandatory** — no guest / continue-without-account path |
| Cloud LLM | OpenRouter via `/api/chat` proxy | Qwen3-32B primary → Llama 3.3-70b fallback; key server-side only |
| Local-dev LLM | Ollama | any model, selected from BackendSelectScreen or Settings → Model |
| OCR | tesseract.js | client-side |
| TTS / STT | Web Speech API | browser SpeechSynthesis / SpeechRecognition |
| Animation | motion (Framer Motion) | |
| Icons | lucide-react | |

Runtime deps are intentionally minimal (cleanup removed ~54 unused packages). Don't add a dependency without a clear need.

Theme: dark luxury black `#0A0A0F`, cream `#F5F0EB`, gold `#D4A853`, teal `#6BBAA7`; fonts Playfair Display (headings), DM Sans (body), Source Serif 4 (character speech).

---

## Architecture

**Routing** (`main.tsx`, react-router): `/` → responsive `LandingPage` (marketing + pricing); `/app` → the `App` companion experience (centered phone-frame over a desktop backdrop); unknown paths redirect to `/`. Vercel SPA rewrites serve `index.html` for all non-asset paths. The heavy machinery (WebGPU, agent init, LLM load) only mounts under `/app`, so the landing page stays light.

**App phases** (`App.tsx`, under `/app`): `init` → (first launch) `onboarding`/`backend_select` → `downloading` → `chat`; returning users go straight to `home`/`chat`.

**Agent orchestrator** (`NaviAgent`): on each message, the Router picks a tool (deterministic keyword routing), sub-agents (`MemoryRetrievalAgent` — Knowledge Graph traversal; `ResearchAgent` — evidence-based learning protocols) and the `ConversationDirector` enrich context, `AvatarContextController` assembles the layered system prompt, `ExecutionEngine` runs the tool under recursion/token/timeout bounds. No extra LLM calls for directing.

```typescript
import { createNaviAgent } from './agent';

const agent = createNaviAgent();                          // OpenRouter via /api/chat (production default)
// createNaviAgent({ backend: 'ollama', ollamaModel })     // local-dev server
await agent.initialize();                                 // load memory + detect location + backend
await agent.loadLLM();                                    // no-op for OpenRouter; pulls model for Ollama
await agent.handleMessage('How do I say hello?');          // auto-routes to a tool
await agent.handleImage(photoBlob);                        // OCR → classify → explain
// React: const { agent, isLLMReady, backend } = useNaviAgent()
```

**Layered system prompt** (`AvatarContextController.buildSystemPrompt`, 11 layers): identity → language enforcement → user prefs → location/dialect → scenario → memory → personality override → additional context → warmth instruction → learning context → conversation goals → core rules. Assembled under a token budget (greedy inclusion by priority; compact tier for small models). All layer **text** lives in `src/config/prompts/*.json` (`coreRules`, `systemLayers`, `toolPrompts`, `warmthLevels`, `memoryExtraction`, `characterGen`, `conversationSkills`, `learningProtocols`, `worldEvents`); never build raw prompts in components — use `promptLoader.get('path', { vars })` (interpolated) or `getRaw('path')` (config objects like temperature/max_tokens).

**Language doctrine** (Praktika-style, across `coreRules`/`systemLayers`/`toolPrompts`): reply mostly in `userNativeLanguage`; every message embeds exactly one `targetLanguage` phrase as `**phrase** (phonetic)`, in the correct local script (Devanagari, Hangul, kana/kanji, Hanzi, Arabic, Thai, Cyrillic, Latin, ...). On confusion, drop back into the user's language and simplify — never lecture in the target language.

**Memory** (`MemoryManager`, 9 systems): working (ring buffer + TTL), episodic, semantic (vectors), profile, learner (phrase tracking + dual-track Leitner SR), relationships (per-avatar warmth, 5 tiers), situation, KnowledgeGraph (typed nodes/edges), MemoryMaker (post-exchange graph writer). Learner/relationship/graph data is **scoped per language and per avatar**. Companion-bonding layers on top: `EmotionalMemoryStore` (peak-moment callbacks), `ConversationThreadStore` (story/debate/project/ritual threads), cross-session open loops (WorkingMemory + episodic breadcrumbs), `dialectBridge.ts` (adapt-not-restart on same-language city/dialect shifts).

**Sub-agents** (`src/agent/agents/`): `MemoryRetrievalAgent` traverses the Knowledge Graph for relevant terms/engagement patterns/cross-location bridges; `ResearchAgent` recommends which of 8 evidence-based SLA protocols (Krashen i+1, Leitner SR, Output Hypothesis, recasting, elicitation, ...) to apply per turn. `ConversationDirector` + `SessionPlanner` + `ProactiveEngine` handle pre/post-processing, per-session goals, and proactive/absence messaging — no extra LLM calls.

**Inference configs** (temperature / max_tokens, in `toolPrompts.json`): chat 0.7/350–400, chat_compact 0.75/300 (small-model tier), character_gen 0.8/400, camera 0.3/600, memory_gen 0.2/300, phrase 0.4/700.

**Accounts & sync** (`src/auth/`, `src/db/`): **mandatory** Supabase auth — no guest / continue-without-account path. `useAuth` gates the `auth` phase; unauthenticated users only ever see `AuthScreen` (a misconfigured Supabase env shows "Accounts unavailable", never a guest fallback). `getDatabase()` returns `CloudDatabase` after login; cloud repos mirror the *same* `navi_*` IndexedDB keys the app already writes, so first login seeds/pulls and a full-snapshot flush (on tab background/close, `useAuth`) carries ongoing changes up — the app and agent stores keep writing straight to IndexedDB (agent memory stays platform-agnostic; it never imports the db layer). Requires `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (see `.env.example`). `navi_semantic_memory` (regenerable vectors) is not cloud-synced.

**Monetization** (`src/config/monetization.ts`, `api/`, MONETIZATION.md): "NAVI fronts an OpenRouter credit pool, signed-in users get a small free cloud allowance" model. `ManagedCloudProvider` (a `ChatLLM` backend, `backend: 'managed'`) calls the same-origin `/api/chat` Edge proxy with the user's Supabase JWT — the OpenRouter key stays server-side. The proxy enforces three stacked guardrails (per-user daily message cap, per-user monthly $ ceiling, global pool budget), meters usage to `cloud_usage`, and falls users back to on-device when a limit hits. All knobs live in `monetization.ts`. Selectable as **NAVI Cloud** in `BackendSelectScreen` (sign-in required). `SettingsPanel` carries a persistent bottom banner: "Upgrade — Early Access" (Stripe via `VITE_PAYMENT_URL`), "Tip ☕" (Ko-fi), "Send feedback →". Stripe/NAVI Plus subscription tiers, an in-app usage meter, and proxy streaming are designed but not built yet (see MONETIZATION.md).

**Portraits** (`CompanionFace`): the only avatar renderer — no DiceBear/avataaars emoji heroes. Portraits generate/save on character create and backfill on companion switch; generation cascades FLUX Pro → HF FLUX.1-schnell → Pollinations.ai (`generateAvatarImage.ts`, `api/generate-avatar.ts`).

**Conventions:**
- Shared state via Zustand stores (no prop-drilling beyond 1 level). All persistence via `utils/storage.ts` (keys prefixed `navi_`: `navi_conversation`, `navi_character`, `navi_memories`, `navi_preferences`, `navi_location`).
- Type definitions live once: domain types in `src/types/`, agent-core types in `src/agent/core/types.ts`. Import them; don't redefine.
- try/catch only at real boundaries (I/O, network, browser-API availability, LLM-output parsing) and must handle visibly (surface or log with context) — no silent swallow.

---

## Platforms

| Platform | Status | Notes |
|---|---|---|
| **Web (Vercel)** | Active | `main.tsx` react-router: `/` → `LandingPage`, `/app` → the companion experience |
| **iOS** | Planned | TBD — do not assume implementation details |
| **Android** | Planned | TBD — do not assume implementation details |

**Platform rules:** platform-specific code must live in clearly named platform directories (e.g. `platform/web/`, `platform/ios/`, `platform/android/`) or behind explicit feature flags — never mixed into shared modules. Shared code (`src/agent/`, `src/stores/`, `src/types/`, `src/config/`) stays platform-agnostic: no WebGPU / Web Speech API / DOM / IndexedDB / `navigator.geolocation` without a platform abstraction.

---

## Status
The agent framework, memory, providers, prompt engine, and all UI screens are built and the UI is wired to the agent. The codebase has been through a full cleanup pass (dead code removed, types strong, 0 type errors, 0 circular deps). Phase 1–5 shipped: mandatory Supabase auth, CompanionFace-only portraits, the Praktika language doctrine, per-scenario TBLT arcs, emotional memory / conversation threads / open loops / dialect bridging, and Phase 5 language support (Hindi, Indonesian, Turkish, Tagalog, Russian, Swahili). The web-landing branch added the public marketing/landing page + routing, the managed-cloud monetization proxy, and the Supabase-backed accounts/sync layer — both feature sets are merged in.

### Known Gaps

**Agent ↔ UI wiring (incomplete):**
- `ExpandedPhraseCard` TTS/STT still calls `services/` directly instead of agent tools; "Practice" records speech but discards the transcript (no scoring/feedback).
- KnowledgeGraph data isn't auto-migrated from the flat stores into graph nodes (the graph is populated going forward by MemoryMaker; the `KnowledgeGraphExplorer` view reads it via the Brain button in My Dictionary).
- Flashcards and the memory graph are reachable from the My phrases pill → My Dictionary header (2 taps); consider first-class entry points if usage warrants.

**Model / prompt quality:**
- Model-size-aware prompt tiers exist for chat only: `chatTool` detects small Ollama models (~1–4B, by name) and swaps to the compact `toolPrompts.chat_compact` tier. Other tools/models still share one prompt; models < 3B remain unreliable for persona conversation (invest in 5B+ over 1.5B tuning).
- `chatTool.ts` appends the chat template outside `buildSystemPrompt()`'s token budget — can overflow small models' attention window.
- `OllamaProvider` still doesn't pass `think: false`, so thinking models (qwen3, gemma) can burn their budget reasoning and return empty. Mitigated (not fixed) by `responseParser.stripInlineReasoning()`, which strips leaked chain-of-thought preamble from replies; prefer non-thinking instruct models (qwen2.5, llama3.2, hermes3) for Ollama.
- Quality degrades after ~turn 8 in long sessions (hooks/sensory collapse first); session pacing kicks in at 8–10 turns. Sensory grounding is the weakest dimension (~30–60%, high variance) — the model prioritizes teaching content over atmosphere when both are requested.
- Script enforcement and emotional-override (beyond language frustration) are only partially handled outside the production language-enforcement layer.
- Latin-script target languages (French, Catalan, Spanish, ...) score low on automated `hasTargetLang` checks because the scorer requires non-ASCII characters — needs a language-aware detection mode.

**Testing infrastructure:**
- No automated conversational-quality regression suite (rubric defined in `TEST_RUBRIC.md`, not yet a runner). The dev test harnesses in `src/agent/__tests__/*` score English keywords only (miss non-English and Latin-script target-language content) — fix the scorer before trusting its sensory/personality/target-language numbers.
- No real-user testing infrastructure (session length, return rate, retention). See `RESEARCH_ROUND7.md`.

**Fluency-journey & continuity (designed, partially built):**
- `LearningStage`/`getCurrentStage()` exist but the full progression (per-stage goal stacks, SR intervals, scenario difficulty levels, self-correction + user-production counting) isn't wired. See `FLUENCY_JOURNEY.md`.
- Cross-session open loops / conversation threads have a basic (MVP) implementation; scenario arcs still don't persist across sessions (e.g. apartment hunting over 3 sessions) — `SessionPlanner` picks fresh goals each session with no memory of ongoing narratives.
- `personality_details` has a type + identity-layer injection; still pending: parsing from live LLM char-gen on create, a `fromTemplate.template` schema, and template bootstrap pools for companions without LLM gen.
- Engagement systems (avatar moods, world events, relationship-language stages, identity anchors) ship a basic form in the prompt configs; richer multi-session designs (the full 10 emotional-anchor teaching techniques, authored narrative arcs, reciprocal-vulnerability detection, city-knowledge tiers) are not built. See `RESEARCH_ROUND4/6/7.md`.

**Monetization & accounts:**
- Stripe/NAVI Plus subscription tiers, an in-app usage meter, and proxy streaming are designed but not built (see MONETIZATION.md). The guardrails (daily cap / monthly ceiling / global pool budget) are live server-side in `api/chat` + `monetization.ts`.
- Local dev is blocked without Supabase — a misconfigured env shows AuthScreen "Accounts unavailable" (intentional; no guest/offline skip per the mandatory-auth decision).
- `navi_semantic_memory` (regenerable vectors) is intentionally not cloud-synced.

**Language support:** Hindi, Indonesian, Turkish, Tagalog, Russian, and Swahili are live (Phase 5). Residual gaps: Tagalog OCR has no Tesseract pack (falls back to `eng`); Swahili/Turkish/Tagalog browser Web Speech voices are often missing (gTTS fallback covers online use); Free Dictionary IPA lookup still lacks id/tl/sw.

**Web/deploy:** `web/wrangler.toml` has a `YOUR_D1_DATABASE_ID` placeholder; `web/feedback.html` has a hard-coded worker URL and no offline-submission retry.
