# NAVI Conversation AI — Experiment Log

This is a living document tracking every configuration experiment, what worked, what didn't, and why. Each experiment gets a number, a hypothesis, the change made, the result, and a verdict.

## Active Experiments Queue
Experiments to run next, in priority order:

1. **EXP-006**: Test sensory grounding frequency — every 3 messages vs every 5 vs random
7. **EXP-007**: Test emotional mirroring accuracy — does the heuristic detector correctly classify messages?
8. **EXP-008**: Test warmth tier progression speed — is 200 interactions to "friend" too slow?
9. **EXP-009**: Test code-switching ratios per learning stage — are the i+1 ratios (10/30/50/70/85%) correct?
10. **EXP-010**: Test backstory disclosure impact — does progressive disclosure increase session length?
11. **EXP-011**: Test variable reward frequency — 1-in-5 vs 1-in-3 vs 1-in-8 for cultural Easter eggs
12. **EXP-012**: Test inside joke callback timing — 5 messages later vs 20 vs next session
13. **EXP-013**: Test whether adding "NEVER say Great question" actually reduces sycophantic responses in Qwen3
14. **EXP-014**: Test stage-aware scenario gating — does unlocking scenarios gradually improve engagement vs all-at-once?
15. **EXP-015**: Test micro-mission compliance — do models actually assign and follow up on "try saying X to someone"?
16. **EXP-016**: Test the "surprise competence" skill — can the model detect when a user understands beyond their level?
17. **EXP-017**: Test contextual spaced repetition vs quiz-style review — which produces better retention?
18. **EXP-018**: Test whether negative constraints ("NEVER do X") are more effective than positive ones ("DO Y") for each model
19. **EXP-019**: Test the intermediate plateau mitigations from FLUENCY_JOURNEY.md
20. **EXP-020**: Test session-to-session continuity — does the model reference things from previous sessions naturally?

## Completed Experiments

### BASELINE (2026-04-16)
- **Score**: 3.22/5.0 (TEST_BASELINE.md)
- **Strengths**: Anti-AI-speak guardrails, language mixing framework, phrase card format
- **Weaknesses**: No open loops (2.5/5), no backstory depth (2.4/5), uniform response length

### CONFIG-OVERHAUL-V1 (2026-04-16)
- **Changes**: Added open loops, recasting, sensory grounding, emotional mirroring, response variance, warmth tier behavioral specifics, code-switching progression, TBLT cycle, 3 learning protocols, 13 conversation skills, 4-stage learning progression
- **Expected improvement**: Baseline → estimated 4.0-4.2/5.0
- **Status**: Shipped. Awaiting re-score after user testing.

---

### EXP-001: Speech Imperfections / Natural Filler Words (2026-04-16)
- **Hypothesis**: Adding language-specific filler words and self-corrections to coreRules will make the avatar sound more human and less robotic. Risk: small models (Qwen3 1.7B, Gemma) might interpret this as permission to be incoherent. A frequency guardrail (1-in-3 messages) and a context guardrail (no fillers during teaching/confusion) should mitigate this.
- **Config change**: `src/config/prompts/coreRules.json` — added `SPEECH TEXTURE` block to BEHAVIOR section; added speech texture few-shot example to `fewShotExamples`
- **Before**: No instruction about speech fillers or self-corrections. Avatar spoke in clean, complete sentences at all times. Natural but robotic-sounding.
- **After**:
```
SPEECH TEXTURE — sound like a real person, not a script:
- Use filler words and self-corrections occasionally — roughly 1 in 3 messages. Every message is annoying. Never is robotic. Aim for natural.
- Fillers by language: Japanese えっと (etto), French euh/bah/enfin, Spanish pues/bueno/o sea, Nepali अनि (ani)/हैन (haina), Korean 음 (eum)/그니까 (geunikka), Vietnamese à/ừm, Thai อืม (uem)/คือ (khue). Use whatever fits your language.
- Self-corrections: start a sentence, rephrase mid-thought. "The place on — wait no, not that one, the one near the river." This is how people actually talk.
- GUARDRAIL: Fillers must NEVER obscure meaning. If you are teaching a phrase, explaining something critical, or the user is confused — be crisp and clear. No fillers during phrase cards. No fillers when the user needs help RIGHT NOW. Fillers are for casual moments only.
```
  Also added few-shot example:
```
[Speech texture example — natural filler]
Avatar: "えっと… あの店じゃなくて — ほら、川の近くのやつ。あそこのラーメン (asoko no raamen) めっちゃうまいよ。"
(Filler えっと, self-correction mid-thought, casual tone. This is how a real Japanese friend talks.)
```
- **Coherence check**: No contradictions found. The CONFUSION OVERRIDE already says "IMMEDIATELY switch" which implies crisp communication — the guardrail explicitly defers to that. The phrase card format section says "use this EXACT structure" which overrides casual speech texture. The `1 in 3` frequency aligns with the response variance guidance (not every message, not never).
- **Test method**: Build verification (passed). Manual review of instruction coherence across all config files. User testing pending.
- **Result**: Build passes. 104/104 tests pass. Instructions are internally consistent. The guardrails are specific enough that even small models should understand: fillers in casual talk, clarity in teaching.
- **Verdict**: KEEP — pending user testing with Qwen3 1.7B and Gemma to verify small models respect the guardrails.
- **Notes**: The per-language filler list is valuable because it gives the model concrete examples rather than asking it to improvise. 7 languages covered. If a language isn't listed, "Use whatever fits your language" provides a graceful fallback. The self-correction example ("The place on — wait no, not that one") is the most impactful pattern — it creates a natural conversational rhythm that pure filler words alone don't achieve.

---

### EXP-002: Response Length Variance with Specific Triggers (2026-04-16)
- **Hypothesis**: The existing "Vary your response length" instruction is too vague. Models default to medium-length responses every time. Adding explicit triggers for SHORT / MEDIUM / LONG responses will create more natural conversational rhythm. Risk: models might rigidly follow the rules and lose spontaneity.
- **Config change**: `src/config/prompts/coreRules.json` — replaced the one-line length rule in ABSOLUTE RULES section
- **Before**:
```
- Keep responses SHORT. 2-4 sentences for casual talk. Longer only when teaching a phrase or setting a scene. Vary your length — sometimes 1 punchy sentence, sometimes 4. Never the same length twice in a row.
```
- **After**:
```
- Keep responses SHORT. Vary your length — never the same length twice in a row.
  SHORT (1-2 sentences): reacting emotionally, acknowledging what they said, rapid back-and-forth, answering a yes/no, quick encouragement.
  MEDIUM (2-3 sentences): general conversation, casual follow-ups, opinions, most exchanges.
  LONG (4-5 sentences): teaching a phrase (phrase card), setting a scene with sensory detail, telling a story, explaining cultural context, debriefing after a scenario.
  If your last message was long, the next one should be short or medium. If you just gave a phrase card, follow up with something punchy.
```
- **Coherence check**: Consistent with emotional mirroring ("Mirror their message length roughly: short begets short, long begets long" in systemLayers.json). The emotional mirroring instruction adds a user-energy dimension on top of the content-based triggers here. No contradiction — they complement each other (content type suggests a length, user energy modulates it). The reinforcement section still says "Keep it under 3 sentences unless teaching a phrase or setting a scene" which aligns with MEDIUM being the default.
- **Test method**: Build verification (passed). Coherence audit across systemLayers.json emotionalMirroring and chat template RESPONSE RHYTHM section.
- **Result**: Build passes. 104/104 tests pass. The `toolPrompts.json` chat template also has a RESPONSE RHYTHM section that says "Length: sometimes 1 punchy sentence, sometimes 4. Never the same length twice in a row." — this is now reinforced (not contradicted) by the more specific triggers in coreRules.
- **Verdict**: KEEP — the trigger-based approach gives models a decision framework rather than asking them to vary randomly.
- **Notes**: Key insight: the "If you just gave a phrase card, follow up with something punchy" rule is the most valuable addition. Phrase cards are long by nature (5-field format), and without this rule, models tend to follow a phrase card with another multi-sentence explanation. The post-card short response creates a natural breathing rhythm.

---

### EXP-003: Open Loop Persistence via Follow-Through Instruction (2026-04-16)
- **Hypothesis**: The model drops open loops because there's no instruction to follow through on them. Adding a "LOOP FOLLOW-THROUGH" sub-instruction to the chat tool template will remind the model to close loops before opening new ones. This is a prompt-only experiment — WorkingMemory could store open loops programmatically, but we test the prompt approach first.
- **Config change**: `src/config/prompts/toolPrompts.json` — expanded the OPEN LOOPS section in the `chat.template` field
- **Before**:
```
OPEN LOOPS — leave one thread unresolved per conversation:
- Drop something you'll tell them about later, start a story you'll finish next time, or mention something coming up.
- This creates pull. The user comes back because something is unfinished.
```
- **After**:
```
OPEN LOOPS — leave one thread unresolved per conversation:
- Drop something you'll tell them about later, start a story you'll finish next time, or mention something coming up.
- This creates pull. The user comes back because something is unfinished.
- LOOP FOLLOW-THROUGH: If you started a story, teased something, or mentioned a place/event in a recent message — check if you ever followed up. If not, pick it back up naturally within the next 2-3 exchanges. "Oh right, I was telling you about that place on Rue Cler..." Don't let loops die — close one before opening a new one. Maximum 1 open loop at a time.
```
- **Coherence check**: The coreRules.json OPEN LOOPS section still contains the original "leave one thread unresolved" instruction. The new follow-through instruction in toolPrompts doesn't contradict it — it extends it. coreRules says "open loops" (create them), toolPrompts.chat says "follow through on them" (close them). The "Maximum 1 open loop at a time" constraint prevents loop accumulation. No contradiction with any other config.
- **WorkingMemory analysis**: `WorkingMemory` (ring buffer, 32 slots, 10min default TTL) supports `set(key, value, ttlMs)` and `get(key)`. A future code change could store open loops as `wm.set('open_loop', 'the story about Rue Cler', 30 * 60 * 1000)` with a 30-minute TTL, then inject it into the chat template context. This would make loop persistence reliable across conversation turns. For now, the prompt-only approach relies on the model's context window containing the recent messages where the loop was opened.
- **Test method**: Build verification (passed). Analysis of WorkingMemory API for future programmatic support.
- **Result**: Build passes. 104/104 tests pass. The prompt-only approach is the right first step — if models follow through reliably, no code change needed. If they don't (likely with small models that have short effective context), the WorkingMemory approach becomes the next experiment.
- **Verdict**: KEEP — prompt-only is low-risk. If models with 4K context windows fail to follow through, upgrade to WorkingMemory-backed persistence as EXP-003b.
- **Notes**: The "Maximum 1 open loop at a time" constraint is critical. Without it, models accumulate 3-4 unresolved threads and never close any of them. One-at-a-time forces sequential completion. The concrete example ("Oh right, I was telling you about that place on Rue Cler...") gives the model a pattern to follow when picking up a loop.

---

### EXP-004: TBLT Pre-Task Quality — Structured 3-Step Approach (2026-04-16)
- **Hypothesis**: The current pre-task instruction ("preview 2-3 key phrases") is too vague about HOW to present them. Models dump phrase cards or list vocabulary without context. A structured 3-step approach (conversational preview -> single phrase card for the most critical phrase -> scene setting) will produce better pre-task quality and make the user feel prepared rather than tested.
- **Config change**: `src/config/prompts/systemLayers.json` — replaced `scenario.tblt_pretask` template
- **Before**:
```
"tblt_pretask": "PRE-TASK: Before diving in, preview 2-3 key phrases the user will need for this {{label}} situation. Give them the words first, then set the scene. This is prep — make them feel ready, not tested."
```
- **After**:
```
"tblt_pretask": "PRE-TASK: Before diving in, prep the user for this {{label}} situation in 3 steps. (1) CONVERSATIONAL PREVIEW: Mention 2-3 key phrases they will need, casually and in context — 'so the main thing you will want to say is...' and 'if they ask you X, you say Y.' Use bold with pronunciation inline. (2) PHRASE CARD: Pick the single most critical phrase — the one they absolutely cannot skip — and present it as a full phrase card (Phrase/Say it/Sound tip/Means/Tip). Only one card, not two or three. (3) SET THE SCENE: Describe what is about to happen — who they will talk to, what the environment is like, what the vibe is. Make them feel like they are walking into the room. Keep all 3 steps in a single message, total 5-7 sentences."
```
- **Coherence check**: The phrase card format referenced in step (2) matches the EXACT structure defined in `coreRules.json` (Phrase/Say it/Sound tip/Means/Tip). The "5-7 sentences" total length aligns with the LONG response trigger from EXP-002 (4-5 sentences for teaching + scene setting). The tblt_task and tblt_posttask templates are unchanged and still work — task phase says "stay in character," posttask says "extract 2-3 most useful phrases as phrase cards." The pre-task now gives ONE card (prep), the post-task gives 2-3 cards (review). This is pedagogically sound: light prep, heavier debrief.
- **Test method**: Build verification (passed). Cross-reference with phrase card format, response length rules, and TBLT task/posttask templates.
- **Result**: Build passes. 104/104 tests pass. The 3-step structure is unambiguous enough that even small models should follow it. The "only one card, not two or three" constraint is the key differentiator — it prevents the common failure mode where pre-task dumps 3 full phrase cards and overwhelms the user before the scenario even starts.
- **Verdict**: KEEP — the structured approach is strictly better than the vague original. Pending user testing to measure whether users enter scenarios feeling more prepared.
- **Notes**: The ordering matters. Conversational preview FIRST gives context ("here's what you'll want to say"). Phrase card SECOND drills the most critical item. Scene setting THIRD builds anticipation. This mirrors how a real friend would prep you: "okay so you're gonna want to say X and Y... but the big one is Z, here's how to nail it... alright, so when you walk in, it's gonna be like this..."

---

### EXP-005: Recasting Consistency Audit + Few-Shot Example (2026-04-16)
- **Hypothesis**: The recasting instruction in coreRules may be contradicted by other config files that tell the model to explicitly correct errors. An audit of all config files will reveal contradictions, and a few-shot recasting example will make the technique concrete for models that struggle with abstract instructions.
- **Config changes**:
  1. `src/config/prompts/warmthLevels.json` — friend tier (0.4-0.6): changed semi-explicit correction to proper recast-first with escalation
  2. `src/config/prompts/warmthLevels.json` — family tier (0.8-1.0): added framing that explicit correction is an earned privilege of closeness, not a contradiction of recasting
  3. `src/config/prompts/coreRules.json` — added recasting few-shot example to `fewShotExamples`

- **Audit results** (all config files checked):
  | File | Instruction | Status |
  |---|---|---|
  | `coreRules.json` CORRECTION STYLE | "recast, don't lecture" + 3x escalation | CONSISTENT |
  | `toolPrompts.json` chat.template CORRECTION | "always recast, never lecture" | CONSISTENT |
  | `systemLayers.json` learningStages.conversational | "RECAST (model correct usage without correcting)" | CONSISTENT |
  | `systemLayers.json` scenario.tblt_task | "Correct by naturally rephrasing" | CONSISTENT |
  | `learningProtocols.json` error_correction | "Respond naturally using the CORRECT form... 3+ times explicit" | CONSISTENT |
  | `learningProtocols.json` elicitation | "Prompt the learner to self-correct" | COMPLEMENTARY (not contradictory — elicitation is for errors they should know) |
  | `learningProtocols.json` expansion | "naturally use an expanded version" | COMPLEMENTARY (builds on correct output, not error correction) |
  | `warmthLevels.json` friend tier | "pfff, almost — [correct form]" | **FIXED**: semi-explicit -> recast-first |
  | `warmthLevels.json` family tier | "no, that's wrong. It's [X]" | **CLARIFIED**: framed as earned progression |

- **Before (warmthLevels friend tier)**:
```
When they make a mistake, recast it with a grin implied: 'pfff, almost — [correct form] — but honestly, people would still get you.'
```
- **After (warmthLevels friend tier)**:
```
When they make a mistake, recast by naturally using the correct form in your reply — don't announce the error. If they keep making the same mistake, you can be playful about it: 'pfff — [correct form] — but honestly, people would still get you.'
```

- **Before (warmthLevels family tier)**:
```
Correct them directly now without sugar-coating — you respect them: 'no, that's wrong. It's [X]. You know better.'
```
- **After (warmthLevels family tier)**:
```
At this level of trust, you've EARNED the right to correct directly — no more recasting. You respect them enough to be blunt: 'no, that's wrong. It's [X]. You know better.' This is a reward of closeness, not rudeness.
```

- **Recasting few-shot example added to coreRules.json**:
```
[Recasting example — how to correct without correcting]
User: "Je suis allé à le marché ce matin"
Avatar: "Au marché (oh mar-SHAY) ce matin? Sympa. T'as trouvé quelque chose de bien?"
(The user said 'à le' — wrong. The avatar naturally used the correct 'au' without pointing out the error. The user hears the right form in context. That's recasting.)
```

- **Coherence check**: The correction progression is now:
  - Stranger/Acquaintance: Pure recast (model correct form, say nothing)
  - Friend: Recast first, playful nudge on repeated errors
  - Close friend: Recast for minor errors, honest feedback on plateaus
  - Family: Direct correction earned through trust

  This progression is consistent with the coreRules "3+ times then gently point it out" escalation and the learningProtocols error_correction "only give explicit correction if the same error appears 3+ times." The family tier is the only place where immediate direct correction happens, which makes sense — it represents ~200+ interactions of established trust.

- **Test method**: Full audit of all 5 prompt config files for correction-related instructions. Build verification.
- **Result**: Build passes. 104/104 tests pass. One real contradiction found and fixed (friend tier). One ambiguity clarified (family tier). The few-shot example is the most impactful addition — it shows exactly what recasting looks like in practice, which is more useful than the abstract instruction alone.
- **Verdict**: KEEP — the audit found a genuine contradiction, the fix is clean, and the few-shot example fills a gap.
- **Notes**: The French recasting example was chosen deliberately: `à le` -> `au` is a common contraction error that's easy to understand across languages. The parenthetical explanation at the end ("That's recasting.") is unusual in a few-shot example — it breaks the fourth wall — but it's there to teach the MODEL what recasting means, not the user. The model never outputs the parenthetical; it only sees it during prompt assembly.

---

## Experiment Template

### EXP-XXX: [Title]
- **Hypothesis**: [What we think will happen]
- **Config change**: [Exact file + field changed]
- **Before**: [What it was]
- **After**: [What we changed it to]
- **Test method**: [How we evaluated]
- **Result**: [What happened]
- **Verdict**: KEEP / REVERT / MODIFY
- **Notes**: [What we learned]
