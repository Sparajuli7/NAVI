# 03 — Paper Options (5), with RQs, Contributions & Outlines

Each option is a self-contained paper you could write. Option 1 is the recommended
primary. Options 2–5 reuse the same infrastructure (see `05_...md`), so choosing
one now doesn't waste work on the others.

Legend — **Contribution type:** Empirical (E), Systems/Artifact (S), Methods (M).

---

## Option 1 ★ — Adaptive Code-Switching in an LLM Language Companion (E)

**Working title:** *"How Much of My Language Should the AI Speak? Effects of Fixed
vs. Adaptive Code-Switching in an LLM Language-Learning Companion."*

**Target venues:** CALICO Journal / ReCALL / *Language Learning & Technology*
(primary); CHI or Learning@Scale (if framed as interaction design).

**Gap:** No controlled learner study manipulates L1/L2 ratio *adaptively* with a
modern LLM companion (see `02_related_work.md`, Themes A/B; anchor: Brixey & Traum
2025).

**RQs**
- **RQ1 (learning):** Does adaptive code-switching improve short-term and delayed
  (48h) retention of target phrases vs fixed-ratio and full-immersion?
- **RQ2 (affect):** How do the three modes affect foreign-language anxiety (FLCAS),
  enjoyment (FLE), and willingness-to-communicate (WTC)?
- **RQ3 (production/engagement):** Which mode elicits more learner L2 production
  (user L2-token ratio) and longer, deeper sessions?
- **RQ4 (adaptation):** Does *dynamic* adaptation beat a static ratio, and can the
  agent identify the right moment to increase L2?

**Conditions (IV):** Immersion (L2-only) · Fixed calibration (80–90% L1 + embedded
L2) · Adaptive (starts L1-heavy, shifts to L2 as comprehension/production rises).

**Contribution:** First controlled evidence on adaptive L1 use in LLM tutors + an
open, reproducible testbed (NAVI's versioned prompt tiers) others can reuse.

**Outline (IMRaD):**
1. Intro — the L1-ratio dilemma; why LLMs make adaptation newly possible.
2. Related work — code-switching/translanguaging; LLM tutors; affect.
3. System — NAVI + the three prompt policies (cite exact config versions).
4. Method — within-subjects, counterbalanced; participants; instruments; procedure.
5. Results — RQ1–4 (mixed-effects models + qualitative themes).
6. Discussion — design guidance ("adapt to comprehension, don't fix a ratio").
7. Limitations, ethics, future work.

Full design: `04_study_protocol_primary.md`.

---

## Option 2 — The Price of Privacy: On-Device vs Cloud LLMs for Language Learning (E + S)

**Working title:** *"Good Enough to Keep Private? A Behavioral Study of On-Device
vs Cloud LLMs in a Language Companion."*

**Target venues:** CHI / DIS / IUI (HCI); ACL/EMNLP demo or workshop (systems).

**Gap:** Privacy work on LLM CAs is attitudinal (Theme F); NAVI can run the model
**in the browser**, enabling a *behavioral* quality↔privacy trade-off study.

**RQs**
- RQ1: How large is the perceived + measured quality gap between WebLLM-1.7B (on-
  device), Ollama-8B (local server), and cloud-Claude for NAVI conversations?
- RQ2: At what quality gap do learners choose privacy/offline over quality?
- RQ3: Does disclosing "this runs privately on your device" change disclosure
  behavior and trust?

**Design:** Blind A/B of model tiers on identical prompts (rubric + human ratings),
plus a choice/willingness-to-pay-in-quality elicitation and a disclosure-framing
manipulation.

**Contribution:** First behavioral quantification of the on-device CALL trade-off;
design guidance for hybrid-inference apps.

---

## Option 3 — Situated Persona: Location/Dialect-Aware Tutoring (E)

**Working title:** *"A Local Friend: Does GPS-Grounded Dialect and Persona Improve
Authenticity and Pragmatic Learning?"*

**Target venues:** CALICO / ReCALL / *LLT*; CHI (situated interaction).

**Gap:** Cultural/dialect awareness is studied at the *model* level (Theme I), not
as a learner-facing interface manipulation.

**RQs**
- RQ1: Does dialect/location grounding raise perceived authenticity and cultural-
  pragmatic competence vs a generic same-language tutor?
- RQ2: Does the benefit depend on how much structured local data NAVI has for the
  city (tiered-data hypothesis from `RESEARCH_ROUND7.md`)?

**Design:** Between-subjects (grounded vs generic) across high-data and low-data
cities; authenticity ratings by native-speaker judges + learner pragmatic tests.

---

## Option 4 — The Companion Effect: Memory & Warmth on Retention (E)

**Working title:** *"Does a Companion That Remembers You Keep You Learning? A
Multi-Week Study of Memory and Relationship in a Language App."*

**Target venues:** CHI / CSCW / Learning@Scale.

**Gap:** Companionship is studied for well-being (Theme D), not language outcomes.

**RQs**
- RQ1: Does a memory-bearing, warmth-tiered companion raise 2–4 week return rate
  and session count vs a stateless tutor?
- RQ2: Does it raise self-reported relatedness (SDT) and does relatedness mediate
  retention?
- RQ3: Do callbacks/open-loops and spaced-repetition prompts drive returns?

**Design:** Multi-week randomized deployment (companion vs stateless), telemetry +
biweekly surveys + exit interviews. Needs longer cohort access.

---

## Option 5 — Validating an Automated Conversational-Quality Rubric for CALL (M)

**Working title:** *"Can a Rubric Score a Tutor? Validating Automated
Conversational-Quality Metrics Against Human Judgment and Learning Outcomes."*

**Target venues:** ACL/EMNLP (eval track/workshop); *LLT*; L@S.

**Gap:** NAVI's 18-dim rubric (`TEST_RUBRIC.md`) is heuristic and unvalidated
(Theme G). Reviewers love reusable, validated measures.

**RQs**
- RQ1: How well do the automated rubric dimensions correlate with expert human
  ratings on the same transcripts?
- RQ2: Do rubric scores predict actual learner outcomes (retention, WTC)?
- RQ3: Which dimensions are valid, and which are noise (esp. the non-English/
  target-language scoring gap the repo already flags)?

**Design:** Reuse Study 1 transcripts; ≥2 expert raters (inter-rater reliability),
correlate with automated scores and outcomes. Cheap, high methodological payoff.
**Run this bundled with Option 1.**

---

## Recommended combination

**Primary:** Option 1. **Bundled add-on:** Option 5 (same transcripts, near-free).
This yields one strong empirical paper + one methods contribution from a single
data-collection effort, and directly answers a product decision you must make.
