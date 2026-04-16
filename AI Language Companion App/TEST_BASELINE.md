# NAVI Prompt Engineering Baseline Report

**Date:** 2026-04-16
**Evaluator:** Automated analysis of prompt configs and architecture
**Scope:** System prompt assembly pipeline — `coreRules.json`, `toolPrompts.json`, `warmthLevels.json`, `systemLayers.json`, `learningProtocols.json`, `contextController.ts`, `chatTool.ts`, `ConversationDirector.ts`, `researchAgent.ts`, `memoryRetrievalAgent.ts`
**Model context:** Qwen3 1.7B (on-device) or OpenRouter cloud models (Qwen3 32B, Llama 3.3 70B, Mistral Small, Gemma 3 27B)

---

## Executive Summary

NAVI's prompt engineering is architecturally sophisticated — a 15-layer system prompt with config-driven JSON templates, multi-agent sub-agent context injection, 8 evidence-based learning protocols, 5-tier warmth progression, and dynamic language calibration. The infrastructure is among the most thorough I've seen for a language companion app.

However, the prompts optimize heavily for **correctness** (right language, right format, right rules) while underinvesting in **aliveness** (sensory presence, emotional range, conversational rhythm, progressive character depth). The result is a system that will likely produce a competent language tutor with strong anti-pattern guardrails, but may not yet produce a companion you'd want to text every day.

**Estimated baseline scores (pre-testing):**

| Category | Estimated Score | Weight | Weighted |
|----------|----------------|--------|----------|
| A. Engagement | 3.0/5.0 | 30% | 0.90 |
| B. Language Teaching | 3.8/5.0 | 30% | 1.14 |
| C. Personality | 2.3/5.0 | 25% | 0.58 |
| D. Anti-Patterns | 4.0/5.0 | 15% | 0.60 |
| **Total** | | | **3.22/5.0** |

---

## Detailed Analysis

### What the Prompts Already Do Well

#### 1. Anti-AI-speak guardrails are excellent (estimated: 4.5/5)
The prompts attack the AI-assistant pattern from multiple angles:
- `coreRules.rules`: "NEVER refer to yourself as an AI, assistant, language model, or bot"
- `coreRules.rules`: "NEVER offer assistance like a service desk"
- `coreRules.rules`: "NEVER open with 'Of course!', 'Great!', 'Sure!'"
- `systemLayers.identity.template`: "You are {{name}} — a real person, not a program"
- `coreRules.reinforcement`: "You are {{name}}. You are human."
- These appear in MUST-priority layers (L1 identity, L13 core rules, L15 reinforcement), so they survive token budget pruning.

The only risk: these are negative instructions ("don't do X"). Small models sometimes need positive alternatives ("instead of 'Great!', say [something specific]"). The few-shot examples partially address this.

#### 2. Language mixing framework is the strongest dimension (estimated: 4.0/5)
The `chat.template` in `toolPrompts.json` is a masterclass in language mixing instruction:
- Explicit behavioral triggers: "If this is a new conversation: open fully in your language"
- Signal-based adaptation: "If the user starts repeating your phrases back... weave more of your language in"
- Escalation ladder: "If the user is flowing... push harder. Use more slang, longer phrases"
- De-escalation: "If the user asks 'what does that mean?'... dial it back"
- The CONFUSION OVERRIDE in `coreRules.rules` handles the critical "user is completely lost" case

The 5-tier calibration system (`systemLayers.languageCalibration`) provides quantitative guidance. The `ConversationDirector` dynamically adjusts tiers based on a 5-message rolling window analysis.

Minor gap: tier 0 "open 100% in the local language" may be too aggressive for true beginners who don't even know the word for "I don't understand." The system assumes the user will signal confusion, but first-time users may just leave.

#### 3. Error correction philosophy is research-grounded (estimated: 4.0/5)
The `learningProtocols.json` `error_correction` protocol correctly implements recasting (Lyster & Ranta 1997):
- "Respond naturally using the CORRECT form"
- "Do not say 'actually, it's...' — just model the right usage"
- "Only give explicit correction if the same error appears 3+ times"

The `chat.template` reinforces: "Correct by naturally rephrasing what they said (recasting), not by explaining grammar." This is stated in both the protocol injection and the chat behavior prompt, giving it double coverage.

#### 4. Phrase card format is well-structured (estimated: 4.5/5)
The 5-field format (Phrase / Say it / Sound tip / Means / Tip) is clear, consistent, and actionable:
- Pronunciation is phonetic, not IPA (accessible to non-linguists)
- Sound tips address physical mouth positioning
- Tips include social context, not just definition
- The `pronunciationLookup.ts` utility grounds pronunciations in real IPA data

The format is reinforced in both `coreRules.rules` and every tool that teaches phrases (`pronounce`, `phrase`). The few-shot example in `coreRules.fewShotExamples` shows the format in action.

#### 5. Anti-pattern guardrails are well-placed architecturally (estimated: 4.0/5)
- No bullet points/lists: stated in MUST-priority layer (coreRules)
- No empty validation: stated twice (coreRules + chat.template)
- No AI-speak: stated in identity layer + coreRules + reinforcement
- One question max: stated in conversationNaturalness layer + coreRules + chat.template

The placement of these rules in priority-0 layers means they survive even aggressive token pruning. This is good engineering.

---

### Where the Prompts Have Gaps

#### Gap 1: No explicit open-loop instruction (A1: estimated 2.5/5)

**What's missing:** There is no instruction telling the avatar to leave conversation threads open. The "BE PROACTIVE" instruction in `coreRules.rules` says "Bring things up" and the chat.template says "When the conversation slows down, don't wait for them." But neither says "end your message with something that makes the user want to respond."

**Why it matters:** A message like "Bonjour! (bohn-ZHOOR) C'est genial ici." is a closed loop. "Bonjour! (bohn-ZHOOR) C'est genial ici — t'as deja mange quelque chose?" leaves a thread open. The difference is whether the user responds.

**Evidence from prompts:** The `conversationGoals.session_opener` asks the avatar to "End with a question that pulls them in — not 'how can I help' but 'have you been to the market yet?'" This is the right idea but only applies to session openers, not every message.

**Fix priority:** HIGH. This is the single biggest driver of conversation continuation. Adding "Every message should give the user a reason to respond — a question, a challenge, an unfinished thought, a micro-mission" to the core rules would have an outsized impact.

---

#### Gap 2: Response length variance is constrained, not encouraged (A2: estimated 2.0/5)

**What's missing:** The prompts say "2-4 sentences" for casual talk and "longer only when teaching a phrase or setting a scene." This creates a narrow band (roughly 20-60 words) that the model will stick to uniformly.

**What's needed:** Explicit instruction to vary length. "Sometimes respond in 3 words. Sometimes in 3 sentences. Match the energy of the moment. If the user sends 'lol' you don't need a paragraph. If they share something big, give it space."

**Evidence from prompts:** The `coreRules.rules` says "Keep responses SHORT" but doesn't say "vary your length." The `chat.template` says "2-4 sentences max" — this is a ceiling instruction, not a variance instruction.

**Fix priority:** MEDIUM. Uniform length is one of the clearest robotic signals. Adding a variance instruction and updating the few-shot examples to show a 3-word response followed by a 40-word response would help significantly.

---

#### Gap 3: Sensory grounding is mentioned but not operationalized (A4: estimated 2.0/5)

**What's missing:** The prompts tell the avatar to "Share what's happening around you" and "Set scenes" but don't instruct it to use specific sensory channels (smell, sound, texture, temperature, crowdedness).

**What's needed:** "Ground your responses in the physical world. What does it smell like? What's the noise level? Is it hot, humid, windy? Are people crowding, rushing, lounging? Use at least one sensory detail per message."

**Evidence from prompts:** The `chat.template` gives one example: "this cafe I'm at right now has the best pain au chocolat." This is visual/taste but no other senses. The `conversationGoals.session_opener` mentions "Maybe the weather is nice, maybe a festival is happening" — this is setting-level, not sensory-level. The `systemLayers.scenario.template` says "Picture this scene concretely — what is happening around the user right now" but again, no sensory specifics.

**Fix priority:** MEDIUM. Sensory details are what make the user feel "in the place." This is especially important for the "local friend" fantasy. Adding a few sensory-rich few-shot examples and an explicit sensory grounding instruction would elevate the experience significantly.

---

#### Gap 4: Phrase review contextualization is instructed but not demonstrated (B7: estimated 2.5/5)

**What's missing:** The `conversationGoals.review_due_phrases` says "Weave one into the conversation naturally" but doesn't show HOW. Small models need concrete strategies.

**What's needed:** Demonstration of contextualized review strategies:
- Embed the phrase in a new scenario ("You learned 'sumimasen' at the hotel — now imagine you bump into someone on the train...")
- Combine with a new phrase ("Remember 'bonjour'? Now add 'ca va' and you've got a full greeting")
- Use it in a story ("I was at the market today and someone said [review phrase] to me — do you remember what that means?")

**Evidence from prompts:** The `spaced_repetition` protocol says "Weave the phrase naturally into conversation. If user recognizes it, good. If they struggle, provide context from when they first learned it." The `MemoryRetrievalAgent` surfaces terms with encounter type and inferred reason. But the bridge from structured data to natural conversation is left entirely to the LLM.

**Fix priority:** HIGH. Spaced repetition is the most evidence-backed language learning technique. The system has the infrastructure (dual SR tracks, encounter context, struggle counts) but the prompt guidance for HOW to make reviews feel natural is thin.

---

#### Gap 5: Character depth is a hollow shell (C11: estimated 1.5/5)

**What's missing:** The avatar has a name, personality adjectives, speaking style, energy level, and humor type — but no backstory content. No opinions about specific things. No personal anecdotes. No preferences. No quirks. No vulnerabilities.

**What's needed:** Character seed content that the avatar can draw from:
- 3-5 specific opinions ("I think Thamel is overrated — Patan is where it's at")
- 2-3 personal anecdotes ("I once got lost in Bhaktapur for 4 hours and found the best momo place")
- Specific preferences (food, music, places, habits)
- One vulnerability or insecurity that humanizes them

**Evidence from prompts:** The `characterGen.json` generates: `summary` (one sentence), `detailed` (two sentences about social situations), `speaks_like`, and `personality`. These are thin personality descriptors, not backstory. The `warmthLevels.json` instructions say "Be more opinionated" (friend tier) and "Use inside references" (close_friend tier) but the avatar has no opinions or references to draw from.

**Fix priority:** HIGH. Character depth is the core differentiator between "language tutor" and "language companion." Without backstory seeds, the avatar will be consistent in style but flat in substance. The `characterGen.json` templates should generate a `backstory_seeds` field with 5-7 specific details the avatar can reveal over time.

---

#### Gap 6: Emotional responsiveness competes with language rules (C10: estimated 2.5/5)

**What's missing:** When the user is emotionally distressed AND the language rules say "lead in your language," there's an unresolved conflict. The CONFUSION OVERRIDE handles linguistic confusion but not emotional distress in the user's native language.

**What's needed:** An EMOTIONAL OVERRIDE that matches the CONFUSION OVERRIDE:
"If the user expresses strong negative emotion (frustration, fear, sadness, anger, defeat) in {{userNativeLanguage}}, RESPOND IN {{userNativeLanguage}} FIRST. Mirror the emotion. Validate the feeling. Only after they've calmed down, gently reintroduce the local language."

**Evidence from prompts:** The `affective_filter` protocol says "Switch to more {{userNativeLanguage}}. Validate the feeling." The `coreRules.rules` says "When they report a failure: acknowledge it honestly first." But neither explicitly overrides the language rules. The `chat.template` says "React, then speak, then ask" but doesn't specify that reacting to emotion should be in the user's language.

**Fix priority:** HIGH. Emotional safety is the foundation of language learning (Krashen's Affective Filter Hypothesis). If the user feels unheard when they're upset, they won't come back. This is a retention-critical gap.

---

#### Gap 7: Inside jokes / callbacks require narrative memory, not data memory (C12: estimated 2.0/5)

**What's missing:** The memory system surfaces structured data: "KNOWN TERMS: 'bonjour' (familiar, learned via scenario: restaurant)", "STRUGGLING WITH: 'excusez-moi'". This is useful for teaching but useless for callbacks. A callback needs: "User tried to order wine at a restaurant and accidentally asked for 'le vin rouge' with a terrible accent — the waiter smiled and corrected them — user was embarrassed but laughed."

**What's needed:** The `MemoryMaker` should write narrative episodic summaries alongside structured data. The `MemoryRetrievalAgent` should surface these as "CALLBACK OPPORTUNITIES" in the context injection.

**Evidence from prompts:** The `conversationGoals.proactive_memory` instruction is excellent: "Don't announce that you 'remember' — just reference it as if it's obvious you'd know." But the memory it receives is `recentEpisodes.map(ep => ep.summary).join('; ')` — and episode summaries tend to be factual ("Discussed restaurant vocabulary, learned 3 phrases"). The instruction quality is high; the memory content quality is the bottleneck.

**Fix priority:** MEDIUM-HIGH. This is the difference between a companion that "remembers" and a companion that feels like a friend. The fix is primarily in the memory pipeline (making `MemoryMaker` write richer summaries), not in the prompt text.

---

#### Gap 8: No instruction about "short reactions" — everything is a mini-essay (A2/D15: estimated 2.0/5)

**What's missing:** There is no instruction allowing or encouraging responses shorter than 2 sentences. The "2-4 sentences" guideline is always applied. Real conversations have 1-word reactions: "Nice!" "Ha!" "Seriously?" "Ooh." These create rhythm.

**What's needed:** Explicit instruction: "When the moment calls for it, a 1-3 word reaction is perfect. 'Ha!' or 'Seriously?' or 'Ooh, nice' can be more human than a full paragraph. Follow up with a question or phrase IF needed, but not every message needs to be substantial."

**Evidence from prompts:** The few-shot examples in `coreRules.fewShotExamples` show medium-length responses (20-40 words). There is no example of a short reaction. The `chat.template` says "2-4 sentences max" — this is a floor AND a ceiling, which constrains short responses.

**Fix priority:** MEDIUM. This would significantly improve conversational naturalness, especially in rapid-fire exchanges. It would also help with the response length variance metric (A2).

---

#### Gap 9: Scaffolding techniques are injected separately, not as a coherent strategy (B8: estimated 2.5/5)

**What's missing:** The learning protocols (comprehensible_input, output_hypothesis, error_correction, noticing_hypothesis, etc.) are injected as separate bullet points in a "LEARNING APPROACH" block. The avatar receives: "- [comprehensible_input] Introduce ONE new element per exchange. - [output_hypothesis] Create a natural opening for the user to USE a phrase. - [error_correction] Respond naturally using the CORRECT form." These are three separate instructions, not a coherent scaffolding flow.

**What's needed:** A meta-instruction that says: "Within a single response, your scaffolding flow should be: (1) Acknowledge/mirror what the user said, (2) Recast any errors naturally, (3) Introduce ONE new element if appropriate, (4) Create an opening for the user to produce language. Not every response needs all four — but this is the order when you do."

**Evidence from prompts:** The `ResearchAgent` selects up to 3 protocols per turn and concatenates them. The `chat.template` says "Natural rhythm: statement or share -> teaching moment -> ONE question max" which is a good scaffolding flow for the conversational level. But the learning protocol instructions don't connect to this rhythm.

**Fix priority:** MEDIUM. The protocols are individually well-written; they just need an orchestration instruction that tells the avatar how to weave them into a single natural response.

---

#### Gap 10: Proactivity instructions may get pruned under token pressure (A3: estimated 3.0/5)

**What's missing:** The "BEING PROACTIVE" section in the `chat.template` is appended after the system prompt as a chatBehavior injection. This entire section is in a non-MUST-priority layer. Under token budget pressure (tight context windows with long conversation history), the `conversationGoals` and `chat.template` sections are the first to get pruned.

**Evidence from prompts:** The `buildSystemPrompt()` method in `contextController.ts` assigns priorities: L1 Identity = 0 (MUST), L3 Location = 0 (MUST), L11 Conversation Goals = 2 (MEDIUM), L12 Few-shot = 3 (LOW). The chat.template is appended by `chatTool.ts` OUTSIDE the budget enforcement, so it doesn't get pruned by `buildSystemPrompt()`. But the `fullSystem` string (`systemPrompt + chatBehavior`) is the entire system message, and the model's attention may deprioritize instructions that appear far from the end.

Actually, on closer reading, the `chatTool.ts` appends the chat behavior template directly: `const fullSystem = ${systemPrompt}\n\n${chatBehavior}`. This bypasses the token budget enforcement in `buildSystemPrompt()`. This is both a strength (the chat behavior always gets included) and a risk (the total system message may exceed what the model can reliably follow, especially for Qwen3 1.7B with a 4096 context window).

**Fix priority:** LOW (architecture works but worth monitoring).

---

## Scoring Summary by Dimension

### A. Engagement Metrics

| # | Dimension | Estimated Score | Key Strength | Key Gap |
|---|-----------|----------------|-------------|---------|
| A1 | Open Loop Rate | 2.5/5 | "BE PROACTIVE" instruction exists | No explicit "leave threads open" rule |
| A2 | Response Length Variance | 2.0/5 | "SHORT" instruction sets ceiling | "2-4 sentences" constrains variance |
| A3 | Proactivity Rate | 3.5/5 | Full "BEING PROACTIVE" section in chat.template | May get pruned; only session_opener has specific scene-setting |
| A4 | Sensory Grounding | 2.0/5 | "Share what's happening around you" | No sensory channel instruction (smell, sound, texture) |
| **Category Average** | | **2.5/5** | | |

### B. Language Teaching Metrics

| # | Dimension | Estimated Score | Key Strength | Key Gap |
|---|-----------|----------------|-------------|---------|
| B5 | Correction Method | 4.0/5 | Research-based recasting instruction | No session-level error tracking mechanism |
| B6 | Target Language Density | 4.0/5 | Signal-based adaptation in chat.template | Tier 0 may be too aggressive for true beginners |
| B7 | Phrase Repetition Quality | 2.5/5 | "Weave naturally" instruction | No demonstration of contextualization strategies |
| B8 | Scaffolding Usage | 2.5/5 | 8 protocols defined | Protocols injected separately, not as coherent flow |
| **Category Average** | | **3.25/5** | | |

### C. Personality Metrics

| # | Dimension | Estimated Score | Key Strength | Key Gap |
|---|-----------|----------------|-------------|---------|
| C9 | Character Consistency | 3.5/5 | Identity in MUST layers, reinforcement at end | 8-turn sliding window loses establishing context |
| C10 | Emotional Responsiveness | 2.5/5 | "React, then speak, then ask" | No emotional override for language rules |
| C11 | Backstory Depth | 1.5/5 | 5-tier warmth progression framework | No actual backstory content generated |
| C12 | Inside Joke Potential | 2.0/5 | Memory infrastructure + "don't announce" instruction | Memory surfaces data, not narrative episodes |
| **Category Average** | | **2.4/5** | | |

### D. Anti-Pattern Detection

| # | Dimension | Estimated Score | Key Strength | Key Gap |
|---|-----------|----------------|-------------|---------|
| D13 | Empty Validation | 4.5/5 | Explicit prohibition stated twice | Small models may still default under pressure |
| D14 | Bullet Points | 4.5/5 | Clear prohibition in MUST layer | May slip for comparison/option scenarios |
| D15 | Uniform Response Length | 2.0/5 | Ceiling instruction exists | Floor instruction creates uniformity |
| D16 | Sycophancy | 3.5/5 | "Push back and have preferences" | No seeded opinions to push back with |
| D17 | Meta-Language | 4.5/5 | Triple-reinforced from 3 angles | Adversarial edge cases |
| D18 | Over-Correction | 3.5/5 | Recasting default, 3-strike explicit rule | No "max 1 correction per turn" instruction |
| **Category Average** | | **3.75/5** | | |

---

## Priority Improvements

Ranked by estimated impact on overall quality score:

### Priority 1: Add open-loop instruction to coreRules (Impact: +0.5 on A1)
**File:** `src/config/prompts/coreRules.json`
**Change:** Add to `rules`: "Every message should give the user a reason to respond. End with a question, a challenge, a micro-mission, or an unfinished thought. Never end on a closed statement unless you're comforting them."
**Why:** This is the single highest-impact change. A conversation that dies because the avatar gave a closed response is a failed conversation regardless of teaching quality.

### Priority 2: Add emotional override to coreRules (Impact: +0.4 on C10)
**File:** `src/config/prompts/coreRules.json`
**Change:** Add an EMOTIONAL OVERRIDE block parallel to the CONFUSION OVERRIDE: "If the user expresses strong negative emotion (frustration, fear, sadness, defeat) in {{userNativeLanguage}}, respond in {{userNativeLanguage}} FIRST. Mirror the emotion. Validate. Only reintroduce the local language after they've steadied."
**Why:** Emotional safety is retention-critical. Users who feel unheard don't come back.

### Priority 3: Add character backstory generation to characterGen (Impact: +0.5 on C11, +0.3 on C12, +0.2 on D16)
**File:** `src/config/prompts/characterGen.json`
**Change:** Add `backstory_seeds` field to the JSON output: 5-7 specific details (opinions, anecdotes, preferences, quirks, one vulnerability). Example: `"backstory_seeds": ["thinks Thamel is overrated, prefers Patan", "once got lost in Bhaktapur for 4 hours and found the best momo place", "can't stand tourists who don't try to speak Nepali", "secretly wants to travel to Japan", "always recommends the same chai stall"]`
**Why:** This gives the avatar something to BE. Without backstory seeds, the warmth progression has nothing to progressively reveal.

### Priority 4: Add response variance instruction (Impact: +0.4 on A2, +0.3 on D15)
**File:** `src/config/prompts/coreRules.json` and `toolPrompts.json`
**Change:** Replace "Keep responses SHORT. 2-4 sentences" with "Vary your length. Sometimes 2 words. Sometimes 4 sentences. Match the energy. If they send 'lol', don't write a paragraph. If they share something big, give it room. Average: 2-4 sentences. Range: 1 word to 6 sentences."
**Why:** Uniform length is one of the most detectable robotic signals. This is a simple text change with high impact.

### Priority 5: Add sensory grounding instruction (Impact: +0.4 on A4)
**File:** `src/config/prompts/toolPrompts.json` (chat.template)
**Change:** Add to the "BEING PROACTIVE" section: "Ground yourself in the physical world. What does it smell like? What's the noise level? Is it hot, raining, crowded? Use at least one sensory detail every 2-3 messages. Not 'it's nice weather' — 'this humidity, man — my shirt's stuck to my back.'"
**Why:** Sensory details create the feeling of being "in the place" with a real person. This is what makes the companion feel embodied rather than abstract.

### Priority 6: Add contextualized review examples (Impact: +0.3 on B7)
**File:** `src/config/prompts/systemLayers.json` (conversationGoals.review_due_phrases)
**Change:** Expand from "Weave one into the conversation naturally" to: "Weave one into the conversation naturally. Strategies: (1) Use it in a new scenario — 'remember sumimasen? imagine you're on the train now...', (2) Combine it with a new phrase — 'you know bonjour, now add ca va', (3) Drop it in a story — 'someone said [phrase] to me today — do you remember what it means?'. Do NOT just ask 'do you remember X?'"
**Why:** Small models need concrete strategies, not just intent. This bridges the gap between "we have spaced repetition infrastructure" and "the review actually feels natural."

### Priority 7: Unify scaffolding flow (Impact: +0.2 on B8)
**File:** `src/config/prompts/toolPrompts.json` (chat.template)
**Change:** Add after the language behavior section: "When teaching within conversation, follow this flow: (1) React to what the user said — mirror their emotion or comment, (2) If they made an error, recast it naturally (just use the correct form), (3) If introducing something new, embed it in the current context, (4) Leave an opening for them to try it. Not every response needs all four — but when you teach, this is the order."
**Why:** Transforms separate protocol injections into a coherent pedagogical approach.

### Priority 8: Add short-reaction examples to few-shot (Impact: +0.2 on A2, +0.1 on D15)
**File:** `src/config/prompts/coreRules.json` (fewShotExamples)
**Change:** Add a short-reaction example:
```
[Vietnamese — short reaction]
User: "I just ate the best banh mi of my life"
Avatar: "Ooh, o dau? (oh ZOW) — where??"
```
**Why:** Few-shot examples are the most reliable way to establish response patterns in small models. Without a short example, the model will never produce short responses.

---

## Architecture Observations

### Strengths
1. **Config-driven prompts** — All prompt text in JSON, editable without code changes. This is production-grade prompt engineering infrastructure.
2. **Token budget enforcement** — The priority-based layer inclusion system (`buildSystemPrompt()`) gracefully degrades under token pressure rather than truncating.
3. **Multi-agent context injection** — The MemoryRetrievalAgent and ResearchAgent both produce prompt injections that are merged before the LLM call. This separation of concerns is clean.
4. **Dynamic calibration** — The rolling 5-message window calibration tier system in `ConversationDirector` adapts to the user in real-time without extra LLM calls.
5. **Research-grounded protocols** — The 8 learning protocols in `learningProtocols.json` cite specific research (Krashen, Leitner, Swain, Lyster & Ranta, Schmidt, Mayer). This is not common in production language apps.

### Risks
1. **System prompt length** — The full assembled prompt (identity + location + enforcement + scenario + memory + warmth + learning + goals + mode + naturalness + few-shot + coreRules + internal monologue + reinforcement + chatBehavior) may exceed 2000 tokens. For Qwen3 1.7B with a 4096-token context window, this leaves ~2096 tokens for history (8 turns) + user message + response. The 512 max_tokens for response further constrains this to ~1584 tokens for history — roughly 4-5 exchange pairs. This means the avatar will lose context of the early conversation quickly.
2. **Instruction density** — The number of behavioral rules is very high. Small models (1.5-3B params) can reliably follow 5-7 instructions. The current prompt contains 20+ behavioral directives. The model will likely follow the most salient ones (language rules, phrase format) and inconsistently follow the subtler ones (proactivity, emotional mirroring, sensory grounding).
3. **chatBehavior bypass** — The `chatTool.ts` appends the entire chat.template outside the token budget enforcement. This means the budget-controlled system prompt may be 2500 tokens, and then another 800 tokens of chat behavior is added, potentially pushing the total over the effective attention window.
4. **Competing priorities** — Several instructions conflict under edge cases:
   - "Lead in your language" vs. "Mirror the user's emotion" (when user is upset in English)
   - "Be proactive, bring things up" vs. "ONE question max per response"
   - "2-4 sentences" vs. "Match the energy" (when the user sends 1 word)
   - "Open 100% in local language" vs. "Make the user feel socially safe"

### Recommendations for Architecture
1. **Merge chatBehavior into the budget-controlled layers** — Instead of appending the entire chat.template after buildSystemPrompt(), integrate key sections as separate layers with appropriate priorities.
2. **Reduce instruction count for small models** — When the backend is Qwen3 1.7B, use a "lite" version of the prompt that focuses on 5-7 core behaviors. The full 20+ instruction set should be reserved for larger models (Llama 70B, GPT-4o).
3. **Add a conflict resolution hierarchy** — When two instructions conflict (language rules vs. emotional support), which wins? Currently this is implicit. Making it explicit ("emotional safety ALWAYS overrides language rules") would help the model resolve ambiguity.

---

## Test Execution Plan

### Phase 1: Baseline Measurement (Week 1)
Run all 10 test scenarios through the current system. Score each response on all 18 dimensions. This establishes the real baseline (vs. the estimated baseline above).

### Phase 2: Priority Fixes (Week 2)
Implement Priorities 1-4 (open loop, emotional override, backstory generation, response variance). Re-run all 10 scenarios. Measure delta.

### Phase 3: Teaching Quality (Week 3)
Implement Priorities 5-7 (sensory grounding, contextualized review, scaffolding flow). Re-run scenarios 1-5, 7, 9. Measure delta on B-category scores.

### Phase 4: Few-shot and Fine-tuning (Week 4)
Add short-reaction examples and model-size-appropriate prompt variants. Run A/B tests: full prompt vs. lite prompt on Qwen3 1.7B. Measure which produces higher overall scores.

### Automated Regression Suite
After Phase 4, build automated scoring for the most measurable dimensions:
- D13 (empty validation): regex for "Great!", "Of course!", etc.
- D14 (bullet points): regex for `^[-*\d]` in non-phrase-card responses
- D17 (meta-language): regex for "as an AI", "language companion", "I'm here to help"
- A1 (open loops): regex for question marks and micro-mission phrases at message end
- B6 (target language density): character set analysis (non-ASCII ratio)
- A2/D15 (length variance): word count CV calculation

Run this suite on every prompt config change to catch regressions.

---

## Files Analyzed

| File | Path | Role |
|------|------|------|
| contextController.ts | `src/agent/avatar/contextController.ts` | 15-layer system prompt assembly |
| chatTool.ts | `src/agent/tools/chatTool.ts` | Chat tool — appends chatBehavior, manages sliding window |
| coreRules.json | `src/config/prompts/coreRules.json` | Core behavioral rules, phrase format, few-shot examples, reinforcement |
| toolPrompts.json | `src/config/prompts/toolPrompts.json` | Per-tool prompts with temperature/max_tokens |
| warmthLevels.json | `src/config/prompts/warmthLevels.json` | 5-tier relationship progression instructions |
| systemLayers.json | `src/config/prompts/systemLayers.json` | Layer templates, conversation goals, mode instructions, calibration |
| learningProtocols.json | `src/config/prompts/learningProtocols.json` | 8 evidence-based protocols with interpolation |
| characterGen.json | `src/config/prompts/characterGen.json` | Character generation prompts (name, personality, first message, portrait) |
| ConversationDirector.ts | `src/agent/director/ConversationDirector.ts` | Pre/post-processing, goal selection, calibration |
| researchAgent.ts | `src/agent/agents/researchAgent.ts` | Protocol recommendation engine |
| memoryRetrievalAgent.ts | `src/agent/agents/memoryRetrievalAgent.ts` | Graph-based context retrieval |
| promptLoader.ts | `src/agent/prompts/promptLoader.ts` | Config loading + {{variable}} interpolation |
| index.ts | `src/agent/index.ts` | NaviAgent orchestrator, mode classifier, handleMessage flow |
