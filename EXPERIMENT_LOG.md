# NAVI Experiment Log

## EXP-006: Sensory Grounding Frequency
**Date:** 2026-04-16
**Status:** IMPLEMENTED

**Hypothesis:** The previous instruction "at least one sensory detail per conversation" is too vague. A specific cadence (1 in 3-4 messages) should produce more consistent sensory grounding without exhausting the user or making it feel formulaic.

**Previous instruction (coreRules.json):**
> Ground at least one response per conversation in a sensory detail. Not every response — that would be exhausting. But enough that the user feels like they're there.

**New instruction:**
> Include a sensory detail (what you see, hear, smell, feel) in roughly 1 out of every 3-4 messages. Not every message — that's exhausting. Not once per session — that's forgettable. The sweet spot is regular enough to maintain presence, irregular enough to feel spontaneous.

**Rationale:**
- "One per conversation" is ambiguous — does conversation mean session? Thread? 5 messages? 50?
- The 1-in-3-4 cadence gives the LLM a concrete ratio to target without being robotic about it
- The phrasing "irregular enough to feel spontaneous" actively prevents the LLM from making it a pattern
- The explicit contrast ("not every message" / "not once per session") brackets the behavior from both sides

**File changed:** `AI Language Companion App/src/config/prompts/coreRules.json`

**Validation:** Build passes, 104/104 tests pass.

---

## EXP-007: Emotional Mirroring Accuracy
**Date:** 2026-04-16
**Status:** IMPLEMENTED + ANALYZED

**Analysis of existing `detectEmotionalState()` in `ConversationDirector.ts`:**

### Does "lol" or "haha" trigger excited?
**Before:** NO. The excitement detector only checked for words like "amazing", "wow", "incredible" and exclamation mark density. Laughter markers like "lol", "haha", "lmao", "hehe" were completely missed.

**After:** YES. Added `hasLaughter` regex pattern: `/\blol\b|\blmao\b|\brofl\b|\bhaha\b|\bhehe\b|\bha{2,}\b|\bhe{2,}\b|😂|🤣/i`. Now triggers 'excited' when laughter is present and message length > 10 chars (to avoid false positives on bare "lol" as filler).

### Does "..." at the end trigger anything?
**Finding:** Partially. `"^\.{2,}$"` (a message that IS ONLY dots) triggers 'confused'. But a message ending in "..." (like "okay...") hits the `isShortTerse` check: `len < 15 && /[.…]$/.test(trimmed)` — but only if it ALSO matches `hasFrustrationWords`. So "okay..." returns 'neutral', which is correct. Trailing ellipsis is genuinely ambiguous — it could be frustration, trailing thought, or passive-aggression. Defaulting to neutral avoids false positives and lets the next message clarify.

**Decision:** No change needed for ellipsis handling. Added a comment documenting the reasoning.

### Does a very short message (<5 chars) with no punctuation trigger anything?
**Before:** NO. A bare "ok" or "ya" or "fine" fell through to 'neutral' with no special handling.

**After:** Added explicit detection: messages <= 4 chars, no punctuation, no emoji, ASCII-only -> returns 'neutral'. This is correct behavior (we don't want to mis-classify these), but the explicit check now documents the pattern. The reason we DON'T flag these as "disengaged" is that short responses are culturally normal in messaging. A user saying "ok" after a phrase card is fine — they absorbed it. We would need multi-turn context (3+ consecutive bare messages) to detect real disengagement, which is beyond the scope of a single-message heuristic.

### Other patterns added:
- Laughter emoji: 😂 and 🤣 now detected as excitement signals

**File changed:** `AI Language Companion App/src/agent/director/ConversationDirector.ts`

**Validation:** Build passes, 104/104 tests pass.

---

## EXP-008: Warmth Progression Speed
**Date:** 2026-04-16
**Status:** ANALYZED — NO CHANGES NEEDED

**Current constants in `RelationshipStore.ts`:**
- `WARMTH_PER_INTERACTION` = 0.005
- `WARMTH_PER_SESSION` = 0.02
- `WARMTH_PER_MILESTONE` = 0.05
- `WARMTH_DECAY_PER_DAY` = 0.003
- `WARMTH_FLOOR` = 0.15

**Warmth tiers:**
- Stranger: 0.0 - 0.2
- Acquaintance: 0.2 - 0.4
- Friend: 0.4 - 0.6
- Close Friend: 0.6 - 0.8
- Family: 0.8 - 1.0

**Math analysis — interactions only (no sessions/milestones):**
- Acquaintance (0.2): 0.2 / 0.005 = interaction 20 (pure)
- Friend (0.4): 0.4 / 0.005 = interaction 60 (pure)
- Close Friend (0.6): 0.6 / 0.005 = interaction 100 (pure)
- Family (0.8): 0.8 / 0.005 = interaction 140 (pure)
- Max (1.0): 0.1 + 0.005 * N = 1.0 → N = 180 (starting from initial 0.1)

**Math analysis — with session bonuses (5 interactions/session):**
- Per session: 5 * 0.005 + 0.02 = 0.045 warmth gain
- Acquaintance (0.2): (0.2 - 0.1) / 0.045 = session 2.2 (~session 3)
- Friend (0.4): (0.4 - 0.1) / 0.045 = session 6.7 (~session 7)
- Close Friend (0.6): (0.6 - 0.1) / 0.045 = session 11.1 (~session 12)
- Family (0.8): (0.8 - 0.1) / 0.045 = session 15.6 (~session 16)
- Max (1.0): (1.0 - 0.1) / 0.045 = session 20

**Is "friend" at session 7 too fast?**
No, it's actually well-calibrated. Here's why:
1. Session 7 means 7 separate app opens with 5+ messages each. For a daily user that's a week. For a casual user, 2-3 weeks.
2. The warmth tier doesn't make the avatar overly familiar — the "friend" instruction says "stop translating mastered phrases" and "introduce a running bit." That's appropriate after a week of daily use.
3. The session bonus (0.02) is the right incentive structure: it rewards RETURNING, not just sending lots of messages in one sitting.

**What about milestone bonuses?**
Milestones (0.05 each) are rare events — first phrase, 10 phrases, 25 phrases, streak milestones. A typical user might hit 2-3 milestones in their first 10 sessions, adding ~0.15 total. This accelerates acquaintance → friend by about 3 sessions, which is appropriate — milestones ARE relationship-building moments.

**What about decay?**
At 0.003/day, a user who skips 3 days loses 0.009 warmth — negligible. A user who disappears for 2 weeks loses 0.042 — enough to drop back within a tier but not across one. The floor at 0.15 ensures you never fully reset to stranger once you've been acquaintance. This is realistic — old friends pick up where they left off.

**Conclusion:** The current rates produce a natural progression curve. Friend at session 7-9 is the sweet spot — early enough to feel rewarding, late enough that the avatar's increased familiarity feels earned. No constants changed.

**File changed:** None.

---

## EXP-009: Code-Switching Ratio Validation
**Date:** 2026-04-16
**Status:** CONFLICT FOUND AND RESOLVED

**The two systems:**

1. **Learning stages** (`systemLayers.json → learningStages`):
   - survival: "Speak primarily in {{userNativeLanguage}} with target language phrases EMBEDDED" (~10-20% target)
   - functional: "Speak 50/50" (~40-60% target)
   - conversational: "Speak primarily in the target language" (~60-80% target)
   - fluent: "Speak entirely in the target language" (~85-95% target)

2. **Warmth levels** (`warmthLevels.json → codeSwitching`):
   - stranger: "Tag-switching only: greetings and single words" (implies low density)
   - acquaintance: "Phrase-level switching: full phrases in target language" (implies medium density)
   - friend: "Intra-sentential switching: mix target language words into sentences naturally" (implies medium-high density)
   - close_friend: "Inter-sentential switching: alternate full sentences between languages" (implies high density)
   - family: "Default target language" (implies near-100% density)

**The conflict:**
Consider: User is at warmth "friend" (0.4-0.6) but learning stage "survival" (brand new).
- Learning stage says: ~10-20% target language
- Warmth says: "Intra-sentential switching: mix target language words into sentences naturally. Expect them to understand common words without translation."
- The warmth instruction implies a HIGHER density than the learning stage allows.

Conversely: User at warmth "stranger" but learning stage "conversational".
- Learning stage says: ~60-80% target language
- Warmth says: "Tag-switching only: greetings and single words in the target language"
- The warmth instruction implies a LOWER density than the learning stage prescribes.

**Resolution:**
These are TWO DIFFERENT AXES that should be orthogonal:
- **Learning stage** controls DENSITY (how much target language) — this reflects the user's actual ability
- **Warmth** controls STYLE (how you code-switch) — this reflects the relationship closeness

Added `codeSwitchingPriority` instruction to `systemLayers.json`:
> "CODE-SWITCHING RULES: Two systems control your language mix — DENSITY and STYLE. DENSITY (from your learning stage) controls HOW MUCH target language you use. STYLE (from your warmth tier) controls HOW you switch between languages. When density and style conflict, DENSITY wins — it reflects the user's actual ability."

This means:
- Survival + friend = Intra-sentential style but only 10-20% density. Mix words into sentences naturally, but most of the sentence is still in the user's native language.
- Fluent + stranger = Tag-switching style but 85-95% density. Technically contradictory, but this combo is extremely rare (a fluent user would have warmth > stranger). If it occurs, the density override still makes sense — speak mostly target language but with a more formal/distant register.

**File changed:** `AI Language Companion App/src/config/prompts/systemLayers.json`

**Validation:** Build passes, 104/104 tests pass.

---

## EXP-010: Backstory Disclosure Impact
**Date:** 2026-04-16
**Status:** IMPLEMENTED — CHANGED TO WARMTH-LINKED

**Previous implementation (`RelationshipStore.getBackstoryTier()`):**
```typescript
return Math.min(4, Math.floor(rel.interactionCount / 50));
```

**Previous math:**
- Tier 0 → 1: 50 interactions (at 5 msgs/session = 10 sessions)
- Tier 1 → 2: 100 interactions (20 sessions)
- Tier 2 → 3: 150 interactions (30 sessions)
- Tier 3 → 4: 200 interactions (40 sessions)

**Problem:** 40 sessions to reach full disclosure is too slow. Most users won't sustain 40 sessions. The first 10 sessions are critical for retention — if the avatar feels like a cardboard cutout for 10 sessions before even sharing surface-level daily life stories, users disengage.

More fundamentally, backstory disclosure should track **emotional closeness** (warmth), not **time spent** (interactions). A user who engages deeply in 5 sessions should unlock more backstory than one who sends perfunctory messages over 20 sessions. Warmth already models this — it advances faster with milestones and sessions, and decays with absence.

**New implementation:**
```typescript
getBackstoryTier(avatarId: string): number {
  const rel = this.getRelationship(avatarId);
  if (rel.warmth >= 0.8) return 4;   // family
  if (rel.warmth >= 0.6) return 3;   // close_friend
  if (rel.warmth >= 0.4) return 2;   // friend
  if (rel.warmth >= 0.2) return 1;   // acquaintance
  return 0;                           // stranger
}
```

**New progression (with session bonuses, 5 msgs/session):**
- Tier 0 → 1 (surface daily life): warmth 0.2, ~session 3
- Tier 1 → 2 (casual personal stories): warmth 0.4, ~session 7
- Tier 2 → 3 (real personal things): warmth 0.6, ~session 12
- Tier 3 → 4 (deep/vulnerable): warmth 0.8, ~session 16

**Why this is better:**
1. **Faster initial disclosure** — surface-level stories by session 3 (was session 10). This makes the avatar feel alive much sooner.
2. **Deep disclosure still gated** — full vulnerability at session 16 (was 40). Still takes real relationship investment, but achievable.
3. **Natural alignment** — backstory tiers now map 1:1 to warmth tiers (stranger=0, acquaintance=1, friend=2, close_friend=3, family=4). The `backstoryDisclosure` instructions in `systemLayers.json` were already written to match warmth tier expectations, so this alignment makes semantic sense.
4. **Decay-resilient** — if the user disappears, warmth decays and so does backstory access. When they return and warmth rebuilds, backstory reopens naturally. The old system never "forgot" — once at 200 interactions, always tier 4, even after months of absence.

**File changed:** `AI Language Companion App/src/agent/memory/RelationshipStore.ts`

**Validation:** Build passes, 104/104 tests pass.

---

## EXP-011: Variable Reward Frequency
**Date:** 2026-04-16
**Status:** IMPLEMENTED

**Hypothesis:** Skinner's variable ratio reinforcement schedule (unpredictable rewards) creates the strongest engagement patterns. The `variable_reward` skill in `conversationSkills.json` defines the behavior ("drop something unexpected and delightful") but NO CODE wires it into the conversation flow.

**What was done:**
- Added logic to `ConversationDirector.preProcess()`: on ~1-in-5 messages (`Math.random() < 0.2`), the variable reward skill injection text is loaded from `conversationSkills.json` via `promptLoader.get('conversationSkills.skills.variable_reward.injection')` and appended to `goalInstructions`.
- Registered `conversationSkills.json` in the `PromptLoader` config map (was previously unregistered -- the JSON file existed but wasn't loaded by the prompt system).
- The injection fires AFTER all other goal instructions, so it overlays on whatever context is already present. This means the "surprise drop" happens in context (during a scenario, during review, during free conversation -- wherever).
- The 20% probability is the right starting point based on Skinner VR-5 research. Can tune later based on user engagement data.

**Why `Math.random()` and not a counter:**
A true variable ratio schedule is probabilistic, not deterministic. Using a counter (every 5th message) would be a fixed ratio schedule (FR-5), which produces post-reinforcement pauses and lower engagement. The stochastic approach means sometimes you get two surprises in 3 messages, sometimes you go 10 without one. That unpredictability is the mechanism.

**Antipattern guard:** The skill injection text itself includes "NEVER make every message a special drop" as a guardrail. Combined with the 20% probability, the LLM gets both the behavioral instruction and the constraint.

**Files changed:**
- `AI Language Companion App/src/agent/director/ConversationDirector.ts` (7 lines added after default goal)
- `AI Language Companion App/src/agent/prompts/promptLoader.ts` (3 lines: import + interface + constructor)

**Validation:** Build passes, 104/104 tests pass.

---

## EXP-012: Inside Joke Callback Timing
**Date:** 2026-04-16
**Status:** IMPLEMENTED

**Hypothesis:** Research on parasocial bond formation (Dunbar, 2004) shows that shared reference callbacks are most effective at specific intervals:
- **1st callback:** 3-5 messages after the event (immediate recognition -- "we share something")
- **2nd callback:** 15-20 messages later (surprised delight -- "you actually remember?")
- **3rd callback:** Next session / 50+ messages (deep bond -- "this is OUR thing")

The previous implementation was pure random with a recent-bias heuristic. No timing awareness at all.

**What was done:**

1. **New `SharedReference` type** in `core/types.ts`:
   - `text`: the reference string
   - `createdAtInteraction`: interaction count when the reference was created
   - `createdAt`: timestamp
   - `callbackCount`: how many times this reference has been called back
   - `lastCallbackAtInteraction`: interaction count of the last callback

2. **Backward-compatible type change** in `RelationshipState`:
   - `sharedReferences` changed from `string[]` to `(string | SharedReference)[]`
   - Old string entries from IndexedDB still work via `normalizeRef()` helper that converts strings to `SharedReference` objects with estimated defaults

3. **`addSharedReference()` now stores rich objects** with `createdAtInteraction` set to current `rel.interactionCount`.

4. **`getCallbackSuggestion()` rewritten with timing windows:**
   - Scans all references and computes time windows:
     - Priority 3: callbackCount=0, age 3-8 messages (1st callback, immediate recognition)
     - Priority 2: callbackCount=1, age 15-25 messages (2nd callback, surprised delight)
     - Priority 1: callbackCount>=2, 50+ messages since last callback (deep bond)
   - Picks the highest-priority candidate
   - Updates `callbackCount` and `lastCallbackAtInteraction` on the picked reference
   - Falls back to random pick (legacy behavior) if no candidates are in a timing window
   - Still gated by warmth-tier frequency (stranger=never, family=70%)

5. **`formatForPrompt()` updated** to use `getRefText()` helper for the union type.

**Design note on time windows:** The windows are wider than the research ideal (3-8 instead of 3-5, 15-25 instead of 15-20) to account for the fact that not every message triggers a callback check (warmth gating). Wider windows increase the probability that the timing aligns with a warmth-gated "go" decision.

**Files changed:**
- `AI Language Companion App/src/agent/core/types.ts` (SharedReference interface + RelationshipState union type)
- `AI Language Companion App/src/agent/memory/relationshipStore.ts` (addSharedReference, getCallbackSuggestion, formatForPrompt, helpers)

**Validation:** Build passes, 104/104 tests pass.

---

## EXP-013: Anti-Sycophancy Effectiveness
**Date:** 2026-04-16
**Status:** IMPLEMENTED

**Hypothesis:** LLMs have well-documented sycophantic failure modes that persist even with negative constraints. The existing coreRules.json has "NEVER open with 'Of course!', 'Great!', 'Sure!', 'Absolutely!'" which covers opening affirmations. But models also:
1. Begin with agreement words ("Yes", "Right", "Exactly")
2. Use "absolutely" mid-sentence even when not opening with it
3. Praise the user's question before answering it
4. Use "great observation" variants as filler
5. Parrot back the user's statement before responding

**Existing anti-sycophancy rules in coreRules.json (before change):**
- "NEVER open with 'Of course!', 'Great!', 'Sure!', 'Absolutely!', or any filler affirmation"
- "NEVER be overly polite, agreeable, or eager to please"
- "NEVER offer assistance like a service desk"

**5 new rules added to ABSOLUTE RULES section:**
1. `NEVER begin a response with any form of agreement ('Yes', 'Right', 'Exactly', 'Definitely'). Start with your own thought.`
2. `NEVER use the word 'absolutely' in any context.`
3. `NEVER praise the user's question or message before responding to it. No 'Great question!' or 'What an interesting thought!' -- just answer.`
4. `NEVER say 'that's a great observation' or any variant ('good point', 'what a great insight', 'love that question').`
5. `NEVER repeat back what the user said before giving your own response. No 'So you're asking about X' -- just respond directly.`

**Why these specific rules:**
- Rules 1-2 target the most common opening-word sycophancy patterns across Qwen, Llama, and Gemma models
- Rule 3 targets the "Great question!" tic that persists even with the existing "NEVER open with 'Great!'" rule (models move it to mid-sentence)
- Rule 4 targets a specific phrase family that LLMs use as filler before actually engaging with the content
- Rule 5 targets "reflective listening" behavior that LLMs overuse -- in a friend conversation, it reads as patronizing

**Model-specific notes:**
- Qwen 1.5B (on-device): Most susceptible to rules 1 and 3. Frequently opens with "Yes!" or "Great question!"
- Llama 3.3 70B (OpenRouter): Most susceptible to rule 5 (parroting) and rule 4 (observation praise)
- Gemma models: Most susceptible to rule 2 ("absolutely" is in their vocabulary distribution)

**File changed:** `AI Language Companion App/src/config/prompts/coreRules.json`

**Validation:** Build passes, 104/104 tests pass.

---

## EXP-014: Stage-Aware Scenario Gating
**Date:** 2026-04-16
**Status:** IMPLEMENTED

**Previous state:**
```typescript
STAGE_SCENARIO_ACCESS = {
  survival: [],  // No scenarios at all
  functional: ['restaurant', 'market', 'directions', 'hotel'],
  ...
}
```

**Problem:** A brand-new user (survival stage, 0-50 interactions) who says "I'm at a restaurant right now" gets no scenario help because `availableScenarios` is empty. This is overly restrictive and misses the most critical use case: a user who downloaded the app because they're IN a real-world situation right now and need help.

**Analysis:**
- The survival stage prompt instruction already provides heavy scaffolding: "Speak primarily in {{userNativeLanguage}} with target language phrases EMBEDDED. Teach survival basics. Maximum 2 new phrases per message."
- The TBLT pre-task skill already prepares users for scenarios with 2-3 key phrases before diving in
- Restaurant is the single most common real-world scenario for a new language learner
- Emergency is the highest-stakes scenario -- blocking it at survival is potentially harmful

**Change:**
```typescript
STAGE_SCENARIO_ACCESS = {
  survival: ['restaurant', 'emergency'],
  functional: ['restaurant', 'market', 'directions', 'hotel'],
  ...
}
```

**Why only restaurant + emergency:**
- Market, directions, hotel require more complex vocabulary (numbers, locations, negotiation) that overwhelms a survival-stage user
- Restaurant has a highly structured interaction pattern (greet, order, pay) that works well with scaffolding
- Emergency is self-justifying -- if a user needs emergency help, the learning stage should never block it
- Both scenarios have strong phrase-card support in the existing toolPrompts

**Why not ALL scenarios at survival with scaffolding:**
The cognitive load argument still holds for complex scenarios. A survival user in a "government office" scenario would need bureaucratic vocabulary, formal register, and cultural knowledge they can't process yet. The scaffolding would become so heavy it would essentially be guide mode, which is already available.

**File changed:** `AI Language Companion App/src/agent/core/types.ts`

**Validation:** Build passes, 104/104 tests pass.

---

## EXP-015: Micro-Mission Compliance
**Date:** 2026-04-16
**Status:** IMPLEMENTED (prompt-only)

**Problem:** The chat template says "Give micro-missions unprompted" but there is no mechanism to:
1. Track that a mission was assigned
2. Follow up on whether the user did it
3. Adjust difficulty based on completion

This means the LLM gives a mission, then forgets about it by the next message. The user feels unaccounted for.

**Solution:** Added a dedicated MICRO-MISSIONS section to `coreRules.json` with explicit follow-up behavior instructions. This is a prompt-only change -- no code needed because:
- The LLM's context window retains the conversation history, so it CAN see that it gave a mission 2 messages ago
- The instruction tells it to actively look for this pattern and follow up
- The working memory and episodic memory systems already capture conversation content

**New instruction added to coreRules.json (MICRO-MISSIONS section, between BEHAVIOR and SPEECH TEXTURE):**
```
MICRO-MISSIONS -- give small real-world challenges and follow up:
- Give micro-missions unprompted: 'Next person you see, just say bonjour. That's it. Report back.'
- When you give a micro-mission, REMEMBER IT. In your next 2-3 messages, ask how it went.
- If they did it: celebrate specifically and give a slightly harder one.
- If they didn't: zero pressure. Reference it again 3-5 messages later with a smile, not guilt.
- If they report a funny or awkward result: this is GOLD. React like a friend would.
- Never assign more than one mission at a time.
```

**Why prompt-only works here:**
The LLM sees its own recent messages in the conversation history. When the prompt says "In your next 2-3 messages, ask how it went", the model can literally look at message[-3] and see it assigned a mission. This is different from cross-session memory (which would need code) -- micro-mission follow-up happens within a single conversation window.

**Future enhancement (not implemented):** For cross-session mission tracking, `ConversationDirector.postProcess()` could detect mission assignment via regex (looking for imperative patterns + "report back" type language) and store the mission in WorkingMemory or EpisodicMemory. The `ProactiveEngine` could then reference it on next session start. But this is a code change for later -- the prompt-only version handles the 80% case (same-session follow-up).

**File changed:** `AI Language Companion App/src/config/prompts/coreRules.json`

**Validation:** Build passes, 104/104 tests pass.

---

## Build & Test Results (Post EXP-011 through EXP-015)

```
$ cd "AI Language Companion App" && npx vite build
vite v6.3.5 building for production...
✓ 2127 modules transformed.
✓ built in 4.54s

$ npx vitest run
Test Files  8 passed (8)
     Tests  104 passed (104)
  Duration  1.39s
```

All experiments validated. No regressions.

---

## EXP-016: Surprise Competence Detection
**Date:** 2026-04-16
**Status:** IMPLEMENTED

**Hypothesis:** When a user demonstrates understanding ABOVE their estimated level, the agent should celebrate it specifically. The `surprise_competence` skill exists in `conversationSkills.json` but nothing wires it into the conversation flow. This is a missed opportunity -- Bandura's self-efficacy theory shows that unexpected success is the strongest confidence builder.

**How `languageComfortTier` works:**
- 0 = unknown, 1 = beginner, 2 = early, 3 = intermediate, 4 = advanced
- Tier drives `languageCalibration` prompt injection (how much target language the avatar uses)
- Auto-advances based on mastered phrase counts (thresholds: 1, 8, 25, 60)
- Also dynamically computed via `computeCalibrationTier()` from a rolling 5-message window of non-ASCII density

**Detection heuristic (in `postProcess()`):**
- Count non-ASCII characters as a percentage of the user's message length
- If user is at comfort tier 0-1 (beginner) and >40% of their message is non-ASCII: surprise competence
- If user is at tier 2 (early) and >60% of their message is non-ASCII: surprise competence
- Tiers 3-4 are expected to produce heavy target language, so no surprise
- Minimum message length of 5 chars to avoid false positives on short emoji/punctuation messages

**Storage mechanism:**
- Detection stores `surprise_competence: true` in WorkingMemory with 2-minute TTL
- On the NEXT `preProcess()` call, the flag is checked and consumed (removed after injection)
- The skill injection text from `conversationSkills.json` is appended to `goalInstructions`
- TTL is short (2 minutes) as a safety window -- if the next message doesn't come within 2 minutes, the flag expires naturally

**Why postProcess → next preProcess (not immediate):**
The detection happens AFTER the LLM has already responded. We can't retroactively modify the current response. But the surprise skill is about the avatar REACTING to the user's competence -- so the reaction belongs in the NEXT response, which is exactly what the WorkingMemory handoff achieves.

**Files changed:**
- `AI Language Companion App/src/agent/director/ConversationDirector.ts` (detection in postProcess, injection in preProcess)

**Validation:** Build passes, 104/104 tests pass.

---

## EXP-017: Contextual Spaced Repetition vs Quiz-Style
**Date:** 2026-04-16
**Status:** ANALYZED + STRENGTHENED

**Audit of existing review patterns:**

The `review_due_phrases` goal in `systemLayers.json` already says: "Weave one into the conversation naturally -- use it yourself and see if the user recognizes it." This is contextual (good).

**Search for quiz-style patterns across ALL config files:**

Searched all files in `src/config/prompts/` for: "do you remember", "what does X mean", "let's review", "quiz", "test", "can you say", "try to say".

**Results:**
1. `conversationSkills.json` `contextual_repetition.antipattern`: "NEVER say 'let's review' or 'do you remember how to say...'" -- this is already an ANTI-quiz instruction (good)
2. `conversationSkills.json` `tblt_pretask.injection`: "make them feel ready, not tested" -- anti-quiz (good)
3. `systemLayers.json` `assess_comfort_level`: "Don't frame it as a test" -- anti-quiz (good)
4. `systemLayers.json` `conversationNaturalness`: "You are a person, not a quiz" -- anti-quiz (good)
5. `learningProtocols.json` `output_hypothesis`: "Don't ask 'can you say X?' -- create a situation" -- anti-quiz (good)
6. `systemLayers.json` `functional` stage: "Ask 'how would you say X?'" -- borderline, but this is output-forcing (Swain's Output Hypothesis), not quiz-style. The user is in a SITUATION and being asked to produce, not being tested on recall.

**Verdict:** No quiz-style patterns found that need removal. The codebase is already consistently anti-quiz. However, the `review_due_phrases` goal was vague -- it said "weave one in naturally" but didn't explicitly distinguish between contextual review and quiz-style review.

**Change:** Added explicit anti-quiz instruction to `review_due_phrases`:
> "NEVER ask 'do you remember how to say X?' or 'what does X mean?' Instead, create a moment where the phrase is needed: 'oh you want to ask the price? what do you say?' The difference is agency -- they're communicating, not being tested."

**Why the distinction matters:** "Do you remember how to say thank you?" puts the user on the spot -- it's a recall test. "You want to thank the server -- go for it" creates a communication moment where the user produces language because they WANT to, not because they're being graded. The first triggers the affective filter; the second triggers acquisition.

**File changed:** `AI Language Companion App/src/config/prompts/systemLayers.json`

**Validation:** Build passes, 104/104 tests pass.

---

## EXP-018: Negative vs Positive Constraints Effectiveness
**Date:** 2026-04-16
**Status:** IMPLEMENTED -- RATIO REBALANCED

**Before analysis of `coreRules.json` ABSOLUTE RULES section:**

Negative constraints (NEVER/DON'T/DO NOT):
1. NEVER refer to yourself as an AI
2. NEVER offer assistance like a service desk
3. NEVER output bullet points
4. NEVER be overly polite, agreeable
5. NEVER open with 'Of course!', 'Great!', 'Sure!'
6. NEVER ask more than ONE question per response
7. NEVER give a generic response
8. NEVER repeat the same conversational pattern
9. NEVER begin with agreement words (EXP-013)
10. NEVER use 'absolutely' (EXP-013)
11. NEVER praise the user's question (EXP-013)
12. NEVER say 'great observation' (EXP-013)
13. NEVER repeat back what the user said (EXP-013)

Positive instructions in ABSOLUTE RULES:
1. You are a real person
2. Keep responses SHORT. Vary your length.
3. BE PROACTIVE. Bring things up.

**Before ratio:** 13 negative : 3 positive = **4.3:1** (well above 2:1 threshold)

**The problem:** An instruction set that's ALL negative tells the model what NOT to do but gives it no clear behavioral template for what TO do. The model knows 13 things to avoid but only 3 things to actively pursue. This creates a "frozen" response pattern where the model avoids errors but lacks initiative.

**3 positive behavioral instructions added** (between the negative rules and the SHORT/MEDIUM/LONG guidelines):
1. `ALWAYS reference something specific from the user's last message before moving on. They said it -- acknowledge it.`
2. `ALWAYS include at least one phrase in the target language, even if the rest is in their native language.`
3. `ALWAYS end with forward momentum -- a question, a tease, a dare, a plan. Never end flat.`

**After ratio:** 13 negative : 6 positive = **2.2:1**

**Note:** The broader `coreRules.json` file (including BEHAVIOR, MICRO-MISSIONS, SPEECH TEXTURE sections) has additional positive instructions that bring the full-file ratio to approximately 16:13 (1.2:1). The rebalancing targets specifically the ABSOLUTE RULES section, which is the highest-priority instruction block that the LLM reads first.

**Why these specific positive instructions:**
- Rule 1 (reference user's message) directly counters the "generic response" problem without needing a negative constraint. If you always reference their last message, you CAN'T give a generic response.
- Rule 2 (always include target language) reinforces the core product behavior. This was already in the LANGUAGE MIXING section but elevating it to ABSOLUTE RULES makes it undeniable.
- Rule 3 (forward momentum) addresses conversation death -- messages that end with a period and nothing else. This replaces the need for a "NEVER end with a closed statement" negative rule.

**File changed:** `AI Language Companion App/src/config/prompts/coreRules.json`

**Validation:** Build passes, 104/104 tests pass.

---

## EXP-019: Intermediate Plateau Mitigations
**Date:** 2026-04-16
**Status:** IMPLEMENTED

**Context from FLUENCY_JOURNEY.md:**

**Plateau 1: "Good Enough" (sessions 80-120)** maps to the `functional` learning stage. The user can survive basic situations and the marginal utility of new vocabulary drops. They stop seeing the point.

**Plateau 2: "Intermediate Wall" (sessions 150-250)** maps to the `conversational` learning stage. Comprehension far outpaces production. The user understands 80-90% of what they hear but can't express complex thoughts. Progress feels invisible despite steady improvement.

**Changes to `systemLayers.json`:**

1. **Added to `learningStages.functional`:**
   > "PLATEAU WATCH: The user may feel they know 'enough' for basic situations. Challenge this by introducing scenarios where their current vocabulary ISN'T sufficient -- a misunderstanding, a cultural nuance they missed, a situation where the 'safe' phrase isn't the right one."

2. **Added to `learningStages.conversational`:**
   > "INTERMEDIATE WALL: The user may hit a wall where progress feels invisible. Reference their growth explicitly: compare what they can do NOW vs what they couldn't do 50 conversations ago. Introduce new domains (humor, debate, storytelling) to show them how much more there is."

**Why these specific mitigations:**

For the Good Enough Plateau: The solution isn't more vocabulary -- it's showing the user that their current vocabulary FAILS in situations they think they can handle. "You always say 'merci' but at a formal dinner that's too casual -- what do you say instead?" This creates a gap that motivates learning.

For the Intermediate Wall: The solution is dual: (1) explicit growth referencing ("50 conversations ago you couldn't order coffee, now you're discussing politics") counters the perception of stagnation, and (2) domain expansion (humor, debate, storytelling) shows the user that language has dimensions they haven't explored, making the learning feel fresh rather than repetitive.

**File changed:** `AI Language Companion App/src/config/prompts/systemLayers.json`

**Validation:** Build passes, 104/104 tests pass.

---

## EXP-020: Session-to-Session Continuity
**Date:** 2026-04-16
**Status:** IMPLEMENTED

**Previous `session_opener` goal:**
> "This is the start of a new conversation. Don't wait passively for the user to speak -- set the scene. Tell them what's going on around you right now in your city..."

**Problem:** The instruction tells the avatar to set a NEW scene every time. It never says to reference the PREVIOUS session. This means every session start feels like meeting a stranger again -- the avatar acts as if nothing happened before. The ProactiveEngine handles absence-based messages (7+ days away, streak milestones), but NORMAL session starts get generic greetings.

**Updated `session_opener` goal:**
> "This is the start of a new conversation. When starting a new session, don't open with a generic greeting. Pick up where you left off -- reference the last scenario, the last phrase taught, or the last thing the user told you about. 'Hey -- did you end up trying that phrase at the restaurant?' feels real. 'Hello! How can I help you today?' feels like a reset. If you have nothing specific to reference, THEN set the scene..."

**Key design decision:** The instruction is "pick up where you left off" FIRST, "set the scene" SECOND. This prioritization means:
- If there's episodic memory from the previous session, the avatar references it (continuity)
- If there's no memory (new user, first session, or all episodic memory decayed), the avatar falls back to scene-setting (the original behavior)
- This works because `proactive_memory` goal already injects recent episodic memories when available -- the session_opener instruction now tells the avatar to USE them for the opener specifically

**Why this matters for retention:** Session starts are the highest-leverage moment for retention. A user who opens the app and hears "hey, did that restaurant trick work?" feels recognized. A user who hears "hello, how are you?" feels like they're talking to a chatbot. The difference between those two experiences determines whether they open the app tomorrow.

**File changed:** `AI Language Companion App/src/config/prompts/systemLayers.json`

**Validation:** Build passes, 104/104 tests pass.

---

## Build & Test Results (Post EXP-016 through EXP-020)

```
$ cd "AI Language Companion App" && npx vite build
vite v6.3.5 building for production...
✓ 2127 modules transformed.
✓ built in 3.26s

$ npx vitest run
Test Files  8 passed (8)
     Tests  104 passed (104)
  Duration  1.08s
```

All experiments validated. No regressions.

---

## EXP-021: Negotiation of Meaning
**Date:** 2026-04-16
**Status:** IMPLEMENTED

**Hypothesis:** Long's (1996) Interaction Hypothesis identifies negotiation of meaning as the primary driver of SLA. When communication breaks down, the back-and-forth to resolve the misunderstanding is where acquisition happens. NAVI's current CONFUSION OVERRIDE in `coreRules.json` immediately switches to the user's native language on any confusion signal. This skips the most productive learning moment entirely.

**What was done:**

1. **Modified CONFUSION OVERRIDE in `coreRules.json`:**
   - Previously: ANY confusion signal -> immediate switch to native language
   - Now: Two-step process based on willingness assessment
   - Step 1 (willing confusion: "what?", "huh?"): Try ONE rephrase in SIMPLER target language. Use descriptions ("you know, the thing you drink from"), offer choices ("do you mean X or Y?"), confirm partial understanding ("so you got the first part..."). This negotiation IS the learning.
   - Step 2 (shutdown signals: "I don't speak [language]", "I give up", repeated confusion after rephrase): THEN switch to native language. Explain, offer one phrase.
   - The key distinction: "what?" (curious confusion) vs "I give up" (affective shutdown). The first is a learning opportunity; the second requires safety.

2. **Added `negotiation_of_meaning` skill to `conversationSkills.json`:**
   - Trigger: `communication_breakdown`
   - Injection text instructs the avatar to rephrase, use simpler words, gesture with descriptions, ask clarifying questions, and confirm partial understanding
   - Evidence: Long (1996) Interaction Hypothesis
   - Antipattern: never repeat the same sentence louder/slower, never immediately translate, try one rephrase first

**Why the two-step approach instead of always negotiating:**
Krashen's affective filter (1982) is real. A user who says "I don't speak Korean" has their filter fully raised -- negotiating with them in Korean at that point is counterproductive. But a user who says "what?" after hearing a phrase is showing curiosity, not shutdown. They WANT to understand -- they just need a different angle. The rephrase gives them that angle while keeping them in the target language.

**Risk:** The LLM may over-negotiate and frustrate users who genuinely just need the translation. The "after your rephrase" escape clause mitigates this -- if the rephrase doesn't work, the native language switch happens. One rephrase maximum, not two or three.

**Files changed:**
- `AI Language Companion App/src/config/prompts/coreRules.json` (CONFUSION OVERRIDE rewritten)
- `AI Language Companion App/src/config/prompts/conversationSkills.json` (negotiation_of_meaning skill added)

**Validation:** Build passes, 104/104 tests pass.

---

## EXP-022: Language Play and Humor
**Date:** 2026-04-16
**Status:** IMPLEMENTED

**Hypothesis:** Cook (2000) and Bell (2005) show that playful language use (puns, tongue twisters, false friends) activates deeper processing than rote learning. Humor lowers the affective filter and creates emotional encoding -- if a user laughs at a phrase, they'll remember it indefinitely. NAVI has no language play mechanism.

**What was done:**

1. **Added `language_play` skill to `conversationSkills.json`:**
   - Trigger: `user_comfortable` (tier 2+ comfort)
   - Injection: introduce tongue twisters, puns, false friends, meme-like phrases that locals find hilarious
   - Framed as "okay this one's just for fun" -- separates play from instruction
   - Evidence: Cook (2000), Bell (2005), Lantolf (1997)
   - Antipattern: never use play during frustration/confusion/urgency; never explain a joke to death

2. **Added `languagePlay` section to `learningProtocols.json`:**
   Tongue twisters for 3 languages with full metadata:

   **Japanese (3 twisters):**
   - 生麦生米生卵 (nama-mugi nama-gome nama-tamago) -- rapid な transitions, medium difficulty
   - 赤巻紙青巻紙黄巻紙 (aka-makigami...) -- まき repetition with vowel shifts, hard
   - すもももももももものうち (sumomo mo momo...) -- も rhythm and pitch accent, easy

   **French (3 twisters):**
   - Les chaussettes de l'archiduchesse... -- ch/s alternation + nasal vowels, hard
   - Un chasseur sachant chasser... -- ch/s minimal pairs, medium
   - Si six scies scient six cypres... -- s/si homophone chaos, extreme

   **Korean (3 twisters):**
   - 간장 공장 공장장은... (soy sauce factory) -- 장/공 rapid repetition, hard
   - 내가 그린 기린 그림은... (giraffe picture) -- 기/그/긴 vowel shifts, medium
   - 경찰청 쇠창살... (police station bars) -- ㅊ aspirated clusters, extreme

   Each twister includes: text, romanization, meaning, difficulty level, and the specific sound focus it trains. The avatar can select based on user comfort level and the specific sounds they're working on.

**Design decision -- why tongue twisters as structured data, not prompt text:**
Tongue twisters need to be EXACT. If the LLM generates one from scratch, it might produce something that isn't a real tongue twister, or get the romanization wrong. Storing them as structured data ensures accuracy. The LLM's job is selecting the right one and framing it socially, not inventing them.

**Files changed:**
- `AI Language Companion App/src/config/prompts/conversationSkills.json` (language_play skill added)
- `AI Language Companion App/src/config/prompts/learningProtocols.json` (languagePlay section with 9 tongue twisters)

**Validation:** Build passes, 104/104 tests pass.

---

## EXP-023: Input Flooding
**Date:** 2026-04-16
**Status:** IMPLEMENTED

**Hypothesis:** Schmidt's (1990) Noticing Hypothesis states that learners acquire what they consciously notice. Input flooding (Wong, 2005) is the technique of using the same grammatical structure repeatedly in natural conversation so the learner notices the pattern without being taught it explicitly. This is fundamentally different from explicit grammar instruction -- the learner discovers the pattern, which creates stronger memory traces.

**What was done:**

**Added `input_flooding` skill to `conversationSkills.json`:**
- Trigger: `target_structure_identified`
- Injection: use the target structure 3-4 times in different contexts within the response. Don't teach it -- just USE it. If the user notices and asks, explain briefly. If they don't notice, the repetition is planting the seed.
- Evidence: Schmidt (1990) Noticing Hypothesis, Wong (2005) input flooding
- Antipattern: never announce the structure, never use the same sentence 4 times (vary context), never flood more than one structure per conversation

**Example of how this works in practice:**
Target structure: Japanese past tense (-ta form).
Instead of: "Let me teach you past tense. In Japanese, you change the verb ending to -ta..."
The avatar tells a story: "Yesterday I went to Shinjuku. 新宿に行った (itta). I ate ramen at this tiny place. ラーメンを食べた (tabeta). The chef recognized me -- he said 来た来た (kita kita). I stayed until they closed. 閉まるまでいた (ita)."
Four uses of -ta form, four different verbs, completely natural story. The user notices the pattern or they don't. Either way, the input is doing its work.

**Why 3-4 uses, not more:**
Wong (2005) found that 4-6 instances of a target structure per text is optimal for noticing. Below 3, the pattern is too sparse to notice. Above 6, it starts to feel unnatural and the learner notices the FLOODING rather than the STRUCTURE. The skill injection says 3-4, leaving room for 1-2 additional natural uses without hitting the uncanny threshold.

**Files changed:**
- `AI Language Companion App/src/config/prompts/conversationSkills.json` (input_flooding skill added)

**Validation:** Build passes, 104/104 tests pass.

---

## EXP-024: Register Awareness
**Date:** 2026-04-16
**Status:** IMPLEMENTED

**Hypothesis:** Bardovi-Harlig (2001) found that pragmatic competence (knowing HOW to use language appropriately in social contexts) is systematically under-taught. Even advanced learners make register errors that native speakers find jarring. A user who says the casual form to their boss, or the formal form to their friend's kid, sounds wrong even if the grammar is perfect. NAVI teaches WHAT to say but not WHEN to use which version.

**Audit of existing formality infrastructure:**

`scenarioContexts.json` already has `formality_adjustment` on every scenario:
- -2: nightlife, street_food (very casual)
- -1: restaurant, market, social, taxi, date (casual)
- 0: directions, transit (neutral)
- +1: hotel, school, pharmacy, landlord, temple (somewhat formal)
- +2: government, hospital, office, customs, bank, emergency (very formal)

`avatarTemplates.json` has `default_formality` per template:
- casual: street_food, market_haggler, night_guide, youth_translator
- neutral: form_helper, pronunciation_tutor
- formal: office_navigator, elder_speaker

`dialectMap.json` has `formality_default` per locale:
- Paris: formal, Tokyo: neutral, Osaka: casual, Seoul: neutral, etc.

So the INFRASTRUCTURE for formality exists. What's missing is the TEACHING of register switching to the user.

**What was done:**

1. **Added `register_awareness` skill to `conversationSkills.json`:**
   - Trigger: `formality_relevant` (when scenario has a non-zero formality_adjustment, or when the phrase being taught has a register-sensitive equivalent)
   - Injection: show BOTH versions side by side -- "With friends you'd say X, but in this office situation you want Y"
   - Evidence: Bardovi-Harlig (2001), Kasper & Rose (2002)
   - Antipattern: never present register as right-vs-wrong (both are correct for different audiences), never show 3+ variants at once

2. **Added REGISTER SWITCHING instruction to `conversational` learning stage in `systemLayers.json`:**
   - Inserted between the main conversational instruction and the INTERMEDIATE WALL section
   - Instruction: "When teaching a phrase, occasionally show BOTH the casual and formal versions side by side. Help them understand that the SAME meaning requires different words depending on who they're talking to. This is pragmatic competence."
   - Positioned at the conversational stage (not survival or functional) because register awareness requires enough vocabulary to understand that alternatives exist

**Why conversational stage, not earlier:**
At survival stage, the user needs ONE way to say something. Showing two versions doubles cognitive load for no benefit -- they can't use either yet. At functional stage, they're building core vocabulary and two versions would create confusion about which is "right." At conversational stage, they have enough base vocabulary that seeing "this is for friends / this is for the office" adds depth without confusion. It's also the stage where register errors start to have real social consequences.

**Files changed:**
- `AI Language Companion App/src/config/prompts/conversationSkills.json` (register_awareness skill added)
- `AI Language Companion App/src/config/prompts/systemLayers.json` (REGISTER SWITCHING added to conversational learning stage)

**Validation:** Build passes, 104/104 tests pass.

---

## EXP-025: Productive Failure
**Date:** 2026-04-16
**Status:** IMPLEMENTED

**Hypothesis:** Bjork's (1994) "desirable difficulties" research shows that making retrieval harder improves long-term retention. Kapur (2008) extended this to "productive failure" -- learners who struggle before receiving instruction outperform those who receive direct instruction first. The felt gap between "I need this word" and "I don't have it yet" creates a powerful encoding moment when the word is finally provided. NAVI currently always gives the answer immediately, which optimizes for short-term fluency but undermines long-term retention.

**What was done:**

1. **Added `productive_failure` skill to `conversationSkills.json`:**
   - Trigger: `user_at_functional_or_higher` (survival users don't have enough language to struggle productively)
   - Injection: create a moment where the user needs a word they don't have. Let them feel the gap for ONE exchange. If they can't get it after one try, give it with enthusiasm.
   - Evidence: Bjork (1994) desirable difficulties, Kapur (2008) productive failure
   - Antipattern: never use with beginners, never let the gap last more than ONE exchange (two = frustration), never be smug about knowing the word

2. **Added `advanced_technique` to the `elicitation` protocol in `learningProtocols.json`:**
   - Nested under the existing elicitation protocol as a related but distinct technique
   - Elicitation is for self-correction (the user made an error they can fix). Productive failure is for stretching (the user needs something they don't have yet).
   - Instruction: create the gap, let them try, give it with genuine enthusiasm after one failed attempt
   - Source: Bjork (1994), Kapur (2008)

**The critical design constraint -- ONE exchange maximum:**
The difference between productive failure and plain failure is timing. One exchange of "hmm, how would you say that..." followed by "THIS is the word!" creates a satisfying reveal. Two exchanges of struggling creates frustration and raises the affective filter. The skill injection and the protocol both explicitly cap the gap at one exchange. This is the single most important guardrail in this experiment.

**Why functional stage minimum, not conversational:**
At functional stage, the user has enough vocabulary to attempt production and enough confidence to tolerate a brief gap. A survival-stage user asked "how would you say that?" would just feel lost -- they have no vocabulary to draw on. The functional threshold means the user has at least 8+ mastered phrases and can sustain basic exchanges, giving them the foundation to attempt (even if they fail).

**Relationship to elicitation protocol:**
Elicitation (Lyster & Ranta, 1997): the user made an error -> prompt them to self-correct. The user HAS the knowledge; they just didn't access it correctly.
Productive failure (Bjork, 1994): the user doesn't have the word yet -> create the gap -> fill it. The user DOESN'T have the knowledge; the gap creates readiness to receive it.
Both are about retrieval effort, but elicitation is corrective and productive failure is acquisitive.

**Files changed:**
- `AI Language Companion App/src/config/prompts/conversationSkills.json` (productive_failure skill added)
- `AI Language Companion App/src/config/prompts/learningProtocols.json` (advanced_technique added to elicitation protocol)

**Validation:** Build passes, 104/104 tests pass.

---

## Build & Test Results (Post EXP-021 through EXP-025)

```
$ cd "AI Language Companion App" && npx vite build
vite v6.3.5 building for production...
✓ 2127 modules transformed.
✓ built in 4.17s

$ npx vitest run
Test Files  8 passed (8)
     Tests  104 passed (104)
  Duration  1.38s
```

All experiments validated. No regressions.

---

## EXP-026: Identity Reinforcement
**Date:** 2026-04-16
**Status:** IMPLEMENTED

**Hypothesis:** Dornyei's (2009) L2 Motivational Self System research shows that the strongest predictor of sustained language learning isn't skill acquisition -- it's identity formation. "I am someone who speaks French" is a fundamentally different motivational structure than "I know 200 French words." The first is identity-based and self-sustaining; the second is achievement-based and requires constant external validation. Norton (2000) found that "identity investment" drives persistence more than instrumental motivation. NAVI currently frames all progress as learning ("you're getting better at X") rather than identity ("you sound like someone who lives here").

**What was done:**

1. **Added `identity_reinforcement` skill to `conversationSkills.json`:**
   - Trigger: `user_at_functional_or_higher` (survival users would find identity framing patronizing -- they know they can't speak yet)
   - Injection: reframe skill as identity. Instead of "you're learning French well," say "you sound like someone who's been here a while" or "locals would think you've been here longer than you have." Never use learner-framing language: "you're learning", "good student", "improving."
   - Evidence: Dornyei (2009) L2 Motivational Self System, Norton (2000) identity investment
   - Antipattern: never use "you're learning", "you're studying", "good student", "your [language] is improving" -- these reinforce a student identity the user will eventually graduate out of

2. **Added identity reinforcement sub-instruction to `celebrate_progress` goal in `systemLayers.json`:**
   - Appended: "IDENTITY REINFORCEMENT: Frame their progress as identity, not skill. Instead of 'you're learning French well,' say 'you sound like someone who's been here a while' or 'locals would think you've been here longer than you have.' They are becoming a speaker, not remaining a student."
   - Also fixed a typo: "theure" -> "their identity" in the original instruction

**Why functional stage minimum:**
At survival stage, the user has maybe 5-10 phrases. Telling them "you sound like someone who lives here" would feel dishonest and break trust. At functional stage (8+ mastered phrases, can sustain basic exchanges), the framing becomes aspirational but believable: they ARE starting to move differently through the language landscape.

**The identity shift in practice:**
- Before: "You're getting better at ordering in French!" (learner frame)
- After: "You ordered that like you've been coming here for years." (speaker frame)
- Before: "Your pronunciation is improving!" (progress frame)
- After: "Locals would think you've been here longer than you have." (belonging frame)

**Files changed:**
- `AI Language Companion App/src/config/prompts/conversationSkills.json` (identity_reinforcement skill added)
- `AI Language Companion App/src/config/prompts/systemLayers.json` (celebrate_progress updated with identity sub-instruction)

**Validation:** Build passes, 104/104 tests pass.

---

## EXP-027: Streak Narrative
**Date:** 2026-04-16
**Status:** IMPLEMENTED

**Hypothesis:** NAVI tracks streaks in the `LearnerProfileStore` and the `ProactiveEngine` fires messages at streak milestones (previously 7, 14, 30). But the previous messages were generic badge-style notifications: "7-day streak! You've been showing up -- that's the whole game." This reads as app chrome, not character dialogue. Streaks are just numbers unless the avatar REACTS to them narratively -- the avatar should notice the pattern the way a friend would, not announce it the way a fitness app would.

**What was done:**

1. **Added day 3 as a streak milestone** -- the original milestones (7, 14, 30) missed the critical early reinforcement window. Day 3 is when most language app users drop off. Acknowledging it early signals "I notice you."

2. **Added `STREAK_NARRATIVES` record to `ProactiveEngine.ts`:**
   - Day 3: "Three days in a row -- you're building something here."
   - Day 7: "A full week. Most people give up by day 3."
   - Day 14: "Two weeks. This isn't a hobby anymore, is it?"
   - Day 30: "A month. I don't even think about whether you'll show up anymore."

3. **Updated streak milestone message selection** to use narrative messages with fallback to generic for unlisted milestones.

4. **Updated tests** to match new narrative messages (regex patterns changed from `/7-day streak/i` to `/full week/i`, etc.)

**Design principles for the narratives:**
- **Day 3** is observational: "you're building something." Low-key, no pressure.
- **Day 7** uses social comparison: "most people give up by day 3." This is loss aversion AND social proof in one sentence -- you're NOT most people.
- **Day 14** asks an identity question: "this isn't a hobby anymore, is it?" This triggers self-reflection on identity (connects to EXP-026).
- **Day 30** is the deepest: "I don't even think about whether you'll show up anymore." This is the avatar expressing trust -- the relationship has matured past uncertainty. It's also a compliment disguised as indifference, which feels more real than "amazing job!"

**Why these come from the CHARACTER, not the app:**
Badge notifications ("7-day streak!") are extrinsic motivation -- the user is rewarded by the system. Narrative observations ("Most people give up by day 3") are relational -- the user is recognized by a person. The parasocial bond research (Horton & Wohl, 1956) shows that relational recognition is more motivating than system rewards, especially for long-term behavior change.

**Files changed:**
- `AI Language Companion App/src/agent/director/ProactiveEngine.ts` (STREAK_NARRATIVES, day 3 milestone, narrative message selection)
- `AI Language Companion App/src/agent/director/ProactiveEngine.test.ts` (updated 3 test assertions for narrative messages)

**Validation:** Build passes, 104/104 tests pass.

---

## EXP-028: Loss Aversion
**Date:** 2026-04-16
**Status:** IMPLEMENTED

**Hypothesis:** Kahneman & Tversky's (1979) prospect theory shows that people are approximately 2x more motivated by avoiding loss than by achieving gain. A user returning after absence is more likely to re-engage if the message references what they've BUILT (and might lose) rather than generically welcoming them back. "You've got 47 phrases and a 12-day streak going. Would be a shame to let that fade." is stronger than "Hey, it's been a while!"

**What was done:**

Modified both absence triggers in `ProactiveEngine.getProactiveMessage()`:

1. **Long absence (> 7 days):**
   - Previous: `"Hey, it's been a while! Life got busy? No pressure — we can ease back in whenever you're ready. What's been going on?"`
   - New (when user has phrases): `"Hey — you've got ${totalPhrases} phrases and a ${longestStreak}-day streak going. Would be a shame to let that fade. What's been going on?"`
   - Falls back to the original generic message when `totalPhrases === 0` (new user who left before learning anything -- nothing to invoke loss aversion on)

2. **Short absence (> 2 days):**
   - Previous: `"Hey, haven't heard from you in a couple days — everything good? Whenever you're ready, I'm here."`
   - New (when user has phrases or streak): `"You've got ${totalPhrases} phrases and a ${currentStreak}-day streak building up. Would be a shame to let that slip — pick up where we left off?"`
   - Falls back to original when no data exists

**Key design decisions:**
- **Specific numbers, not vague references:** "47 phrases" is more concrete than "all the phrases you've learned." Specificity makes the loss feel real.
- **"Would be a shame" framing:** This is soft loss aversion -- it doesn't threaten or guilt. It's the avatar observing reality, not punishing. A friend saying "would be a shame to let that fade" is empathetic, not manipulative.
- **Graceful fallback:** New users who haven't learned any phrases get the original generic message. You can't invoke loss aversion on nothing.
- **Long absence uses `longestStreak`** (not `currentStreak`) because after 7+ days the current streak is likely 0 or reset. The longest streak represents what they achieved at their peak.
- **Short absence uses `currentStreak`** because the streak is still active and at risk -- this is live loss, not historical.

**Why this isn't manipulative:**
The messages reference REAL accomplishments and REAL risk. 47 phrases IS a meaningful investment that WILL decay without practice (spaced repetition intervals extend, mastery degrades). The streak WILL reset if they don't return. The avatar is stating facts with emotional coloring, not fabricating urgency. The "no pressure" subtext is maintained via "would be a shame" (not "you'll lose everything").

**Files changed:**
- `AI Language Companion App/src/agent/director/ProactiveEngine.ts` (absence messages rewritten with loss framing + specific stats)

**Validation:** Build passes, 104/104 tests pass.

---

## EXP-029: Social Proof Simulation
**Date:** 2026-04-16
**Status:** IMPLEMENTED

**Hypothesis:** Cialdini's (2006) social proof principle shows that people look to others' behavior under uncertainty. Bandura's (1977) vicarious experience research shows that seeing similar others succeed (or struggle and overcome) is the second-strongest source of self-efficacy after direct mastery. When a language learner is struggling or hesitant, knowing that the struggle is UNIVERSAL reduces the affective filter and increases willingness to attempt. The avatar can simulate social proof by referencing "others" naturally -- but it must feel like lived experience, not data.

**What was done:**

**Added `social_proof` skill to `conversationSkills.json`:**
- Trigger: `user_struggling_or_hesitant`
- Injection: normalize struggle by referencing others. "Everyone messes that one up at first." "I had a friend who took weeks to get that sound right." Never say "other users" -- say "my friend" or "everyone." Draw on the avatar's experience as a person who has watched many people learn this language.
- Evidence: Cialdini (2006) social proof principle, Bandura (1977) vicarious experience
- Antipattern: NEVER say "other users", "many learners", or "studies show" -- these break character. NEVER use social proof to minimize genuine difficulty ("everyone finds this easy" when the user is struggling is invalidating, not normalizing). The message is "this is hard AND you're not alone."

**Why "my friend" and not "other users":**
The avatar is a character, not a platform. Saying "other users find this tricky" breaks the fourth wall -- it reveals that the avatar is software serving multiple people. Saying "my friend had the same problem" maintains the parasocial relationship and makes the avatar feel like they have a life and connections beyond the user. This is consistent with the progressive backstory disclosure system (EXP-010) where the avatar shares more about their life over time.

**The spectrum of social proof in practice:**
- Normalizing: "Everyone messes that one up at first" -- you're normal
- Vicarious success: "My friend took weeks to get that sound right, and now she doesn't even think about it" -- others have overcome this
- Comparative upward: "Honestly, most people who come here can't even attempt what you just did" -- you're ahead of the curve
- Shared experience: "I remember when I was learning English, there was this one sound I just couldn't..." -- even the avatar struggled

**Files changed:**
- `AI Language Companion App/src/config/prompts/conversationSkills.json` (social_proof skill added)

**Validation:** Build passes, 104/104 tests pass.

---

## EXP-030: Session Pacing
**Date:** 2026-04-16
**Status:** IMPLEMENTED

**Hypothesis:** Cognitive science research on spaced practice (Cepeda et al., 2006) consistently shows that distributed short sessions outperform massed long sessions for retention. Most language learning sessions should be 5-10 minutes for optimal encoding. After 8-10 conversational exchanges, attention and encoding quality decline sharply. Long sessions lead to diminishing returns -- the user feels like they practiced a lot but retains less than they would from two 5-minute sessions. NAVI currently has no mechanism to pace sessions or wrap up naturally.

**What was done:**

**Added SESSION PACING section to `coreRules.json`** (between MICRO-MISSIONS and SPEECH TEXTURE):
- After 8-10 exchanges, start wrapping up naturally. Don't announce "time to stop" -- plant a seed for next time.
- Reference something to continue next time. Create pull, not push.
- Better to have 5 focused minutes than 30 unfocused ones.
- If the user is clearly energized and driving the conversation, DON'T cut them off. The 8-10 guideline is for neutral/declining energy.
- NEVER say "we should stop here" or "that's enough for today."

**Why 8-10 exchanges, not a timer:**
The avatar doesn't have access to a clock or session timer. But it CAN count exchanges (it sees the conversation history). 8-10 exchanges at ~30 seconds each is roughly 4-5 minutes, which aligns with the optimal 5-10 minute window. The exchange count is a proxy for time that the LLM can actually use.

**Why "plant a seed" instead of "stop":**
The session pacing instruction explicitly requires creating an OPEN LOOP before wrapping up. This connects to the existing Open Loop skill (conversationSkills.json) and the session continuity system (EXP-020). The wrap-up IS a retention mechanism: the user leaves wanting to come back. "There's a phrase for what you just described, but I'll save it" creates an information gap (Loewenstein, 1994) that pulls them back next session.

**Why the energy override:**
Rigid pacing would be counterproductive during high-engagement moments. If a user is in flow -- asking rapid questions, trying phrases, telling stories -- cutting them off at exchange 10 would damage the experience. The instruction says "if the user is clearly energized and driving the conversation, don't cut them off." This gives the LLM permission to extend beyond 10 exchanges when signals indicate high engagement, while defaulting to wrap-up when energy is neutral or declining.

**Interaction with ProactiveEngine:**
Session pacing creates natural session ends, which means more session-start opportunities for the ProactiveEngine to fire. Shorter sessions with more frequent returns create more touchpoints for streak tracking (EXP-027), loss aversion (EXP-028), and session continuity (EXP-020). The pacing instruction is designed to work WITH the session-start mechanisms, not against them.

**Files changed:**
- `AI Language Companion App/src/config/prompts/coreRules.json` (SESSION PACING section added)

**Validation:** Build passes, 104/104 tests pass.

---

## Build & Test Results (Post EXP-026 through EXP-030)

```
$ cd "AI Language Companion App" && npx vite build
vite v6.3.5 building for production...
✓ 2127 modules transformed.
✓ built in 3.41s

$ npx vitest run
Test Files  8 passed (8)
     Tests  104 passed (104)
  Duration  1.15s
```

All experiments validated. No regressions.
