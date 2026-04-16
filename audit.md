# NAVI Codebase Audit

**Last updated: 2026-04-16o** (RESEARCH_ROUND4 — 4-area deep research: Area 1 Rich Character Generation — new `characterGen.json` template design with `personality_details` schema (7 fields: strong_opinion, funny_anecdote, sensory_anchor, pet_peeve, recurring_character, favorite_spot, unpopular_take); exact freeText and fromTemplate prompt text provided; validation rules (min lengths, proper noun check, landmark blocklist); fallback personality pools per city; system prompt injection format for AvatarContextController identity layer; expected score improvement: personality 0/20 -> 18/20. Area 2 Conversation Threading — `ConversationThread` data model with 4 types (story/debate/project/ritual); lifecycle management (active/resolved/dormant/abandoned); prioritization algorithm (emotionalWeight 0.4 + recency 0.3 + unresolved 0.2 + type_bonus 0.1); heuristic thread detection (no LLM needed); system prompt injection for top 1-2 threads; max 30 per avatar in IndexedDB. Area 3 Month 3 Problem — root cause analysis (intermediate plateau + novelty decay + identity crisis); 3 specific interventions: Journey Reflection (specific then-vs-now using emotional memories), Identity Upgrade (permanent learner-to-peer frame shift), Unfinished Story (high-stakes open loop via ProactiveEngine using recurring_character); trigger detection: sessions 60-100 with increasing gap trend. Area 4 Emotional Memory — `EmotionalMemory` type with 7 emotions; 3-category detection heuristics (lexical + behavioral + contextual); `scoreEmotionalPeak()` function with 0.3 threshold; referenceability scoring with time curves and overuse decay; 4 reference triggers (contrast/echo/anniversary/vulnerability); safety rules (never reference negative without positive contrast); max 50 per avatar; integration points with MemoryMaker, ConversationDirector, SessionPlanner, ProactiveEngine. CLAUDE.md Known Gaps updated: backstory seeds gap updated with implementation path; 4 new gaps added (conversation threading, emotional memory, month 3 interventions, personality_details type). No code changes — research only.)

**Previously: 2026-04-16n** (Experiments EXP-031 through EXP-035 -- live model testing + prompt/scorer improvements: EXP-031 -- 3 few-shot examples added to `coreRules.json` for open loops, sensory grounding, and personality (teach by showing, not telling; critical for sub-5B models); EXP-032 -- personality scorer in `liveConversationTest.ts` expanded from 9 English-only patterns to 6 detection categories covering cross-language opinion markers, character staging (*asterisk actions*), expressive emoji, Korean/French/Japanese voice markers; personality detection jumped 0/20 -> 17/20; EXP-033 -- gemma4:e4b (8B) full test: 4.6/5.0 overall, 100% open loops, 100% personality, 50% sensory; model progression 1.5B (3.1) -> 5.1B (4.1) -> 8B (4.6); EXP-034 -- Tokyo scenario prompt strengthened with specific opinions/anecdotes/preferences; scored 4.9/5.0 at 8B (highest of any scenario); key finding: specific personality details >> generic instructions; EXP-035 -- CRITICAL: thinking models (gemma4/qwen3) via Ollama spend entire token budget on reasoning when thinking enabled, producing empty responses; `think: false` option disables thinking and fixes the issue; `ollamaProvider.ts` gained empty-content fallback; test harness uses `think: false`; production recommendation: disable thinking for conversation mode; build passes, 104/104 tests pass)

**Previously: 2026-04-16m** (RESEARCH_ROUND3 — model-size-aware prompt optimization: CRITICAL FINDING — MUST layers in `contextController.ts` consume 3056 of 3072-token budget (99.5%), leaving 16 tokens for warmth/memory/goals/few-shot/mirroring/mode — all silently dropped; `chatTool.ts` appends 1023 tokens OUTSIDE budget, pushing total system prompt to ~4079 tokens (entire 4K context for small models); this explains test results perfectly — NEVER rules at top work (primacy effect, 20/20), instructions buried in middle fail (personality 0/20, sensory 3-4/20), warmth/memory never reach the model; RESEARCH_ROUND3.md written with 5 areas: (1) compact prompt tier for <3B models (~400 tokens, 82% compression, all-negative framing), (2) few-shot vs instruction analysis by model size (examples critical below 3B, instructions effective above 5B), (3) negative constraint reframing (NEVER rules work at 20/20 so reframe personality/sensory/open-loops as negatives), (4) tiered budget system (compact=1500/standard=2500/full=3072 with tool templates INSIDE budget enforcement), (5) model-specific quirks (Qwen strong at CJK/suppression, Gemma strong at character voice/behavioral instructions); implementation roadmap: P1 fix budget crisis (demote core rules from MUST to HIGH), P2 create compact/standard/full prompt tiers, P3 negative reframing for compact tier, P4 model-specific identity layer boosts; exact prompt text provided for all tiers; CLAUDE.md Known Gaps updated with 2 new critical gaps (budget blown, no prompt tiers); new known gap: chatBehavior bypass marked as subset of budget crisis)

**Previously: 2026-04-16l** (Experiments EXP-026 through EXP-030 — identity formation and habit mechanics: EXP-026 — identity reinforcement: `identity_reinforcement` skill added to `conversationSkills.json` (trigger: user_at_functional_or_higher; reframe progress as identity not skill; Dornyei 2009 L2 Motivational Self System, Norton 2000); `celebrate_progress` goal in `systemLayers.json` updated with identity reinforcement sub-instruction + typo fix; EXP-027 — streak narrative: `STREAK_NARRATIVES` record added to `ProactiveEngine.ts` with 4 character-voiced messages (day 3/7/14/30); day 3 added as milestone (early dropout prevention); messages feel like avatar noticing, not badge notification; tests updated; EXP-028 — loss aversion: both absence messages in `ProactiveEngine.ts` rewritten with loss framing using specific stats (totalPhrases, longestStreak/currentStreak); "Would be a shame to let that fade" framing; graceful fallback to generic when no stats exist; long absence uses longestStreak, short absence uses currentStreak; EXP-029 — social proof simulation: `social_proof` skill added to `conversationSkills.json` (trigger: user_struggling_or_hesitant; normalize struggle via "my friend"/"everyone" references; Cialdini 2006, Bandura 1977 vicarious experience); never say "other users" or "studies show"; EXP-030 — session pacing: SESSION PACING section added to `coreRules.json` (8-10 exchange wrap-up guideline; plant seed for next session; energy override for engaged users; never announce stopping; Cepeda et al 2006 spaced practice); build passes, 104/104 tests pass)

**Previously: 2026-04-16j** (Experiments EXP-016 through EXP-020: EXP-016 — surprise competence detection wired: `postProcess()` in `ConversationDirector.ts` detects when user produces target language above their comfort tier threshold (tier 0-1: >40% non-ASCII, tier 2: >60%), stores flag in WorkingMemory with 2-min TTL; `preProcess()` checks flag and injects `surprise_competence` skill from `conversationSkills.json`; consumed after one use; EXP-017 — contextual SR audit: searched all config files for quiz-style patterns ("do you remember", "let's review", "quiz", "test"); found none requiring removal; anti-quiz patterns already in 5 locations; strengthened `review_due_phrases` goal with explicit anti-quiz instruction ("create a moment where the phrase is needed" vs "do you remember how to say X?"); EXP-018 — negative/positive constraint ratio in `coreRules.json` ABSOLUTE RULES was 4.3:1 (13 neg : 3 pos); added 3 positive ALWAYS rules (reference user's message, include target language, end with forward momentum); new ratio 2.2:1; EXP-019 — plateau mitigations added to `systemLayers.json`: `functional` stage gets "PLATEAU WATCH" instruction (introduce scenarios where current vocab fails); `conversational` stage gets "INTERMEDIATE WALL" instruction (reference growth explicitly, introduce new domains); EXP-020 — session continuity: `session_opener` goal rewritten to prioritize picking up where last session left off ("did you end up trying that phrase?") before falling back to scene-setting; build passes, 104/104 tests pass)

**Previously: 2026-04-16i** (Experiments EXP-001 through EXP-005 (prompt-level conversational quality): EXP-001 — `SPEECH TEXTURE` section added to `coreRules.json` BEHAVIOR with per-language fillers (7 languages: Japanese/French/Spanish/Nepali/Korean/Vietnamese/Thai), self-correction pattern, 1-in-3 frequency, guardrail against fillers during teaching/confusion; speech texture + recasting few-shot examples added to `fewShotExamples`; EXP-002 — response length rule in `coreRules.json` ABSOLUTE RULES replaced with trigger-based SHORT/MEDIUM/LONG guidance (SHORT=emotional/ack/rapid, MEDIUM=default, LONG=phrase card/scene/story); post-phrase-card short response rule; EXP-003 — `LOOP FOLLOW-THROUGH` sub-instruction added to `toolPrompts.json` chat template open loops section (close loops within 2-3 exchanges, max 1 open loop at a time); WorkingMemory API analyzed for future programmatic persistence; EXP-004 — `tblt_pretask` in `systemLayers.json` replaced with structured 3-step approach (conversational preview -> single phrase card for most critical phrase -> scene setting, 5-7 sentences total); EXP-005 — full recasting audit across all 5 config files: 1 contradiction found and fixed in `warmthLevels.json` friend tier (semi-explicit "almost" changed to recast-first with escalation); family tier reframed as earned-trust progression; recasting few-shot example added to `coreRules.json`; build passes, 104/104 tests pass)

**Previously: 2026-04-16h** (Experiments EXP-011 through EXP-015: EXP-011 — variable reward injection wired into `ConversationDirector.preProcess()` via `Math.random() < 0.2`; reads injection text from `conversationSkills.json` via `promptLoader`; `conversationSkills.json` registered in `promptLoader.ts` config map; EXP-012 — inside joke callback timing: new `SharedReference` type with `createdAtInteraction`/`callbackCount`/`lastCallbackAtInteraction`; `getCallbackSuggestion()` rewritten with 3 timing windows (1st callback 3-8 msgs, 2nd 15-25 msgs, 3rd 50+ msgs since last); backward-compat union type `(string | SharedReference)[]`; EXP-013 — 5 anti-sycophancy rules added to `coreRules.json` (no agreement openers, no "absolutely", no question praise, no "great observation", no parroting back); EXP-014 — survival stage now allows restaurant+emergency scenarios in `STAGE_SCENARIO_ACCESS` (was empty `[]`); EXP-015 — MICRO-MISSIONS section added to `coreRules.json` with follow-up behavior (remember missions, ask in 2-3 msgs, celebrate/adjust, one at a time); build passes, 104/104 tests pass)

**Previously: 2026-04-16g** (Experiments EXP-006 through EXP-010: EXP-006 — sensory grounding cadence in `coreRules.json` changed from "at least one per conversation" to "1 in 3-4 messages" with explicit bracketing; EXP-007 — `detectEmotionalState()` in `ConversationDirector.ts` now detects lol/lmao/haha/hehe/laughter emoji as 'excited', short disengaged messages explicitly handled, trailing ellipsis documented as intentionally neutral; EXP-008 — warmth progression math analyzed, current rates validated (friend at session 7-9 is correct sweet spot, session bonus properly rewards returning), no changes needed; EXP-009 — density-vs-style conflict between learningStages and warmthLevels codeSwitching resolved via new `codeSwitchingPriority` instruction in `systemLayers.json` (learning stage=DENSITY wins over warmth=STYLE); EXP-010 — `getBackstoryTier()` in `RelationshipStore.ts` changed from interaction-count-based (every 50 interactions) to warmth-linked (maps to warmth tiers directly), surface stories at session 3 instead of 10, deep vulnerability at session 16 instead of 40; build passes, 104/104 tests pass)

**Previously: 2026-04-16f** (FLUENCY_JOURNEY.md created: comprehensive long-term language acquisition blueprint covering 4 stages (Survival 0-50 sessions, Functional 50-200, Conversational 200-500, Fluent 500+); grounded in SLA research (Krashen, Long, Swain, Nation, Laufer, Schmidt, Vygotsky, Ellis, Willis); defines: stage-specific languageComfortTier configs, conversation goal priority stacks per stage, exact prompt injection text for each stage, scenario progression unlock map (5 Stage 1 -> 6 Stage 2 -> 9 Stage 3 -> all Stage 4), stage-specific SR intervals (aggressive->standard->extended->maintenance), milestone definitions for stage advancement with concrete metrics, conversation pattern progressions (turn-taking, repair, topic management, pragmatic competence, cultural code-switching), session design from Session 1 to Session 500+, analysis of 3 plateau types with mitigation strategies, implementation checklist for code changes needed; no code changes in this commit)

**Previously: 2026-04-16e** (learning stage progression system: `LearningStage` type + `LearningStageInfo` + `STAGE_SCENARIO_ACCESS` added to `core/types.ts`; `LearnerProfileStore.getCurrentStage()` — composite score from 4 weighted signals (interactions 0.3, mastered phrases 0.35, comfort tier 0.25, completed scenarios 0.1); 4 stages: survival (0-50 interactions), functional (50-200), conversational (200-500), fluent (500+); `systemLayers.json` — `learningStages` section with per-stage prompt instructions + `scenarioLock_fluent` peer role-play layer; `ConversationDirector.preProcess()` — detects stage, injects stage instruction at HIGH priority before all other goal instructions, passes `LearningStageInfo` in `DirectorContext`; scenario progression: survival=none, functional=4 basic, conversational/fluent=all; build passes, 104/104 tests pass)

**Previously: 2026-04-16d** (conversational quality testing framework: `TEST_RUBRIC.md` — 18-dimension scoring rubric across 4 categories (engagement 30%, teaching 30%, personality 25%, anti-patterns 15%), each dimension 0-5 with measurement criteria; `TEST_BASELINE.md` — baseline analysis of all prompt configs, estimated 3.22/5.0 overall score, 10 test conversation scenarios (beginner Tokyo, intermediate Paris, advanced Seoul, emergency Mexico City, restaurant HCMC, casual Tokyo, frustration Kathmandu, dialect Osaka, multi-language Paris-Tokyo, ambient Kathmandu), 8 prioritized improvement recommendations, architecture risk analysis; Known gaps added: no open-loop instruction, no character backstory seeds, no emotional override, chatBehavior bypasses token budget)

**Previously: 2026-04-16c** (engagement overhaul Tier 1+2: coreRules.json — open loops, sensory grounding, recast correction, response variance, negative constraints; warmthLevels.json — per-tier callbackFrequency/selfDisclosureDepth/imperfectionAllowance with behavioral instructions; systemLayers.json — emotionalMirroring instruction, backstoryDisclosure tiers 0-4, TBLT scenario templates; learningProtocols.json — 3 new protocols (expansion, elicitation, contextual_reintroduction); toolPrompts.json chat template rewritten; ConversationDirector — emotional state detection heuristic injected into preProcess; RelationshipStore — getCallbackSuggestion() warmth-gated, getBackstoryTier() progressive disclosure, formatForPrompt() enhanced; ProactiveEngine — scenario completion hook, backstory openers by tier; contextController — emotionalMirroring layer added; build passes, 104/104 tests pass)

**Previously: 2026-04-16b** (prompt engineering research: `RESEARCH_FINDINGS.md` created with 30+ specific prompt improvements across all 7 config files — recasting protocol, open-loop hooks, response variance, sensory grounding, emotional mirroring, TBLT cycle, progressive backstory, variable rewards, warmth-tier code-switching, 5 new learning protocols, micro-missions, session pacing, curiosity gaps in character gen, contextual vocab in document prompts; all written as exact copy-paste text ready for implementation)

**Previously: 2026-04-16** (code quality cleanup: removed 13 dead files -1977 LOC; extracted 3 shared utilities (locationHelpers, avatarProfileHelpers, GeneratedCharacter/mapCharacterToUI); consolidated duplicate types across 6 files; removed 5 error-hiding try-catches; fixed last `any` type; build passes, 104/104 tests pass)

**Previously: 2026-04-14** (pronunciation grounding: `pronunciationLookup.ts` — Free Dictionary API + IndexedDB cache for real IPA data; `pronounceTool` pre-injects IPA reference; both pronounce/phrase tools post-process via `enrichPronunciations()` to replace hallucinated pronunciations; prompt templates hardened with syllable-mapping rules + skip-native-language guard)

**Previously: 2026-04-13** (simplified onboarding: replaced 4-step `NewOnboardingScreen` with single-step `AvatarSelectScreen.tsx` — 8 avatar template grid, no LLM needed for character creation; auto-default WebGPU Qwen3 1.7B on first launch, `backend_select` skipped unless no WebGPU; model changes only in Settings; GPS location detected in background during avatar selection)

**Previously: 2026-04-08** (UI polish: `Navbar.tsx` — pencil + gear buttons now conditional on `onEdit`/`onSettings` props (were stubs with empty onClick); `App.tsx` — passes `onEdit`/`onSettings` to Navbar on home phase only, adds `showHomeSettings` state to render `SettingsPanel` from home screen (model picker accessible via Settings → Model tab); `ConversationScreen.tsx` — removed Brain/BookOpen/LayoutList icon buttons from second bar (3 icons → Zap/Sun/Settings only); dialect indicator shortened to flag emoji only (was "🇳🇵 Standard Nepali (Kathmandu)"))

**Previously: 2026-04-06b** (first-launch backend selection: `BackendSelectScreen.tsx` — full-screen 3-card picker shown once on first launch when `navi_backend_pref` absent from localStorage; `App.tsx` gains `'backend_select'` AppPhase + `handleBackendChosen` callback; Qwen3 PRESET_CONFIGS (9 models, Qwen3-1.7B default); FALLBACK_MODELS expanded to 8 (Gemma 4 first); PAID_MODELS includes OpenAI models; `switchBackend()` on NaviAgent with localStorage persistence; `useNaviAgent` exposes `switchBackend`/`webllmPreset`/`openRouterTier`; SettingsPanel 3-card Model UI with no key input on free tier) **2026-04-06:** (3-way backend selector: `NaviAgent.switchBackend()` — On-Device WebGPU / Cloud Free / Cloud Paid OpenRouter; `navi_backend_pref` localStorage; 4 WebLLM presets (Phi-3.5 Mini, Gemma 2 2B, Llama 3.2 1B/3B); `OpenRouterProvider.setApiKeys()` + `setModels()`; `useNaviAgent` exposes `switchBackend`/`webllmPreset`/`openRouterTier`; SettingsPanel 3-card Model UI). **2026-03-30:** Multi-agent orchestrator — `MemoryRetrievalAgent` + `ResearchAgent`; `KnowledgeGraphStore` (6 node + 9 edge types); MemoryMaker rich metadata; `learningProtocols.json`; Context Injection Protocol; MemoryManager 9 systems; `KnowledgeGraphExplorer.tsx` (Brain icon); 63/63 integration tests.

**Previous: 2026-03-29c** (updated 2026-03-29c: fixed two bugs — (1) `generateAvatarImageFromDescription` now logs HF FLUX failures and falls back to Pollinations.ai (Step C) so avatar portrait always generates; (2) `characterGen.json` NAME RULE in both templates now includes Kathmandu/Nepal names list so LLM picks varied names; `fallbackNameFor` randomizes from Nepali names instead of hardcoding Arjun) (updated 2026-03-29: OpenRouter retry overhaul — `MAX_ATTEMPTS` cap removed; now tries all `keys × models` combinations (up to 40 for 10 keys × 4 models); exponential backoff added between retries (200ms→8s); `Retry-After` header respected on 429s (sleeps up to 30s); `DEFAULT_TIMEOUT` raised 30s→90s for slow free models; `408` added to `RETRYABLE_STATUSES`; `throttle()` method + `MIN_REQUEST_GAP_MS` removed; updated 2026-03-28e: `KnowledgeGraphScreen` + `PhraseDetailSheet` — phrase map from `agent.memory.learner.phrases`, demo phrases by region when empty, `BookOpen` opens graph, `LayoutList` opens `FlashcardDeck` full-screen overlay, My phrases pill; updated 2026-03-28d: `FlashcardDeck` and `ProactiveEngine` wired into `ConversationScreen` — phrase review via `LayoutList` (2026-03-28e), `agent.memory.learner.phrases` as data source, `onPractice` queues phrase to chat, proactive `useEffect` fires once on mount for returning users (messages.length > 0 guard), `proactiveShownRef` prevents double-fire; updated 2026-03-28c: Phase 1 guided immersion architecture — `SessionPlanner` (session-level goal persistence via WorkingMemory, 2h TTL, 7-priority goal selection), `ProactiveEngine` (app-open proactive messages for long absence/streak milestones/struggling phrases), dual SR tracks in `LearnerProfileStore` (STRUGGLE_INTERVALS 6h→2w urgent vs SUCCESS_INTERVALS 2d→2mo relaxed), `struggleCount` field added to `TrackedPhrase`, `getUrgentReviewPhrases()` + `getRoutineReviewPhrases()` methods, `ConversationDirector` upgraded with `setSessionPlanner()` + `surfacePersonalContext()` + session goal achievement check in `postProcess()`, `reconnect` goal added to `systemLayers.json`, `FlashcardDeck.tsx` component with card-flip animation, mastery badges, filter tabs, `NaviAgent.getProactiveMessage()` public method; updated 2026-03-21: context window fix, dialect key wiring, target language flow, AnimatedCharacter, Gemini embeddings; 2026-03-21b: multi-city response bug + same-response loop bug fixed; 2026-03-21c: avatar prefs from LLM character generation; 2026-03-21d: companion switch restoration, inline markdown stripping, dynamic language calibration; 2026-03-21e: 6 core bugs fixed — token estimator dense scripts, language enforcement, location-on-update sync, location-on-switch always-sync, AvatarRenderer wired, calibration speed; 2026-03-26: 4 conversation bugs fixed — phrase repetition, confusion signal ignored, markdown asterisks in segments, wrong language on first message; 2026-03-26b: OpenRouter cloud provider added — when VITE_OPENROUTER_API_KEY is set, all LLM calls route to meta-llama/llama-3.3-70b-instruct:free, model download screen is skipped entirely; 2026-03-26c: OpenRouter multi-model fallback — `models` array replaces single `model` field; FALLBACK_MODELS list tries qwen3-32b → llama-3.3-70b → mistral-small → gemma-3-27b in order; 429/503/empty-response throw clean user-facing strings; NewChatBubble renders ⚠️ error bubble instead of raw JSON for all NAVI error strings; 2026-03-26d: OpenRouter fallback routing fixed — added `"route": "fallback"` to request body (required by OpenRouter to activate multi-model fallback); timeout reduced 120s → 30s for cloud API path; 2026-03-27: AI portrait avatar — `AIAvatarDisplay` 3-tier renderer (AI portrait → DiceBear notionists → letter fallback), `generateAvatarImage` Pollinations.ai utility, `saveAvatarImage`/`loadAvatarImage` IndexedDB helpers, `portrait_prompt` field in `characterGen.json` and `Character` type, Settings OpenRouter key input + Regenerate Portrait button, `@dicebear/core` + `@dicebear/collection` installed; 2026-03-28: multi-API key rotation — `VITE_OPENROUTER_API_KEY` now accepts comma-separated keys; `OpenRouterProvider` rotates to next key on 429/503 and retries within same request; Nepali/Devanagari first-message example added to all 3 `characterGen.json` FIRST MESSAGE RULE sections so Qwen generates नमस्ते-style openers for Kathmandu characters; 2026-03-28b: OpenRouter rate limit overhaul — 402 now caught + rotated (was crashing); `models:[...]`/`route:fallback` replaced with single `model:` per attempt cycling through FALLBACK_MODELS so each retry hits a different per-model rate limit pool; `RETRYABLE_STATUSES` set covers 402/429/500/502/503/504; 100ms throttle between requests; empty_response now advances `currentKeyIndex`; error body logged on all retryable failures)

---

## ⚠️ Security TODOs (before public launch)

### API keys exposed in client bundle
`VITE_OPENROUTER_API_KEY` is baked into the JS bundle (Vite `VITE_` prefix = client-side). Anyone can find it in DevTools. Fine for founder testing, not for public launch.

**Fix when ready:** Add a Vercel serverless function (`/api/chat.ts`) that holds keys server-side (non-`VITE_` env vars) and proxies OpenRouter requests. ~50 lines of TypeScript.

---

## Dependencies (`package.json`)

**Runtime (installed):**
- React 18.3.1, React DOM 18.3.1 (peer deps)
- **Routing:** `react-router` 7.13.0 — installed but NOT used; `App.tsx` uses manual `useState` to switch screens
- **Animation:** `motion` 12.23.24 (Framer Motion v12)
- **UI:** Full Radix UI suite + shadcn/ui wrappers + `vaul` 1.1.2 (bottom sheet) + `sonner` 2.0.3 (toasts)
- **Icons:** `lucide-react` 0.487.0
- **Forms:** `react-hook-form` 7.55.0
- **Charts:** `recharts` 2.15.2
- **DnD:** `react-dnd` 16.0.1
- **Carousel:** `embla-carousel-react` 8.6.0
- **Themes:** `next-themes` 0.4.6 — installed but not used; dark mode handled manually via `classList`
- **MUI:** `@mui/material` 7.3.5 + `@emotion/react` 11.14.0 — present but not used in custom components
- **Avatars:** `avataaars` ^2.0.0 — installed but not used; avatar rendering is via `BlockyAvatar.tsx` (custom 8-bit style)
- **State:** `zustand` ^5.0.11 — installed and in use (3 stores: appStore, characterStore, chatStore)
- **LLM:** `@mlc-ai/web-llm` ^0.2.81 — installed and in use (WebGPU inference)
- **OCR:** `tesseract.js` ^7.0.0 — installed and in use
- **Storage:** `idb-keyval` ^6.2.2 — installed and in use

**Dev:**
- Vite 6.3.5, `@vitejs/plugin-react` 4.7.0, `@tailwindcss/vite` 4.1.12, TailwindCSS 4.1.12, TypeScript ^5.9.3

---

## State Management

- **Zustand** is in use — 3 stores: `appStore` (model status, location, preferences), `characterStore` (active character, memories), `chatStore` (messages, scenario, generation state)
- App-level phase switching in `App.tsx` via `useState` (`phase`: init → onboarding (avatar select) → downloading → chat; backend_select only for Settings or no-WebGPU fallback)
- All stores persist to IndexedDB via `utils/storage.ts` (idb-keyval)
- Full state survives page refresh

---

## Routing

- `react-router` is installed but **not used**
- Navigation is manual: `App.tsx` renders `<NewOnboardingScreen>` or `<ConversationScreen>` based on `hasOnboarded` boolean

---

## Component-by-Component Breakdown

### `App.tsx`
- **Renders:** switches between `NewOnboardingScreen`, `ConversationScreen`, and `CameraOverlay` (modal overlay)
- **Props:** none (root)
- **State:** `hasOnboarded`, `character` (`GeneratedCharacter | null`), `location` (string), `isDark` (bool), `showCamera` (bool)
- **Handlers:** `handleOnboardingComplete(character, location)`, `handleToggleTheme()`
- **Hardcoded:** dark mode defaults to `true` on mount
- **Needs wiring:** character generation (currently simulated), location detection

---

### `NewOnboardingScreen.tsx`
- **Renders:** 3-state AnimatePresence: input form → generating animation → character reveal
- **Props:** `onComplete(character, location)`
- **State:** `placeholderIndex`, `promptValue`, `location` (hardcoded `'Ho Chi Minh City'`), `isGenerating`, `generatedCharacter`
- **Hardcoded:** location is hardcoded; character is randomly generated from static arrays with a 2s `setTimeout` — not real LLM
- **Has:** text input (custom personality), location display with "Change" button (non-functional), CTA "Meet your companion" button
- **Needs wiring:** real LLM generation via `llm.generateCharacter()`, real GPS location detection, avatarTemplates (currently no template picker — just free text)

---

### `ConversationScreen.tsx`
- **Renders:** sticky top bar (avatar + name + location + theme toggle + settings), collapsible profile card, scrollable chat messages, input area with camera/mic/send
- **Props:** `character`, `location`, `onOpenCamera()`, `onToggleTheme()`, `isDark`
- **State:** `messages` (array, pre-populated with 6 hardcoded messages), `inputValue`, `isTyping`, `showQuickActions`, `expandedPhrase`, `showProfile`
- **Hardcoded:** `initialMessages` — 6 static messages hardcoded in file; bot response is a 1.5s setTimeout with a static string
- **Has:** typing indicator (3 bouncing dots), 3 hardcoded `QuickActionPill`s (Scan a menu, Teach me a phrase, What's nearby?), mic button (no handler), camera button → calls `onOpenCamera`, settings button (no handler), "Regenerate companion" link (no handler)
- **Needs wiring:** real LLM via `llm.streamMessage()`, real message persistence, quick action pills from `scenarioContexts.json`, mic → STT, settings → settings panel

---

### `NewChatBubble.tsx`
- **Renders:** user bubbles (right-aligned, plain text) or character bubbles (left-aligned, italic serif font, optional phrase highlight card)
- **Props:** `type`, `content`, `character?`, `phraseHighlight?` `{text, phonetic}`, `showAvatar?`, `onPhraseClick?`
- **Has:** `Volume2` TTS button on phrase cards (no handler), "Tap to learn more" → `onPhraseClick`
- **Needs wiring:** TTS button → `tts.speakPhrase()`, rendered phrase data from `responseParser`

---

### `BlockyAvatar.tsx`
- **Renders:** Minecraft-style blocky avatar using `character.colors.primary/secondary/accent` and `character.accessory` emoji
- **Props:** `character {name, colors, accessory?}`, `size` ('xs'|'sm'|'md'|'lg'|'xl'), `animate?` (floating bob), `onClick?`
- **Hardcoded:** nothing — fully driven by props
- **Needs wiring:** pass real `characterStore.activeCharacter` data; could optionally accept `emoji` prop for template-based avatars

---

### `CameraOverlay.tsx`
- **Renders:** full-screen black overlay, fake camera viewfinder (Unsplash image), scan animation, results bottom sheet with hardcoded Vietnamese menu items
- **Props:** `character`, `onClose()`
- **State:** `isScanning`, `showResults`, `flashOn`
- **Hardcoded:** static `menuItems` array (5 items), Unsplash image as "camera feed", scan is a 1.5s setTimeout
- **Has:** Close button, Flash toggle (no real flash), Scan button, "Help me order this" button (closes overlay), `Volume2` buttons on items (no handler), "Save" button (no handler)
- **Needs wiring:** real `<input type="file" capture="environment">` for image capture, `ocr.extractText()`, `ocrClassifier`, `llm.streamMessage()`, `tts.speakPhrase()` on Volume2 buttons, "Help me order" → inject context into chat

---

### `ExpandedPhraseCard.tsx`
- **Renders:** bottom sheet modal with phrase, phonetic, literal + natural translation, formality slider, character tip, alternative phrasings, save button
- **Props:** `phrase {foreign, phonetic, literal, natural, formality, characterTip, alternatives?}`, `characterName`, `onClose()`
- **Has:** Listen button (no handler), Practice/mic button (no handler), Save button (no handler)
- **Needs wiring:** Listen → `tts.speakPhrase()`, Practice → `stt.startRecording()`, Save → persist phrase to IndexedDB

---

### `QuickActionPill.tsx`
- **Renders:** small pill button with emoji icon + label
- **Props:** `icon` (string), `label` (string), `onClick()`
- **Fully prop-driven** — no internal state
- **Needs wiring:** dynamic pills from `scenarioContexts[scenario].auto_suggestions`; tap to auto-send message

---

### `ActionCard.tsx`
- **Renders:** icon card with label + description, accent color variant
- **Props:** `icon` (LucideIcon), `label`, `description`, `accentColor?`, `onClick?`
- **Not currently used** in any visible screen — available for settings/home use

---

### `ContextualCard.tsx`
- **Renders:** 200×120px image card with title, optional progress bar
- **Props:** `title`, `imageUrl`, `progress?`, `onClick?`
- **Not currently used** in any visible screen — available for scenario/lesson cards

---

### `ImageWithFallback.tsx` (figma/)
- **Renders:** `<img>` with error fallback to an SVG placeholder
- Utility component, fully functional, no wiring needed

---

## Styles

- **3 font families:** `Playfair Display` (display/headings), `DM Sans` (body), `Source Serif 4` (character speech bubbles)
- **Dark mode (`.dark`):** Luxury black (`#0A0A0F`) background, warm cream foreground (`#F5F0EB`), gold primary (`#D4A853`), teal secondary (`#6BBAA7`)
- **Light mode:** Warm white (`#FAF8F5`), deep navy foreground (`#1A1A1F`), darker gold (`#B8922D`), darker teal (`#4A9A87`)
- `--radius: 0.75rem` (rounded-xl everywhere)
- Custom scrollbar styles + `scrollbar-hide` utility class
- `ambient-gradient` animation class defined but not currently used in any component

---

## Hardcoded vs Dynamic

| Thing | Status |
|---|---|
| Location | **Hardcoded** — `'Ho Chi Minh City'` string in `NewOnboardingScreen` |
| Character generation | **Hardcoded** — random name/color from static arrays, 2s timeout |
| Initial messages | **Hardcoded** — 6 static messages in `ConversationScreen` |
| Bot responses | **Hardcoded** — static string after 1.5s timeout |
| Camera feed | **Hardcoded** — Unsplash image URL |
| Menu OCR results | **Hardcoded** — 5 static Vietnamese menu items |
| Phrase card data | **Hardcoded** — static `expandedPhrase` object in `handlePhraseClick` |
| Quick action pills | **Hardcoded** — 3 static pills |
| TTS / STT | **Non-functional** — buttons exist, no handlers |
| Dark mode | **Functional** — `classList` toggle works |

---

## Wiring Status

Items from original audit, updated to reflect current implementation state (Prompts 1–6, 8 complete; Prompt 7 incomplete; Master Plan Batches 1–4 complete):

| # | What | Where | Status |
|---|---|---|---|
| 1 | Character generation | `NewOnboardingScreen` | ✅ Wired to `llm.generateCharacter()` |
| 2 | Location detection | `NewOnboardingScreen` | ✅ Wired to `location.ts` + `dialectMap.json` |
| 3 | All bot responses | `ConversationScreen` | ✅ Wired to `llm.streamMessage()` with streaming |
| 4 | Message persistence | `ConversationScreen` | ✅ IndexedDB via `storage.ts` |
| 5 | Camera capture | `CameraOverlay` | ⬜ Not wired — Prompt 7 incomplete |
| 6 | OCR | `CameraOverlay` | ⬜ Not wired — Prompt 7 incomplete |
| 7 | Camera LLM results | `CameraOverlay` | ⬜ Not wired — Prompt 7 incomplete |
| 8 | TTS | `NewChatBubble`, `CameraOverlay`, `ExpandedPhraseCard` | ✅ Wired to `tts.speakPhrase()` |
| 9 | STT | `ConversationScreen` mic button, `ExpandedPhraseCard` Practice | ✅ Wired to `stt.startRecording()` |
| 10 | Quick action pills | `ConversationScreen` | ✅ Dynamic from `scenarioContexts.json` |
| 11 | Settings panel | `ConversationScreen` | ✅ `SettingsPanel.tsx` built and wired |
| 12 | "Regenerate companion" | `ConversationScreen` profile card | ✅ Resets to onboarding phase |
| 13 | "Help me order this" | `CameraOverlay` | ⬜ Not wired — Prompt 7 incomplete |
| 14 | Save phrase | `ExpandedPhraseCard` | ✅ Persists to IndexedDB |

---

## Platform Status

| Platform | Status | Notes |
|---|---|---|
| **Web (Vercel)** | Active | Vite/React app, current primary target |
| **iOS** | Not started | Planned — no implementation yet |
| **Android** | Not started | Planned — no implementation yet |

### Shared Core — Web Coupling

The shared agent/store/prompt layer currently assumes web APIs in several places. These will need an abstraction layer before iOS/Android work begins:

| API | Where Used | Risk |
|---|---|---|
| **WebGPU** (`navigator.gpu`) | `services/llm.ts`, `services/modelManager.ts`, `App.tsx` phase check | Web-only; iOS/Android will need Core ML / NNAPI alternative |
| **Web Speech API** (`SpeechSynthesis`, `SpeechRecognition`) | `services/tts.ts`, `services/stt.ts` | Web-only; native platforms need AVSpeechSynthesizer / Android TTS |
| **IndexedDB** (`idb-keyval`) | `utils/storage.ts` | Web-only; native needs SQLite or AsyncStorage equivalent |
| **`navigator.geolocation`** | `services/location.ts` | Available on all platforms but requires permission model differences |
| **`<input capture="environment">`** | `CameraOverlay.tsx` (planned) | Web file input; native needs camera API |

**Action required before iOS/Android:** extract these into a `PlatformServices` abstraction interface so each platform can provide its own implementation without touching shared code.

---

## Known Gaps (as of 2026-03-21)

### ~~Context Window Overflow~~ — RESOLVED
System prompt exceeded Qwen 1.5B's 4096-token limit. Fixed by: (1) shortening `coreRules.rules` ~495 tokens, `identity.template` ~69 tokens, `languageCalibration` tiers ~143 tokens; (2) adding token budget enforcement in `contextController.buildSystemPrompt()` — greedily adds layers priority 0→3 while tokens ≤ 3072. Build confirmed clean.

### ~~Dialect Key Not Wired (avatar speaks English bug)~~ — RESOLVED
`AvatarProfile.dialect` was always `''`, causing language enforcement to never fire. Fixed: `dialect_key` field added to `Character` type; saved during onboarding; passed to `createFromTemplate()` via new `dialectKey` param in both `contextController` and `agent.createAvatarFromTemplate()`; propagated at all 3 avatar creation sites in `App.tsx`.

### ~~Language Immersion Flow Missing~~ — RESOLVED
Added target language onboarding step (step 0 before native language picker); saves to `profileMemory.targetLanguage`, `Character.target_language`, `UserPreferences.target_language`; city presets filter to matching countries. `ConversationDirector.postProcess()` now tracks `consecutiveTargetLangMessages` / `consecutiveHelpRequests` and calls `learner.setComfortTier()` after 3 consecutive target-lang exchanges (advance) or 2 help requests (drop), min 5 exchanges between changes.

### ~~Emoji Avatar Looks Dead~~ — RESOLVED (Lottie-ready)
`AnimatedCharacter.tsx` created — drop-in replacement for `CharacterAvatar` with Lottie animation support. Dynamically imports `lottie-react` and fetches JSON from `/public/lottie/`. Falls back to CharacterAvatar silently if either is missing. **User must**: (1) `pnpm add lottie-react`, (2) download 4 Lottie JSONs from lottiefiles.com into `public/lottie/` (char_idle.json, char_speaking.json, char_thinking.json, char_success.json).

### Gemini Embedding Provider Added (online-optional)
`src/agent/models/geminiEmbedding.ts` created — uses `text-embedding-004` REST API, falls back when offline or no key. User sets key in Settings → AI Model panel (stored in localStorage). Key never sent anywhere except `generativelanguage.googleapis.com`.

### Agent ↔ UI Wiring (partially resolved)
`ConversationScreen.handleSend()` now calls `agent.handleMessage()` via `useNaviAgent()`. `CameraOverlay` OCR/LLM pipeline is still not wired (Prompt 7 incomplete). `ExpandedPhraseCard` TTS/STT are wired to service layer, not agent tools.

### ~~AvatarRenderer Not Wired in ConversationScreen~~ — RESOLVED
`CharacterAvatar.tsx` created (emoji + gradient ring + country flag). Replaces `AvatarDisplay` at all call sites (`ConversationScreen`, `HomeScreen`, `NewChatBubble`, `NewOnboardingScreen`, `CameraOverlay`). Gender read from `appStore.userPreferences.avatar_gender`. `AvatarDisplay.tsx` retained for `AvatarBuilder` legacy support.

### CameraOverlay Pipeline Incomplete (Prompt 7)
`CameraOverlay.tsx` still uses a mocked scan + static results. `agent.handleImage()` exists and the OCR→classification→LLM pipeline is implemented in the agent framework but is not wired to the UI.

### Cloudflare Worker Setup Required
`web/wrangler.toml` has `database_id = "YOUR_D1_DATABASE_ID"` placeholder. Steps to activate:
1. `wrangler d1 create navi-feedback` → copy the returned ID into `wrangler.toml`
2. `wrangler d1 execute navi-feedback --command "CREATE TABLE IF NOT EXISTS feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL DEFAULT 'general', message TEXT NOT NULL, email TEXT, app_version TEXT, created_at TEXT NOT NULL);"`
3. `wrangler deploy`
4. Update the `WORKER_URL` constant in `web/feedback.html` if the subdomain differs

### Pending Feedback Offline Queue
`feedback.html` stores failed submissions in `localStorage('navi_pending_feedback')` but there is no background sync to retry when connectivity is restored.

---

## Resolved Gaps (2026-03-20)

| Gap | Resolution |
|---|---|
| Native language not collected | Language picker step added first in `NewOnboardingScreen.tsx` (13 options + Other). Saved to `profileMemory` + `appStore.userPreferences`. |
| `{{userNativeLanguage}}` had no source | Populated from `profileMemory.getNativeLanguage()` in agent context params. |
| Immersion mode not enforced | `ModeClassifier` in `agent/index.ts` detects learn/guide/friend from rolling keyword scoring (threshold=2). Mode injected as instruction layer by `contextController`. |
| Language mismatch bug | `contextController.resolveDialect()` uses explicit `dialectKey` from `AvatarProfile.dialect` first, bypassing city string matching. |
| Nepali not supported | `NP/Kathmandu` added to `dialectMap.json`, Kathmandu to `cities.json`, `ne-NP` to TTS/STT with `hi-IN` fallback, Devanagari script note injection added. |
| Avatar appearance variants | `AvatarRenderer.tsx` created with avataaars + Framer Motion animated states (idle, generating, speaking, success, thinking, blink). |
| ScenarioLauncher rigid 4-field form | Redesigned to single free-text + chips. 9 new scenario templates added. |
| Avatar always renders male / SVG-based | `CharacterAvatar.tsx` created: emoji + gradient ring + flag badge. Reads `avatar_gender` from store. Template+gender → emoji. All call sites updated. |
| ScenarioLauncher extra step for templates | Template tiles now fire `onStart` immediately (zero friction). Only Custom scenario shows a text input step. |
| Scenario first message is generic gauging | `scenarioOpener` prompt template added to `systemLayers.json`. `contextController.ts` injects it when `isFirstEverMessage && scenario`. `chatTool` + `agent/index.ts` wired to pass `isFirstEverMessage`. |
| No scenario access from HomeScreen | Horizontal scroll scenario strip added directly to HomeScreen. |
| No web presence | `web/index.html` (landing page), `web/feedback.html` (feedback form + offline fallback), `web/worker.js` (Cloudflare Worker + D1) created. |
| Avatar opens with canned greeting | Mode system adds `gauging_question` first-message layer: avatar opens with "What do you need from me?" in its language + pronunciation guide. |
| Avatar double-questions + filler openers | `coreRules.json` + `systemLayers.conversationNaturalness` rules added. |

## Resolved Gaps (2026-03-21d)

| Gap | Resolution |
|---|---|
| Companion switch restores wrong/shallow avatar | `handleSelectCompanion` in `App.tsx` now resolves dialect key (stored → dialectMap scan fallback), calls `agent.avatar.createFromDescription()` with full `AvatarProfile` shape including visual prefs. Also syncs `agent.location` + `appStore.currentLocation` so system prompt uses correct dialect. |
| LLM responses contain raw Markdown formatting | `stripInlineMarkdown()` added to `utils/responseParser.ts`. Strips `##` headings, `**bold**`, `__bold__`, `*italic*`, `_italic_`. Applied at all `segments.push({ type: 'text' })` sites in `parseResponse()` and to `displayContent` in `SpeechBubble` + `ChatLogEntry` in `NewChatBubble.tsx`. |
| Language calibration tier is static (only advances on consecutive full exchanges) | `ConversationDirector` now maintains a 5-message rolling window of user input. `computeCalibrationTier()` scores non-ASCII density to produce a tier 0–4, written to `WorkingMemory` (key: `calibration_tier`, TTL: 30 min). `preProcess()` prefers the WM tier over `learner.languageComfortTier`. `WorkingMemory` passed as 4th arg to `ConversationDirector` from `agent/index.ts`. |

## Resolved Gaps (2026-04-10)

| Gap | Resolution |
|---|---|
| OpenRouter invoked without explicit user choice | `agent/index.ts:325` — changed routing condition from `llmBackend !== 'webllm'` to `llmBackend === 'openrouter'`. Env key alone no longer activates cloud inference; user must pick OpenRouter explicitly. |
| Proactive message repeats and poisons context | `ProactiveEngine.ts` — added `firedThisSession` flag so message fires at most once per session. `ConversationScreen.tsx` — proactive messages tagged `metadata.isProactive=true` and filtered from LLM history slice at line 232. |
