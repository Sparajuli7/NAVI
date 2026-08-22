# 05 — Instrumentation, Data Pipeline, Ethics & Tester Involvement

What to **build into NAVI** to collect valid research data, how to handle ethics,
and how to recruit + involve student testers. Most of this is dual-purpose: it's
also the real-user telemetry the product roadmap has been missing (see
`CLAUDE.md` Known Gaps: "No real-user testing infrastructure").

---

## 1. Instrumentation to build (in priority order)

NAVI already has Supabase (`cloud_usage`, accounts) and versioned prompt JSON —
perfect foundations. Add a **study mode** gated behind a flag / study build.

### 1.1 Consent + screening onboarding (study build)
- Consent screen (IRB-approved text) → demographics → L2 self-rating + short
  placement check → assign `participant_id` (pseudonymous). No study data before
  consent = true.

### 1.2 Deterministic condition assignment
- A small service that maps `participant_id` → counterbalanced condition order
  (Latin square). Deterministic + logged so a session's condition is unambiguous.
- Model this on the existing backend-selection seam (`monetization.ts` /
  `BackendSelectScreen`) — it already switches behavior by config.

### 1.3 Structured event logging → `research_events` (Supabase)
The single highest-leverage build. Log **every turn** with:

```
research_events (
  id              uuid primary key,
  participant_id  text,          -- pseudonymous
  session_id      uuid,
  condition       text,          -- immersion | fixed | adaptive
  turn_index      int,
  role            text,          -- user | assistant | system
  ts              timestamptz,
  latency_ms      int,           -- assistant turns
  model           text,          -- backend + model id
  prompt_version  text,          -- pinned config hash/tag  (reproducibility!)
  temperature     numeric,
  max_tokens      int,
  user_l2_tokens  int,           -- learner production (key DV)
  user_l1_tokens  int,
  asst_l2_tokens  int,
  asst_l1_tokens  int,
  phrase_ids      text[],        -- target phrases taught this turn
  phrase_card_opened boolean,
  self_correction boolean,
  confusion_signal boolean,      -- "what?", "I don't understand"
  adaptation_event jsonb,        -- C3: the rule's decision + inputs
  content_hash    text,          -- privacy-preserving ref to transcript store
  survey_context  jsonb          -- attach per-session survey answers
)
```
- Store raw transcripts separately (opt-in), keyed by `content_hash`; keep the
  metrics table PII-light. **Language-tagging tokens** (L1 vs L2) is the trickiest
  bit — use a script/lang-ID pass; validate it (this also fixes the
  `TEST_RUBRIC` non-English scoring gap the repo flags).

### 1.4 In-app instruments
- Per-session micro-surveys (FLCAS/FLE/WTC short forms, NASA-TLX) rendered as a
  gated step after each session.
- 48h delayed-retention quiz delivered via push/email deep link.
- Optional per-message thumb + reason ("too much target language?").

### 1.5 Researcher export + dashboard
- CSV/Parquet export of `research_events` + surveys (participant-anonymized).
- Minimal metrics view (n by condition, completion, mean DVs) to monitor the run.
- A "replay transcript" view for qualitative coding.

### 1.6 Reproducibility hooks
- Pin and log `prompt_version` (git tag/hash of the prompt JSON) per session.
- Freeze model + temperature per run; record everything needed to reproduce a turn.

> I can scaffold 1.2–1.5 in the codebase when you're ready — say the word and I'll
> propose a branch + schema migration + a `study/` module.

---

## 2. Ethics / IRB (start this FIRST — it's the long pole)

- **Get IRB/ethics approval before collecting any student data.** Data gathered
  without prior approval typically **cannot be published**. Timeline: often 4–8
  weeks; begin in parallel with instrumentation.
- **Informed consent:** purpose, what's logged, cloud vs on-device processing,
  storage/retention, withdrawal rights, compensation, contact.
- **Data protection:** pseudonymous IDs; separate PII from metrics; encrypt at
  rest; least-privilege access; a deletion path. Prefer **on-device/managed**
  inference during studies to minimize third-party data exposure; if cloud
  (OpenRouter/Anthropic) is used, disclose it and check the provider's data terms.
- **LLM safety:** content filtering; a plan for distressing content; NAVI is not a
  clinical tool — state limits.
- **Vulnerable populations / minors:** if any testers are under-18 or from special
  populations, additional safeguards + consent apply.
- **Compensation** must be non-coercive and IRB-approved.
- **Pre-registration** (OSF/AsPredicted) strengthens the paper and disciplines the
  analysis — do it before data collection.

---

## 3. Recruiting & involving student testers

### 3.1 Recruitment channels
- Language-department courses & instructors (built-in motivated L2 learners).
- International-student orgs, conversation/exchange clubs, language tables.
- Campus research pools (SONA) if available; flyers/Slack/Discord.
- Screen for target L2 + baseline proficiency so conditions are comparable.

### 3.2 Tiered involvement (match method to access)
- **Tier A — Controlled A/B cohort (n≈30–36):** lab or supervised-remote sessions
  for clean data (Study 1/Option 1).
- **Tier B — Diary / co-design panel (n≈6–10):** 2–4 weeks of real use + interviews
  → drives **UI refinement** and feeds the retention avenue (Option 4). Biweekly
  surveys + exit interviews.
- **Tier C — Student co-authors / RAs:** help run sessions, code qualitative data,
  build instrumentation. Great for their CVs, multiplies your labor, and is common
  practice — clarify authorship early.

### 3.3 Keeping testers engaged (reduce attrition)
- Clear time expectations; scheduled reminders (the delayed test is where you lose
  people — automate the nudge).
- Small milestones/compensation; a debrief that shares what they contributed.
- For multi-week: NAVI's own retention features (streaks, callbacks) — but don't
  let them confound a retention study; log and control.

---

## 4. Data you end up with (triangulated)

1. **Behavioral telemetry** (objective) — from `research_events`.
2. **Learning outcomes** — pre/immediate/48h tests.
3. **Self-report** — validated affect/usability/motivation scales.
4. **Qualitative** — interviews, think-alouds, in-app ratings.
5. **System-side** — latency, cost, model quality via the (validated) rubric.

The publishable move is **correlating interface choices (condition) with learning
outcomes**, triangulated across these sources — exactly what single-source app
studies can't do.
