# NAVI Codebase Audit

---

## Dependencies (`package.json`)

**Runtime:**
- React 18.3.1, React DOM 18.3.1 (peer deps)
- **Routing:** `react-router` 7.13.0 ✅ installed but NOT used — `App.tsx` uses manual `useState` to switch screens
- **Animation:** `motion` 12.23.24 (Framer Motion v12)
- **UI:** Full Radix UI suite (accordion, dialog, dropdown, select, etc.) + shadcn/ui wrappers
- **Icons:** `lucide-react` 0.487.0
- **Forms:** `react-hook-form` 7.55.0
- **Charts:** `recharts` 2.15.2
- **DnD:** `react-dnd` 16.0.1
- **Carousel:** `embla-carousel-react`
- **Themes:** `next-themes` 0.4.6 — installed but not used; dark mode handled manually via `classList`
- **MUI:** `@mui/material` + `@emotion/react` — present but not used in custom components
- **No Zustand, no Redux, no Context API**

**Dev:**
- Vite 6.3.5, `@vitejs/plugin-react`, `@tailwindcss/vite` 4.1.12, TailwindCSS 4

**Missing (need to install):**
- `@mlc-ai/web-llm` or `wllama`
- `zustand`
- `tesseract.js`
- `idb-keyval`

---

## State Management

- **Only `useState`** in individual components — no global state at all
- App-level state lives in `App.tsx`: `hasOnboarded`, `character`, `location`, `isDark`, `showCamera`
- Conversation state lives in `ConversationScreen.tsx`: `messages`, `inputValue`, `isTyping`, `showQuickActions`, `expandedPhrase`, `showProfile`
- **No persistence** — full state reset on page refresh

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

## What Needs to Be Wired Up

| # | What | Where | Wire To |
|---|---|---|---|
| 1 | Character generation | `NewOnboardingScreen` | `llm.generateCharacter()` |
| 2 | Location detection | `NewOnboardingScreen` | `navigator.geolocation` + `location.ts` + `dialectMap.json` |
| 3 | All bot responses | `ConversationScreen` | `llm.streamMessage()` |
| 4 | Message persistence | `ConversationScreen` | IndexedDB via `storage.ts` |
| 5 | Camera capture | `CameraOverlay` | `<input type="file" capture="environment">` |
| 6 | OCR | `CameraOverlay` | `ocr.extractText()` + `ocrClassifier` |
| 7 | Camera LLM results | `CameraOverlay` | `llm.streamMessage()` with camera prompt |
| 8 | TTS | `NewChatBubble`, `CameraOverlay`, `ExpandedPhraseCard` | `tts.speakPhrase()` |
| 9 | STT | `ConversationScreen` mic button, `ExpandedPhraseCard` Practice | `stt.startRecording()` |
| 10 | Quick action pills | `ConversationScreen` | Dynamic from `scenarioContexts.json` |
| 11 | Settings button | `ConversationScreen` | Settings panel (screen does not exist yet) |
| 12 | "Regenerate companion" | `ConversationScreen` profile card | Reset to onboarding |
| 13 | "Help me order this" | `CameraOverlay` | Inject scan context into `chatStore` |
| 14 | Save phrase | `ExpandedPhraseCard` | Persist to IndexedDB |
