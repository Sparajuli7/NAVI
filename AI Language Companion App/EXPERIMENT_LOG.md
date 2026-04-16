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
