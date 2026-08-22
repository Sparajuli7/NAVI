# 04 — Study Protocol: Adaptive Code-Switching (Primary)

A ready-to-adapt protocol for Option 1. This doubles as the skeleton of an IRB
application and a pre-registration. Fill the `‹…›` fields with your specifics.

## 1. Title & summary

**Title:** Effects of fixed vs. adaptive code-switching in an LLM language-learning
companion on retention, affect, and learner production.

**Summary:** University L2 learners each complete three matched conversational
sessions with NAVI under three code-switching policies (immersion / fixed /
adaptive), order counterbalanced. We measure phrase retention (immediate + 48h),
affect (anxiety, enjoyment, WTC), cognitive load, usability, and behavioral
production, plus qualitative interviews.

## 2. Research questions & hypotheses

| RQ | Hypothesis | Primary DV | Test |
|----|-----------|-----------|------|
| RQ1 Learning | H1: Adaptive ≥ Fixed > Immersion on delayed retention for beginners | Delayed (48h) cued-recall score | Mixed-effects model |
| RQ2 Affect | H2: Immersion ↑ anxiety, ↓ WTC vs L1-inclusive modes | FLCAS, WTC, FLE | RM-ANOVA / LMM |
| RQ3 Production | H3: Adaptive elicits highest learner L2-token ratio | user L2-token ratio | LMM |
| RQ4 Adaptation | H4: Adaptive > Fixed on retention *and* enjoyment | composite | contrast |

Pre-register directional hypotheses; keep exploratory analyses labeled as such.

## 3. Design

- **Type:** Within-subjects, 3 conditions, **counterbalanced** via a 3×3 Latin
  square (6 orders) to control order/practice effects.
- **IV — code-switching policy** (implemented as NAVI prompt tiers; pin versions):
  - **C1 Immersion:** L2-only; L1 only on explicit confusion (the `full-immersion`
    templates that came from `origin/updates`).
  - **C2 Fixed calibration:** 80–90% L1 + 1–3 embedded L2 phrases (current
    `coreRules.json` / `toolPrompts.chat`).
  - **C3 Adaptive:** starts like C2, increases L2 as comprehension/production
    signals rise (drive from `LearningStage` + user L2-token ratio + explicit
    "I got it" affordance). **This is the novel condition — spec it precisely and
    log the adaptation decisions.**
- **Held constant:** avatar persona, city/dialect, target language, scenario type
  and difficulty, model/backend, temperature/max_tokens, session length.
- **Matched materials:** three parallel scenario sets (e.g., café / directions /
  small talk) with equally difficult, disjoint target-phrase lists; rotate with
  condition order so no phrase set is bound to one condition.

## 4. Participants

- **Population:** university students learning ‹target L2(s)› at ‹beginner–low-
  intermediate›; L1 = ‹e.g., English›.
- **Screening:** L2 self-rating + a short placement check; exclude near-native.
- **Sample size:** within-subjects is efficient. Target **N = 30** completers for
  medium effects (run a proper power analysis in G*Power: RM-ANOVA, within factors,
  f ≈ 0.25, power .80, 3 measurements → ~28; recruit ~36 for attrition).
- **Compensation:** ‹gift card / course credit / NAVI Plus› — must be IRB-approved
  and non-coercive.

## 5. Measures & instruments

**Learning (objective)**
- Pre-test: confirm target phrases are unknown (baseline).
- Immediate post-test (per session): cued recall + recognition of that session's
  target phrases.
- **Delayed retention: 48h** later, same test (the key learning DV).

**Affect (validated self-report, short forms per condition)**
- FLCAS (anxiety), FLE (enjoyment), L2 WTC. Administer per condition + overall.

**Load & usability**
- NASA-TLX per condition; SUS once overall; optional UEQ-S.
- Intrinsic Motivation Inventory (IMI) subscales (interest/enjoyment, competence).

**Behavioral (telemetry — see `05_...md`)**
- Session length, messages sent, **user L2-token production ratio**, phrase-card
  opens, self-corrections, help/confusion signals, adaptation events (C3).

**Qualitative**
- Post-study semi-structured interview (10–15 min): preference, perceived
  difficulty, when L2 felt "too much/too little."
- Think-aloud on one session (subset).
- Optional in-app per-message micro-rating ("helpful? too much target language?").

## 6. Procedure (per participant)

1. Consent + demographics + L2 screener (in-app gated flow).
2. Brief tutorial session (uncounted) to normalize UI familiarity.
3. Session A → immediate post-test A → affect A → TLX A. *(condition per Latin square)*
4. Session B → tests B. 5. Session C → tests C. (Sessions can be same day with
   breaks, or across days — decide and hold constant.)
5. SUS + overall preference.
6. **48h later:** delayed retention test (push notification / email link).
7. Interview (all or subset).

## 7. Analysis plan

- **Primary:** linear mixed-effects models (lme4/`afex`) with condition as fixed
  effect and participant as random effect; separate models per DV. Report
  estimates, 95% CIs, effect sizes; correct for multiple comparisons.
- **RQ4 contrast:** planned contrast Adaptive vs Fixed.
- **Mediation (exploratory):** does anxiety/WTC mediate condition→production?
- **Qualitative:** reflexive thematic analysis; triangulate with quantitative.
- **Reproducibility:** publish anonymized data + analysis scripts (R/Python) +
  pinned prompt-config versions.

## 8. Threats to validity & mitigations

- **Order/practice** → Latin-square counterbalancing; tutorial warm-up.
- **Material difficulty confound** → matched, rotated phrase sets; pilot-equate.
- **Adaptive condition ill-defined** → pre-specify the adaptation rule + log every
  decision so it's auditable and replicable.
- **Model nondeterminism** → fix temperature/seed where possible; log model+prompt
  version per turn; same backend for all conditions.
- **Demand characteristics** → don't reveal hypotheses; neutral condition labels.
- **Automated-metric trust** → validate against human raters (Option 5).

## 9. Ethics (summary — details in `05_...md`)

IRB/ethics approval **before** data collection; informed consent; right to
withdraw; data minimization + anonymization; secure storage; LLM-output safety
(content filtering, no PII sent to cloud in on-device/managed modes). Disclose any
cloud processing in consent.

## 10. Pilot

Run **N ≈ 5** end-to-end to debug logging, timing, test difficulty, and the
adaptive rule before the full run. Treat pilot data as separate.
