# 06 — Timeline, Venues & Roles

## 1. Suggested timeline (single primary study + bundled methods paper)

Assumes a ~1–2 semester horizon. Parallelize IRB with building.

| Phase | Weeks | What | Owner |
|------|:-----:|------|-------|
| 0. Lock niche + pre-reg draft | 1–2 | Finalize Option 1 (+5); 1-page pre-registration; advisor sign-off | You + advisor |
| 1. IRB/ethics | 2–8 (parallel) | Submit + iterate approval | You |
| 2. Instrumentation | 2–6 (parallel) | Consent flow, condition assignment, `research_events`, surveys, export (see `05`) | Dev (I can help) |
| 3. Materials | 3–5 | 3 matched scenario/phrase sets; pilot-equate difficulty; finalize scales | You |
| 4. Pilot (n≈5) | 6–7 | End-to-end debug; refine adaptive rule + timing | Team |
| 5. Data collection | 8–12 | Tier A cohort (+ Tier B diary in parallel) | Team + RAs |
| 6. Analysis | 12–15 | Mixed-effects models; thematic analysis; metric validation | You + advisor |
| 7. Writing | 14–18 | Draft → internal review → submit | You + co-authors |

**Critical path:** IRB. Start it the day the niche is locked.

## 2. Venue targets (pick by field; confirm current deadlines/CFPs)

| Venue | Field | Fits options | Notes |
|------|-------|-------------|------|
| **CALICO Journal** | CALL | 1, 3, 5 | Very receptive to LLM-in-L2 studies; likely best first home for #1 |
| **ReCALL** (Cambridge) | CALL | 1, 3 | Rigorous CALL empirical work |
| **Language Learning & Technology (LLT)** | CALL | 1, 3, 5 | Open access, high visibility in the field |
| **System** (Elsevier) | Applied linguistics | 1, 3 | Where much of the AI-chatbot-affect work lives (Theme C) |
| **CHI** | HCI | 1, 2, 4 | Broad reach; frame as interaction design; competitive |
| **CSCW** | HCI/social | 4 | Companionship/social angle |
| **Learning@Scale (L@S)** | Edu tech | 1, 4, 5 | Learning + systems; loves telemetry |
| **AIED / LAK** | AI in edu / analytics | 1, 4, 5 | Learning analytics framing |
| **IUI** | Intelligent UIs | 1, 2 | Adaptive-interface framing of #1/#2 |
| **ACL/EMNLP (+ workshops: BEA, AmericasNLP)** | NLP | 2, 5 | #5 (metric validation) and #2 (systems) fit; BEA = "Building Educational Applications" |

**Strategy:** target **one CALL/HCI journal or conference for the primary (Option
1)** and consider an **NLP workshop (BEA/eval) for the bundled Option 5**. Journals
have rolling deadlines (good for a student timeline); conferences have hard CFP
dates — check each before committing.

## 3. Roles & authorship (agree up front)

- **Lead author:** you — design, run, analyze, write.
- **Advisor:** senior author — framing, methods rigor, venue strategy.
- **Student RAs / co-authors:** sessions, qualitative coding, instrumentation. Set
  authorship criteria early (contribution-based, e.g., ICMJE-style).
- **Engineering (NAVI):** instrumentation + reproducibility (can be same people).

## 4. Immediate next actions (this week)

1. **Advisor meeting:** present `01_landscape_and_niches.md`; lock Option 1 (+5).
2. **Draft the 1-page pre-registration** from `04_study_protocol_primary.md`
   (RQs, hypotheses, DVs, analysis) — I can generate this next.
3. **Open the IRB application** using `04` + `05` as source text.
4. **Green-light instrumentation:** approve the `research_events` schema in `05`
   and I'll scaffold `study mode` in the codebase.
5. **Line up the cohort:** talk to a language instructor about recruiting Tier A.

---

### Things I can produce next on request
- A filled **1-page pre-registration** / OSF template for Option 1.
- A **draft IRB narrative** (purpose, procedures, risks, consent) from `04`+`05`.
- The **consent form** + **survey instruments** doc (actual item lists for FLCAS/
  FLE/WTC/SUS/NASA-TLX/IMI with sources).
- The **instrumentation scaffold** in the repo (schema migration + `study/` module
  + condition assignment).
- A **BibTeX file** seeded from `02_related_work.md` (after you verify the entries).
