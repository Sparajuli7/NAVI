# Research Round 5: Scenario Depth, Avatar Coherence, UI Flow, and Memory Persistence

Date: 2026-04-16
Files analyzed: 22 source files across agent/, app/, config/, stores/, utils/

---

## Research Area 1: Scenario Depth

### Current State

Scenarios are defined in `src/config/scenarioContexts.json` with 20 templates. Each template provides:
- `vocabulary_focus` (array of target vocabulary)
- `tone_shift` / `tone_guidance` (how the avatar should speak)
- `formality_adjustment` (-2 to +2)
- `cultural_guardrails` (what not to do)
- `debrief_focus` (what to review after)
- `auto_suggestions` (quick-action pills in the UI)
- `pronunciation_priority` (what to drill)

**Problem:** These are all single-layer metadata. There is no concept of a scenario ARC — turns progressing through distinct phases. When a user taps "Restaurant," the avatar gets a `scenarioLock` prompt that says "stay focused on this situation" but has no notion of progression. Every turn is treated the same.

The TBLT templates exist in `systemLayers.json`:
- `tblt_pretask` — prep the user with 2-3 phrases, set the scene
- `tblt_task` — stay in character, correct by rephrasing
- `tblt_posttask` — debrief honestly

And in `conversationSkills.json`:
- `tblt_pretask` (skill version with evidence citations)
- `tblt_posttask` (skill version)

**Critical gap:** These TBLT templates are NEVER INJECTED during scenario execution. Searching the codebase:
- `buildScenarioLayer()` in `contextController.ts` (line 418) uses `scenarioLock` only — never `tblt_pretask`, `tblt_task`, or `tblt_posttask`
- `handleStartScenario()` in `App.tsx` (line 422) calls `avatar.applyOverride({ scenario: templateKey })` — no phase tracking
- `handleEndScenario()` in `ConversationScreen.tsx` (line 284) manually injects a debrief override — but this is the ONLY TBLT phase that gets activated, and it's hardcoded rather than using the `tblt_posttask` or `scenarioDebrief` templates from JSON config
- The `conversationSkills.json` `tblt_pretask` skill has `trigger: "scenario_started"` but the ConversationDirector never checks for this trigger
- The `scenarioOpener` in `systemLayers.json` modeInstructions fires on `isFirstEverMessage && effectiveScenario` (contextController line 252) but `isFirstEverMessage` is based on `historyLen === 0` (agent/index.ts line 604) which means it only fires on the VERY first message of the entire conversation, not the first message of a scenario

### Designed Scenario Arcs

#### Arc 1: Restaurant (8 turns)

**Pre-task (Turn 0 — triggered automatically when scenario starts):**
Phrases to pre-teach:
1. "A table for [number], please" — the entry phrase
2. "What do you recommend?" — avoids menu paralysis
3. "The check, please" — the exit phrase

Avatar message: "Okay, so we're about to walk into [restaurant type based on location]. Here's what you need to know — [pre-task phrases with pronunciation]. The waiter's going to greet you first. Just say [greeting phrase]. Ready? Let's go."

**Turn 1 — Scene setting (avatar as companion):**
Avatar describes the scene: sounds, smells, visual details. "We just walked in. It's [busy/quiet], there's [sensory detail]. The host is looking at us — go ahead, tell them how many."

**Turn 2 — Getting a table (user attempts):**
User tries the table phrase. Avatar coaches if needed: "Nice! They're seating us by the window. Okay, menu's coming."

**Turn 3-4 — Ordering (avatar shifts to light role-play):**
Avatar signals the waiter is approaching: "The waiter's here. They're going to ask what you want to drink first — in [language] that sounds like [phrase]."
If user orders successfully, avatar adds a cultural note. If user struggles, avatar models the correct form naturally (recast).

**Turn 5-6 — Food arrives / conversation:**
Avatar describes the food, teaches dish-specific vocabulary. Creates a natural moment for the user to express opinion: "How would you say 'this is delicious' here? It's [phrase]."

**Turn 7 — Paying the bill:**
Avatar coaches: "Okay, time to pay. In [city], [tipping culture note]. Say [check phrase]."

**Turn 8 — Debrief (TBLT post-task):**
Avatar steps out of scenario. Honest assessment: one specific win, one thing to work on. 2-3 phrase cards extracted from the conversation. References specific moments.

#### Arc 2: Market Haggling (8 turns)

**Pre-task phrases:**
1. "How much?" — essential opener
2. "Too expensive" — the core negotiation phrase
3. "I'll take it" — closing the deal

**Turn 1 — Scene setting:**
"We're at [market name/type]. Vendors are calling out, there's [sensory details]. See that stall with [item]? Let's go over. First rule: never look too interested."

**Turn 2 — Approaching the vendor:**
Avatar coaches approach behavior: "Ask the price of [item]. In [language]: [phrase]. Don't react to the number — just nod."

**Turn 3-4 — Negotiation:**
Avatar plays the role of cultural coach standing beside the user: "They said [price]. That's the tourist price. Counter with [phrase + amount]. Smile when you say it — this is supposed to be fun."
Second round: "They came down to [price]. You can go a little higher — say [phrase]. If they shake their head, start walking away slowly."

**Turn 5-6 — Closing the deal:**
"They called you back — that means your price was close. Offer [final amount]. Say [phrase]." If successful: "You just saved [amount] and the vendor is smiling — that's how you know it was fair."

**Turn 7 — Walking away:**
Avatar teaches post-purchase courtesy: "Say [thank you phrase]. Vendors remember polite buyers. Next time you come back, they'll give you a better price from the start."

**Turn 8 — Debrief:**
What worked, what to adjust. Phrase cards for: price asking, negotiation, closing. Cultural insight: "In [city], the haggling IS the relationship. You did that."

#### Arc 3: Asking Directions (6 turns — shorter arc)

**Pre-task phrases:**
1. "Excuse me, where is...?" — approach phrase
2. "Left / right / straight" — comprehension essentials
3. "Is it far?" — follow-up

**Turn 1 — Scene setting:**
"You need to get to [destination]. We're on [street/landmark]. I could just tell you, but let's practice asking someone. See that [person description]? Go ahead — start with [excuse me phrase]."

**Turn 2 — Asking:**
User attempts the direction question. Avatar coaches pronunciation and approach etiquette.

**Turn 3-4 — Understanding the response:**
Avatar simulates what a local would say (fast, with landmarks): "Okay, they said [direction in target language]. Did you catch that? The key words were [left/right/straight]. They mentioned [landmark] — that's your signal to turn."

**Turn 5 — Confirming:**
Avatar teaches confirmation phrase: "Always confirm — ask [so I go left at the X?]. In [city], people sometimes give directions even when they don't know. If the second person says something different, trust the second one."

**Turn 6 — Debrief:**
Phrase cards for: approach phrase, direction words, confirmation phrase. "Next time you're lost, you've got the three phrases. The secret is confidence — even if your pronunciation is rough, the gesture + the attempt gets you there."

### What Each Scenario Config Needs (New Fields)

```json
{
  "restaurant": {
    "arc": {
      "pretask_phrases": [
        { "phrase": "A table for {{number}}, please", "context": "entry", "priority": 1 },
        { "phrase": "What do you recommend?", "context": "ordering", "priority": 2 },
        { "phrase": "The check, please", "context": "closing", "priority": 3 }
      ],
      "phases": [
        { "id": "scene_set", "turn": 1, "prompt": "Set the scene. Describe the restaurant..." },
        { "id": "approach", "turn": 2, "prompt": "The user needs to get a table..." },
        { "id": "ordering", "turns": [3, 4], "prompt": "Ordering phase. Waiter approaches..." },
        { "id": "food", "turns": [5, 6], "prompt": "Food arrives. Teach food vocabulary..." },
        { "id": "bill", "turn": 7, "prompt": "Time to pay. Teach check/tipping..." },
        { "id": "debrief", "turn": 8, "prompt": "Step out. Debrief honestly..." }
      ],
      "expected_turns": 8,
      "complications": [
        "Waiter asks about allergies",
        "Item not available",
        "Wrong order arrives"
      ]
    }
  }
}
```

### Implementation Requirements

1. **Phase tracker in chatStore** — new state: `scenarioPhase: number` (0=pretask, 1-N=task turns, last=debrief). Incremented per user message when `isScenarioActive`.

2. **Phase-aware prompt injection** — `buildScenarioLayer()` needs to read the current phase and inject the appropriate TBLT template:
   - Phase 0: inject `tblt_pretask` + `pretask_phrases`
   - Phases 1-N: inject `tblt_task` + phase-specific prompt
   - Final phase: inject `tblt_posttask` + `debrief_focus`

3. **Auto-debrief** — When `scenarioPhase >= expected_turns`, automatically trigger debrief instead of requiring user to click "End Scenario."

4. **Complication injection** — At random during task phases, inject a complication from the `complications` array to create productive challenge moments.

---

## Research Area 2: Scenario-Avatar Coherence

### The Core Tension

The avatar is the user's FRIEND and COMPANION. But scenarios need someone to play the waiter, shopkeeper, customs officer. These are incompatible roles.

### What Language Teaching Research Says

**Task-Based Language Teaching (Willis, 1996; Ellis, 2003):**
The teacher is a FACILITATOR during the task, not a participant. The task itself drives the interaction. In NAVI's case, the avatar should coach the user through the scenario, not become the other person.

**Character.AI / Replika approach:**
These platforms let the character freely role-play any role the user requests. This works for entertainment but is problematic for learning because:
- Role-play removes the coaching layer — the avatar can't simultaneously BE the waiter and TEACH the user how to talk to a waiter
- The user practices scripted responses rather than building real-world confidence
- There's no one to catch errors and provide recasts

**Immersive VR research (Godwin-Jones, 2016):**
The most effective immersive language scenarios use a DUAL AGENT model: one agent plays the NPC role (waiter, shopkeeper), another provides coaching. NAVI has only one avatar.

### Recommended Approach: Coach-on-the-Side

The avatar stays as the user's COMPANION throughout. They never "become" the waiter. Instead:

1. **They describe what the other person says/does** — "The waiter just asked what you want to drink. In [language] he said [phrase]."
2. **They coach the user's response** — "Try saying [phrase]. If they look confused, point at the menu — that always works."
3. **They provide real-time feedback** — "Nice, they understood you! They're bringing the menu now."
4. **They add cultural coaching** — "By the way, in [city] you don't tip until you leave, not at the counter."

This preserves:
- The companion relationship (trust, warmth)
- The coaching function (error correction, encouragement)
- Cultural meta-commentary (the REAL value of NAVI)
- The user's sense of agency (they're doing it, not watching)

### Prompt Text for Coach-on-the-Side Mode

```
SCENARIO ROLE: You are the user's COMPANION — their friend standing beside them in this {{scenarioLabel}} situation. You are NOT the {{roleNPC}} (waiter/shopkeeper/officer). Instead:
- DESCRIBE what the other person says or does: "The waiter just said [phrase in target language]"
- COACH the user's response: "Tell them [phrase]. Here's how you say it..."
- PROVIDE FEEDBACK: "They understood you! Nice." or "They looked confused — try again with [simpler phrase]"
- ADD CULTURAL CONTEXT: "In [city], this is how [situation] typically goes..."
- SIMULATE COMPLICATIONS: Occasionally describe unexpected moments (wrong order, miscommunication) and coach through them
You are their insider, their translator, their friend who knows how this works. You never leave their side.
```

### When Role-Play IS Appropriate

At the FLUENT learning stage (`stageInfo.stage === 'fluent'`), the user may benefit from full role-play where the avatar becomes the NPC. The `scenarioLock_fluent` template already exists in `systemLayers.json`:

```
"scenarioLock_fluent": "PEER ROLE-PLAY: You and the user are equals in this {{scenarioLabel}} situation. Do NOT teach or explain — have a real conversation as two people navigating this together."
```

This should be gated: only activate full role-play at fluent stage. All other stages get Coach-on-the-Side.

---

## Research Area 3: UI Flow Gaps

### Full Flow Trace

#### Flow 1: Avatar Creation to Chat

1. User opens app -> `App.tsx` `init()` runs
2. No saved character -> `setAppPhase('onboarding')`
3. `AvatarSelectScreen` renders -> user picks template + location
4. `handleAvatarSelected()` (App.tsx line 228):
   - Creates `Character` object with `template_id`, `dialect_key`, `location_city`
   - Saves to characterStore, chatStore, IndexedDB
   - Creates first message and adds to chatStore
   - Sets up agent avatar via `agent.createAvatarFromTemplate()` or `agent.avatar.createFromDescription()`
   - If LLM not ready, goes to `downloading` phase, then `chat`
5. `ConversationScreen` renders with the character

**Gap 1: First message is hardcoded English** — `handleAvatarSelected()` line 249-251 creates `first_message` as English (`"Hey! I'm your [template]. Ready to explore [city]?"`). This contradicts the language enforcement and immersion design. The first message should be generated by the LLM using `characterGen.json` templates, but onboarding bypasses LLM generation entirely for template characters (only custom characters go through LLM gen). The user's very first experience is in English regardless of target language.

**Gap 2: No LLM-generated character for template picks** — When the user picks a template (not custom), `handleAvatarSelected()` creates a `Character` with `summary: template.base_personality` and `detailed: ''`. The `speaks_like` is hardcoded to `'warm and conversational'`. No LLM call is made to generate personality, first message, or `portrait_prompt`. The character is generic.

#### Flow 2: Scenario Launch to Conversation

1. User taps Zap icon -> `onOpenScenarios()` -> `setShowScenarioLauncher(true)`
2. `ScenarioLauncher` renders template grid
3. User taps a template (e.g., "Restaurant") -> `handleSelectTemplate()` -> immediate `onStart(key, EMPTY_CTX)`
4. `handleStartScenario()` in App.tsx (line 422):
   - `setScenario(templateKey)` — stores in chatStore
   - `setScenarioContext(context)` — stores parsed context (empty for templates)
   - `setScenarioActive(true)`
   - `avatar.applyOverride({ scenario: templateKey })` — sets override
5. Back in `ConversationScreen`, user types a message -> `handleSend()`
6. `handleSend()` also runs `detectScenario(msgText)` on the user's text (line 166-167), which may override the manually-set scenario

**Gap 3: No TBLT pretask on scenario start** — When the user taps "Restaurant," control goes immediately back to `ConversationScreen` without any avatar message. The user has to type first. There is no pretask phase where the avatar previews key phrases and sets the scene. The scenario starts cold.

**Gap 4: `scenarioOpener` only fires on first-ever message** — `contextController.ts` line 252 checks `isFirstEverMessage` which is `historyLen === 0` (agent/index.ts line 604). This means the scenario opener prompt NEVER fires when a user starts a scenario mid-conversation (which is the normal case — they've been chatting, then open a scenario).

**Gap 5: `detectScenario()` fights with manual scenario** — `ConversationScreen.handleSend()` line 166-167 runs `detectScenario(msgText)` on every message. If the user is in a "restaurant" scenario and says "I need to take a taxi to the restaurant," `detectScenario` may flip the scenario to "taxi" (because "taxi" is a keyword for the transit scenario). This overrides the manually-set scenario.

**Gap 6: Empty context for template scenarios** — When a template scenario is picked (not custom), `handleStartScenario()` receives `EMPTY_CTX` (all fields empty). The `buildContextSummary()` returns `''`. So `avatar.applyOverride` gets `additionalContext: undefined`. The avatar has no user-specific context for the scenario. Compare with custom scenarios where the user types their situation.

**Gap 7: No scenario phase tracking** — `chatStore` has `activeScenario`, `isScenarioActive`, and `scenarioContext` but NO `scenarioPhase` or `scenarioTurnCount`. There is no way to know if the user is on turn 1 or turn 7 of a scenario.

#### Flow 3: Scenario End

1. User taps the scenario pill in the header with X icon -> `handleEndScenario()` (ConversationScreen line 284)
2. `handleEndScenario()`:
   - `setScenarioActive(false)`, `setScenarioContext(null)`, `setScenario(null)` — clears all scenario state
   - `avatar.applyOverride({ scenario: '', additionalContext: 'DEBRIEF MODE: ...' })` — injects debrief
   - `await handleSend('[End scenario — debrief: ...]')` — sends a synthetic user message
   - `avatar.clearOverrides()` — removes all overrides

**Gap 8: Debrief is a one-shot, then all context is lost** — After `handleSend` completes and `clearOverrides()` runs, ALL scenario context is gone. The avatar has no memory that a scenario was practiced. Episodic memory only stores summaries every 10 user messages (ConversationScreen line 253-265), so short scenarios (4-5 turns) may never get stored.

**Gap 9: ProactiveEngine scenario completion not triggered** — `proactiveEngine.markScenarioCompleted()` is never called from `handleEndScenario()`. The proactive debrief trigger (ProactiveEngine line 109-113) is dead code — `lastCompletedScenario` is always null.

**Gap 10: No scenario data in learnerProfile** — Phrases learned during a scenario are tracked by the regular `phraseDetector` in the director's `postProcess`, but there is no record that the phrase was learned IN a scenario. The `TrackedPhrase.learnedAt` field could contain scenario context but currently only gets `attempt.context` which isn't set by the director.

#### Flow 4: Character Switching

1. User goes to HomeScreen -> taps a companion -> `handleSelectCompanion()` (App.tsx line 315)
2. Loads per-character conversation and memories from IndexedDB
3. Sets up avatar profile via `agent.avatar.createFromDescription()`
4. Syncs agent location

**Gap 11: Scenario state not cleared on character switch** — `handleSelectCompanion()` loads the new character's messages via `useChatStore.setState({ messages: msgs })` but does NOT clear `activeScenario`, `isScenarioActive`, or `scenarioContext`. If the user was in a "restaurant" scenario with Character A and switches to Character B, Character B's conversation loads but the scenario state from Character A persists.

#### Flow 5: App Reopen (Returning User)

1. `App.tsx` `init()` loads from IndexedDB
2. `loadCharacterConversation(activeChar.id)` — gets messages
3. `useChatStore.setState({ messages: msgs })` — restores messages
4. Agent memory initializes (line 438-441): `memory.initialize()` + `location.initialize()`
5. Avatar profile created from template (line 158-165)

**Gap 12: Scenario state not persisted across sessions** — `chatStore` holds `activeScenario`, `isScenarioActive`, `scenarioContext` in Zustand (in-memory only). These are NOT saved to IndexedDB. When the user closes the app mid-scenario and reopens, the scenario is gone. Messages are restored but the scenario overlay/pills/phase tracking is lost.

---

## Research Area 4: Avatar Memory Across Sessions

### What IS Persisted (IndexedDB)

| Data | Key | Restored On Load? | Code Path |
|---|---|---|---|
| Character object | `navi_characters`, `navi_character` | Yes | `App.tsx` init, `loadCharacters()` |
| Conversation messages | `navi_conv_{charId}` | Yes | `App.tsx` init, `loadCharacterConversation()` |
| Character memories (legacy) | `navi_mem_{charId}` | Yes | `App.tsx` init, `loadCharacterMemories()` |
| User preferences | `navi_preferences` | Yes | `App.tsx` init, `loadPreferences()` |
| Location context | `navi_location` | Yes | `App.tsx` init, `loadLocation()` |
| User profile notes | `navi_user_profile` | Yes | `App.tsx` init, `loadUserProfile()` |
| Avatar portrait image | `navi_avatar_img_{charId}` | Lazy (on render) | `AIAvatarDisplay.tsx` |
| Episodic memory | `navi_episodic_memory` | Yes | `MemoryManager.initialize()` → `EpisodicMemoryStore.load()` |
| Profile memory | `navi_profile_memory` | Yes | `MemoryManager.initialize()` → `ProfileMemoryStore.load()` |
| Learner profile (phrases, topics, stats) | `navi_learner_profile` | Yes | `MemoryManager.initialize()` → `LearnerProfileStore.load()` |
| Relationships (warmth, milestones) | `navi_relationships` | Yes | `MemoryManager.initialize()` → `RelationshipStore.load()` |
| Situation model | via `SituationAssessor.load()` | Yes | `MemoryManager.initialize()` |
| Knowledge graph | via `KnowledgeGraphStore.load()` | Yes | `MemoryManager.initialize()` |
| User mode (learn/guide/friend) | Inside `navi_profile_memory` | Yes | `agent.memory.profile.getUserMode()` in `App.tsx` init |
| Semantic memory (vectors) | via `SemanticMemoryStore.load()` | Yes | `MemoryManager.initialize()` |

### What IS NOT Persisted

| Data | Current Storage | Impact |
|---|---|---|
| Working memory (ring buffer) | In-memory only, 10-min TTL | All session context lost on close: calibration tier, session goal, message counts, scenario skill flags |
| Active scenario state | Zustand (in-memory) | Scenario lost on app close — see Gap 12 |
| Scenario phase/turn count | Does not exist | See Gap 7 |
| Mode classifier state | In-memory (`ModeClassifier` class) | Mode IS persisted in ProfileMemory, but the classifier's rolling scores/lock state reset. Mode is re-detected from `profileMemory.getUserMode()` on load. |
| Director's consecutive counters | In-memory | `consecutiveTargetLangMessages`, `consecutiveHelpRequests`, `exchangesSinceTierChange` all reset. Language calibration tier restarts from learnerProfile value. |
| `termsInSession` / `turnsWithoutOutput` | In-memory (NaviAgent) | Research agent context resets — it loses track of session-level learning pace |
| Proactive engine state | In-memory (`firedThisSession`) | Resets correctly — proactive message fires once per session, which is intended |

### Memory Recall Across Sessions: What Works

**Does the avatar remember what they talked about?**
PARTIALLY. Episodic memory stores summaries every 10 user messages (`ConversationScreen.tsx` line 253-265). These are persisted and loaded. The `buildContextForPrompt()` method injects recent episodes into the system prompt. But:
- Short conversations (< 10 user messages) get NO episodic summary
- Episodes are summarized as raw text slices (line 256-259: `recentMsgs.slice(0, 200)`) not LLM-generated summaries, so they're noisy
- The system prompt only includes 3-5 episodes due to token budget (memoryManager line 93-101)

**Does it remember what phrases were taught?**
YES. `LearnerProfileStore` persists all tracked phrases with mastery levels, attempt counts, and spaced repetition schedules. The learner profile is loaded on app start and injected into the system prompt via `formatForPrompt()` (recent 5 phrases + weak topics).

**Does it remember the relationship warmth?**
YES. `RelationshipStore` persists per-avatar warmth values, interaction counts, milestones, and shared references. Warmth decay is applied on session start (`applyDecay()`). The warmth instruction is injected into the system prompt.

**Does it resume the learning stage?**
YES, but indirectly. Learning stage is COMPUTED, not stored (learnerProfile line 389: `getCurrentStage(interactionCount, completedScenarios)`). It derives from persistent data (interaction count from relationships, mastered phrases from learner, comfort tier from learner). So it effectively resumes — but `completedScenarios` is always 0 because scenario completion count is never tracked or persisted.

### Critical Memory Gaps

**Gap 13: Per-character memory isolation is incomplete** — Memory stores (`navi_episodic_memory`, `navi_learner_profile`, `navi_relationships`, `navi_profile_memory`, `navi_knowledge_graph`) are GLOBAL, not per-character. If a user has Character A (Nepali companion in Kathmandu) and Character B (French companion in Paris):
- All phrases from both characters are in the same `LearnerProfileStore`
- All episodic memories mix together
- Profile memory is shared (native language, user mode)
- Only relationship warmth is per-avatar (keyed by `avatarId`)

This means when talking to Character B in Paris, the system prompt may reference Nepali phrases learned with Character A. The `getByLocation()` filter in episodic memory helps somewhat, but phrases and topics have no character isolation.

**Gap 14: Conversation messages are per-character but memory is not** — `navi_conv_{charId}` correctly isolates conversations. But the agent's `MemoryManager` operates on global stores. `handleSelectCompanion()` (App.tsx line 315) loads per-character messages but does NOT switch/filter the memory stores.

**Gap 15: `completedScenarios` is never tracked** — The `getCurrentStage()` method accepts `completedScenarios` as a parameter, but it's always passed as `options?.completedScenarios ?? 0` (director line 301). No code ever increments a scenario completion counter. `handleEndScenario()` does not record the completion anywhere.

**Gap 16: Working memory is not serialized on app background** — `WorkingMemory` has `serialize()` and `restore()` methods (workingMemory.ts lines 103-113) but they are NEVER called. When the app goes to background or closes, all working memory slots (including session goals, calibration tiers, skill flags) are lost.

---

## Summary of All Gaps Found

### Scenario Depth (6 gaps)
1. TBLT pretask/task templates are defined but never injected
2. No scenario phase tracking exists
3. No pretask message on scenario start
4. `scenarioOpener` only fires on first-ever message, not first scenario message
5. `detectScenario()` keyword matcher fights with manual scenario selection
6. No scenario arc definition or turn-based phase progression

### Scenario-Avatar Coherence (1 gap)
7. No Coach-on-the-Side prompt — avatar has no guidance on whether to role-play or coach

### UI Flow (5 gaps)
8. First message for template characters is hardcoded English
9. Scenario state not cleared on character switch
10. Scenario state not persisted across app sessions
11. `ProactiveEngine.markScenarioCompleted()` never called (dead code)
12. Debrief clears all context — short scenarios may get no episodic memory

### Memory Persistence (4 gaps)
13. Memory stores are global, not per-character (phrases, episodes, profile mix across companions)
14. `completedScenarios` never tracked (learning stage computation always uses 0)
15. Working memory never serialized/restored on app lifecycle events
16. Episodic summaries are raw text slices, not LLM-generated (noisy, low signal)

### Priority Implementation Order

1. **Scenario phase tracker + TBLT injection** (Gaps 1, 2, 3, 4) — This is the core ask. Add `scenarioPhase` to chatStore, inject appropriate TBLT template per phase, auto-generate pretask message on scenario start.

2. **Coach-on-the-Side prompt** (Gap 7) — Add scenario role guidance to `buildScenarioLayer()` that switches between coach mode (survival/functional/conversational) and peer role-play (fluent).

3. **Scenario state persistence** (Gap 10) — Save `activeScenario`, `isScenarioActive`, `scenarioPhase` to IndexedDB alongside messages.

4. **Fix `scenarioOpener`** (Gap 4) — Track `isFirstScenarioMessage` separately from `isFirstEverMessage`.

5. **Remove `detectScenario()` interference** (Gap 5) — Skip auto-detection when `isScenarioActive` is true.

6. **Wire `ProactiveEngine.markScenarioCompleted()`** (Gap 11) — Call from `handleEndScenario()`.

7. **Clear scenario state on character switch** (Gap 9) — Add scenario state cleanup to `handleSelectCompanion()`.

8. **Per-character memory isolation** (Gap 13, 14) — Requires refactoring memory stores to accept a character ID scope. Major effort.
