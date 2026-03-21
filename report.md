# NAVI — Planning Session Report
*Use this as context for the next planning session*

**Location:** Canonical copy in repo root (`report.md`). Older copies may exist at `~/.claude/plans/report.md` — prefer this file for the NAVI-1 repo.

---

## What NAVI Is
Offline-first AI language companion app. A travel buddy, tour guide, language teacher, and emotional support companion in one pocket. Runs entirely on-device via WebGPU (Qwen2.5-1.5B). No internet required for core functionality.

**The differentiator:** Every competitor (Google Translate, Duolingo, Papago) is a tool. NAVI is a companion. Offline-first is the moat.

---

## Current State of the Codebase

### What's Built and Working
- Full React + TypeScript + Vite app with dark/gold/teal theme
- 15+ custom UI components, 50+ shadcn/ui primitives
- 3 Zustand stores (appStore, characterStore, chatStore)
- IndexedDB persistence via idb-keyval
- WebLLM + Ollama dual backend (Qwen2.5-1.5B on-device)
- Full agent framework: Router, ExecutionEngine, ToolRegistry, EventBus
- 6-tier memory system (working, episodic, semantic, profile, learner, relationships)
- 13 registered tools (chat, translate, pronounce, camera, culture, slang, etc.)
- 11-layer system prompt engine (AvatarContextController)
- ConversationDirector with 12 goal types + spaced repetition
- Relationship warmth system (stranger → family over ~200 interactions)
- OCR pipeline (Tesseract.js), TTS/STT (Web Speech API)
- 11 scenario templates with ScenarioLauncher UI
- HomeScreen with companion list and scenario access
- All prompts in editable JSON config files (PromptLoader)

### What's Not Working / Missing
1. **Language mismatch bug** — Avatar language is re-derived from city string at runtime, not from the saved `dialectKey`. Any description with cultural cues (e.g. "Mexican vibe") when location ≠ that culture results in the wrong language being spoken.
2. **Native language not collected** — `{{userNativeLanguage}}` template variable has no source. Onboarding never asks.
3. **No mode system** — All sessions forced into learning mode regardless of user intent.
4. **Blocky avatar** — `BlockyAvatar.tsx` renders an 8-bit head. `avataaars` (cartoon SVG) is installed but unused.
5. **CameraOverlay OCR pipeline not wired** — Prompt 7 incomplete.
6. **Immersion mode not enforced** — Language calibration tiers defined but no UI toggle and no mode inference.

---

## What Was Planned This Session (Master Plan)

**Full plan:** [plans/purrfect-waddling-dusk.md](./plans/purrfect-waddling-dusk.md)

### Phase 1 — Foundation Fixes
**1A. Language Bug**
- `characterGen.json`: Add CULTURE LOCK rule — city/country always overrides description culture
- `contextController.ts`: Accept explicit `dialectKey` param in `buildLocationLayer()`, skip city-string matching when authoritative key provided
- `systemLayers.json`: Add `languageEnforcement` layer (Layer 2.5) — enforces language in every response

**1B. Native Language (Base Language)**
- `NewOnboardingScreen.tsx`: Add `language` step FIRST in onboarding flow
- Screen: "What language do you speak?" — 13 options (English, Spanish, Portuguese, French, Hindi, Nepali, Mandarin, Arabic, Korean, Japanese, German, Italian, Other)
- This sets the user's **base language** — used for all translation, navigation explanations, and as the support language in learning mode
- Saved to `ProfileMemoryStore.nativeLanguage` + `UserPreferences.native_language`

**1C. Mode System — Silent Inference**
- **No mode picker screen** — avatar opens with "What do you need from me?" (localized with pronunciation guide)
- First user message → keyword classifier → silently sets `userMode`
- Three modes (invisible to user):
  - `learn` — immersive, tier calibration, spaced repetition
  - `guide` — responds in base language, translates, no drills
  - `friend` — empathize first, organic teaching, slang/swear words welcome
- Default on ambiguity: `guide`
- Switchable via Settings panel
- Mode stored in `ProfileMemoryStore`, restored on app restart

**1D. Nepali Language**
- `dialectMap.json`: Add `NP/Kathmandu` entry
- `cities.json`: Add Kathmandu with GPS coords
- `NewOnboardingScreen.tsx`: Kathmandu in city picker
- `characterGen.json`: Fallback name for NP → "Arjun"
- `systemLayers.json`: Devanagari + romanized transliteration note for Nepali
- `tts.ts` / `stt.ts`: Add `ne-NP` with `hi-IN` fallback

### Phase 2 — Conversation Quality
**2A.** Scenario launcher: rename "What are you nervous about?" → "What do you need from me?"

**2B. Real-time audio translation (guide mode)**
- Hold mic → STT set to avatar's dialect language → captures ambient speech → translates to user's base language
- Short tap → user speaks their own message (existing behavior)
- UI: gold mic + "Listening..." label + internet note (only online-required feature)
- `toolPrompts.json`: Add `listenAndTranslate` prompt template
- `chatTool.ts`: Detect `translationMode: 'listen'` context flag

**2C. Conversation naturalness rules in prompts:**
- No "Of course!" / "Great!" / "Sure!" openers
- Never two questions in a row
- Statement → teaching → one question max

### Phase 3 — Avatar Appearance
- Replace `BlockyAvatar` with `AvatarRenderer.tsx` (wraps `avataaars` library — already installed)
- Map character traits to avataaars props (personality → mouth, age → hair, color → skin/hair, style → clothing)
- Framer Motion animated states: idle float, speaking pulse, thinking expression, blink, success reaction

### Phase 4 — Scenario UX Overhaul
- `ScenarioLauncher.tsx` redesign: scenario tile grid → one free-text box → optional chips ("What do you need?")
- Context parser: LLM call (temp 0.1, 100 tokens) parses free text into `ParsedScenarioContext`
- 9 new scenario templates: customs, pharmacy, emergency, landlord, bank, taxi, temple, street_food, date
- HomeScreen: scenario tiles row directly visible (no button tap)
- ConversationScreen: "Start a scenario" quick action pill in defaults

### Phase 5 — Web Presence
- `web/index.html`: landing page (no framework, plain HTML/CSS)
- `web/feedback.html`: feedback form (Bug / Feature / UX / General)
- `web/worker.js`: Cloudflare Worker → D1 database for feedback storage

---

## Key Architectural Decisions Made

| Decision | Rationale |
|----------|-----------|
| No explicit mode picker screen | Companion-feel: a real buddy doesn't ask you to pick a category. Infer from first message. |
| Keyword classifier, not LLM call | Qwen2.5-1.5B is unreliable for meta-reasoning. Keyword matching is fast, deterministic, and already used by `detectScenario()`. |
| Rolling detection, not first-message-only | Users often say "hi" or something ambiguous first. Mode is locked only after 2+ clear signals of the same type within 5 messages. Default (null) = natural blended behavior. |
| Empathy wins ties in mixed signals | If a message has both learn and friend signals, friend wins. Being heard is more important than being taught. |
| `userMode` stored in ProfileMemoryStore | Profile data belongs in agent memory, not a new IndexedDB key. Already persisted via `navi_profile_memory`. |
| `avataaars` over DiceBear | Already installed, no new dependency. Maps naturally to character traits. |
| CULTURE LOCK in characterGen prompt | Simplest fix — prevents the LLM from generating mismatched characters at creation time. Combined with dialectKey fix in contextController. |
| `languageEnforcement` as Layer 2.5 | Must come early in the system prompt, after identity but before scenario/memory, so it anchors all subsequent layers. |

---

## Files Changed (will be changed during implementation)

| File | Change Type | What |
|------|------------|------|
| `src/config/prompts/characterGen.json` | Edit | CULTURE LOCK rule |
| `src/config/dialectMap.json` | Edit | NP/Kathmandu entry |
| `src/data/cities.json` | Edit | Kathmandu entry |
| `src/config/prompts/systemLayers.json` | Edit | languageEnforcement, modeInstructions, conversationNaturalness, Devanagari note |
| `src/config/prompts/coreRules.json` | Edit | No filler openers, no double questions |
| `src/config/prompts/toolPrompts.json` | Edit | Conversation quality, listenAndTranslate, scenarioContextParse |
| `src/agent/core/types.ts` | Edit | Add userMode to ProfileMemory |
| `src/agent/memory/profileMemory.ts` | Edit | setUserMode / getUserMode |
| `src/agent/avatar/contextController.ts` | Edit | dialectKey fix, languageEnforcement layer, mode layer |
| `src/agent/director/conversationDirector.ts` | Edit | Mode-aware goal selection |
| `src/agent/tools/chatTool.ts` | Edit | userMode param, translationMode detection |
| `src/agent/index.ts` | Edit | Keyword classifier, wire userMode + isFirstEverMessage |
| `src/stores/appStore.ts` | Edit | userMode field + setter |
| `src/services/tts.ts` | Edit | ne-NP + hi-IN fallback |
| `src/services/stt.ts` | Edit | ne-NP, mode-aware language |
| `src/app/App.tsx` | Edit | Remove intent phase, restore userMode from memory |
| `src/app/components/NewOnboardingScreen.tsx` | Edit | Language picker step (base language), Kathmandu city |
| `src/app/components/AvatarRenderer.tsx` | Create | avataaars wrapper with animated states |
| `src/app/components/ConversationScreen.tsx` | Edit | AvatarRenderer, mic mode differentiation, Listening UI |
| `src/app/components/ScenarioLauncher.tsx` | Edit | Full redesign |
| `src/app/components/HomeScreen.tsx` | Edit | Scenario tiles row |
| `src/config/scenarioContexts.json` | Edit | 9 new templates |
| `web/index.html` | Create | Landing page |
| `web/feedback.html` | Create | Feedback form |
| `web/worker.js` | Create | Cloudflare Worker |
| `CLAUDE.md` | Edit | Resolve known gaps, add new components |
| `audit.md` | Edit | Mark resolved, add new items |

Paths above are relative to `AI Language Companion App/` unless noted.

---

## What's NOT in This Plan (Next Session Candidates)

1. **CameraOverlay OCR wiring** (Prompt 7 incomplete) — pipeline exists, UI not wired to `agent.handleImage()`
2. **ExpandedPhraseCard / SettingsPanel → agent wiring** — currently calls legacy services directly
3. **iOS / Android** — planned but not started
4. **Multi-avatar scenario** — two companions in one scene
5. **Push notifications** for spaced repetition review
6. **Companion switching mid-chat** — UX not designed
7. **Voice-only mode** — fully hands-free conversation flow
8. **Real-time microphone transcription display** — show what's being heard as it comes in
9. **Phrase review UI** — dedicated screen to review tracked phrases and spaced repetition queue

---

## Tech Stack Quick Reference
- React 18 + TypeScript + Vite 6
- TailwindCSS 4 + shadcn/ui (50+ Radix components)
- Zustand 5 (appStore, characterStore, chatStore)
- IndexedDB via idb-keyval
- WebLLM (Qwen2.5-1.5B-Instruct-q4f16_1-MLC) + Ollama fallback
- Framer Motion 12 for animations
- Tesseract.js for OCR
- Web Speech API for TTS/STT
- `avataaars` installed but unused (until Phase 3 of this plan)

## App path
`AI Language Companion App/` (within this repo)

## Auto-Accept Edits
To skip permission prompts during implementation, run Claude Code with:
```
claude --dangerously-skip-permissions
```
Or toggle in settings: `/config` → set `autoAcceptEdits: true`
