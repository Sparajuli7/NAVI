# NAVI — Product Requirements Document (PRD)
### Version 3.0 | Offline-First Architecture

---

## 1. Product Overview

### 1.1 One-Liner
NAVI is an offline-first AI companion that lives on your phone — a local friend who speaks the language, knows the slang, understands the culture, and explains everything like a native, anywhere on Earth, no internet required.

### 1.2 Vision
A mix between Duolingo and Google Translate, powered by a conversational AI avatar that actually understands how people really talk — not textbook language, but the slang, the dialect, the generational speak, the cultural subtext. Open the app, and you have a realistic local friend in your pocket who can fit into any situation: ordering street food in Saigon, reading a lease in Brooklyn, understanding Gen Z slang in Seoul, or navigating a government form in São Paulo. All on-device. All offline. All on demand.

### 1.3 The Core Bet
Every competitor requires internet. Google Translate, ChatGPT, Duolingo, DeepL — useless without a connection. NAVI works everywhere because it runs entirely on the user's device. This is not a feature. This is the product. This is the moat.

### 1.4 What NAVI Is
- A tour guide / language translator in your pocket who explains like a native
- An AI avatar that holds realistic conversations adapted to any situation
- A cultural interpreter that understands slang, dialects, generational language, and local context
- A pronunciation and enunciation coach that teaches you how to actually sound right
- An image/document reader that explains what things say and how to comprehend them
- All of this running on your phone, offline, on demand

### 1.5 What NAVI Is NOT
- Not a language learning app (no lessons, no streaks, no curriculum)
- Not a word-for-word translation app
- Not a cloud wrapper with an offline fallback (offline IS the product)
- Not a generic chatbot (persistent avatar with personality, memory, and cultural depth)

---

## 2. Target Users

### 2.1 Primary: Daily Use Segments

**Immigrants & New Arrivals**
- 46M+ foreign-born in the US alone
- Daily needs: school forms, leases, medical visits, government mail, grocery shopping
- Often in areas with poor connectivity or expensive data
- Need dialect-specific help (not just "Spanish" but Dominican Spanish vs. Mexican Spanish)
- Highest willingness to pay — this is survival

**Expats & International Workers**
- Professional communication, workplace culture, formal documents
- Need to understand office slang, formality levels, unwritten rules
- High income, high willingness to pay

**Multilingual Families**
- Second-gen kids connecting with grandparents across language gaps
- Need real warmth, not textbook phrases — the way a grandmother actually talks
- Generational language differences within families

**Service Workers in Multilingual Environments**
- Healthcare, hospitality, retail in diverse areas
- Need to communicate across 5-10+ languages daily
- B2B expansion path

### 2.2 Secondary: Marketing Hook

**Travelers & Backpackers**
- Most emotionally compelling, most viral use case
- Often in areas with no data/wifi
- Need on-demand help: what does this menu say? how do I haggle? what's the local way to say thanks?
- Best for user acquisition and demo videos

---

## 3. Core User Stories

### 3.1 Sara — Backpacker in Vietnam
Sara lands in Ho Chi Minh City, no SIM card. She opens NAVI — airplane mode on. Her avatar says "Welcome to Saigon — locals never say HCMC." She photographs a phở menu. The app reads the Vietnamese, tells her what to order, how to pronounce it, and warns her that "không đá" means no ice (important for your stomach). She asks "how do young people here say 'this is amazing'?" and gets the actual Gen Z Vietnamese slang, not textbook.

### 3.2 Carlos — Immigrant from Guatemala
Carlos gets a letter from his kid's school. No unlimited data. He photographs it with NAVI. His avatar — configured as a helpful older brother type — explains what the letter says, what's expected, and teaches him the exact phrases he'll need at the parent-teacher conference, with pronunciation coaching so he feels confident saying them. The avatar remembers Carlos is from Guatemala and adjusts Spanish references to Central American dialect, not Castilian.

### 3.3 Jenny — Expat in Tokyo
Jenny speaks basic Japanese but can't handle keigo (formal Japanese) at work. On the subway (underground, no signal), she spawns a "strict Japanese office manager" avatar and practices formal email phrasing. The avatar corrects her pronunciation of honorifics and explains the unwritten seniority rules. She switches the avatar to "Shibuya college student" mode to understand the slang her younger coworkers use at lunch.

### 3.4 Priya — Language-Gap Family
Priya married into a Punjabi family. Before dinner, she uses NAVI to learn how her mother-in-law's generation actually speaks — not modern Punjabi, but the older expressions and terms of endearment. Her avatar is set to "Punjabi auntie, 60s" and teaches her the warmth and rhythm of how older women actually talk.

### 3.5 Diego — Service Worker at Queens Hospital
Diego's patients speak English, Spanish, Mandarin, Bengali, Haitian Creole. Hospital wifi is spotty. He uses NAVI dozens of times daily — switching the avatar's location context between languages. The avatar remembers his medical vocabulary preferences and auto-suggests relevant phrases for patient intake.

---

## 4. Product Modes

### 4.1 Chat Mode (MVP — Primary Interface)
The conversation IS the app. Everything is accessed from or returns to the chat.

- Text input: type questions, describe situations, ask for help
- Voice input: hold-to-talk, on-device STT
- Avatar responds with personality-driven, culturally-aware guidance
- Pronunciation coaching: avatar teaches HOW to say things, not just what to say — emphasis, tone, rhythm, enunciation tips
- Inline phrase cards with foreign text + phonetic + audio playback
- Slang mode: understands and teaches generational language (Gen Z, Gen Alpha, boomer expressions) in any target language
- Contextual quick-action pills above input
- Avatar's first message serves as feature discovery
- **All on-device. No internet required.**

### 4.2 Camera Mode (MVP)
Accessed from chat via camera icon. Opens as full-screen overlay.

**Handles:**
- Menus → contextual interpretation with recommendations
- Signs/notices → meaning + what to do + cultural context
- Documents/forms → section-by-section explanation, action items, how to fill it out
- Pages of text (books, articles, instructions) → comprehension help + how to read/pronounce key sections
- Labels/packaging → ingredient interpretation, warnings, usage instructions

**Pipeline (entirely on-device):**
1. User photographs anything with text
2. ML Kit OCR extracts text on-device
3. Extracted text → on-device LLM with context (avatar personality, location, user preferences)
4. Avatar interprets contextually — not just translation but meaning, pronunciation guide, cultural subtext
5. Results in bottom sheet overlay
6. User can tap "Help me with this" → returns to chat with full context

### 4.3 Coach Mode (Post-MVP v1.1)
Focused on pronunciation and enunciation — the thing no other app does well offline.

- User says what they need to communicate
- Avatar provides the phrasing + pronunciation breakdown
- Syllable-by-syllable enunciation guide
- Tone/pitch guidance for tonal languages (Mandarin, Vietnamese, Thai)
- Formality slider (casual ↔ formal)
- User records themselves → Whisper STT compares to target → avatar gives feedback
- "You're stressing the wrong syllable — try putting the emphasis on..."
- All on-device

### 4.4 Listen Mode (Post-MVP v1.2)
Passive listening to understand what's being said around you.
- On-device STT captures spoken language
- Running interpretation with cultural context
- Works for: announcements, conversations, lectures, market haggling

---

## 5. The AI Avatar System

### 5.1 Avatar Generation — Two Methods

**Method A: Text Description Spawning (Primary)**
User describes who they want their companion to be, including the scenario and setting:
- "a 25-year-old street food vendor in Bangkok who knows every alley"
- "a strict Japanese businesswoman in her 40s who can teach me office etiquette"
- "a Gen Z college student from Seoul who speaks in modern slang"
- "a Parisian grandmother who judges your French but loves you anyway"
- "put me in a busy market in Marrakech with a local haggling expert"

The LLM generates a full avatar from this description — name, personality, speaking style, age-appropriate language, location knowledge.

**Method B: Template Spawning (Quick Start)**
Pre-built avatar templates the user can pick and customize:
- 🍜 **Street Food Guide** — knows every local dish, casual, enthusiastic
- 📋 **Form Helper** — precise, patient, explains documents step by step
- 🎓 **Language Tutor** — focused on pronunciation, corrects gently
- 🏢 **Office Navigator** — formal language, workplace culture, email help
- 🛍️ **Market Haggler** — knows the tricks, teaches negotiation phrases
- 🌙 **Night Guide** — bars, nightlife, social slang, dating phrases
- 👴 **Elder Speaker** — older generation language, traditional expressions
- 🧒 **Youth Translator** — Gen Z/Gen Alpha slang decoder

Templates are starting points — user can modify any template with additional text description.

### 5.2 Avatar Preferences (User-Configurable)
The user can set preferences that affect how the avatar speaks and what it teaches:

| Preference | Options | Effect on Avatar |
|-----------|---------|-----------------|
| **Avatar Age** | Teen, 20s, 30s, 40s, 50s, 60s+ | Affects slang usage, formality, cultural references |
| **Avatar Gender** | Male, Female, Non-binary, No preference | Affects gendered language in languages that use it |
| **Avatar Vocation** | Student, Professional, Service worker, Retired, etc. | Affects vocabulary focus and conversation topics |
| **User's Age** | Range | Avatar adjusts language complexity and cultural references |
| **Formality Default** | Casual, Neutral, Formal | Starting formality level (always adjustable per conversation) |
| **Learning Focus** | Pronunciation, Vocabulary, Cultural context, All | Weights avatar responses toward user's goal |
| **Dialect Preference** | Auto-detect, Manual select | Which regional dialect the avatar uses |

These preferences are injected into the system prompt dynamically. When the user changes a preference, the avatar adapts immediately — no restart needed.

### 5.3 Avatar Context Controls
Avatars maintain character identity but can switch contexts fluidly:

**Location Context Switching:**
- User changes location (GPS auto-detect or manual) → avatar adapts language, dialect, cultural references
- Same avatar personality, different local knowledge
- Example: "Koji" is a playful foodie avatar. In Tokyo, Koji talks about ramen spots and teaches Tokyo dialect. User flies to Osaka → Koji now teaches Osaka-ben (Osaka dialect) and recommends takoyaki spots. Same personality, different local context.

**Scenario Context Switching:**
- User describes a new scenario → avatar adapts while keeping character
- "I'm now at a hospital" → avatar switches to medical vocabulary, becomes more precise
- "I'm at a bar with friends" → avatar switches to casual slang, social phrases
- "I need to read this legal document" → avatar becomes methodical, explains each clause

**Generational Language Context:**
- Avatar understands and teaches age-appropriate language in the target language
- If user asks "how do young people say this?" → avatar provides Gen Z/Gen Alpha slang in that language
- If user asks "how would my grandmother say this?" → avatar provides older/traditional phrasing
- If avatar is configured as a specific age → language naturally reflects that generation

### 5.4 Avatar Memory System
Avatars remember across conversations:

**What's Remembered:**
- User's name and preferred greeting
- Languages/phrases the user has learned (don't re-teach known phrases)
- User's pronunciation weak spots (keeps coaching those)
- Locations the user has been (references past experiences)
- User's vocabulary level (adapts complexity over time)
- User's stated preferences and goals
- Past scenarios and conversations (continuity)

**Implementation:**
- Memory stored in SQLite on-device — completely offline
- Memory entries are key-value pairs: { key: "learned_phrases", value: [...] }
- After each conversation, the LLM generates a brief memory summary (1-2 sentences)
- Memory injected into system prompt as context (trimmed to fit token budget)
- User can view and delete memories in settings

### 5.5 Visual Style — Blocky / Low-Poly Cartoon
- Intentionally stylized, not photorealistic
- Minecraft Steve meets a travel poster
- MVP: emoji-in-circle avatar with color customization
- Post-MVP: template sprites with age/gender/accessory variations

### 5.6 Avatar Sizes
- Chat bubble: 28-36px
- Home greeting: 72-80px
- Onboarding reveal: 160-200px

### 5.7 Regeneration & Multiple Avatars
- User can regenerate their avatar anytime (new prompt → new identity)
- User can spawn NEW avatars without deleting old ones
- Switch between avatars from the chat header
- Each avatar has its own memory and conversation history
- MVP: single active avatar. v1.1: multiple avatars with switching.

---

## 6. Dialect & Location Intelligence

### 6.1 Auto-Detect Location + Dialect
On app launch and when location changes:
1. GPS detects coordinates (works offline)
2. Bundled city database maps coordinates to city + country + region
3. Avatar automatically adjusts to local dialect/language:
   - In Osaka → Osaka-ben, not standard Tokyo Japanese
   - In Quebec → Québécois French, not Parisian French
   - In Salvador, Brazil → Bahian Portuguese, not São Paulo Portuguese
   - In Mumbai → Hindi-Urdu mix with Marathi words, not textbook Hindi
   - In New Orleans → Southern English with Creole influence

### 6.2 User Override
- User can manually change location anytime (in settings or by telling the avatar)
- "Pretend we're in Barcelona" → avatar switches to Catalan/Castilian Spanish with Barcelona context
- "I'm going to Chiang Mai next week, prepare me" → avatar switches to Northern Thai dialect and cultural prep

### 6.3 Dialect Mapping Database
Bundled lightweight JSON mapping:
```
{
  "Japan/Osaka": { "dialect": "Osaka-ben", "formality_default": "casual", "notes": "More expressive, comedic culture" },
  "Japan/Tokyo": { "dialect": "Standard Japanese", "formality_default": "neutral", "notes": "Business center" },
  "France/Paris": { "dialect": "Parisian French", "formality_default": "formal", "notes": "Formal pronouns expected" },
  "France/Marseille": { "dialect": "Southern French", "formality_default": "casual", "notes": "Provençal influence" },
  ...
}
```
- Start with 50-100 major city/region entries
- Easily expandable — just add JSON entries, no code changes
- Injected into system prompt as location context

---

## 7. Context Control Architecture

### 7.1 Design Philosophy
The context control system that shapes avatar behavior must be:
1. **Easily scalable** — handle new users, new preferences, new languages without code changes
2. **Visible and understandable** — anyone on the team can read, understand, and alter behavior
3. **No-code editable** — change avatar behavior by editing config files, not source code
4. **Testable** — preview the effect of changes before shipping them

### 7.2 Context Control Layers
Avatar behavior is controlled by stacked context layers, each one a readable config:

```
┌─────────────────────────────────────────┐
│  LAYER 1: BASE PERSONALITY              │
│  Source: character generation output     │
│  "Koji — a playful foodie who..."       │
│  Fixed per avatar. Changes only on regen│
├─────────────────────────────────────────┤
│  LAYER 2: USER PREFERENCES              │
│  Source: user settings (JSON config)     │
│  age_group, gender, vocation, formality │
│  learning_focus, dialect_preference     │
│  Editable by user anytime               │
├─────────────────────────────────────────┤
│  LAYER 3: LOCATION CONTEXT              │
│  Source: GPS + dialect_map.json          │
│  city, country, dialect, local_customs  │
│  Auto-updates on location change        │
├─────────────────────────────────────────┤
│  LAYER 4: SCENARIO CONTEXT              │
│  Source: scenario_templates.json OR      │
│  user description in chat               │
│  "at a restaurant", "reading a form",   │
│  "at a hospital", "nightlife"           │
│  Switches vocabulary focus + tone       │
├─────────────────────────────────────────┤
│  LAYER 5: MEMORY CONTEXT                │
│  Source: SQLite memory store             │
│  learned_phrases, pronunciation_notes,  │
│  user_level, past_locations, goals      │
│  Auto-accumulated, user can edit/delete │
├─────────────────────────────────────────┤
│  LAYER 6: CONVERSATION CONTEXT          │
│  Source: recent message history          │
│  Last 10-15 messages (trimmed to fit)   │
│  Sliding window, auto-managed           │
└─────────────────────────────────────────┘

All layers merge into one system prompt sent to the on-device LLM.
```

### 7.3 Config File Structure (No-Code Editable)

All behavior-shaping configs are JSON files that anyone can read and edit:

**avatar_templates.json** — Pre-built avatar templates
```json
[
  {
    "id": "street_food",
    "name_hint": "foodie name",
    "emoji": "🍜",
    "label": "Street Food Guide",
    "base_personality": "Enthusiastic about local food, knows every street vendor and hidden restaurant. Casual, warm, opinionated about what's good.",
    "default_formality": "casual",
    "vocabulary_focus": ["food", "ordering", "ingredients", "prices", "recommendations"],
    "scenario_hint": "restaurants, street food stalls, markets"
  },
  ...
]
```

**dialect_map.json** — Location to dialect/context mapping
```json
{
  "JP/Osaka": {
    "language": "Japanese",
    "dialect": "Osaka-ben (Kansai dialect)",
    "formality_default": "casual",
    "cultural_notes": "Osaka people are known for directness and humor. Food culture is central. 'Nandeyanen' is the quintessential Osaka expression.",
    "slang_era": {
      "gen_z": "Uses ぴえん (pien), 草 (kusa/lol), エモい (emoi), やばい (yabai) heavily",
      "millennial": "Uses マジで (maji de), ウケる (ukeru), やばい (yabai) moderately",
      "boomer": "More traditional Kansai expressions, あかん (akan), なんでやねん (nandeyanen)"
    }
  },
  ...
}
```

**scenario_contexts.json** — Scenario behavior modifiers
```json
{
  "restaurant": {
    "vocabulary_focus": ["ordering", "menu items", "dietary restrictions", "tipping", "compliments to chef"],
    "tone_shift": "casual, enthusiastic",
    "formality_adjustment": -1,
    "auto_suggestions": ["Help me order", "What's good here?", "How do I ask for the check?"]
  },
  "hospital": {
    "vocabulary_focus": ["symptoms", "body parts", "medications", "insurance", "emergency phrases"],
    "tone_shift": "precise, calm, reassuring",
    "formality_adjustment": +2,
    "auto_suggestions": ["Describe my symptoms", "Ask about wait time", "Insurance phrases"]
  },
  "nightlife": {
    "vocabulary_focus": ["social phrases", "ordering drinks", "compliments", "slang", "safety"],
    "tone_shift": "casual, playful, streetwise",
    "formality_adjustment": -2,
    "auto_suggestions": ["Bar phrases", "How to introduce myself", "Local nightlife tips"]
  },
  ...
}
```

**user_preference_schema.json** — Defines all user-configurable preferences
```json
{
  "avatar_age": {
    "type": "select",
    "options": ["teen", "20s", "30s", "40s", "50s", "60s+"],
    "effect": "Controls slang generation, cultural references, formality baseline",
    "prompt_injection": "You are a {value}-aged person. Speak as someone of this age naturally would."
  },
  "avatar_gender": {
    "type": "select",
    "options": ["male", "female", "non-binary", "no_preference"],
    "effect": "Controls gendered language in gendered languages (Spanish, French, Hindi, etc.)",
    "prompt_injection": "You present as {value}. Use appropriate gendered language forms."
  },
  "learning_focus": {
    "type": "multi_select",
    "options": ["pronunciation", "vocabulary", "cultural_context", "reading", "slang"],
    "effect": "Weights response content toward selected areas",
    "prompt_injection": "Focus especially on: {value}. When teaching phrases, emphasize {value} aspects."
  },
  ...
}
```

### 7.4 How Config Changes Affect the Model
When any config is edited:
1. The prompt builder re-assembles the system prompt from all 6 layers
2. New system prompt is used on the next inference call
3. Avatar behavior changes immediately — no restart, no rebuild
4. Changes are visible in real-time in the next conversation turn

### 7.5 Testing & Optimization (No-Code)
Built-in config testing flow:

**Prompt Preview Panel (Settings → Developer/Debug):**
- Shows the fully assembled system prompt (all layers merged)
- Highlight which config contributed which lines
- Edit any config value → see prompt update in real-time
- Send a test message → see how the avatar responds with the new config
- Compare before/after responses side by side
- No code changes needed — just edit JSON, preview, test, ship

**A/B Testing Support (Post-MVP):**
- Define config variants in a test_variants.json
- System randomly assigns users to variants
- Track: response quality ratings, user engagement, conversation length
- Pick winner, promote to default config

### 7.6 Scalability
Adding a new location/dialect:
→ Add an entry to dialect_map.json. Done.

Adding a new avatar template:
→ Add an entry to avatar_templates.json. Done.

Adding a new scenario:
→ Add an entry to scenario_contexts.json. Done.

Adding a new user preference:
→ Add to user_preference_schema.json with prompt_injection template. Done.

Supporting a new language's generational slang:
→ Add slang_era entries to that location's dialect_map.json entry. Done.

No code changes for any of the above. All config-driven.

---

## 8. Pronunciation & Enunciation System

### 8.1 Philosophy
Most language apps teach you WHAT to say. NAVI teaches you HOW to say it — the emphasis, the rhythm, the tone, the mouth shape. This is what makes the difference between sounding like a textbook and sounding like a local.

### 8.2 Pronunciation Features

**Phrase Cards with Pronunciation Depth:**
Every phrase taught includes:
- Foreign text (how it's written)
- Phonetic transcription (how it sounds to English ears)
- Syllable breakdown with stress markers ("pho" = "fuh" not "foe", stress on the falling tone)
- Enunciation tips ("round your lips", "tongue behind teeth", "this is a nasal sound")
- Tone guidance for tonal languages (Mandarin, Vietnamese, Thai, Cantonese)
  - "This is a rising tone — start low, go high, like asking a question"
  - "This is a falling tone — start high, drop sharply, like giving a command"

**Record & Compare (v1.1):**
- User records themselves saying the phrase (Whisper STT on-device)
- STT transcribes what the user actually said
- LLM compares user's transcription to target phrase
- Avatar gives specific feedback: "You're saying 'foe' but it should be 'fuh' — drop the 'o' sound"
- Repeat until pronunciation matches

**TTS Playback:**
- Platform native TTS for instant pronunciation playback
- Slower rate (0.4x) for learning
- Tap once: normal speed. Tap again: slow speed. Tap again: syllable by syllable.
- All on-device, no internet

### 8.3 Pronunciation in System Prompt
The avatar is instructed to always include pronunciation guidance:
- When teaching any phrase, break down pronunciation
- Flag sounds that don't exist in English (explain how to approximate)
- Note common mispronunciations by English speakers
- For tonal languages: always include tone marks and tone descriptions

---

## 9. Onboarding

### 9.1 Flow

**Step 1: Welcome Screen**
- "Meet your local companion"
- Two paths:
  - **Quick Start**: Pick a template avatar (horizontal scroll of template cards)
  - **Custom**: "Describe your companion" (free text)
- Location auto-detected via GPS, shown as pill ("📍 Osaka, Japan")
- Location tappable to override manually

**Step 2: Avatar Preferences (Optional, Skippable)**
- Quick preference selector (horizontal scroll cards, not a form):
  - Avatar age range
  - Avatar gender
  - Learning focus (pronunciation / vocabulary / cultural / all)
- "Skip — surprise me" option that uses sensible defaults
- Settings injected into avatar generation prompt

**Step 3: Character Generation (~3 seconds on-device)**
- Brief animation while LLM generates avatar
- Avatar revealed: name, personality, emoji, avatar visual
- First message appears in chat

**Total: 2-3 taps to get into the app. Preferences are optional.**

### 9.2 Model Download (First Install Only)
Before onboarding, if models aren't downloaded:
- Download screen with progress bar
- Qwen3-1.7B (~1.1GB) + Whisper Small (~150MB)
- "Downloading your AI companion... this only happens once."
- Lite option: 0.6B (394MB) for storage-constrained users
- After download: never needs internet again

### 9.3 Permissions
- Location: at onboarding (GPS for dialect detection)
- Camera: on first camera use
- Microphone: on first voice input
- Storage: for model files if needed

---

## 10. Technical Architecture — Offline-First

### 10.1 Core Principle
**Everything runs on the user's device. The cloud is an optional upgrade, never a requirement.**

### 10.2 On-Device Stack

```
┌──────────────────────────────────────────────────┐
│                 USER'S PHONE                      │
│                                                    │
│  ┌────────────────────────────────────────────┐   │
│  │  BRAIN: Qwen3-1.7B (1.1GB)                │   │
│  │  via Cactus SDK                             │   │
│  │  • 100+ languages & dialects natively       │   │
│  │  • Slang, generational language, idioms     │   │
│  │  • Character personality + memory           │   │
│  │  • Pronunciation coaching                   │   │
│  │  • Document/form comprehension              │   │
│  │  • Context-controlled via JSON configs      │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
│  ┌────────────────────────────────────────────┐   │
│  │  EYES: ML Kit OCR (on-device)              │   │
│  │  • Latin, Chinese, Devanagari, Japanese,    │   │
│  │    Korean scripts                           │   │
│  │  • Menus, signs, forms, documents, labels   │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
│  ┌────────────────────────────────────────────┐   │
│  │  EARS: Whisper Small (on-device)           │   │
│  │  • Multilingual speech-to-text              │   │
│  │  • Pronunciation comparison (v1.1)          │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
│  ┌────────────────────────────────────────────┐   │
│  │  VOICE: Platform Native TTS                │   │
│  │  • Phrase pronunciation at multiple speeds  │   │
│  │  • Already on every phone, 50+ languages    │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
│  ┌────────────────────────────────────────────┐   │
│  │  LOCATION: GPS + Dialect Map               │   │
│  │  • Offline GPS → city → region → dialect    │   │
│  │  • dialect_map.json for local context       │   │
│  │  • Auto-switches avatar dialect/slang       │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
│  ┌────────────────────────────────────────────┐   │
│  │  CONFIG ENGINE: JSON-Driven Context        │   │
│  │  • avatar_templates.json                    │   │
│  │  • dialect_map.json                         │   │
│  │  • scenario_contexts.json                   │   │
│  │  • user_preference_schema.json              │   │
│  │  • No code changes to modify behavior       │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
│  ┌────────────────────────────────────────────┐   │
│  │  MEMORY: SQLite On-Device                  │   │
│  │  • Avatar memories across conversations     │   │
│  │  • Learned phrases, pronunciation notes     │   │
│  │  • User preferences, conversation history   │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
│  ┌────────────────────────────────────────────┐   │
│  │  OPTIONAL: Cloud Upgrade                   │   │
│  │  • Claude/GPT-4o when wifi available        │   │
│  │  • Better quality for complex tasks         │   │
│  │  • Never required                           │   │
│  └────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

### 10.3 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native (bare workflow, NOT Expo) |
| On-device LLM | Qwen3-1.7B via Cactus SDK |
| On-device OCR | Google ML Kit via rn-mlkit-ocr |
| On-device STT | Whisper Small via Cactus SDK |
| TTS | Platform native (iOS/Android) |
| Camera | react-native-vision-camera |
| Location | GPS + bundled GeoNames + dialect_map.json |
| Local DB | SQLite via react-native-quick-sqlite |
| State | Zustand |
| Config | JSON files (no-code editable) |
| Navigation | React Navigation |

### 10.4 System Prompt Assembly

The prompt builder merges all 6 context layers into a single system prompt:

```
function buildSystemPrompt(avatar, userPrefs, location, scenario, memory, dialectMap) {

  // Layer 1: Base personality
  let prompt = `You are ${avatar.name}. ${avatar.personality_summary}\n`;

  // Layer 2: User preferences
  if (userPrefs.avatar_age) prompt += `You are ${userPrefs.avatar_age}. Speak as someone this age naturally would.\n`;
  if (userPrefs.avatar_gender) prompt += `You present as ${userPrefs.avatar_gender}. Use appropriate language forms.\n`;
  if (userPrefs.learning_focus) prompt += `Focus especially on: ${userPrefs.learning_focus.join(', ')}.\n`;
  if (userPrefs.formality) prompt += `Default formality: ${userPrefs.formality}.\n`;

  // Layer 3: Location + dialect
  const dialectInfo = dialectMap[`${location.country}/${location.city}`] || {};
  prompt += `Location: ${location.city}, ${location.country}.\n`;
  if (dialectInfo.dialect) prompt += `Speak in ${dialectInfo.dialect}, not standard/textbook.\n`;
  if (dialectInfo.cultural_notes) prompt += `Cultural context: ${dialectInfo.cultural_notes}\n`;
  
  // Generational slang injection
  if (userPrefs.avatar_age && dialectInfo.slang_era) {
    const ageGroup = mapAgeToGeneration(userPrefs.avatar_age); // "20s" → "gen_z"
    if (dialectInfo.slang_era[ageGroup]) {
      prompt += `Use age-appropriate slang: ${dialectInfo.slang_era[ageGroup]}\n`;
    }
  }

  // Layer 4: Scenario context
  if (scenario) {
    prompt += `Current scenario: ${scenario.label}.\n`;
    prompt += `Vocabulary focus: ${scenario.vocabulary_focus.join(', ')}.\n`;
    prompt += `Tone: ${scenario.tone_shift}.\n`;
  }

  // Layer 5: Memory
  if (memory.length > 0) {
    prompt += `\nWhat you remember about this user:\n`;
    memory.slice(-10).forEach(m => { prompt += `- ${m.summary}\n`; });
  }

  // Core rules (kept tight for small model)
  prompt += `
Rules:
- You are a knowledgeable local friend, NOT a translator.
- Stay in character always. Never say "As an AI."
- When teaching phrases, ALWAYS include:
  **Phrase:** [local language text]
  **Say it:** [phonetic for English speakers]
  **Sound tip:** [how to shape your mouth/tongue, emphasis, tone]
  **Means:** [natural meaning]
  **Tip:** [cultural context]
- Focus on pronunciation and enunciation — teach HOW to say it, not just what.
- Use local dialect and slang appropriate to your age and location.
- If asked about generational slang, provide age-specific language.
- Be concise. Under 150 words unless asked for detail.
- If unsure, say so honestly.`;

  return prompt;
}
```

### 10.5 Memory Implementation

```sql
-- SQLite memory table
CREATE TABLE avatar_memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  avatar_id INTEGER REFERENCES characters(id),
  memory_key TEXT NOT NULL,
  memory_value TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Example entries:
-- { key: "user_name", value: "Shreyash" }
-- { key: "learned_phrase", value: "cảm ơn (Vietnamese thank you) - mastered" }
-- { key: "pronunciation_note", value: "Struggles with Vietnamese tones, especially falling tone" }
-- { key: "vocab_level", value: "beginner Vietnamese, intermediate Japanese" }
-- { key: "past_location", value: "Was in Ho Chi Minh City last week, now in Osaka" }
-- { key: "preference", value: "Prefers casual language, interested in street food" }
-- { key: "session_summary", value: "Practiced ordering phở, learned 5 food phrases" }
```

After each conversation session, generate a memory summary:
```
System: "Summarize this conversation in 1-2 bullet points for future memory. Focus on: what the user learned, pronunciation issues, preferences expressed, and goals mentioned. Respond ONLY with bullet points."
```

### 10.6 App Size Budget

| Component | Size |
|-----------|------|
| React Native app + configs | ~35MB |
| Qwen3-1.7B model | ~1,100MB |
| ML Kit OCR models | ~30MB |
| Whisper Small | ~150MB |
| GeoNames + dialect_map.json | ~8MB |
| Avatar templates/sprites | ~10MB |
| **Total** | **~1,333MB** |

Lite option with Qwen3-0.6B: ~625MB total.

---

## 11. Information Architecture (MVP)

```
App Install → Model Download (one-time)
      │
      ▼
Onboarding
├── Pick template OR describe custom avatar
├── Optional: set avatar age/gender/focus preferences
├── Confirm location (auto-detected, overridable)
└── "Meet your companion"
      │
      ▼
Avatar Generated On-Device (~3 sec)
      │
      ▼
CONVERSATION (the entire app)
├── Text input → LLM → response (context-controlled)
├── Voice input → Whisper STT → LLM → response
├── Camera → OCR → LLM → interpretation bottom sheet
├── Quick-action pills (contextual, scenario-aware)
├── Phrase cards with pronunciation + enunciation
├── 🔊 TTS playback (normal speed / slow / syllable)
├── Avatar header → tap for profile (preferences, switch, regen)
├── Location changes → dialect auto-switches
├── Scenario changes → vocabulary/tone auto-switches
├── Memory accumulates across sessions
└── Settings → preferences, model, location, memory, debug/preview
```

**No bottom nav. No tab bar.** Chat is the app.

---

## 12. MVP Scope

### 12.1 What's In

| Feature | Priority |
|---------|----------|
| React Native + Cactus SDK + on-device Qwen3-1.7B | P0 |
| Model download flow (LLM + Whisper) | P0 |
| Template avatar selection + custom text description spawning | P0 |
| Avatar preferences (age, gender, formality, learning focus) | P0 |
| GPS location detection + dialect_map.json auto-switching | P0 |
| Chat interface with streaming on-device LLM | P0 |
| Context-controlled system prompt (all 6 layers) | P0 |
| Phrase cards with pronunciation + enunciation tips | P0 |
| Camera mode (OCR → LLM interpretation) | P0 |
| Platform native TTS for phrase audio | P1 |
| Voice input via Whisper STT | P1 |
| Avatar memory across sessions | P1 |
| Scenario context switching | P1 |
| Generational slang support | P1 |
| Quick-action pills (scenario-aware) | P2 |
| JSON config files (no-code editable) | P0 |
| Prompt preview panel for testing configs | P2 |
| Dark mode UI | P0 |

### 12.2 What's Out (Post-MVP)

| Feature | Version |
|---------|---------|
| Record & compare pronunciation feedback | v1.1 |
| Multiple simultaneous avatars with switching | v1.1 |
| Coach mode (dedicated pronunciation practice) | v1.1 |
| Listen mode (passive interpretation) | v1.2 |
| Cloud upgrade toggle | v1.1 |
| A/B testing for configs | v2.0 |
| Real-time two-person conversation mode | v2.0 |
| OTA model updates | v2.0 |
| B2B features | v3.0 |

---

## 13. Competitive Positioning

| | Google Translate | Duolingo | ChatGPT | **NAVI** |
|---|---|---|---|---|
| Works fully offline | Partial | ❌ | ❌ | ✅ |
| Dialect awareness | ❌ | ❌ | Sometimes | ✅ Auto-detect |
| Generational slang | ❌ | ❌ | If prompted | ✅ Built-in |
| Pronunciation coaching | ❌ | Basic | ❌ | ✅ Detailed |
| Cultural context | ❌ | ❌ | Sometimes | ✅ Always |
| Camera interpretation | Word-for-word | ❌ | Needs wifi | ✅ Offline |
| Persistent companion | ❌ | Mascot | ❌ | ✅ Memory + personality |
| Configurable avatar | ❌ | ❌ | ❌ | ✅ Age/gender/vocation |
| Scenario adaptation | ❌ | ❌ | Manual | ✅ Auto-switch |
| 100+ languages offline | ❌ | 40 online | 100+ online | ✅ Offline |

---

## 14. Monetization (Post-Validation)

**Cost advantage:** everything runs on the user's phone. Marginal cost per user ≈ $0. No API bills. No server scaling. Pricing is about value, not cost recovery.

**Models:**
- Freemium subscription: free tier with daily limits, Pro $9.99-14.99/month unlimited
- One-time purchase: $19.99-29.99, use forever (aligns with offline — no ongoing server costs)
- B2B: hospitals, schools, hotels, corporate expat programs

---

## 15. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| 1.7B model quality for nuanced dialect/slang | Test across languages. Cloud upgrade for complex tasks. Models improve quarterly. |
| 1.3GB download scares users | "One-time, then works forever." Lite option (625MB). Compare to game sizes. |
| Cactus SDK stability | Validate Day 1. Fallbacks: llama.rn, ExecuTorch, cloud-first pivot. |
| Dialect/slang info in config is wrong | Community contribution model for config corrections. Flag uncertain info. |
| Battery drain | Lazy load model. Unload on background. Cactus optimized for efficiency. |
| "Why not ChatGPT?" | "Turn on airplane mode and try." |
| Cultural misinformation | System prompt emphasizes honesty. Test carefully. User feedback loop. |

---

## 16. The Manifesto

NAVI is not an app that works offline as a fallback. NAVI is an offline app that optionally upgrades to the cloud.

Every feature runs on-device. Every demo is filmed with airplane mode on. Every config is editable without code. Every avatar remembers you. Every dialect is local, not textbook.

The phone is the product. The cloud is a nice-to-have.

Open the app and you have a local friend who speaks the language, knows the slang, understands the culture, teaches you how to actually pronounce things, reads whatever you point your camera at, and fits into any situation you throw at them.

No internet. No lessons. No streaks. Just a companion who helps you navigate the world like a native.

---

*Version 3.0 | Offline-First | Config-Driven Context Controls*
