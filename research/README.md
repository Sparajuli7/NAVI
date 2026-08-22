# NAVI Research Package

A planning + literature scaffold for the research phase of NAVI (an AI language
companion). Goal: turn NAVI's distinctive interface/interaction choices into
**one sharp, publishable contribution** (plus a portfolio of follow-ups), tested
with real university-student learners, in a way that also **refines the product**.

## How to use this package

Read in this order:

1. **`01_landscape_and_niches.md`** — the 6 candidate research niches scored on
   novelty / effort / publishability, with a recommended primary. Hand this to
   your advisor to lock the topic.
2. **`02_related_work.md`** — annotated bibliography grouped by theme (real,
   recent papers from top venues), plus the **gap analysis** that positions NAVI.
3. **`03_paper_options.md`** — 5 concrete paper options, each with title, RQs,
   contribution, method, target venue, and an IMRaD outline you can start filling.
4. **`04_study_protocol_primary.md`** — full protocol for the recommended primary
   study (adaptive code-switching), ready to adapt into an IRB application.
5. **`05_instrumentation_data_ethics.md`** — what to build in NAVI to collect
   valid data (logging schema, condition assignment, consent), ethics/IRB, and
   how to recruit + involve testers.
6. **`06_timeline_venues_roles.md`** — timeline, venue targets, and team roles.
7. **`07_avenue_international_students.md`** — a focused, high-potential avenue:
   NAVI as a **settling-in language guide for newly-arrived international
   students**. Strong fit to NAVI's differentiators, an easily-recruited on-campus
   population, and an open research gap. Includes a phased "best path" (formative →
   build → longitudinal field study). **A serious candidate for the primary study**
   — weigh it against Avenue #1 (adaptive code-switching) with your advisor; the
   two combine well (adaptive code-switching *inside* the newcomer guide).

## ⚠️ Citation caveat (read before submitting anything)

Citations here were gathered via live web search from top-venue sources and are
**real to the best of the search's ability**, but you must **independently verify
every reference** before it goes in a submission — confirm author list, exact
title, venue, year, and page/DOI. This is normal scholarly practice.

- **Verified during compilation:** Brixey & Traum (2025), AmericasNLP — the crux
  prior work for the primary paper.
- **Flagged (verify carefully):** any arXiv ID, and paywalled entries where only
  metadata was retrievable (noted inline in `02_related_work.md`).
- Canonical SLA/instrument references (Krashen, Swain, MacIntyre, Horwitz et al.,
  Brooke's SUS, Hart & Staveland's NASA-TLX, Settles & Meeder) are long-standing
  and safe, but still confirm edition/year in your reference manager.

## What NAVI is (for reviewers/collaborators new to the repo)

An AI language companion: a local "friend" who speaks the language, knows the
slang/culture, is **location/dialect-aware**, remembers conversations (9-system
memory + knowledge graph + spaced repetition), adapts to the learner's level, and
runs inference **hybrid** — on-device (WebLLM/WebGPU, default, private) with
Ollama and cloud (OpenRouter / managed proxy) as options. These are the levers
the studies below manipulate. See root `CLAUDE.md`, `navi-prd-v3.md`, and the
existing `AI Language Companion App/RESEARCH_ROUND*.md`, `TEST_RUBRIC.md`,
`FLUENCY_JOURNEY.md` for internal design history.
