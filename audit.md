# NAVI Codebase Audit

**Last updated: 2026-03-20** (updated 2026-03-21: context window fix, dialect key wiring, target language flow, AnimatedCharacter, Gemini embeddings; 2026-03-21b: multi-city response bug + same-response loop bug fixed; 2026-03-21c: avatar prefs from LLM character generation; 2026-03-21d: companion switch restoration, inline markdown stripping, dynamic language calibration; 2026-03-21e: 6 core bugs fixed — token estimator dense scripts, language enforcement, location-on-update sync, location-on-switch always-sync, AvatarRenderer wired, calibration speed; 2026-03-26: 4 conversation bugs fixed — phrase repetition, confusion signal ignored, markdown asterisks in segments, wrong language on first message; 2026-03-26b: OpenRouter cloud provider added — when VITE_OPENROUTER_API_KEY is set, all LLM calls route to meta-llama/llama-3.3-70b-instruct:free, model download screen is skipped entirely; 2026-03-26c: OpenRouter multi-model fallback — `models` array replaces single `model` field; FALLBACK_MODELS list tries qwen3-32b → llama-3.3-70b → mistral-small → gemma-3-27b in order; 429/503/empty-response throw clean user-facing strings; NewChatBubble renders ⚠️ error bubble instead of raw JSON for all NAVI error strings; 2026-03-26d: OpenRouter fallback routing fixed — added `"route": "fallback"` to request body (required by OpenRouter to activate multi-model fallback); timeout reduced 120s → 30s for cloud API path; 2026-03-27: AI portrait avatar — `AIAvatarDisplay` 3-tier renderer (AI portrait → DiceBear notionists → letter fallback), `generateAvatarImage` Pollinations.ai utility, `saveAvatarImage`/`loadAvatarImage` IndexedDB helpers, `portrait_prompt` field in `characterGen.json` and `Character` type, Settings OpenRouter key input + Regenerate Portrait button, `@dicebear/core` + `@dicebear/collection` installed)

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
- App-level phase switching in `App.tsx` via `useState` (`phase`: init → downloading → onboarding → chat)
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
