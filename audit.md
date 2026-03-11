# NAVI Codebase Audit

**Last updated: 2026-03-10**

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

Items from original audit, updated to reflect current implementation state (Prompts 1–6, 8 complete; Prompt 7 incomplete):

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

## Known Gaps (as of 2026-03-10)

### Agent ↔ UI Wiring
The full agent framework (`src/agent/`) is built but **not connected to the UI**. The UI currently calls legacy services (`llm.ts`, `tts.ts`, `stt.ts`) directly. `useNaviAgent()` hook exists but `ConversationScreen.handleSend()` has not been updated to call `agent.handleMessage()`.

To fix: replace direct service calls in `ConversationScreen`, `CameraOverlay`, and `ExpandedPhraseCard` with calls through the agent layer (`agent.handleMessage()` / `agent.handleImage()`).

### Native Language Not Collected
Onboarding (`NewOnboardingScreen.tsx`) collects a personality description and (optionally) a template. It does **not** ask for the user's native language. The prompt system uses `{{userNativeLanguage}}` in `coreRules.json` and `toolPrompts.json`, but this variable has no source — it defaults to an empty string or undefined.

### Immersion Mode Not Enforced
Language calibration tiers (`languageCalibration` in `systemLayers.json`) define how much the avatar uses the target language vs. the user's native language. There is no UI setting or toggle exposed to the user to control this. The immersion level defaults to the prompt's authored behavior with no per-session override.

### Avatar Generation — Single Template, No Appearance Variants
`BlockyAvatar.tsx` renders a programmatic 8-bit avatar driven by `colors.primary/secondary/accent` and an `accessory` emoji. It does not support gender, body type, or facial appearance variants. `avataaars ^2.0.0` is installed in `package.json` but is not used anywhere in the codebase. Avatar differentiation is limited to color palette + one emoji accessory.
