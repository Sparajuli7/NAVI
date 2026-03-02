# NAVI — Claude Code Integration Prompts

The frontend is already built (Vite + React + shadcn/ui + TypeScript). These prompts wire up on-device AI, services, configs, and state WITHOUT touching existing UI styling.

**MODEL STRATEGY — NO CLOUD APIs:**
- Web prototype: WebLLM (runs GGUF models in-browser via WebGPU) or wllama (WebAssembly llama.cpp)
- Mobile build: Cactus SDK or llama.rn (React Native on-device inference)
- Model: Qwen3-1.7B (GGUF INT4 quantized, ~1.1GB) — 100+ languages, great multilingual
- Fallback: Qwen3-0.6B (394MB) for low-end devices
- Zero dependency on OpenAI, Anthropic, or any cloud API

**CRITICAL RULE FOR EVERY PROMPT:** Before modifying ANY existing file, read it first. Understand the current styling, props, and structure. Preserve all visual design. Only add functionality — never restyle or restructure existing components.

---

## PROMPT 1: Audit Existing Code

```
I have an existing NAVI app with the full frontend already built in Vite + React + TypeScript + shadcn/ui. Before writing ANY code, audit the entire codebase:

1. Read the project config files:
   - package.json (dependencies, scripts)
   - vite.config.ts
   - postcss.config.mjs
   - tsconfig (if exists)
   - Guidelines.md
   - navi-prompts-v3.md (AI prompt templates — reference for all prompt content)

2. Read EVERY custom component in src/app/components/ui/ and note what each one does. These are shadcn components — DO NOT MODIFY.

3. Read EVERY custom app component and understand their props, state, and rendering:
   - BlockyAvatar.tsx
   - CameraOverlay.tsx
   - ConversationScreen.tsx (or ConversationScre...)
   - ExpandedPhraseCard (or ExpandedPhrase...)
   - NewChatBubble.tsx (or NewChatBubble.t...)
   - NewOnboardingScreen.tsx (or NewOnboardingS...)
   - QuickActionPill.tsx
   - ActionCard.tsx
   - ContextualCard.tsx
   - ImageWithFallback (in figma/)
   - App.tsx
   - main.tsx

4. Read:
   - src/app/styles/ (all style files)
   - use-mobile.ts
   - utils.ts

5. Report back with:
   - Full dependency list from package.json
   - What state management exists (useState? Zustand? Context? Redux?)
   - What routing exists (react-router? none?)
   - For EACH custom component: what it renders, what props it takes, what state it manages, what callbacks/handlers it has
   - What's hardcoded vs dynamic (are messages hardcoded? is the avatar static?)
   - What needs to be wired up (which components are just visual shells waiting for data?)

DO NOT write any code yet. Just audit and report.
```

---

## PROMPT 2: Install On-Device LLM + Add Project Structure

```
Based on your audit, now add the on-device AI framework and project structure. DO NOT modify any existing files in this step.

STEP 1: Install on-device LLM for web.

Option A — WebLLM (preferred, uses WebGPU):
npm install @mlc-ai/web-llm

Option B — wllama (WebAssembly, broader browser support):
npm install @anthropic-ai/wllama
or
npm install wllama

Check which one is more compatible with the existing Vite setup. WebLLM requires WebGPU support (Chrome 113+, Edge 113+). wllama works everywhere via WebAssembly but is slower.

Install WebLLM first. If there are build issues with Vite, fall back to wllama.

STEP 2: Install other dependencies (only what's not already installed — check package.json first):
npm install zustand                    # State management (if not present)
npm install tesseract.js               # Client-side OCR (for camera mode)
npm install idb-keyval                 # IndexedDB wrapper for local storage (conversations, memories)

STEP 3: Create new directories and files. DO NOT put these inside the existing component folders — create a parallel services structure:

src/services/
  llm.ts                    # On-device LLM wrapper (WebLLM or wllama)
  ocr.ts                    # Tesseract.js OCR wrapper
  tts.ts                    # Browser SpeechSynthesis TTS wrapper
  stt.ts                    # Browser SpeechRecognition STT wrapper
  location.ts               # Browser Geolocation + city lookup
  modelManager.ts            # Model download, load, status tracking

src/prompts/
  systemBuilder.ts           # 6-layer system prompt assembly engine
  characterGen.ts            # Character generation prompt templates
  camera.ts                  # 6 camera prompt templates
  phrase.ts                  # Phrase teaching prompt
  slang.ts                   # Generational slang prompt
  memory.ts                  # Memory generation prompt
  scenario.ts                # Scenario switch + location change prompts

src/config/
  avatarTemplates.json       # 8 pre-built avatar templates
  dialectMap.json            # City → dialect + slang mapping
  scenarioContexts.json      # Scenario behavior modifiers
  userPreferenceSchema.json  # User-configurable preference definitions

src/stores/
  appStore.ts                # App-level state (model status, location, preferences)
  characterStore.ts          # Active character, memories
  chatStore.ts               # Messages, conversation, active scenario

src/utils/
  contextManager.ts          # Token budgeting, history trimming
  tokenEstimator.ts          # Token count estimation
  ocrClassifier.ts           # Classify OCR output into 6 types
  responseParser.ts          # Parse LLM output for phrase cards
  fallbacks.ts               # Error/fallback strings
  storage.ts                 # IndexedDB persistence layer

src/types/
  character.ts               # Character, Template, Preferences types
  chat.ts                    # Message, Conversation, PhraseCard types
  config.ts                  # Dialect, Scenario, Preference types
  inference.ts               # InferenceConfig, ModelStatus types

STEP 4: Create the config JSON files with this exact content:

src/config/avatarTemplates.json:
[
  {"id":"street_food","emoji":"🍜","label":"Street Food Guide","base_personality":"Enthusiastic about local food. Knows every street vendor and hidden restaurant. Casual, warm, opinionated about what's good and what's tourist bait.","default_style":"casual","default_formality":"casual","vocabulary_focus":["food","ordering","ingredients","prices","recommendations"],"scenario_hint":"restaurants, street stalls, markets"},
  {"id":"form_helper","emoji":"📋","label":"Form Helper","base_personality":"Patient and precise. Explains documents step by step. Reassuring — makes confusing paperwork manageable.","default_style":"warm","default_formality":"neutral","vocabulary_focus":["documents","legal terms","forms","official language"],"scenario_hint":"offices, banks, hospitals"},
  {"id":"pronunciation_tutor","emoji":"🎓","label":"Pronunciation Coach","base_personality":"Focused on how you SOUND. Breaks down every syllable. Encouraging but detailed.","default_style":"nurturing","default_formality":"neutral","vocabulary_focus":["pronunciation","phonetics","tones","enunciation"],"scenario_hint":"practice sessions"},
  {"id":"office_navigator","emoji":"🏢","label":"Office Navigator","base_personality":"Understands workplace hierarchy, formal language, email etiquette, unwritten office rules.","default_style":"warm","default_formality":"formal","vocabulary_focus":["business","email","meetings","hierarchy"],"scenario_hint":"offices, meetings"},
  {"id":"market_haggler","emoji":"🛍️","label":"Market Haggler","base_personality":"Streetwise negotiator. Knows tricks, fair prices, how to get a deal without being rude.","default_style":"streetwise","default_formality":"casual","vocabulary_focus":["negotiation","prices","numbers","polite pushback"],"scenario_hint":"markets, shops"},
  {"id":"night_guide","emoji":"🌙","label":"Night Guide","base_personality":"Knows the nightlife. Social phrases, bar lingo, playful wingman energy with safety awareness.","default_style":"playful","default_formality":"casual","vocabulary_focus":["social","drinks","compliments","introductions","slang"],"scenario_hint":"bars, clubs"},
  {"id":"elder_speaker","emoji":"👴","label":"Elder Speaker","base_personality":"Speaks like the older generation. Traditional expressions, respectful language, grandparent warmth.","default_style":"nurturing","default_formality":"formal","vocabulary_focus":["traditional phrases","respectful language","proverbs","family terms"],"scenario_hint":"family gatherings"},
  {"id":"youth_translator","emoji":"🧒","label":"Youth Translator","base_personality":"Gen Z / Gen Alpha speak. Internet slang, trending phrases, memes in the local language.","default_style":"energetic","default_formality":"casual","vocabulary_focus":["slang","internet speak","abbreviations","trending phrases"],"scenario_hint":"social media, casual hangouts"}
]

src/config/dialectMap.json:
{
  "JP/Tokyo":{"language":"Japanese","dialect":"Standard Japanese (Tokyo)","formality_default":"neutral","cultural_notes":"Formality matters. Bowing depth matters. Business cards with both hands.","slang_era":{"gen_z":"草 (kusa=lol), ぴえん (pien=sad), エモい (emoi), やばい (yabai=amazing/terrible)","millennial":"マジで (maji de=seriously), ウケる (ukeru=funny), 推し (oshi=fave)","older":"ございます forms, しょうがない (shouganai=it can't be helped)"}},
  "JP/Osaka":{"language":"Japanese","dialect":"Osaka-ben (Kansai)","formality_default":"casual","cultural_notes":"Direct, humorous, food-obsessed. なんでやねん is quintessential.","slang_era":{"gen_z":"めっちゃ (meccha=very), あかんて (akante=no way)","millennial":"なんでやねん, ほんまに (honmani=really), あかん (akan=no good)","older":"おおきに (ookini=thank you), あきまへん (akimahen=no good)"}},
  "VN/Ho Chi Minh City":{"language":"Vietnamese","dialect":"Southern Vietnamese (Saigon)","formality_default":"casual","cultural_notes":"Called Saigon by locals. Casual vibe. Coffee culture central.","slang_era":{"gen_z":"ủa (surprised), ghê (impressive), vãi (OMG), đỉnh (amazing)","millennial":"dữ vậy (wow), xỉu (overwhelmed), bá đạo (legendary)","older":"Formal pronouns (ông/bà), traditional politeness, indirect speech"}},
  "FR/Paris":{"language":"French","dialect":"Parisian French","formality_default":"formal","cultural_notes":"ALWAYS start with Bonjour. Vous before tu. Effort in French appreciated.","slang_era":{"gen_z":"C'est chaud (intense), la flemme (can't be bothered), sah (fr fr)","millennial":"kiffer (to love), grave (totally), ouf (crazy, verlan of fou)","older":"Literary tenses, proper subjunctive, fewer anglicisms"}},
  "MX/Mexico City":{"language":"Spanish","dialect":"Mexican Spanish (Chilango)","formality_default":"casual","cultural_notes":"Extremely friendly. Diminutives everywhere. Güey=dude. Ahorita=soon not now.","slang_era":{"gen_z":"neta (fr fr), nmms (no mames), cringe (English loan)","millennial":"neta, güey, chido (cool), naco (tacky)","older":"Usted more common, formal diminutives, fewer anglicisms"}},
  "KR/Seoul":{"language":"Korean","dialect":"Standard Seoul Korean","formality_default":"neutral","cultural_notes":"Age hierarchy is everything. Ask age early — determines speech level.","slang_era":{"gen_z":"ㅋㅋㅋ (kekeke=lol), 갓 (god=amazing), 존맛 (jommat=delicious AF)","millennial":"대박 (daebak=amazing), 헐 (hul=OMG), 꿀잼 (kkuljaem=hilarious)","older":"Formal speech levels, 하십시오체 (hasipsio-che)"}}
}

src/config/scenarioContexts.json:
{
  "restaurant":{"label":"At a Restaurant","vocabulary_focus":["ordering","menu items","dietary restrictions","tipping","asking for check"],"tone_shift":"casual, enthusiastic","formality_adjustment":-1,"auto_suggestions":["Help me order","What's good here?","Ask for the check"],"pronunciation_priority":["dish names","ordering phrases"]},
  "hospital":{"label":"At a Hospital","vocabulary_focus":["symptoms","body parts","medications","insurance","emergency phrases"],"tone_shift":"precise, calm","formality_adjustment":2,"auto_suggestions":["Describe symptoms","Ask about wait time","Insurance phrases"],"pronunciation_priority":["emergency phrases","body parts"]},
  "market":{"label":"At a Market","vocabulary_focus":["prices","negotiation","quantities","too expensive"],"tone_shift":"casual, streetwise","formality_adjustment":-1,"auto_suggestions":["How much?","Haggling phrases","Ask for discount"],"pronunciation_priority":["numbers","too expensive"]},
  "office":{"label":"At Work","vocabulary_focus":["greetings","email phrases","meeting language","apologizing"],"tone_shift":"professional","formality_adjustment":2,"auto_suggestions":["Email opener","Meeting phrases","Polite decline"],"pronunciation_priority":["formal greetings","apologies"]},
  "nightlife":{"label":"Bars & Nightlife","vocabulary_focus":["drink orders","introductions","compliments","social slang","taxi home"],"tone_shift":"casual, playful","formality_adjustment":-2,"auto_suggestions":["Order a drink","Introduce myself","Call a taxi"],"pronunciation_priority":["cheers phrase","introductions"]},
  "transit":{"label":"Public Transit","vocabulary_focus":["directions","tickets","schedules","which stop"],"tone_shift":"practical","formality_adjustment":0,"auto_suggestions":["Where is the station?","Which bus?","Buy a ticket"],"pronunciation_priority":["excuse me","where is"]},
  "school":{"label":"School","vocabulary_focus":["enrollment","parent-teacher","forms","classroom terms"],"tone_shift":"warm, precise","formality_adjustment":1,"auto_suggestions":["Parent meeting phrases","Ask about homework","Understand this form"],"pronunciation_priority":["teacher titles","questions"]},
  "government":{"label":"Government Office","vocabulary_focus":["forms","ID documents","appointments","legal terms"],"tone_shift":"precise, patient","formality_adjustment":2,"auto_suggestions":["What form needed?","Explain this document","Appointment phrases"],"pronunciation_priority":["formal requests","please/thank you"]}
}

src/config/userPreferenceSchema.json:
{
  "avatar_age":{"type":"select","options":["teen","20s","30s","40s","50s","60s+"],"default":"30s","prompt_injection":"You are a {value}-aged person. Speak as someone this age naturally would — use age-appropriate slang, references, formality."},
  "avatar_gender":{"type":"select","options":["male","female","non-binary","no_preference"],"default":"no_preference","prompt_injection":"You present as {value}. Use appropriate gendered language forms where the language requires it."},
  "avatar_vocation":{"type":"select","options":["student","professional","service_worker","retired","traveler","other"],"default":"other","prompt_injection":"Your vocation is {value}. Reference it naturally."},
  "formality_default":{"type":"select","options":["casual","neutral","formal"],"default":"neutral","prompt_injection":"Default formality: {value}."},
  "learning_focus":{"type":"multi_select","options":["pronunciation","vocabulary","cultural_context","reading","slang"],"default":["pronunciation","vocabulary"],"prompt_injection":"Focus especially on: {value}."}
}

STEP 5: Create the Zustand stores (if Zustand is not already in the project, install it):

src/stores/appStore.ts:
- modelStatus: 'not_loaded' | 'loading' | 'downloading' | 'ready' | 'error'
- modelProgress: number (0-100)
- userPreferences: { avatar_age, avatar_gender, avatar_vocation, formality_default, learning_focus }
- currentLocation: { city, country, lat, lng, dialectKey, dialectInfo }
- isFirstLaunch: boolean

src/stores/characterStore.ts:
- activeCharacter: { id, name, summary, detailed, style, emoji, avatar_color, avatar_accessory, speaks_like, template_id, location_city, location_country } | null
- memories: Array<{ id, key, value, created_at }>
- addMemory(), removeMemory(), clearMemories(), setActiveCharacter()

src/stores/chatStore.ts:
- messages: Array<{ id, role, content, type, metadata, timestamp }>
- isGenerating: boolean
- activeScenario: string | null (key into scenarioContexts.json)
- addMessage(), setGenerating(), setScenario(), clearMessages()

STEP 6: Create src/utils/storage.ts using IndexedDB (via idb-keyval) for persistence:
- saveConversation(), loadConversation()
- saveCharacter(), loadCharacter()
- saveMemories(), loadMemories()
- savePreferences(), loadPreferences()

This replaces SQLite since we're in a web environment. All data stays on-device in the browser's IndexedDB.

DO NOT modify any existing files. Only create new files.
```

---

## PROMPT 3: Implement On-Device LLM Service                          CONTINUE FROM HERE 

```
Implement the on-device LLM service. NO cloud APIs. Everything runs in the browser on the user's device.

Read the existing codebase first to understand import patterns and conventions.

STEP 1: Implement src/services/modelManager.ts

Using WebLLM (@mlc-ai/web-llm):
- The model we want: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC" (or closest Qwen3 if available in WebLLM's model list)
- Check WebLLM's prebuilt model list. Pick the best multilingual model at ~1-2GB size. Qwen2.5-1.5B-Instruct is the fallback if Qwen3 isn't available yet.
- Lite option: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC" for low-end devices
- Functions:
  - initEngine() → creates WebLLM engine, returns it
  - loadModel(modelId, onProgress) → downloads + loads model into WebGPU, calls onProgress(percentage) during download
  - isModelReady() → boolean
  - getModelStatus() → 'not_loaded' | 'downloading' | 'loading' | 'ready' | 'error'
  - unloadModel()
- Store model status in appStore
- WebLLM caches the model in browser storage after first download — subsequent loads are instant

If WebLLM doesn't work with Vite (build errors), fall back to wllama:
- npm install @anthropic-ai/wllama or npm install wllama
- Download Qwen3-1.7B-GGUF-Q4_K_M.gguf from Hugging Face
- wllama loads GGUF models via WebAssembly
- Same function signatures, different internals

STEP 2: Implement src/services/llm.ts

This is the main LLM interface. Uses modelManager's engine internally.

export async function sendMessage(messages: {role: string, content: string}[], config: InferenceConfig): Promise<string>
- Takes assembled messages (from systemBuilder + contextManager)
- Sends to WebLLM engine
- Returns full response text

export async function streamMessage(messages, config, onToken: (token: string) => void): Promise<string>
- Same but streams tokens via callback
- For chat: enables typing-indicator-then-streaming UX

export async function generateCharacter(prompt, config): Promise<CharacterJSON>
- Sends character generation prompt
- Parses JSON response (strip markdown fences, retry once on parse failure)
- Returns typed character object

export async function generateMemorySummary(recentMessages): Promise<MemoryEntry[]>
- Sends memory generation prompt
- Parses JSON response
- Returns memory entries

Inference configs (from navi-prompts-v3.md):
const CONFIGS = {
  chat:          { temperature: 0.7, top_p: 0.8, max_tokens: 512, presence_penalty: 1.5 },
  phrase:        { temperature: 0.4, top_p: 0.9, max_tokens: 400, presence_penalty: 1.0 },
  camera:        { temperature: 0.3, top_p: 0.9, max_tokens: 600, presence_penalty: 1.0 },
  character_gen: { temperature: 0.8, top_p: 0.9, max_tokens: 400, presence_penalty: 0.5 },
  memory_gen:    { temperature: 0.2, top_p: 0.9, max_tokens: 300, presence_penalty: 0.5 },
  structured:    { temperature: 0.3, top_p: 0.9, max_tokens: 500, presence_penalty: 0.5 },
};

STEP 3: Implement src/services/tts.ts (browser SpeechSynthesis — already on every device, free):
- speakPhrase(text: string, langCode: string) — uses window.speechSynthesis
- stopSpeaking()
- getAvailableLanguages() → list of supported language codes
- Set rate to 0.4 (slower for learning), pitch 1.0
- Map location to language codes: Vietnam→'vi-VN', Japan→'ja-JP', France→'fr-FR', etc.

STEP 4: Implement src/services/stt.ts (browser SpeechRecognition — free, no API):
- startRecording(lang: string) → starts webkitSpeechRecognition or SpeechRecognition
- stopRecording() → returns transcribed text
- isSupported() → boolean (not all browsers support this)
- Fallback message if not supported: "Voice input isn't supported in this browser. Try Chrome."

STEP 5: Implement src/services/location.ts:
- detectLocation() → uses browser navigator.geolocation → returns {lat, lng}
- getCityFromCoords(lat, lng) → look up nearest city from a bundled lightweight city list (create src/data/cities.json with top 500 world cities: {name, country, country_code, lat, lng})
- lookupDialect(countryCode, city) → look up dialectMap.json with key "{countryCode}/{city}", return dialect info or null
- Returns full location context: { city, country, countryCode, lat, lng, dialectKey, dialectInfo }

DO NOT modify any existing components. Only create new service files.
```

---

## PROMPT 4: Implement Prompt Engine + Utils

```
Read navi-prompts-v3.md in the project root. This contains all AI prompt templates.
Read the stores (appStore, characterStore, chatStore) to understand data shapes.

Implement the prompt engine and utilities:

STEP 1: src/prompts/systemBuilder.ts

export function buildSystemPrompt(avatar, userPrefs, location, scenario, memories): string

Assembles 6 layers into one string (target: under 400 tokens):

Layer 1 — Base: "You are {name}. {summary}\nYou speak like: {speaks_like}"

Layer 2 — Preferences: for each set preference, inject its prompt_injection from userPreferenceSchema.json with {value} replaced. Skip defaults/empty.

Layer 3 — Location + Dialect: "Location: {city}, {country}." If dialectMap has entry: "Speak in {dialect}, not standard/textbook." + cultural_notes. Map avatar_age to generation (teen/20s→gen_z, 30s/40s→millennial, 50s+→older). If slang_era exists for that generation: "Use age-appropriate slang: {slang_era}"

Layer 4 — Scenario: if active: "Current scenario: {label}. Vocabulary focus: {vocab}. Tone: {tone}."

Layer 5 — Memory: last 8 entries as "What you remember:\n- {value}"

Layer 6 — Rules (hardcoded, copy exactly from navi-prompts-v3.md section 1 rules block)

STEP 2: src/utils/contextManager.ts
- buildMessages(systemPrompt, history, newMessage) → [{role, content}]
- Token budget: system ~400, memory ~150, history ~2300, user ~200, response ~800
- Include as many recent messages as fit in history budget
- Use tokenEstimator

STEP 3: src/utils/tokenEstimator.ts
- estimateTokens(text) → number
- CJK chars (Unicode ranges) ÷ 1.5 + other chars ÷ 3.5

STEP 4: src/utils/responseParser.ts
- parseResponse(text) → Array<{type: 'text', content: string} | {type: 'phrase_card', data: PhraseCardData}>
- Detect pattern: **Phrase:** X\n**Say it:** X\n**Sound tip:** X\n**Means:** X\n**Tip:** X
- Extract structured PhraseCardData: { phrase, phonetic, soundTip, meaning, tip }
- Split response into alternating text and phrase_card segments

STEP 5: src/utils/ocrClassifier.ts
- classifyOCR(text, blockCount, avgBlockLength) → 'MENU'|'SIGN'|'DOCUMENT'|'PAGE'|'LABEL'|'GENERAL'
- MENU: price patterns + multiple items
- DOCUMENT: >8 blocks, avg >60 chars
- PAGE: >5 blocks, avg >40, no prices
- SIGN: ≤3 blocks, <200 total chars
- LABEL: prices but ≤5 blocks
- GENERAL: fallback

STEP 6: src/utils/fallbacks.ts — export all error strings:
inference_error, inference_slow, camera_no_text, camera_empty_ocr, unsupported_script, model_loading, model_not_downloaded, low_memory, json_parse_failed, dialect_unknown, pronunciation_unavailable, location_failed

STEP 7: All prompt templates (src/prompts/):
- characterGen.ts — template + custom description prompts (navi-prompts-v3.md section 2)
- camera.ts — 6 prompts: menu, sign, document, page, label, general (section 4)
- phrase.ts — phrase teaching prompt (section 5)
- slang.ts — generational slang prompt (section 6)
- memory.ts — memory generation prompt (section 8)
- scenario.ts — scenario switch + location change prompts (sections 7, 12)

Each prompt template: exported function taking context args → returns assembled prompt string.

DO NOT modify any existing files.
```

---

## PROMPT 5: Wire Model Download + Onboarding

```
Now we start wiring the existing UI to the backend. READ each component fully before modifying.

STEP 1: Model Download

Read App.tsx and the existing routing/navigation. We need a model download state:
- On first visit (model not loaded): show a loading/download UI
- Check if the existing UI has any loading state or splash screen

If there's no download screen in the existing UI:
- Add a minimal model download overlay component that matches the existing dark theme
- Shows: "Downloading your AI companion..." + progress bar + percentage
- "This only happens once. After this, NAVI works offline."
- Uses modelManager.loadModel() with progress callback
- On complete: transition to onboarding or chat

If there IS a loading/splash state already: wire modelManager into it.

- Model downloads via WebLLM are cached in browser IndexedDB — second load is instant
- On app start: check modelManager.isModelReady(). If yes, skip download. If no, show download.

STEP 2: Onboarding

Read NewOnboardingScreen.tsx completely. Map what exists:
- Does it have a text input? → wire to character generation prompt
- Does it have template cards? → wire to avatarTemplates.json data
- Does it have location display? → wire to location.ts service
- Does it have preference selectors? → wire to userPreferenceSchema.json
- Does it have a CTA button? → wire to generation flow

Wire what exists WITHOUT changing styling:

A) If template selection exists: load data from avatarTemplates.json, populate existing UI
B) If text input exists: use as custom personality prompt
C) If location element exists: call location.detectLocation() → getCityFromCoords() → lookupDialect(), display city + dialect name
D) If preference selectors exist: wire to appStore.userPreferences

On CTA button press:
1. Build character generation prompt using characterGen.ts template
2. Call llm.generateCharacter() — on-device inference
3. Parse JSON response → save to characterStore via setActiveCharacter()
4. Save first_message to chatStore
5. Persist via storage.ts (IndexedDB)
6. Navigate to conversation screen

If a component needs a new prop to accept data, add the prop WITH a default value so existing usage doesn't break. Add the data connection. Don't touch layout or styling.

STEP 3: Wire BlockyAvatar.tsx

Read it. Does it accept color/emoji props? 
- If yes: pass avatar_color and emoji from characterStore.activeCharacter
- If no: add optional props with defaults, wire them in
- Don't change the visual style at all
```

---

## PROMPT 6: Wire Conversation Screen

```
This is the most important integration. Read ConversationScreen.tsx and NewChatBubble.tsx completely before writing any code.

Map what exists:
- How are messages stored? (local state? prop? hardcoded?)
- How are messages rendered? (FlatList? map? scroll view?)
- Is there an input field? Send button? Camera button? Mic button?
- Are there typing indicators?
- Are there quick action pills already rendered?

WIRE THE CHAT LOOP — preserve all existing UI:

1. On screen mount:
   - Load activeCharacter from characterStore
   - Load messages from chatStore (persisted via IndexedDB)
   - Load memories from characterStore
   - Detect current scenario from chatStore
   - If first load with new character: display the first_message

2. On user sends message:
   - Add user message to chatStore
   - Set chatStore.isGenerating = true (triggers typing indicator if it exists)
   - Build system prompt: systemBuilder.buildSystemPrompt(character, preferences, location, scenario, memories)
   - Build messages: contextManager.buildMessages(systemPrompt, history, newMessage)
   - Call llm.streamMessage(messages, CONFIGS.chat, onToken)
   - On each token: append to a streaming message in chatStore
   - On complete:
     a. Run responseParser.parseResponse() on full text
     b. If phrase cards found: update message metadata with parsed segments
     c. Set isGenerating = false
     d. Persist messages via storage.ts
   - Every 5 messages: run llm.generateMemorySummary() in background → save to characterStore.memories

3. Scenario detection:
   - After each user message, check if it contains scenario keywords
   - Simple matching: if message includes "restaurant" or "food" or "menu" → set scenario "restaurant"
   - If message includes "hospital" or "doctor" or "sick" → "hospital"
   - Match against scenarioContexts.json keys and vocabulary
   - On match: update chatStore.activeScenario
   - System prompt auto-rebuilds with scenario context on next message

4. NewChatBubble.tsx:
   - Read it. How does it currently render message content?
   - If message has parsed phrase card segments in metadata:
     - Render text segments as normal
     - Render phrase_card segments using a PhraseCard sub-component
     - Phrase card: shows phrase (bold), phonetic (mono), sound tip (teal/accent), meaning, tip
     - 🔊 button on phrase card → calls tts.speakPhrase(phrase, languageCode)
   - If the component already has phrase card rendering: wire it to real parsed data
   - If not: add conditional rendering for phrase card segments, matching existing styles

5. QuickActionPill.tsx:
   - Read it. What does it currently render?
   - Wire tap handler: on tap → add pill's message text to input → auto-send
   - If scenario active: populate pills from scenarioContexts[scenario].auto_suggestions
   - If no scenario: use defaults: "📸 Scan something", "🗣️ Teach me a phrase", "🍜 Food nearby"

6. ExpandedPhraseCard (if exists):
   - Wire to llm.sendMessage() with expanded phrase detail prompt
   - Display structured data: syllables, stress, sound tips, formality, alternatives

7. If camera button exists in the input area: wire to navigate to CameraOverlay
8. If mic button exists: wire to stt.startRecording() on hold, stt.stopRecording() on release → inject transcription as user message

CRITICAL: Do not restructure component hierarchy. Do not change CSS/styling. Only add state connections, event handlers, and data flow.
```

---

## PROMPT 7: Wire Camera Mode

```
Read CameraOverlay.tsx completely. What does it currently show? Does it have:
- A camera/file input for capturing images?
- A results area or bottom sheet?
- Close button?
- Any loading states?

Wire the OCR + LLM pipeline:

1. Image capture:
   - For web: the camera overlay likely uses <input type="file" accept="image/*" capture="environment"> or a canvas-based camera
   - On image captured: get image data (File or base64)

2. OCR processing:
   - Implement src/services/ocr.ts using Tesseract.js:
     import { createWorker } from 'tesseract.js';
   - extractText(imageFile) → initializes worker, processes image, returns { text, blocks }
   - Show loading state during OCR ("Reading text...")
   - First OCR call downloads language data (~2-10MB) — subsequent calls are instant

3. Classification + prompt:
   - Call ocrClassifier.classifyOCR() to determine type (MENU/SIGN/DOCUMENT/PAGE/LABEL/GENERAL)
   - Select prompt template from src/prompts/camera.ts
   - Inject: avatar personality, location, dialect, OCR text

4. LLM interpretation:
   - Call llm.streamMessage() with camera config (temp 0.3, max_tokens 600)
   - Stream response into the results area

5. Results display:
   - If CameraOverlay already has a results area: wire LLM response into it
   - If not: add a results section matching existing component styles
   - Show: avatar icon + "Here's what I see:" + streaming text
   - Parse phrase cards in results too (same responseParser)

6. Return to chat:
   - "Help me with this" button → close camera, inject context into chatStore:
     Add system message: "[Camera scan: {type}. Text: \"{first 200 chars}\". Interpretation: \"{first 200 chars}\"]"
   - "Scan again" → clear results, reopen capture

If OCR returns no text: show fallback "Couldn't detect any text. Try getting closer or better lighting!"

PRESERVE existing camera overlay styling. Wire functionality only.
```

---

## PROMPT 8: Settings, Memory, Persistence + Polish

```
STEP 1: Persistence Layer

Wire src/utils/storage.ts (IndexedDB) into the app lifecycle:
- On app start: load character, messages, memories, preferences from IndexedDB → populate stores
- On character creation: save to IndexedDB
- On new message (after LLM complete): save conversation to IndexedDB
- On memory generated: save to IndexedDB
- On preference change: save to IndexedDB
- App should survive full page refresh with all state intact

STEP 2: Settings

Check if there's already a settings screen/panel in the existing UI. If yes, read it and wire in. If no, add a settings panel accessible from the conversation screen (gear icon or menu).

Settings sections (wire to existing UI patterns):
A) Your Companion — show activeCharacter name, emoji, summary, speaks_like. "Regenerate" button → back to onboarding.
B) Preferences — avatar_age, avatar_gender, formality, learning_focus selectors. Changes save to appStore + IndexedDB. Take effect on next message.
C) Location — current city + dialect. "Update" button re-detects GPS. Manual text input override.
D) Memory — list avatar's memories. Each row: value text + delete button. "Clear All" with confirm.
E) AI Model — current model name, status, size. Download progress if loading.

STEP 3: Memory System

After every 5 messages:
- Take last 5-10 messages
- Send to LLM with memory generation prompt from src/prompts/memory.ts
- Parse JSON response: { entries: [{ key, value }] }
- Save to characterStore.memories + IndexedDB
- Memory injected into Layer 5 of system prompt on next message

User can view and delete memories in settings. Deleted memories are removed from characterStore + IndexedDB.

STEP 4: Error Handling

Add error boundaries and fallback states:
- Model not loaded: show loading with download progress
- LLM fails: show "Hmm, let me try that again... 🔄" with retry button
- Repetition loop detected (same text 3x): truncate, retry with temp 0.5
- OCR fails: show fallback message
- Browser doesn't support WebGPU: show message "Your browser doesn't support on-device AI. Try Chrome 113+ or Edge 113+."
- Browser doesn't support SpeechRecognition: show "Voice input unavailable in this browser"
- Location permission denied: show manual city input
- JSON parse failure: retry once, then use fallback values

STEP 5: Polish

- Scenario badge: if chatStore.activeScenario is set, show a small badge/indicator in the chat header
- Dialect indicator: if location has dialect, show it subtly (e.g., "🇯🇵 Osaka-ben")
- Sound tip styling: phrase card sound tips should use accent/teal color to stand out
- Loading states: typing indicator while model generates
- Quick action pill refresh: regenerate pills every 5 messages or on scenario change

PRESERVE ALL EXISTING STYLING. Only add functional wiring, state management, and error handling.
```

---

## PROMPT 9: Final Integration Test

```
Run through every flow end-to-end and fix anything broken:

1. FRESH START: Clear IndexedDB → app opens → model downloads (check WebGPU works) → onboarding → pick template or type custom → set preferences → GPS detects location + dialect → generate character on-device → first message appears in chat

2. CHAT: Type message → typing indicator → on-device model streams response → phrase cards render with pronunciation + sound tips → TTS plays on 🔊 tap → messages persist across refresh

3. PREFERENCES: Change avatar age to "teen" → send message → avatar uses younger slang. Change formality to "formal" → avatar adjusts. Change learning_focus → avatar emphasizes that area more.

4. DIALECT: Change location to Osaka → dialectMap matches → avatar switches to Osaka-ben. Change to Paris → Parisian French with appropriate formality.

5. SCENARIO: Type "I'm at a restaurant" → scenario detected → quick actions update → avatar vocabulary shifts. Type "now I'm at work" → scenario switches.

6. SLANG: Ask "how do Gen Z people say 'amazing' here?" → avatar gives age-specific slang from dialectMap.

7. CAMERA: Open camera overlay → capture image → OCR extracts text → classifies → LLM interprets with pronunciation → results display → return to chat with context.

8. VOICE (if supported): Hold mic → speak → transcription appears → LLM responds.

9. MEMORY: Chat 5+ messages → memory generates → check settings → memories listed → new messages reference memory context.

10. PERSISTENCE: Chat → refresh page → everything restored (messages, character, memories, preferences).

11. OFFLINE TEST: After model downloaded, disconnect internet → everything still works (on-device model, TTS, location from cache). This is the whole point.

12. CONFIG TEST: Edit dialectMap.json → add new city → rebuild → avatar uses new dialect. Edit scenarioContexts.json → add new scenario → works without code changes.

Fix any errors. Check browser console for warnings. Verify WebGPU model inference is actually running (not silently failing).
```

---

## MOBILE MIGRATION (When Ready)

```
When you're ready to go from web prototype to native mobile app:

1. Create a new React Native bare workflow project
2. Port the UI components (your existing React components adapt to React Native with View/Text/etc.)
3. Replace WebLLM with cactus-react-native (npm install cactus-react-native) or llama.rn
4. Replace Tesseract.js with rn-mlkit-ocr (Google ML Kit, faster + offline)
5. Replace browser SpeechSynthesis with react-native-tts
6. Replace browser SpeechRecognition with Whisper via Cactus SDK
7. Replace IndexedDB with react-native-quick-sqlite
8. Replace browser Geolocation with @react-native-community/geolocation

The entire services layer (llm.ts, ocr.ts, tts.ts, stt.ts, location.ts, storage.ts) swaps out.
The prompt engine (systemBuilder, all prompt templates, configs) stays EXACTLY the same.
The stores stay the same. The utils stay the same.

This is why we built the architecture with clean separation — the AI brain is the same, only the device interface changes.
```

---

## DEBUGGING PROMPT (Use When Stuck)   what does it work...

```
I'm building NAVI, an on-device AI language companion. The frontend is Vite + React + TypeScript + shadcn/ui.

For on-device LLM I'm using [WebLLM / wllama]. Model: [Qwen2.5-1.5B / Qwen3-1.7B].

Current error: [PASTE ERROR]

Context:
- The on-device model [is / is not] loading successfully
- WebGPU [is / is not] available in my browser
- The error happens when: [describe when]
- Browser: [Chrome/Edge/Safari version]

Fix this error. If it's a WebGPU compatibility issue, show me how to check support and fall back gracefully. If it's a Vite build issue, show me the exact vite.config.ts changes needed.
```
