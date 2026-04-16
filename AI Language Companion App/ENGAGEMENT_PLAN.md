# NAVI Engagement Overhaul — Implementation Plan

**Created:** 2026-04-16
**Goal:** Make AI companions feel more human, emotionally engaging, and effective at teaching language using research-backed engagement techniques.

---

## Tier 1 — Config-Only Changes (JSON edits, no code)

These are highest-impact, lowest-risk. All changes are to prompt config files in `src/config/prompts/`.

### 1. coreRules.json
**What:** Add open loop instruction, recasting as default correction, response length variance, sensory grounding, proactivity requirement, negative constraints.
**Why:** The current rules are good but miss key engagement drivers: unresolved narrative threads (open loops) that pull users back, sensory scene-setting that makes conversations feel embodied, and explicit variance instructions that prevent robotic sameness.
**Token impact:** ~80 tokens added (trimmed from verbose existing rules to compensate).

### 2. warmthLevels.json
**What:** Add per-tier callback frequency, self-disclosure depth, imperfection allowances, inside joke injection rates.
**Why:** Current warmth tiers describe *tone* but not *behavior mechanics*. A "friend" tier should have measurably different callback frequency than a "stranger" tier. Imperfection allowances (typos, self-corrections, hedging) make the avatar feel human.
**Token impact:** ~60 tokens added per tier (only one tier active at a time).

### 3. systemLayers.json
**What:** Add emotional mirroring instruction, backstory disclosure tiers, code-switching patterns per comfort tier, TBLT cycle for scenarios.
**Why:** Emotional mirroring (matching the user's energy/mood) is the #1 predictor of conversational bond. Backstory disclosure gates create a sense of "getting to know" the avatar over time. TBLT (Task-Based Language Teaching) gives scenarios a research-backed pedagogical cycle.
**Token impact:** ~40 tokens (mirroring instruction compact; TBLT only active in scenario mode).

### 4. learningProtocols.json
**What:** Add recasting protocol, expansion protocol, elicitation protocol, contextual re-introduction protocol.
**Why:** Current protocols cover the basics but miss key SLA techniques: expansion (building on learner output), elicitation (prompting self-correction), and contextual re-introduction (re-surfacing terms in new contexts to build flexible knowledge).
**Token impact:** ~0 (protocols are selected per-turn, not all injected).

### 5. toolPrompts.json chat template
**What:** Rewrite to incorporate open loops, proactivity, sensory grounding, response variance.
**Why:** The chat template is the most-used prompt. It's already good but can be tightened with specific behavioral instructions for engagement techniques.
**Token impact:** Net neutral (rewrite, not addition).

---

## Tier 2 — Small Code + Config

### 6. ConversationDirector: Emotional State Detection
**What:** Add lightweight heuristic emotional state detection from user messages (message length, punctuation density, emoji presence, ALL CAPS, language mix ratio). Inject a one-line emotional calibration context into the system prompt.
**Why:** The avatar currently has no awareness of user emotional state beyond explicit confusion signals. A frustrated user writing short terse messages gets the same treatment as an excited user writing long ones.
**Files:** `conversationDirector.ts` (add `detectEmotionalState()` method + inject into `preProcess`)

### 7. RelationshipStore: Shared References Callback System
**What:** Add `getCallbackSuggestion()` method that returns a shared reference to weave into conversation, with frequency gated by warmth tier (stranger=never, acquaintance=rare, friend=sometimes, close_friend=often, family=naturally).
**Why:** Current `sharedReferences` array is written to but never proactively surfaced in conversation context.
**Files:** `relationshipStore.ts` (add method), `warmthLevels.json` (add `callbackFrequency` field)

### 8. ProactiveEngine: Enhanced Triggers
**What:** Add scenario-completion hooks, cultural event awareness, backstory disclosure gates.
**Why:** Current triggers are only absence-based. Missing: celebrating scenario completion, noting cultural events, and progressive self-disclosure.
**Files:** `ProactiveEngine.ts` (add new trigger methods)

### 9. Backstory Tier Tracking
**What:** Add `backstoryTier` counter (0-4) to RelationshipState. Increments every ~50 interactions. Controls how much personal history the avatar reveals.
**Why:** Progressive self-disclosure is a core bonding mechanism. The avatar should reveal more about itself over time, creating the sense of deepening friendship.
**Files:** `types.ts` (add field), `relationshipStore.ts` (increment logic), `warmthLevels.json` (per-tier disclosure instructions)

---

## Tier 3 — Architecture Enhancements (deferred)

### 10. TBLT Scenario Cycle
Pre-task (vocab preview) -> Task (immersive practice) -> Post-task (debrief + phrase extraction). Requires scenario state machine changes.

### 11. Surprise Competence Detection
Detect when user unexpectedly uses a phrase correctly without prompting. Trigger a genuine surprise/pride reaction. Requires pattern matching against known phrase inventory.

### 12. Variable Reward Scheduling
Randomize when the avatar gives extra praise, shares a personal story, or unlocks a cultural insight. Currently all rewards are deterministic.

---

## Implementation Order
1. Tier 1 items 1-5 (all JSON config edits)
2. Tier 2 items 6-9 (small code changes)
3. Build verification
4. Tier 3 deferred to future sprint
