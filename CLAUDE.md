# NAVI — Project Guide

## What Is NAVI?

NAVI is an **offline-first AI language companion app** — a local friend in your pocket who speaks the language, knows the slang, understands the culture, and explains everything like a native. It runs entirely on-device using WebGPU-accelerated LLM inference. No internet required.

**The core bet:** Every competitor (Google Translate, ChatGPT, Duolingo, DeepL) requires internet. NAVI works everywhere because it runs entirely on the user's device. Offline is not a fallback — it IS the product.

**Target users:** Travelers, immigrants, expats, multilingual families, service workers in multilingual environments.

---

## Project Structure

```
/NAVI/
├── AI Language Companion App/        # Main React app (Vite + TypeScript)
│   ├── src/
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
│   │   ├── services/                 # Core business logic
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
│   │   ├── prompts/                  # LLM prompt templates
│   │   │   ├── systemBuilder.ts     # 6-layer system prompt engine
│   │   │   └── characterGen.ts      # Character generation prompts
│   │   ├── config/                   # Data files
│   │   │   ├── avatarTemplates.json # 8 character templates by vocation
│   │   │   ├── dialectMap.json      # Language/dialect/slang mappings
│   │   │   ├── scenarioContexts.json # 8 scenario types
│   │   │   └── userPreferenceSchema.json
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

| Layer | Technology | Notes |
|---|---|---|
| **Framework** | React 18 + TypeScript | Vite 6 build tool |
| **Styling** | TailwindCSS 4 + shadcn/ui | 50+ Radix-based components |
| **State** | Zustand 5 | 3 stores: app, character, chat |
| **Storage** | IndexedDB (idb-keyval) | Persists character, messages, memories, prefs |
| **On-Device LLM** | @mlc-ai/web-llm | WebGPU inference, Qwen2.5-1.5B model |
| **OCR** | Tesseract.js 7 | Client-side, 6 languages |
| **TTS** | Web Speech API | Browser SpeechSynthesis |
| **STT** | Web Speech API | Browser SpeechRecognition |
| **Animation** | Motion (Framer Motion v12) | Transitions + AnimatePresence |
| **Icons** | Lucide React | 400+ icons |

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

### 6-Layer System Prompt Engine (`systemBuilder.ts`)
Each LLM call is guided by a layered system prompt:
1. **Identity** — Character name, personality, speaking style
2. **User Preferences** — Age, gender, vocation, formality, learning focus
3. **Location + Dialect** — City, country, dialect specifics, generational slang
4. **Scenario** — Context-specific vocab/tone (restaurant, hospital, office, etc.)
5. **Memory** — Last 8 remembered facts about the user
6. **Core Rules** — Pronunciation format, phrase card structure, behavior constraints

### Data Models
- **Character**: name, personality, avatar colors, speaking style, location context
- **Message**: role (user/character/system), content, type (text/phrase_card/camera_result)
- **LocationContext**: city, country, dialect key, cultural notes, slang era
- **MemoryEntry**: fact extracted from conversation, timestamp

---

## Current Implementation Status

### Fully Built
- All frontend UI components (15+ custom, 50+ shadcn/ui)
- Zustand stores (app, character, chat) with full type definitions
- IndexedDB persistence layer (character, conversations, memories, preferences, location)
- Service layer functions (LLM, OCR, TTS, STT, location)
- System prompt builder (6-layer engine)
- Character generation prompts
- Configuration data (8 avatar templates, 8 dialects, 8 scenarios, city database)
- Dark/light theme with custom typography (Playfair Display, DM Sans, Source Serif 4)
- Model download + loading logic (WebLLM integration)

### Needs Wiring (Services → UI)
- **ConversationScreen**: `handleSend()` needs real LLM call via `streamMessage()`, message persistence, memory generation after exchanges, scenario auto-detection
- **CameraOverlay**: Replace fake camera feed with real `<input capture>`, wire OCR + LLM interpretation
- **ExpandedPhraseCard**: Wire TTS playback, STT practice mode, phrase saving
- **SettingsPanel**: Complete save/load for preferences, location detection UI, memory management
- **App.tsx**: Wire character generation from onboarding → store + IndexedDB, first message flow

### Prompt Templates Still Needed
- `prompts/camera.ts` — OCR interpretation prompts (menu, document, sign, etc.)
- `prompts/phrase.ts` — Phrase card generation with format enforcement
- `prompts/memory.ts` — Memory extraction from conversation
- `prompts/scenario.ts` — Scenario-specific instruction injection
- `prompts/slang.ts` — Generational slang teaching

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
- All prompts in `src/prompts/` directory
- Reference `navi-prompts-v3.md` for template designs
- System prompts assembled via `systemBuilder.ts` — never construct raw prompts in components

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

## Reference Documents
- `navi-prd-v3.md` — Full product requirements with user stories, features, and architecture
- `navi-claude-code-prompts.md` — Step-by-step implementation task prompts
- `AI Language Companion App/navi-prompts-v3.md` — System prompt templates for all modes
- `audit.md` — Previous code audit with component-by-component breakdown
