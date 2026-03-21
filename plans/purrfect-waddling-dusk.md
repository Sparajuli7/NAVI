
# NAVI — Master Plan

## Vision
NAVI is Jarvis in your pocket. A travel buddy, tour guide, language teacher, and emotional support companion in one — that works offline, everywhere. The differentiator isn't a feature; it's the relationship. Like Talking Tom, but actually useful.

**The wedge:** Every competitor (Google Translate, Duolingo, Papago) is a tool. NAVI is a companion who happens to be useful. Offline-first is the moat — it works in the Grand Bazaar, in a Tokyo subway, in a hospital waiting room.

**Target users:**
- Travelers arriving somewhere new (don't know the language, can't trust strangers)
- People relocating who need to learn quickly and feel less isolated
- Immigrant families in the US — parents navigating hospitals, offices, banks in English
- Language learners who want immersion, not flashcards
- University / language school students who want practice beyond the classroom

---

## Phase 1 — Foundation Fixes

### 1A. Language Bug Fix
**Problem:** Avatar shows "Mexican Spanish (Chilango)" but speaks Japanese. The language is re-derived from the city string at runtime, overriding the avatar's saved `dialectKey`.

**Fix 1 — Config:** `src/config/prompts/characterGen.json`
- Add CULTURE LOCK rule to both `freeText.template` and `fromTemplate.template`:
  > "This character is a NATIVE of {{city}}, {{country}}. Name, personality, and first message must be authentic to that city. The user's description determines vibe/personality ONLY — never culture, name, or language."
- This applies universally: a "friendly vibe" description when location=Tokyo generates a Japanese character, location=Kathmandu generates a Nepali character, etc. — regardless of any cultural cues in the description.

**Fix 2 — Code:** `src/agent/avatar/contextController.ts`
- Update `buildLocationLayer()` to accept explicit `dialectKey?: string`
- If provided and exists in `dialectMap.json`, use it directly — skip city string matching
- In `buildSystemPrompt()`, pass `profile.dialect` (set at character creation) as the authoritative key
- This must work for **all** languages in `dialectMap.json` — JP, KR, VN, FR, MX, NP, etc.

**Fix 3 — Language enforcement layer:** `src/config/prompts/systemLayers.json`
- Add `languageEnforcement` layer injected as Layer 2.5 (right after identity):
  > "You speak {{language}} ({{dialect}}). EVERY response is in {{language}}. This never changes. If the user writes to you in another language, you still respond in {{language}} — add a brief parenthetical translation only when genuinely needed. Do not switch. Do not explain. Just speak your language."
- Inject in `contextController.ts` `buildSystemPrompt()` right after the identity layer

---

### 1B. Native Language Collection (Base Language)
**Problem:** `{{userNativeLanguage}}` has no source — onboarding never asks. This is the user's **base language** — the language they are fluent in and will use as their reference point for translation, navigation, and learning.

**Screen copy:** "What language do you speak?" — subtitle: "This is your base. I'll use it when you need a translation or I need to explain something."

**Changes:** `src/app/components/NewOnboardingScreen.tsx`
- Add `step: 'language' | 'describe'` state, default `'language'`
- Show language picker FIRST: 13 buttons in a 3-column grid:
  English, Spanish, Portuguese, French, Hindi, **Nepali**, Mandarin, Arabic, Korean, Japanese, German, Italian, Other
- "Other" reveals an inline text input
- Selecting a language immediately advances to the describe step (no extra tap)
- After character generation: call `agent.memory.profile.setNativeLanguage(nativeLanguage)` and `useAppStore.getState().setUserPreferences({ native_language: nativeLanguage })`

Also: `src/agent/core/types.ts` — add `userMode: 'learn' | 'guide' | 'friend' | null` to `ProfileMemory`
And: `src/agent/memory/profileMemory.ts` — add `setUserMode()` / `getUserMode()`

---

### 1C. Mode System — Infer from First Message (No Picker Screen)
**Decision:** No explicit mode selection screen. The avatar opens with **"What do you need from me?"** and infers the mode from the first response. User never sees a mode selection UI. This matches the companion feel — a real friend doesn't ask you to pick a category.

**Three internal modes (not shown to user):**
- `learn` — Immersive teaching, language calibration tiers active, spaced repetition, vocab introduction
- `guide` — Navigation + translation, responds primarily in user's native language, no drills
- `friend` — Companion mode, empathize first, teach organically, swear words and slang welcome

**How it works:**

1. Avatar's first message → **replace with:** "What do you need from me?" localized to the avatar's language (+ a pronunciation guide) so the user sees how the avatar speaks right away

2. **Mode is NOT locked on first message** — `userMode` starts as `null`. The avatar operates in a natural blended state: teaches when it fits, translates when asked, empathizes when emotional. This handles any first message (hi, hello, I don't know, let's see, show me around, etc.)

3. **Keyword detector runs on every message** (not just the first), incrementally scoring signals:
   - learn-signals: "teach", "learn", "practice", "immerse", "how do I say", "what does X mean in", "say it again"
   - guide-signals: "translate", "what does", "help me understand", "I don't understand", "lost", "navigate", "need to say", "what are they saying"
   - friend-signals: "ugh", "terrible", "scammed", "frustrated", "can you believe", "just wanna talk", "venting", "awful", "so annoying"
   - **Threshold:** 2 clear signals of the same type within 5 messages → lock mode silently

4. **Edge cases:**
   - Greeting only ("hi", "hello", "hey") → stay null, avatar responds warmly and naturally, no mode set
   - Ambiguous ("I'm not sure what I need") → avatar responds: "No worries — just tell me what's happening and we'll figure it out together." Stay null.
   - Mixed signals in same message → lighter mode: friend > guide > learn (empathy wins ties)
   - Mode never locked if signals don't cross threshold → stays blended forever, which is fine

5. Once mode is locked, system prompt includes the mode instruction layer from that message onward

6. User can switch mode anytime via Settings panel (Mode toggle: Immerse / Navigate / Companion)

**Mode instruction templates:** `src/config/prompts/systemLayers.json` — add `modeInstructions`:
- `learn` — "Full immersion. Tier calibration active. Lead in your language. Gauge comfort, introduce vocab organically."
- `guide` — "The user needs a bridge. Respond primarily in {{userNativeLanguage}}. Translate what they encounter locally. When they want to say something, give the local phrase + pronunciation + meaning. No drills."
- `friend` — "Be a travel buddy first. Empathize before anything else. React to what happened before pivoting. Teach only when a phrase surfaces so naturally it would be weird not to share it. Swear words, slang, cultural venting — all welcome."
- `gauging_question` — "This is your very first message. Ask 'What do you need from me?' in your language with pronunciation guide and an English cue in parentheses. Keep it to 2 sentences max."

**Wiring:**
- `src/stores/appStore.ts` — add `userMode: 'learn' | 'guide' | 'friend' | null` + `setUserMode()`
- `src/agent/director/conversationDirector.ts` — read `userMode` in `preProcess()`, wrap all learning goals in `if (mode === 'learn')`, add mode instruction injection for non-learn modes
- `src/agent/tools/chatTool.ts` — extract `userMode` from params, add to `paramSchema`, pass to `buildSystemPrompt()`
- `src/agent/avatar/contextController.ts` — add mode instruction as a named layer in `buildSystemPrompt()`
- `src/agent/index.ts` — run keyword classifier on first message, call `setUserMode()`, pass `userMode` + `isFirstEverMessage` to director
- `src/app/App.tsx` — on restore: read `userMode` from agent memory into appStore. **Remove** the `intent` phase (it no longer exists)

---

### 1D. Nepali Language Support
**Add everywhere:**

- `src/config/dialectMap.json` — Add `"NP/Kathmandu"`:
  ```json
  {
    "language": "Nepali",
    "dialect": "Standard Nepali",
    "slangEra": "modern",
    "culturalNotes": "Kathmandu Valley — Hindu/Buddhist mix, young urban population, Hindi film influence, English common in educated circles",
    "greetingStyle": "Namaste with hands folded",
    "scripts": ["Devanagari"]
  }
  ```
- `src/data/cities.json` — Add Kathmandu (with lat/lng for GPS detection)
- `src/app/components/NewOnboardingScreen.tsx` — Add "Kathmandu" to preset city list
- `src/config/prompts/characterGen.json` — Add fallback name for `"NP"` → `"Arjun"` (or `"Sita"`)
- `src/config/prompts/systemLayers.json` — Add `scriptNote` to location layer: "Write phrases in both Devanagari script and romanized transliteration"
- `src/services/tts.ts` — Add `ne-NP` language code; fallback to `hi-IN` if browser doesn't support it
- `src/services/stt.ts` — Add `ne-NP` to STT language map; fallback to `hi-IN`

---

## Phase 2 — Conversation Quality

### 2A. Avatar Opening & Scenario Input
**Change:** `src/app/components/ScenarioLauncher.tsx`
- Rename `nervousAbout` field label → **"What do you need from me?"**
- Update placeholder text to match
- `src/config/prompts/systemLayers.json` — update `scenarioUserContext` template: `"User needs: {{needFromCompanion}}"` (field rename)

### 2B. Real-Time Audio Translation (Translate / Guide Mode)
**What it is:** In guide mode, hold mic = listen to what someone is saying in the local language → avatar immediately tells the user in their native language what was said + what to say back.

**Changes:**
- `src/app/components/ConversationScreen.tsx` — Differentiate mic behavior by mode:
  - `learn` / `friend`: existing behavior (user speaks their message)
  - `guide`: hold = ambient listening (STT set to avatar's dialect language), short tap = user speaks their own message
  - Add UI cue: mic button turns gold + "Listening..." label when in ambient mode
  - Add small inline note: "Live translation needs internet for voice recognition"
- `src/config/prompts/toolPrompts.json` — Add `listenAndTranslate` prompt:
  ```json
  "listenAndTranslate": {
    "template": "Someone just said this in {{language}}: '{{captured}}'. Tell the user (who speaks {{userNativeLanguage}}) what was said and give them 1-2 natural responses they could use. Short and conversational.",
    "temperature": 0.2,
    "max_tokens": 150
  }
  ```
- `src/agent/tools/chatTool.ts` — detect `translationMode: 'listen'` in context params, use `listenAndTranslate` template instead of standard chat
- `src/services/stt.ts` — in guide mode, set recognition language to the avatar's dialect (not user's native language)

### 2C. Realistic Conversation Flow
**Changes to `src/config/prompts/systemLayers.json`:**
- Add `conversationNaturalness` injected into identity layer: "Never ask more than one question at a time. Lead with a statement, observation, or phrase before any question. React to what the user said before pivoting. You are a person, not a quiz."

**Changes to `src/config/prompts/coreRules.json`:**
- Add: "Do not open with 'Of course!' or 'Great!' or 'Sure!'. Start with the actual content."

**Changes to `src/config/prompts/toolPrompts.json`:**
- Update `chat.template` — Add CONVERSATION QUALITY section: "Natural rhythm: statement → teaching → one question max. Never two questions in a row. If the user seems lost, slow down and offer a phrase. If they're flowing, match their energy."

---

## Phase 3 — Avatar Appearance

### 3A. Replace BlockyAvatar with avataaars
**Problem:** The 8-bit floating head doesn't create emotional connection. `avataaars` (cartoon SVG) is already installed but unused.

**New file:** `src/app/components/AvatarRenderer.tsx`
- Wraps the `avataaars` library
- Maps character traits to avataaars props:
  - `personality` → `mouthType` (e.g., "warm" → Smile, "bold" → Default, "funny" → Tongue)
  - `age_group` → `topType` (hair style / age-appropriate look)
  - `avatar_color` → `skinColor` + `hairColor`
  - `style` → `clotheType` (e.g., "streetwear" → ShirtCrewNeck, "formal" → BlazerShirt)
  - `gender` hint from character → `facialHairType`
- Animated states via Framer Motion:
  - `idle` — slow, subtle float (translateY ±4px, 3s loop)
  - `generating` — slight lean + thinking expression (eyebrows raised)
  - `speaking` — gentle zoom pulse (scale 1.0 → 1.02, synced to TTS if playing)
  - `success` — smile expression + brief sparkle (when user gets a phrase right)
  - `blink` — eye blink every 3–5 seconds (randomized)

**Replace in:**
- `src/app/components/ConversationScreen.tsx` — replace `<BlockyAvatar>` with `<AvatarRenderer character={character} state={avatarState} />`
- `src/app/components/HomeScreen.tsx` — companion cards use `<AvatarRenderer>`
- `src/app/App.tsx` — any avatar rendering

`BlockyAvatar.tsx` — keep file but mark as deprecated (don't delete, may be used elsewhere)

---

## Phase 4 — Scenario UX Overhaul

### 4A. Scenario Launcher Redesign
**Problem:** Current form (where, doing, talkingTo, nervousAbout, customText) is rigid and form-like. Replace with minimal input.

**Redesign `src/app/components/ScenarioLauncher.tsx`:**
- **Step 1:** Pick a scenario tile (emoji + label grid, horizontal scroll) or "Custom"
- **Step 2:** One open text box: "Tell me what's happening." Placeholder: *"e.g. I'm at a market in Istanbul and I need to buy a carpet without getting ripped off"*
- **Step 3 (optional chips):** "What do you need?" → Understand what's being said | Say something specific | Survive a negotiation | Just practice | Have fun with it
- On "Start" → fire context parser → set scenario → navigate to chat

**Context parsing:** `src/config/prompts/toolPrompts.json` — add `scenarioContextParse`:
```json
"scenarioContextParse": {
  "template": "Extract from: '{\"where\": \"\", \"doing\": \"\", \"talkingTo\": \"\", \"needFromCompanion\": \"\"}'. Input: {{input}}. JSON only.",
  "temperature": 0.1,
  "max_tokens": 100
}
```
Run on "Start" click in `ScenarioLauncher.tsx`, populate `ParsedScenarioContext`, then call existing `handleStartScenario()`.

### 4B. Expand Scenario Templates
**Current:** 11 (restaurant, directions, market, hotel, social, government, transit, nightlife, hospital, office, school)

**Add to `src/config/scenarioContexts.json`** (9 new):
| Key | Label | Emoji | Focus |
|-----|-------|-------|-------|
| `customs` | Airport Customs | ✈️ | Immigration questions, declarations, what not to say |
| `pharmacy` | Pharmacy | 💊 | Describing symptoms, getting medication |
| `emergency` | Emergency | 🚨 | Police, theft, accident — high-stakes, calm language |
| `landlord` | Renting / Landlord | 🏠 | Apartment terms, deposit, complaints |
| `bank` | Bank / Money | 🏦 | Account opening, transfers, fee negotiation |
| `taxi` | Taxi / Ride | 🚕 | Negotiating fare, avoiding scams, directions |
| `temple` | Temple / Cultural Site | 🛕 | Etiquette, dress code, sacred phrases |
| `street_food` | Street Food Vendor | 🍢 | Ordering, pointing, quantities, allergens |
| `date` | Meeting Someone | 💬 | Light social, compliments, casual flirting (local style) |

### 4C. Scenario Access Points
- `src/app/components/HomeScreen.tsx` — Add horizontal scroll row "Jump into a scenario" with emoji + label tiles directly on home screen (not behind a button)
- `src/app/components/ConversationScreen.tsx` — Add "▶ Start a scenario" to default quick action pills
- When launching from HomeScreen with no active avatar: offer "Create a companion for this" → shortcut onboarding with location pre-filled from scenario context

---

## Phase 5 — Web Presence

### 5A. Landing Page
**New directory:** `web/` at repo root

`web/index.html` — single-page, no framework:
- **Hero:** "Your local friend, anywhere in the world." + phone mockup
- **How it works:** Pick a companion → Tell them what's happening → Start talking
- **Three user stories:** Traveler (Grand Bazaar) / Learner (immersion) / Family (hospital)
- **The offline promise:** "No internet? No problem."
- **CTA:** "Try it now" → Vercel deployment URL
- **Feedback link** → `feedback.html`

### 5B. Feedback Page
`web/feedback.html` — minimal form:
- Feedback type: Bug / Feature Request / UX / General
- Free text field
- Email (optional)
- Submit → POST to Cloudflare Worker

`web/worker.js` — Cloudflare Worker:
- Receives POST, stores to D1 database: `type`, `message`, `email`, `created_at`, `app_version`

---

## Implementation Order

### Batch 1 — Config fixes (no code changes, immediate impact)
1. `config/prompts/characterGen.json` — culture lock rule
2. `config/dialectMap.json` — add `NP/Kathmandu`
3. `data/cities.json` — add Kathmandu
4. `config/prompts/systemLayers.json` — `languageEnforcement` + `modeInstructions` + `conversationNaturalness` + Devanagari script note
5. `config/prompts/coreRules.json` — no filler openers, no double questions
6. `config/prompts/toolPrompts.json` — conversation quality section + `listenAndTranslate` + `scenarioContextParse`

### Batch 2 — Agent/memory wiring
7. `agent/core/types.ts` — add `userMode` to `ProfileMemory`
8. `agent/memory/profileMemory.ts` — `setUserMode` / `getUserMode`
9. `agent/avatar/contextController.ts` — dialectKey fix + `languageEnforcement` injection + mode layer
10. `agent/director/conversationDirector.ts` — mode-aware goal selection
11. `agent/tools/chatTool.ts` — `userMode` param + `translationMode: 'listen'` detection
12. `stores/appStore.ts` — `userMode` field
13. `agent/index.ts` — rolling keyword classifier on every message, accumulate signal scores, lock mode when threshold crossed, silent `setUserMode()`, wire `userMode` + `isFirstEverMessage` + `userNativeLanguage`

### Batch 3 — UI changes
14. `app/components/NewOnboardingScreen.tsx` — language picker step first (13 languages incl. Nepali + Kathmandu city)
15. `services/tts.ts` — add `ne-NP` with `hi-IN` fallback
16. `services/stt.ts` — add `ne-NP`, mode-aware language selection
17. `app/App.tsx` — remove `intent` phase, restore `userMode` from agent memory on init
18. Create `app/components/AvatarRenderer.tsx` — avataaars wrapper with animated states
19. `app/components/ConversationScreen.tsx` — use `AvatarRenderer`, differentiated mic behavior for guide mode, "Listening..." UI cue
20. `app/components/ScenarioLauncher.tsx` — redesign: tiles + one text box + chips + context parser call
21. `config/scenarioContexts.json` — 9 new templates
22. `app/components/HomeScreen.tsx` — scenario tiles row on home screen

### Batch 4 — Web
23. Create `web/index.html` — landing page
24. Create `web/feedback.html` — feedback form
25. Create `web/worker.js` — Cloudflare Worker + D1

### Batch 5 — Docs
26. `CLAUDE.md` — resolve known gaps, add new components, add Nepali to supported languages
27. `audit.md` — mark resolved, add new items

---

## Critical Files
| File | Why |
|------|-----|
| `src/agent/avatar/contextController.ts` | Dialect key fix + language enforcement + mode layer |
| `src/agent/director/conversationDirector.ts` | Gates all learning features by mode |
| `src/agent/index.ts` | Keyword classifier → silent mode detection |
| `src/config/prompts/systemLayers.json` | All mode/language behavior (pure config) |
| `src/app/components/NewOnboardingScreen.tsx` | Native language step + Nepali/Kathmandu |
| `src/app/components/AvatarRenderer.tsx` | New component — avataaars with expressions |
| `src/app/components/ScenarioLauncher.tsx` | Full redesign |
| `src/config/dialectMap.json` | NP/Kathmandu entry |
| `src/services/stt.ts` | ne-NP + mode-aware language |

---

## Verification Checklist
- [ ] Language lock works for ALL dialects: any mismatch between description culture and selected city always resolves to the city's language (e.g. "friendly vibe" + Kathmandu = Nepali, "Mexican vibe" + Osaka = Japanese, "French vibe" + Seoul = Korean)
- [ ] First launch: language picker appears first with heading "What language do you speak?" — 13 options including Nepali — this sets the base/native language for all translation and navigation
- [ ] Kathmandu available in city picker → generates Nepali avatar with Devanagari + romanized phrases
- [ ] Avatar's first message is "What do you need from me?" in the local language with pronunciation
- [ ] User says "hi" or something ambiguous → avatar responds naturally, no mode locked, blended behavior
- [ ] User says "I'm not sure what I need" → avatar: "No worries — just tell me what's happening", stays in null/blended state
- [ ] User says "teach me Korean" (or 2+ learn-signals across 5 messages) → mode silently set to `learn`, avatar begins immersion
- [ ] User says "I'm lost, what are they saying?" (or 2+ guide-signals) → mode set to `guide`, avatar responds in user's base language
- [ ] User says "I just got scammed, this is awful" (or 2+ friend-signals) → mode set to `friend`, avatar empathizes first
- [ ] Mode never forced if signals never hit threshold — blended natural conversation continues
- [ ] Guide mode: hold mic → avatar listens to local speaker → translates to user's native language
- [ ] "Listening..." UI cue appears, internet note shown
- [ ] Avatar is now cartoon SVG (avataaars) with idle float animation, not Minecraft head
- [ ] Avatar blinks, speaking pulse visible during TTS playback
- [ ] Scenario launcher shows tile grid + one text box + chips (no rigid form fields)
- [ ] New scenarios visible: customs, pharmacy, emergency, taxi, etc.
- [ ] Scenario row visible directly on HomeScreen (no button tap needed)
- [ ] Avatar never opens with "Of course!" and never asks two questions back to back
- [ ] Kill + reopen: mode and native language restored from IndexedDB
- [ ] Landing page loads, CTA works, feedback form submits to Cloudflare Worker

---

## Out of Scope (for now)
- iOS / Android apps
- Multi-avatar scenario
- Push notifications for spaced repetition
