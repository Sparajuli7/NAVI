# 02 — Related Work (Annotated) & Gap Analysis

Grouped by theme. Each entry: citation → one-line takeaway → **how it informs
NAVI / where we differ**. Verify every reference before submission (see README
caveat). `[VERIFIED]` = confirmed during compilation; `[verify]` = metadata only
(paywalled/arXiv), confirm details.

Suggested BibTeX keys are in `[[key]]` for your reference manager.

---

## Theme A — LLM conversational agents as language tutors

- **Brixey, J. & Traum, D. (2025).** *Does a code-switching dialogue system help
  users learn conversational fluency in Choctaw?* Fifth Workshop on NLP for
  Indigenous Languages of the Americas (AmericasNLP), ACL. `[[brixey2025choctaw]]`
  `[VERIFIED]` — https://aclanthology.org/2025.americasnlp-1.2/
  → Compares a **bilingual code-switching** dialogue system vs a **monolingual**
  one for learners of an endangered language; measures engagement/enjoyment and
  fluency gains. **This is the closest prior work to our primary study.** We
  differ by (a) using a modern LLM companion, (b) adding a **dynamically adaptive**
  third condition, (c) a larger, controlled learner sample, and (d) affect +
  production measures. *Cite as the anchor and the gap.*

- **CHI 2024 EA — Exploring LLM-based Chatbot for Language Learning and
  Cultivation of Growth Mindset.** Extended Abstracts, CHI '24.
  `[[chi2024growthmindset]]` — https://dl.acm.org/doi/10.1145/3613905.3648628
  → LLM chatbot for language learning framed around mindset. Positions NAVI in
  the CHI conversation; we go beyond a feasibility EA to a controlled outcome study.

- **Training LLM-based Tutors to Improve Student Learning Outcomes in Dialogues
  (2025).** arXiv:2503.06424. `[[llmtutors2025]]` `[verify]`
  → Optimizing tutor *dialogue policy* for measured learning gains. Method
  reference for tying interaction design to outcomes.

- **Technology-Mediated Task-Based Language Teaching: A Meta-Analysis.** *CALICO
  Journal* (2024). `[[calico2024tblt]]` — https://utppublishing.com/doi/10.3138/calico-2024-0029
  → Meta-analysis of TBLT in tech-mediated contexts (1990–2024). Grounds our
  scenario/task design (`scenarioContexts.json`) in established CALL pedagogy.

- **CALICO 2024 sessions** (e.g., "Implementing AI Chatbots in L2 University
  Courses: Building Pragmatic Competence and Critical Digital Literacy").
  `[[calico2024sessions]]` — https://calico.org/2024-sessions/
  → Shows the CALL community is actively receptive to exactly this work — a good
  first venue for #1/#3.

---

## Theme B — Code-switching, L1 use, and translanguaging in learning

- **Alignment of code switching varies with proficiency in second language
  learning dialogue.** *System* (2022). `[[system2022alignment]]` `[verify — paywalled]`
  https://www.sciencedirect.com/science/article/abs/pii/S0346251X22002342
  → Learners' code-switching *aligns* with the interlocutor and varies with
  proficiency. Direct empirical support for an **adaptive** (proficiency-sensitive)
  policy — our adaptive condition operationalizes this with an LLM.

- **Japanese EFL Speakers' Willingness to Communicate in L2 Conversations: The
  Effects of Code-switching and Translanguaging.** *TESL-EJ* 27(?) . `[[teslej_wtc_cs]]`
  https://tesl-ej.org/wordpress/issues/volume27/ej107/ej107a5/
  → L1 use / translanguaging can *raise* WTC and lower anxiety. Motivates our
  affective DVs and the hypothesis that L1-inclusive modes help beginners engage.

- Pedagogical background (translanguaging as a resource; when to allow L1) is well
  established; cite a translanguaging pedagogy review + Krashen's comprehensible
  input and Swain's output hypothesis as the theoretical frame (below).

---

## Theme C — Affect: anxiety, willingness-to-communicate, oral proficiency with AI chatbots

*(Strong, recent, and directly reusable for our affect instruments.)*

- **The impact of different conversational generative AI chatbots on EFL learners:
  WTC, foreign-language speaking anxiety, and self-perceived communicative
  competence.** *System* (2024). `[[system2024chatbots]]` `[verify — paywalled]`
  https://www.sciencedirect.com/science/article/abs/pii/S0346251X24003154

- **Investigating the role of AI-powered conversation bots in enhancing L2
  speaking skills and reducing speaking anxiety: a mixed-methods study.**
  *Humanities and Social Sciences Communications* (2025). `[[hssc2025bots]]`
  https://www.nature.com/articles/s41599-025-05550-z

- **The impact of AI chatbots on EFL learners' oral proficiency and willingness to
  communicate.** *System* (2025). `[[system2025oral]]` `[verify — paywalled]`
  https://www.sciencedirect.com/science/article/abs/pii/S0346251X2500329X

- **Improving elementary EFL speaking skills with generative AI chatbots.**
  *System* (2024). `[[system2024elementary]]` `[verify — paywalled]`
  https://www.sciencedirect.com/science/article/abs/pii/S036013152400126X

  → Collectively: AI conversation partners can lower anxiety and raise WTC/oral
  proficiency, but authenticity/mechanical-response limits recur. **NAVI's
  contribution:** test whether *code-switching policy specifically* modulates
  these affective outcomes (prior work varies the chatbot, not the L1 ratio).

---

## Theme D — Social/companion agents & long-term engagement (for the retention avenue)

- **Skjuve, M. et al. (2022).** Longitudinal study of Replika users (N≈28, 12
  weeks): companion relationships form gradually (Social Penetration Theory).
  `[[skjuve2022replika]]` `[verify]`
- **Croes, E. & Antheunis, M. (2021).** 3-week study (Mitsuku, N=118): social
  attraction and self-disclosure *decreased* over time. `[[croes2021]]` `[verify]`
- **Only Time Will Tell: A Structured Survey of Longitudinal Studies on Social AI
  Companions.** *Int. J. Human–Computer Interaction* (2026). `[[ijhci2026survey]]`
  https://www.tandfonline.com/doi/full/10.1080/10447318.2026.2670529
- **A Longitudinal Randomized Control Study of Companion Chatbot Use:
  Anthropomorphism…** (2025). arXiv:2509.19515. `[[rct2025companion]]` `[verify]`
- **How AI Companionship Develops: Evidence from a Longitudinal Study.**
  arXiv:2510.10079. `[[dev2025companionship]]` `[verify]`
  → Methodology bank for a NAVI multi-week retention study (measures, cadence,
  attrition handling). Novelty gap: none of these tie companionship to *language
  learning outcomes*.

---

## Theme E — Situated / AR vocabulary learning (for the camera-OCR avenue)

- **Foreign language learning using augmented reality environments: a systematic
  review.** *Frontiers in Virtual Reality* (2024). `[[frvir2024ar]]`
  https://www.frontiersin.org/journals/virtual-reality/articles/10.3389/frvir.2024.1288824/full
- **Effects of Augmented Reality with Pedagogical Agent on EFL Primary Students'
  Vocabulary Acquisition, Motivation, and Technology Perceptions.** *Int. J.
  Human–Computer Interaction* (2024). `[[ijhci2024ar]]`
  https://www.tandfonline.com/doi/full/10.1080/10447318.2024.2443534
- **Augmented reality in language learning: a systematic literature review …
  task design considerations** (2025). `[[ar2025review]]`
  https://www.tandfonline.com/doi/full/10.1080/17501229.2025.2504706
  → Situated-learning theory dominates; AR mostly used for vocab. NAVI's camera-OCR
  is a lightweight, phone-native take (no markers/headset) tied to a companion.

---

## Theme F — On-device LLMs & privacy perceptions (for the on-device avenue)

- **"It's a Fair Game, or Is It?" (Zhang et al., CHI 2024)** — how users navigate
  disclosure risks/benefits with LLM conversational agents. `[[zhang2024fairgame]]` `[verify]`
- **Towards Usable, Privacy-Respecting Long-Term Memory for LLM-based
  Conversational Agents.** CHI 2026 EA. `[[chi2026memory]]`
  https://dl.acm.org/doi/full/10.1145/3772363.3799198
- **A Survey of U.S. Users' Privacy Perceptions in LLM Chatbots.** USEC/NDSS
  (2026). `[[usec2026privacy]]`
  https://www.ndss-symposium.org/wp-content/uploads/usec26-5.pdf
  → Privacy is a live user concern for LLM CAs. **NAVI is unusually positioned:**
  it can run the model fully on-device, so we can study the *actual* privacy↔quality
  trade-off behaviorally, not just via attitudes.

---

## Theme G — Evaluating conversational quality (for the metric-validation avenue)

- **Liu et al. (2023), G-Eval** — LLM-as-judge for open-ended generation; strong
  correlation with humans on dialogue quality. `[[liu2023geval]]` `[verify year]`
- **Reliability without Validity: A Systematic, Large-Scale Evaluation of
  LLM-as-a-Judge … Agreement, Consistency, and Bias.** arXiv:2606.19544.
  `[[reliabilityvalidity]]` `[verify]`
- **LLMs-as-Judges in Automatic Evaluation of Free-Form QA.** WiNLP (2025).
  https://aclanthology.org/2025.winlp-main.37.pdf `[[winlp2025judges]]`
  → Known biases (self-enhancement, verbosity), sensitivity to prompt. Directly
  relevant to validating NAVI's automated rubric against human raters (avenue #6).

---

## Theme H — Adaptive scheduling / spaced repetition (supports memory + SR claims)

- **Settles, B. & Meeder, B. (2016).** *A Trainable Spaced Repetition Model for
  Language Learning* (Half-Life Regression). ACL 2016. `[[settles2016hlr]]`
  https://aclanthology.org/P16-1174/ (mirror: research.duolingo.com/papers/settles.acl16.pdf)
- **Adaptive Forgetting Curves for Spaced Repetition Language Learning.** AIED
  2020 / arXiv:2004.11327. `[[aied2020forgetting]]`
  → Grounds NAVI's Leitner/dual-track SR and any "does adaptive scheduling help"
  sub-analysis.

---

## Theme I — Cultural/dialect awareness in LLMs (supports location/dialect avenue)

- **Localized Cultural Knowledge is Conserved and Controllable in LLMs.** ACL
  Findings (2026) / arXiv:2504.10191. `[[localizedculture]]`
  https://aclanthology.org/2026.findings-acl.2141/
- **NileChat: Towards Linguistically Diverse and Culturally Aware LLMs for Local
  Communities.** arXiv:2505.18383. `[[nilechat]]` `[verify]`
- **CulturePark: Boosting Cross-cultural Understanding in LLMs.** (2024)
  arXiv:2405.15145. `[[culturepark]]` `[verify]`
- **DaKultur: Evaluating the Cultural Awareness of Language Models for Danish with
  Native Speakers.** arXiv:2504.02403. `[[dakultur]]` `[verify]`
  → LLMs hold cultural knowledge but under-surface it without explicit prompting —
  supports NAVI's `dialectMap`/local-persona layering (your `RESEARCH_ROUND7` thesis).

---

## Theoretical / instrument canon (foundational — confirm editions)

- **Krashen (1982)** — Input Hypothesis / comprehensible input (`i+1`).
- **Swain (1985)** — Output Hypothesis (pushed output → acquisition).
- **MacIntyre, Clément, Dörnyei & Noels (1998)** — Willingness to Communicate model.
- **Horwitz, Horwitz & Cope (1986)** — Foreign Language Classroom Anxiety Scale (FLCAS).
- **Dewaele & MacIntyre (2014)** — Foreign Language Enjoyment scale.
- **Brooke (1996)** — System Usability Scale (SUS).
- **Hart & Staveland (1988)** — NASA-TLX (cognitive load).
- **Ryan & Deci** — Intrinsic Motivation Inventory (IMI) / Self-Determination Theory.

---

## Gap analysis — where NAVI plants its flag

1. **No controlled learner study on *adaptive* LLM code-switching.** Prior work is
   corpus/pedagogy (Theme B) or a single low-resource system (Brixey & Traum).
   NAVI operationalizes immersion vs fixed vs **adaptive** and measures learning +
   affect + production. → **Primary paper (#1).**
2. **Conversational-quality metrics for CALL companions are unvalidated against
   human learning outcomes.** NAVI has an 18-dim rubric but only heuristic scoring.
   → **Bundled methods paper (#6).**
3. **On-device LLM CALL is essentially unstudied behaviorally.** Privacy work is
   attitudinal; NAVI can measure the real quality↔privacy trade-off. → **#2.**
4. **Companionship is studied for well-being, not language outcomes.** → **#4.**
5. **Cultural/dialect grounding is studied at the model level, not as a learner-
   facing interface manipulation.** → **#3.**
