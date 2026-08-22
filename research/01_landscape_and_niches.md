# 01 — Research Landscape & Niche Selection

Your advisor is right: don't publish "we built a language app." Publish **one
falsifiable claim about a specific interface/interaction choice**, using NAVI as
the instrument. NAVI has ~6 features that genuinely differ from Duolingo/Babbel/a
generic GPT tutor. Each is a niche. Pick one as primary; the rest are future work.

## The scoring

Scale 1–5 (5 = best). "Fit" = how uniquely NAVI is positioned to answer it.
"Feasible" = doable with a student cohort in one to two semesters.

| # | Niche | Novelty | Fit to NAVI | Feasible | Product value | Overall |
|---|-------|:------:|:----------:|:--------:|:-------------:|:-------:|
| 1 | **Adaptive code-switching** (how much L1 to use, and should it adapt) | 5 | 5 | 5 | 5 | **★ 25** |
| 2 | On-device vs cloud LLM trade-offs for CALL (privacy/latency/quality) | 5 | 5 | 3 | 4 | 22 |
| 3 | Location/dialect-aware persona & cultural-pragmatic learning | 4 | 5 | 3 | 4 | 20 |
| 4 | Companion + memory → long-term engagement/retention | 3 | 4 | 3 | 5 | 19 |
| 5 | Camera-OCR "point at the world" situated vocabulary | 4 | 4 | 3 | 3 | 18 |
| 6 | Validating automated conversational-quality metrics vs human outcomes | 4 | 5 | 5 | 4 | 22 (methods) |

## Recommended primary: #1 — Adaptive code-switching

**The question:** In an LLM conversational companion for beginners, how much of
the **learner's first language (L1)** should the agent use, and should that ratio
**adapt** to the learner in real time?

**Why this one:**
- **It's a live decision in your own codebase.** The repo literally forked on this
  last week: `coreRules.json`/`toolPrompts.json` can run *calibrated code-switching*
  (80–90% L1 + embedded L2) **or** *full immersion* (L2-only). You need the answer
  to ship; a study gives it to you *and* a paper.
- **It's under-studied in the LLM era.** Prior code-switching-for-learning work is
  mostly corpus/pedagogy or a single low-resource dialogue system (Brixey & Traum,
  2025). Nobody has run a controlled learner study on **dynamically adaptive** L1/L2
  mixing with a modern LLM companion.
- **It's cheap and clean.** Three well-defined conditions (immersion / fixed /
  adaptive), within-subjects, modest N. See `04_study_protocol_primary.md`.
- **It generalizes.** The finding ("adapt L1 to comprehension" vs "fixed ratio")
  informs every LLM tutor, not just NAVI.

**One-line contribution:** *We show whether and when an LLM language companion
should adapt its use of the learner's L1, using NAVI as a controllable testbed,
and report effects on learning, affect, and production.*

## Strong secondary: #6 — Metric validation (do this alongside #1, cheaply)

NAVI's `TEST_RUBRIC.md` scores 18 conversational-quality dimensions **by keyword
heuristics with no human validation** (a documented gap). While running Study #1,
collect human expert ratings + learner outcomes on the *same* transcripts. Then
ask: **does the automated rubric predict human judgment and actual learning?**
This makes your entire evaluation pipeline citable and reusable, and it's almost
free because the transcripts already exist. It can be its own short paper or the
"Methods/Measures validation" section of the primary paper.

## The other four (framed as future work / second papers)

- **#2 On-device:** "Do learners trade measurable quality for privacy/offline
  access — and at what quality gap does the trade stop being worth it?" NAVI is
  rare in running the LLM *in the browser* (WebLLM), so it can A/B WebLLM-1.7B vs
  Ollama-8B vs cloud-Claude blind, same prompts. Great **HCI + systems** angle.
- **#3 Location/dialect:** "Does GPS-grounded dialect + local persona increase
  perceived authenticity and cultural-pragmatic competence vs a generic tutor?"
  Ties to your `RESEARCH_ROUND7.md` thesis (structured local data → better avatars).
- **#4 Companion/retention:** "Does a persistent, memory-bearing companion (warmth
  tiers, callbacks, spaced repetition) raise 2–4 week return rate and relatedness
  vs a stateless tutor?" This is the **retention** paper investors also care about;
  needs a multi-week deployment.
- **#5 Camera-OCR:** "Does situated 'point-at-the-world' capture improve retention
  and transfer vs learning the same words in-chat?" Embodied/situated-learning angle.

## How to decide fast (advisor conversation)

1. Confirm the **target field/venue** you most want (CALL vs HCI vs NLP vs
   education) — see `06_timeline_venues_roles.md`. That biases the choice:
   - CALL / applied linguistics (CALICO, ReCALL, *LLT*, *System*) → **#1 or #3**
   - HCI (CHI, CSCW, DIS, L@S) → **#1, #2, or #4**
   - NLP (ACL/EMNLP + workshops) → **#2 or #6**
2. Confirm the **cohort you can realistically get** (how many students, which L2s,
   how many weeks). Multi-week access → #4 becomes viable; single-session access →
   #1/#6 are safest.
3. Lock **#1 as primary + #6 as bundled methods**, unless the venue/cohort push
   you elsewhere. Then go to `03_paper_options.md` and `04_study_protocol_primary.md`.
