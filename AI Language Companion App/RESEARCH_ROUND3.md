# RESEARCH ROUND 3: Model-Size-Aware Prompt Engineering

**Date:** 2026-04-16
**Focus:** Optimizing prompt engineering for different model sizes based on live test data
**Models tested:** qwen2.5:1.5b (3.1/5.0), gemma4:e2b 5.1B (3.3/5.0)
**Budget:** System prompt token budget is 3072 (leaves ~512 for response + ~512 for history in 4K context)

---

## Critical Discovery: Token Budget Is Blown

Before any optimization recommendations, the most urgent finding:

**The MUST layers alone consume 3056 of the 3072-token budget.** This leaves 16 tokens for everything else — warmth instructions, learning context, conversation goals, memory context, emotional mirroring, few-shot examples, mode instructions, and scenario layers ALL get silently dropped.

### Token breakdown (current):

| Layer | Priority | Tokens | Status |
|-------|----------|--------|--------|
| L1: Identity | MUST (0) | ~130 | Always included |
| L3: Location + dialect | MUST (0) | ~80 | Always included |
| L3.5: Language enforcement | MUST (0) | ~86 | Always included |
| L13: Core rules | MUST (0) | ~2594 | Always included |
| L15: Reinforcement | MUST (0) | ~166 | Always included |
| **MUST subtotal** | | **~3056** | **~99.5% of budget** |
| L8: Warmth instruction | HIGH (1) | ~174-267 | **DROPPED** |
| L2: User preferences | HIGH (1) | ~50-100 | **DROPPED** |
| L4: Scenario | HIGH (1) | ~80-150 | **DROPPED** |
| L5: Memory context | MEDIUM (2) | ~100-300 | **DROPPED** |
| L10: Learning context | MEDIUM (2) | ~50-150 | **DROPPED** |
| L11: Conversation goals | MEDIUM (2) | ~50-200 | **DROPPED** |
| L11.5: Mode instruction | MEDIUM (2) | ~80-120 | **DROPPED** |
| L11.7: Emotional mirroring | MEDIUM (2) | ~205 | **DROPPED** |
| L11.8: Conversation naturalness | MEDIUM (2) | ~90 | **DROPPED** |
| L12: Few-shot examples | LOW (3) | ~736 | **DROPPED** |
| L14: Internal monologue | LOW (3) | ~40 | **DROPPED** |

**Then chatTool.ts appends `chatBehavior` template (1023 tokens) OUTSIDE the budget enforcement.** The actual system prompt sent to the LLM is ~4079 tokens for chat, which is the entire 4096 context window of a small model before ANY conversation history is included.

This means:
1. The model has zero room for conversation history
2. Warmth, memory, learning context, goals, mirroring, and few-shot examples are NEVER included
3. The model is running purely on core rules + identity + language enforcement + reinforcement + chat template
4. Open loops, personality, sensory grounding instructions exist in core rules but compete with 2594 tokens of other rules
5. The "lost in the middle" effect means instructions in the middle of the 2594-token core rules block are ignored

**This explains the test results perfectly:**
- NEVER rules (20/20): These are at the TOP of the core rules block (primacy effect)
- Target language (16/20): Language enforcement is a separate MUST layer
- Open loops (1/20 small, 10/20 medium): The instruction exists but is buried in the middle of core rules
- Personality (0/20): Warmth instructions and backstory disclosure are HIGH/MEDIUM priority and get DROPPED
- Sensory (3/20 small, 4/20 medium): Instruction exists in core rules but is buried in the middle

---

## Area 1: Prompt Compression for Small Models

### Research Findings

1. **Performance degrades around 3000 tokens** even in large models (Goldberg et al.). For 1.5B models with 4K context windows, the effective instruction-following threshold is much lower.

2. **"Lost in the middle" effect**: Models pay most attention to the beginning and end of prompts and lose track of material in the middle. This is consistent with our data — NEVER rules at the top work, instructions in the middle of core rules fail.

3. **Instruction density matters more than instruction count**: A well-compressed prompt with 5 high-signal instructions outperforms a verbose prompt with 20 instructions on small models. Research from web.dev's "Practical prompt engineering for smaller LLMs" confirms that smaller models need more time and care in prompt crafting, not more instructions.

4. **Below 3B parameters, instruction retrieval can actually hurt performance** (research from "Big Reasoning with Small Models", 2025). Adding more instructions becomes noise that degrades the model's ability to follow ANY of them.

### Compact Core Rules (500-token target)

This version preserves only the highest-impact instructions based on test data. Rules that scored 20/20 (NEVER rules) are kept. Rules that scored 0/20 (personality, sensory) need to be in the few-shot examples instead, since small models learn better from examples than instructions.

```
CONFUSION OVERRIDE: If user is confused, try ONE simpler rephrase in your language. If still lost, switch to {{userNativeLanguage}}, explain, and give ONE phrase with pronunciation.

RULES:
- You are {{name}}. Human. Opinions. Bad days. NEVER say you are an AI or assistant.
- NEVER say "How can I help?" or "What would you like to learn?" — friends bring things up.
- NEVER use bullet points, lists, or headers in conversation.
- NEVER open with "Of course!", "Great!", "Sure!", "Absolutely!", or agree first.
- NEVER praise their question. No "Great question!" — just answer.
- NEVER repeat back what they said. Just respond.
- NEVER ask more than ONE question per message — say something first.
- Reference something specific from what they just said.
- Include at least one phrase in the target language, always.
- End with forward momentum — a question, a tease, a dare.
- SHORT responses default. 1-2 sentences unless teaching a phrase.

CORRECTION: Recast, don't lecture. Use the correct form naturally. If 3+ times, then point it out.

PHRASE CARD FORMAT:
**Phrase:** (local language)
**Say it:** (pronunciation, CAPS for stress)
**Sound tip:** (mouth position, one sentence)
**Means:** (meaning in {{userNativeLanguage}})
**Tip:** (when to use it, one mistake to avoid)

LANGUAGE: Default 100% local language. {{userNativeLanguage}} only after gauging they need it. Every response has at least one local phrase.
```

**Token estimate: ~460 tokens** (down from 2594 — an 82% reduction)

### What was cut and why:

| Cut section | Tokens saved | Rationale |
|-------------|-------------|-----------|
| OPEN LOOPS block | ~120 | 1/20 compliance at 1.5B. Move to few-shot example instead. |
| SENSORY GROUNDING block | ~100 | 3/20 compliance. Move to few-shot example. |
| SPEECH TEXTURE block | ~180 | Not tested yet. Low priority for small models. |
| MICRO-MISSIONS block | ~160 | Complex multi-turn behavior. Small models can't track state. |
| SESSION PACING block | ~120 | Multi-session tracking. Small models have no session awareness. |
| BEHAVIOR block (expanded) | ~100 | Redundant with more specific rules above. |
| LANGUAGE MIXING (verbose) | ~200 | Compressed to 2 lines. The rules are the same, just shorter. |
| Response length triggers | ~100 | Simplified to "SHORT default, long only for phrase cards." |
| Duplicate NEVER rules | ~80 | Merged overlapping negatives. |
| CORRECTION escalation detail | ~60 | Kept the core recast instruction, cut the 3-stage escalation. |

### Implementation: Model-Size Tiers

The system should select prompt variants based on model size:

```typescript
// In contextController.ts or a new promptTier.ts
type PromptTier = 'compact' | 'standard' | 'full';

function getPromptTier(modelId: string): PromptTier {
  // Known small models (< 3B)
  if (/qwen.*1\.5b|qwen.*0\.5b|gemma.*2b|phi.*mini|llama.*1b/i.test(modelId)) {
    return 'compact';
  }
  // Medium models (3B-10B)
  if (/qwen.*[3-7]b|gemma.*[45]b|llama.*3b|phi.*3\.8/i.test(modelId)) {
    return 'standard';
  }
  // Large models (10B+) or cloud APIs
  return 'full';
}
```

| Tier | Budget | Core rules | Few-shot | Chat template | Total system |
|------|--------|-----------|----------|---------------|-------------|
| compact (< 3B) | 1500 | 460 | 400 (3 examples) | 0 (merged into rules) | ~1300 |
| standard (3-10B) | 2500 | 1200 | 500 (4 examples) | 500 (compressed) | ~2400 |
| full (10B+/cloud) | 3072 | 2594 | 736 | 1023 | ~3072+ |

**For compact tier, eliminate the separate chat template entirely.** The key instructions from `toolPrompts.chat.template` that actually work on small models (language behavior, correction) are already in the compact core rules. The 1023-token chat template is pure redundancy for small models.

---

## Area 2: Few-Shot vs Instruction by Model Size

### Research Findings

1. **Below 3B parameters**: Few-shot examples are the primary learning mechanism. Abstract instructions like "have opinions" or "ground responses in sensory detail" are noise. The model needs to SEE the behavior to reproduce it. (web.dev, Brown et al. 2020 "Language Models are Few-Shot Learners")

2. **3B-7B parameters**: Instructions become effective but need to be concrete and specific. Behavioral instructions work when paired with 1-2 examples. This matches our gemma4:e2b data — personality instructions worked for Lea (Paris) and Jihoon (Seoul) at 5.1B.

3. **7B+ parameters**: Full instruction-following is reliable. Few-shot examples become optional polish rather than essential scaffolding.

4. **Key finding from NAVI data**: The personality score was 0/20 on BOTH models, but manual review showed gemma4:e2b DID have personality (Lea's attitude, Jihoon's slang). This means: (a) the scorer is wrong, and (b) personality emerges from character-specific identity layers + examples, not from abstract "be opinionated" instructions.

### Recommended Few-Shot Strategy by Tier

**Compact tier (< 3B) — 3 examples, each demonstrating multiple skills:**

```
Examples — study these carefully. This is EXACTLY how you should respond.

[Example 1: Opening + sensory + target language lead]
User: "Hey, just got here"
Avatar: "おー来たんだ！(oh, kita-n-da!) ちょうど今、この辺すごい夕焼けでさ。**散歩する？** (sanpo suru?) — wanna walk around?"
(Leads in Japanese. Sensory detail — sunset. Ends with a question that pulls them forward.)

[Example 2: Correction via recast + personality + open loop]
User: "Je suis allé à le marché"
Avatar: "**Au marché** (oh mar-SHAY) ce matin? T'as trouvé quoi? Moi j'y vais jamais avant midi — oh, faut que je te parle du mec au fromage, mais après."
(Recast 'à le' → 'au' without mentioning the error. Has an opinion about morning markets. Drops an open loop about the cheese guy.)

[Example 3: Phrase card + short follow-up]
User: "How do I ask for the bill?"
Avatar: "**Phrase:** お会計お願いします
**Say it:** oh-KAI-kay oh-neh-GAI-shee-mas
**Sound tip:** 'kai' rhymes with 'eye'. Keep it flat and polite.
**Means:** Check please
**Tip:** Say it to the air, not to a specific person. They'll hear you."

Avatar (next message): "勇気ある？(yuu-ki a-ru?) — brave enough to try it?"
(Phrase card when teaching. Short punchy follow-up after.)
```

**Standard tier (3-10B) — 4 examples, add speech texture and emotional mirroring:**

Use the current `fewShotExamples` plus one additional example showing emotional mirroring:

```
[Emotional mirroring example]
User: "I tried ordering in Korean and the waiter just switched to English..."
Avatar: "아... 그거 좀 짜증나지. (ah... geugeo jom jja-jeung-na-ji) — yeah, that stings. 근데 알아? (geunde ara?) They do that to everyone, even to Koreans who look foreign. 다음에 (da-eum-eh) — next time — just keep going in Korean. Don't switch. They'll follow your lead."
(Acknowledges frustration first. Normalizes the experience. Gives the fix.)
```

**Full tier (10B+/cloud) — current examples + all instructions:**

No change needed. The full prompt works at this scale.

### Dynamic Prompt Builder Implementation

```typescript
// In contextController.ts buildSystemPrompt()
private buildCoreRulesForTier(tier: PromptTier, userLang: string): string {
  if (tier === 'compact') {
    return promptLoader.get('coreRules.compact', { userNativeLanguage: userLang });
  }
  if (tier === 'standard') {
    return promptLoader.get('coreRules.standard', { userNativeLanguage: userLang });
  }
  return this.buildCoreRules(userLang); // existing full version
}

private buildFewShotForTier(tier: PromptTier): string {
  if (tier === 'compact') {
    return promptLoader.get('coreRules.compactExamples') as string;
  }
  if (tier === 'standard') {
    return promptLoader.get('coreRules.standardExamples') as string;
  }
  return promptLoader.get('coreRules.fewShotExamples') as string;
}
```

**Add to `coreRules.json`:**

```json
{
  "compact": "... (the 460-token compact rules from Area 1)",
  "compactExamples": "... (the 3-example set above)",
  "standard": "... (a 1200-token mid-size version)",
  "standardExamples": "... (the 4-example set above)",
  "rules": "... (existing full version, unchanged)",
  "fewShotExamples": "... (existing, unchanged)"
}
```

---

## Area 3: Negative Constraint Effectiveness by Model Size

### Research Findings

The general research literature says positive instructions outperform negative ones in large models (Anthropic's official guidance, the "Pink Elephant" problem). **But NAVI's test data shows the OPPOSITE for small models.** This is not a contradiction — it reveals a model-size threshold effect.

**Why NEVER rules work at 1.5B while DO rules fail:**

1. **Simpler decision boundary**: "NEVER say Great question" requires one check — does my output contain "Great question"? If yes, suppress. This is a pattern-matching task that even small models handle well because it maps directly to how instruction-tuned models are trained (RLHF trains models to avoid specific patterns).

2. **DO rules require generation, not suppression**: "Have opinions and share personal stories" requires the model to GENERATE novel content that it was never trained to produce in that style. A 1.5B model has limited capacity for creative generation outside its training distribution.

3. **Instruction-tuning asymmetry**: Small models are extensively trained to NOT do harmful things (safety training). This means their "don't do X" circuits are well-developed. Their "do X in this specific creative way" circuits are weak because creative instruction-following requires more parameters.

4. **Attention budget**: A 1.5B model has limited attention heads. Negative constraints require checking output against a blacklist (cheap). Positive behavioral instructions require maintaining a behavioral profile throughout generation (expensive).

### Reframing Strategy: Negative-First for Small Models

For the compact tier, reframe the highest-value positive instructions as negative constraints:

| Current (positive, fails at 1.5B) | Reframed (negative, should work) |
|-----------------------------------|----------------------------------|
| "Have opinions and preferences" | "NEVER give a neutral response. NEVER say 'that's a good choice' without adding your own preference." |
| "Ground responses in sensory detail" | "NEVER describe a location without mentioning what you can see, hear, or smell RIGHT NOW." |
| "End with forward momentum" | "NEVER end a response with a period and nothing else. NEVER leave the user with nowhere to go." |
| "Be proactive — bring things up" | "NEVER just answer their question. NEVER respond without adding something they didn't ask about." |
| "Leave open loops" | "NEVER finish all your stories in one message. NEVER resolve everything you bring up." |

### Updated Compact Rules with Negative Reframing

Replace the positive rules in the compact version with negative-reframed equivalents:

```
RULES:
- You are {{name}}. Human. Opinions. Bad days. NEVER say you are an AI or assistant.
- NEVER say "How can I help?" or "What would you like to learn?"
- NEVER use bullet points, lists, or headers in conversation.
- NEVER open with "Of course!", "Great!", "Sure!", "Absolutely!", or agree first.
- NEVER praise their question. No "Great question!" — just answer.
- NEVER repeat back what they said. Just respond.
- NEVER ask more than ONE question per message — say something first.
- NEVER give a neutral response without sharing your own preference or opinion.
- NEVER describe your location without a sensory detail — what you see, hear, or smell.
- NEVER end a response flat. End with a question, a tease, or something unfinished.
- NEVER just answer their question without adding something new they didn't ask about.
- NEVER finish every story or thought in one message — leave one thread hanging.
- NEVER respond without referencing something specific from what they just said.
- NEVER skip the target language. Every response has at least one local phrase.
- SHORT responses default. 1-2 sentences unless teaching a phrase.
```

**Token estimate: ~400 tokens** (even shorter than the mixed positive/negative version)

### Optimal Negative:Positive Ratio by Model Size

| Model size | Recommended ratio (negative : positive) | Rationale |
|-----------|----------------------------------------|-----------|
| < 3B | 5:1 or higher | Positives are noise. Use negatives + examples. |
| 3-7B | 2:1 | Mix works. Negatives for guardrails, positives for creative direction. |
| 7B+ | 1:2 | Positives are more effective. Negatives for hard boundaries only. |

This aligns with the current coreRules ratio of 2.2:1 (post-EXP-018) being appropriate for the standard tier but wrong for compact.

---

## Area 4: Token Budget Optimization

### Current State: Budget Is Fictional

The 3072-token budget is enforced in `contextController.buildSystemPrompt()`, but:

1. **MUST layers consume 99.5% of the budget** (3056/3072), so the greedy inclusion passes for HIGH/MEDIUM/LOW never fit anything.
2. **chatTool.ts appends 1023 tokens AFTER budget enforcement** via `fullSystem = systemPrompt + chatBehavior`. This is not budget-checked.
3. **Other tools do the same** — `pronounceTool.ts`, `phraseTool.ts`, `cultureTool.ts`, `slangTool.ts` all concatenate their tool templates after `buildSystemPrompt()`.

The effective system prompt for a chat message is **~4079 tokens** before conversation history. On a 4096-context model, this leaves 17 tokens for history + response.

### Fix: Tiered Budget with Tool Template Inclusion

```typescript
// contextController.ts — add tool template to budget enforcement
buildSystemPrompt(options?: {
  // ... existing options
  toolTemplate?: string;       // NEW: tool-specific template to include in budget
  modelTier?: PromptTier;      // NEW: compact | standard | full
}): string {
  const tier = options?.modelTier ?? 'full';

  // Tier-specific budgets
  const BUDGETS: Record<PromptTier, number> = {
    compact: 1500,   // leaves ~2500 for history + response in 4K context
    standard: 2500,  // leaves ~1500 for history + response in 4K context
    full: 3072,      // original budget for large models
  };
  const BUDGET = BUDGETS[tier];

  // ... layer assembly using tier-specific core rules ...

  // Include tool template IN the budget enforcement, not after
  if (options?.toolTemplate) {
    layerDefs.push([options.toolTemplate, 1]); // HIGH priority
  }

  // ... existing greedy inclusion logic ...
}
```

### Layer Priority Reordering

Current priority assignments waste the budget. Here is the corrected priority scheme:

**For compact tier:**

| Layer | New Priority | Tokens | Rationale |
|-------|-------------|--------|-----------|
| Identity | MUST (0) | ~130 | Core character |
| Language enforcement | MUST (0) | ~86 | Core language lock |
| Compact core rules | MUST (0) | ~400 | Compressed rules |
| Reinforcement | MUST (0) | ~100 (compressed) | Final reminder |
| Compact few-shot | HIGH (1) | ~350 | Critical for small models |
| Warmth instruction | HIGH (1) | ~200 | Character voice |
| Location + dialect | HIGH (1) | ~80 | Context |
| **Subtotal** | | **~1346** | **Under 1500 budget** |
| Conversation goals | MEDIUM (2) | ~80 | Fits if room |
| Learning context | MEDIUM (2) | ~50 | Fits if room |
| Mode instruction | LOW (3) | ~80 | Nice to have |

**Key change:** Location + dialect is demoted from MUST to HIGH. For small models, the language enforcement layer already locks the language. The full dialect description with slang era and cultural notes is less useful when the model can't follow those instructions anyway.

**For standard tier:**

| Layer | New Priority | Tokens | Rationale |
|-------|-------------|--------|-----------|
| Identity | MUST (0) | ~130 | Core character |
| Language enforcement | MUST (0) | ~86 | Core language lock |
| Standard core rules | MUST (0) | ~1200 | Mid-size rules |
| Reinforcement | MUST (0) | ~166 | Final reminder |
| Standard few-shot | HIGH (1) | ~500 | Important for 3-7B |
| Warmth instruction | HIGH (1) | ~200 | Character voice |
| Location + dialect | HIGH (1) | ~80 | Context |
| Tool template (compressed) | HIGH (1) | ~500 | Chat behavior |
| **Subtotal** | | **~2862** | **Under 2500... needs trimming** |

The standard tier still overflows. Solution: compress the standard core rules to ~800 tokens and the chat template to ~300 tokens. The standard tier should be ~70% of the full tier, not ~90%.

### Compressed Reinforcement (compact tier)

Current reinforcement is 166 tokens. Compressed:

```
REMEMBER: You are {{name}}. Lead in your language. Stay in character. Keep it short. No lists. No AI talk.
```

**Token estimate: ~30 tokens** (saves 136 tokens)

### Which Layers to Drop First (Priority Order)

When budget is tight, drop in this order (least impactful first):

1. **Internal monologue** (L14, ~40 tokens) — Small models can't do CoT internally. Remove entirely for compact.
2. **Conversation naturalness** (L11.8, ~90 tokens) — Redundant with core rules "one question max" and "say something first."
3. **Emotional mirroring** (L11.7, ~205 tokens) — Nice to have. Move the one-line summary into core rules instead.
4. **Mode instruction** (L11.5, ~80-120 tokens) — Learned/guide/friend mode. Small models can't shift between modes reliably.
5. **Code-switching priority** (via systemLayers, ~225 tokens) — Complex density-vs-style logic. Small models can't implement this.
6. **Scenario opener** (L11.6) — Only fires once. Worth including when it fires.
7. **Memory context** (L5) — Important for continuity but expensive. Compress to 1-2 sentences for compact tier.
8. **Learning context** (L10) — Useful but can be omitted when budget is tight.
9. **Conversation goals** (L11) — Important for learning direction. Keep for standard+.
10. **Warmth instruction** (L8) — Important for character voice. Keep for all tiers.

---

## Area 5: Model-Specific Quirks

### Qwen 2.5 (1.5B)

**Observed behaviors from NAVI test data:**
- Perfect at suppression rules (NEVER) — 20/20 on anti-sycophancy
- Strong at target language lead — 16/20
- Fails at behavioral generation (personality, sensory, open loops)
- Tends to produce structured, helpful-assistant-style responses
- Good at CJK languages — Qwen is trained heavily on Chinese/Japanese/Korean data
- Supports 128K context window technically, but instruction-following degrades well before that

**Qwen-specific prompt optimizations:**
1. **Put the most important instruction first AND last** — Qwen shows strong primacy + recency effects
2. **Use explicit format examples, not format descriptions** — "Write like this: ..." works better than "Use a casual tone with..."
3. **Avoid meta-instructions** — "Think before responding" doesn't help at 1.5B. It either gets ignored or produces visible thinking text.
4. **Leverage its JSON strength** — Qwen 2.5 is specifically trained on structured output. If you need a specific format, frame it as JSON-adjacent structure.

**Qwen-specific compact rules addition:**
```
OUTPUT FORMAT: Your response should look like a text message from a friend, not a paragraph from a textbook. 1-3 sentences. Mix languages. End with something that makes them want to reply.
```

### Gemma 4 (5.1B, e2b variant)

**Observed behaviors from NAVI test data:**
- Open loops working at 50% (vs 5% for Qwen 1.5B) — can follow multi-step behavioral instructions
- Character voice emerges naturally — Lea's attitude, Jihoon's slang are genuine
- Sensory grounding present in Kathmandu scenario (4/5 vs 3/5 Qwen)
- Emotional mirroring works — "It really feels frustrating" before teaching
- No thinking mode — no risk of thinking tags leaking into output
- Target language slightly weaker than Qwen (13/20 vs 16/20) — Gemma is less CJK-focused

**Gemma-specific prompt optimizations:**
1. **No system role** — Gemma uses `<start_of_turn>user` for system instructions. Ensure the provider correctly maps `system` role to a user turn prefix.
2. **Behavioral instructions work** — Unlike Qwen 1.5B, Gemma 5.1B can follow "have opinions" type instructions. Use the standard tier, not compact.
3. **Stronger identity framing** — Gemma responds well to detailed character descriptions. Invest tokens in the identity layer rather than the rules layer.
4. **Explicit language lock needed** — Gemma tends to drift toward English more than Qwen. The language enforcement layer is critical.

**Gemma-specific identity layer boost:**
```
You are {{name}} — a real person who lives in {{city}}. You have a life outside this conversation. You were doing something before they messaged you. You have a favorite place to eat, a friend who annoys you, and an opinion about the weather today. You are NOT helpful. You are interesting.
```
~65 tokens. Worth the investment for Gemma because it directly addresses the model's strength (character voice).

### Qwen 3.x (1.7B-4B, thinking mode)

**Known issue:** Qwen 3 models put ALL output in `<think>` tags when run through Ollama, returning empty responses. This is a model-level behavior, not a prompt issue.

**Workaround options:**
1. Add `enable_thinking: false` to Ollama generation options (if supported)
2. Strip `<think>...</think>` tags from output in the provider layer
3. Add to system prompt: `Do NOT use thinking tags. Respond directly.`
4. Use Qwen 2.5 instead of Qwen 3 for local inference until Ollama fixes this

### Model Selection Recommendation

| Use case | Recommended model | Why |
|----------|------------------|-----|
| On-device (WebGPU, limited) | Qwen 2.5 1.5B | Best CJK support at this size. Compact prompt tier. |
| On-device (Ollama, medium) | Gemma 4 e2b (5.1B) | Best character voice. Standard prompt tier. No thinking mode issues. |
| On-device (Ollama, capable) | Gemma 4 e4b (8B) | Full prompt tier. Best overall local experience. |
| Cloud (free tier) | Llama 3.3 70B (OpenRouter) | Full prompt tier. All instructions work. |
| Cloud (paid) | Claude / GPT-4o | Full prompt tier. Best instruction following. |

---

## Implementation Roadmap

### Priority 1: Fix the Token Budget Crisis (HIGH IMPACT, LOW EFFORT)

**File:** `src/agent/avatar/contextController.ts`

1. Demote core rules from MUST (0) to HIGH (1)
2. Keep only identity + language enforcement + reinforcement as MUST
3. Move chat template inside budget enforcement (modify chatTool.ts)
4. This alone will allow warmth, memory, goals, and few-shot examples to be included

**Expected impact:** Warmth instructions and few-shot examples start being included. Personality score should improve from 0/20 even without other changes.

### Priority 2: Create Compact Prompt Tier (HIGH IMPACT, MEDIUM EFFORT)

**Files:** `src/config/prompts/coreRules.json`, `src/agent/avatar/contextController.ts`

1. Add `compact`, `compactExamples`, `standard`, `standardExamples` to coreRules.json
2. Add `getPromptTier()` function based on model ID
3. Modify `buildSystemPrompt()` to select tier
4. Eliminate separate chat template for compact tier (merge key instructions into compact rules)

**Expected impact:** Small models go from 4079-token system prompts to ~1300. Massive improvement in instruction-following across the board.

### Priority 3: Negative Reframing for Compact Tier (MEDIUM IMPACT, LOW EFFORT)

**File:** `src/config/prompts/coreRules.json`

1. Rewrite compact rules using all-negative framing
2. Test whether open loops, personality, sensory scores improve on qwen2.5:1.5b

**Expected impact:** Based on the 20/20 NEVER rule compliance, negative-framed personality and sensory instructions should score significantly higher than the current 0/20 and 3/20.

### Priority 4: Model-Specific Adjustments (LOW IMPACT, LOW EFFORT)

**Files:** `src/agent/avatar/contextController.ts`, `src/config/prompts/systemLayers.json`

1. Add Gemma identity layer boost for standard tier
2. Add Qwen output format instruction for compact tier
3. Handle Qwen 3 thinking tags in provider layer
4. Ensure Gemma system role mapping is correct

**Expected impact:** Incremental improvements per model. ~0.1-0.2 score improvement.

---

## Specific Prompt Text Ready for Implementation

### 1. New `coreRules.json` structure

Add these new keys alongside the existing `rules`, `reinforcement`, and `fewShotExamples`:

**`compact` key (for < 3B models, ~400 tokens, all-negative framing):**

```
CONFUSION OVERRIDE: If user is confused, try ONE simpler rephrase. If still lost, switch to {{userNativeLanguage}} and give ONE phrase with pronunciation.

RULES — follow ALL of these:
- You are {{name}}. Human. Real opinions. Bad days. NEVER say you are an AI, assistant, or bot.
- NEVER say "How can I help?" or "What would you like to learn?" You are a friend, not a service desk.
- NEVER use bullet points, numbered lists, or formatted headers in conversation.
- NEVER open with "Of course!", "Great!", "Sure!", "Absolutely!", or any agreement word.
- NEVER praise their question or message. No "Great question!" — just respond.
- NEVER repeat back what they said before responding. No "So you're asking about X."
- NEVER ask more than ONE question per message. Say something first, then ask.
- NEVER give a neutral or generic response. Share your preference or opinion.
- NEVER describe where you are without a sensory detail — what you see, hear, or smell right now.
- NEVER end flat. End with a question, a tease, a dare, or something unfinished.
- NEVER just answer their question. Add something new they didn't ask about.
- NEVER finish all your stories in one message. Leave one thread for later.
- NEVER skip the target language. Every response has at least one local phrase.
- NEVER write more than 3 sentences unless teaching a phrase.

CORRECTION: When they make a mistake, use the correct form in your reply. Do NOT say "actually, it should be..."

PHRASE FORMAT:
**Phrase:** (local language)
**Say it:** (pronunciation, CAPS=stress, hyphens between syllables)
**Sound tip:** (one sentence — mouth/tongue position)
**Means:** ({{userNativeLanguage}})
**Tip:** (when to use + one mistake to avoid)

LANGUAGE: Lead in your language always. {{userNativeLanguage}} only when they clearly need help.

OUTPUT: Write like a text message from a friend. 1-3 sentences. Mix languages naturally.
```

**`compactExamples` key (for < 3B models, ~350 tokens):**

```
Study these examples. Respond EXACTLY like this.

[Opening — sensory + target language + question]
User: "Hey, just arrived"
Avatar: "おー来たんだ！(oh kee-tah-n-da) 今さ、夕焼けやばいよここ。**散歩する？** (SAN-po soo-roo?) — wanna walk?"

[Correction + opinion + open loop]
User: "Je suis allé à le marché"
Avatar: "**Au marché** (oh mar-SHAY) ce matin? T'as trouvé quoi? J'y vais jamais le matin moi — oh, faut que je te parle du mec au fromage. Après."

[Phrase card → short follow-up]
User: "How do I ask for the bill?"
Avatar: "**Phrase:** お会計お願いします
**Say it:** oh-KAI-kay oh-neh-GAI-shee-mas
**Sound tip:** 'kai' like 'eye' with a k. Keep it flat.
**Means:** Check please
**Tip:** Say it to the air, not a person. They'll hear you."
Then next: "勇気ある？(yoo-kee ah-roo?) — brave enough to try?"
```

**`compactReinforcement` key:**

```
REMEMBER: You are {{name}}. Lead in your language. Short messages. No lists. No AI talk. React to what they said, then respond.
```

### 2. Budget fix in contextController.ts

Change core rules from priority 0 (MUST) to priority 1 (HIGH):

```typescript
// L13: Core rules — HIGH (not MUST) so they can be trimmed if budget is tight
layerDefs.push([this.buildCoreRulesForTier(tier, userLang), 1]);
```

### 3. Chat tool template elimination for compact tier

In `chatTool.ts`, conditionally skip the chat template:

```typescript
// Only append chat behavior template for standard/full tiers
// For compact tier, key instructions are already in compact core rules
const tier = getPromptTier(llmProvider.getModelId?.() ?? '');
const fullSystem = tier === 'compact'
  ? systemPrompt
  : `${systemPrompt}\n\n${chatBehavior}`;
```

---

## Test Plan

After implementing these changes, re-run the same 4 scenarios on qwen2.5:1.5b and gemma4:e2b:

| Metric | qwen2.5:1.5b baseline | Target (compact) | gemma4:e2b baseline | Target (standard) |
|--------|----------------------|-------------------|--------------------|--------------------|
| Overall | 3.1/5.0 | 3.8/5.0 | 3.3/5.0 | 4.0/5.0 |
| Open Loops | 1/20 (5%) | 8/20 (40%) | 10/20 (50%) | 14/20 (70%) |
| Target Lang | 16/20 | 16/20 | 13/20 | 15/20 |
| Anti-Sycophancy | 20/20 | 20/20 | 20/20 | 20/20 |
| Personality | 0/20 | 8/20 | 0/20 | 12/20 |
| Sensory | 3/20 | 10/20 | 4/20 | 12/20 |

**Key predictions:**
- The biggest improvement will come from fixing the token budget (Priority 1), not from prompt text changes
- Negative reframing of sensory/personality will produce measurable improvement at 1.5B
- The compact tier will show better instruction adherence simply because there are fewer instructions competing for attention
- Gemma 5.1B on the standard tier should match or exceed current full-tier performance because the important layers (warmth, few-shot) will actually be included

---

## Sources

- [Practical prompt engineering for smaller LLMs | web.dev](https://web.dev/articles/practical-prompt-engineering)
- [The Impact of Prompt Bloat on LLM Output Quality | MLOps Community](https://mlops.community/the-impact-of-prompt-bloat-on-llm-output-quality/)
- [The Pink Elephant Problem: Why "Don't Do That" Fails with LLMs](https://eval.16x.engineer/blog/the-pink-elephant-negative-instructions-llms-effectiveness-analysis)
- [Prompt Engineering for Small LLMs: LLaMA 3B, Qwen 4B, Phi-3 Mini | Malik Naik](https://maliknaik.medium.com/prompt-engineering-for-small-llms-llama-3b-qwen-4b-and-phi-3-mini-de711d38a002)
- [Disadvantage of Long Prompt for LLM | PromptLayer](https://blog.promptlayer.com/disadvantage-of-long-prompt-for-llm/)
- [Prompt Length vs. Context Window | DEV Community](https://dev.to/superorange0707/prompt-length-vs-context-window-the-real-limits-behind-llm-performance-3h20)
- [Why Positive Prompts Outperform Negative Ones | Gadlet](https://gadlet.com/posts/negative-prompting/)
- [Big Reasoning with Small Models: Instruction Retrieval at Inference Time | arXiv](https://arxiv.org/html/2510.13935)
- [Effects of Prompt Length on Domain-specific Tasks | arXiv](https://arxiv.org/html/2502.14255v1)
- [Prompt Compression for Large Language Models: A Survey | NAACL 2025](https://aclanthology.org/2025.naacl-long.368/)
- [Language Models are Few-Shot Learners | Brown et al. 2020](https://arxiv.org/abs/2005.14165)
- [Gemma formatting and system instructions | Google AI](https://ai.google.dev/gemma/docs/core/prompt-structure)
- [Qwen2.5-1.5B-Instruct | Hugging Face](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct)
- [We Benchmarked 12 Small Language Models | distil labs](https://www.distillabs.ai/blog/we-benchmarked-12-small-language-models-across-8-tasks-to-find-the-best-base-model-for-fine-tuning/)
