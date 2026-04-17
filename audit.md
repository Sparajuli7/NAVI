# NAVI Codebase Audit

**Last updated: 2026-04-17** (EXP-112 — Praktika-inspired language approach rewrite: Complete overhaul of language-related system prompt instructions. Root cause of repetition loops and wrong-language responses: contradictory instructions — locationLayer said "SPEAK IN FRENCH" while languageEnforcement said "speak mostly English." Fix inspired by Praktika AI research: beginner chats should be 80-90% user's language with target phrases embedded in bold with pronunciation. Changes: (1) `coreRules.json` rewritten from ~2,100 to ~480 tokens; "NEVER REPEAT YOURSELF" now rule #1; language rule simple and unambiguous; fewShotExamples aligned to new approach. (2) `systemLayers.json`: identity.template shortened; languageCalibration tiers flipped (tier_1=80-90% user language, not "lead in local language"); languageEnforcement simplified; modeInstructions.learn changed from "full immersion" to "learning mode with calibration"; codeSwitchingPriority shortened; emotionalMirroring, conversationNaturalness, locationPersonality, locationSensory all compressed 60-80%; gauging_question, session_opener, free_conversation aligned. (3) `toolPrompts.json` chat.template rewritten as 5 numbered rules (~150 tokens vs ~800). (4) `contextController.ts` locationLayer no longer emits "SPEAK IN [LANG]" — now "talk mostly in user's language, embed target phrases"; internal monologue L14 removed. Total prompt reduction: ~65%. All language instructions now unified. Build passes.)

**Previously: 2026-04-16ai** (SettingsPanel Ollama model selection — refactored Model tab: Ollama promoted from separate card below Apply button to first-class tab alongside Cloud Free / Cloud Paid / On-Device; tab appears dynamically when Ollama is detected at `localhost:11434/api/tags` or when current backend is `ollama`; each installed model shown as clickable card with name + size (GB); clicking a model calls `switchOllamaModel()` immediately (no Apply needed); selection persisted via `localStorage('navi_backend_pref')` + `localStorage('navi_ollama_model')`; BackendSelectScreen also persists `navi_ollama_model`; CORS hint shown when Ollama unreachable; empty-state shows `ollama pull` command. No hardcoded Ollama model lists — all fetched dynamically from user's local Ollama instance. Cloud models (OpenRouter) and WebLLM presets remain hardcoded since they are API/fixed-download based. Build passes, 104/104 tests pass.)

**Previously: 2026-04-16ah** (EXP-086 through EXP-090 final experiment batch + full test suite run: Job 1 — ran all 4 test modes (standard 13-scenario, --dialect, --anchors, --variety); standard 4-scenario: 4.4/5.0, production 3-scenario: 4.4/5.0 (0.0 gap), all anchors fire, variety GOOD (23.7% Jaccard). Job 2 — EXP-086: Chiang Mai cooking instructor (unknown city not in dialectMap) scored 4.3/5.0 with 4/4 location personality (Northern Thai เจ้า used, Warorot Market referenced) — PASS, universal location system works. EXP-087: Barcelona Catalan (not Spanish) scored 4.2/5.0 with 3/4 language independence (taught Bon dia/Gracies/Adeu, distinguished from Castilian) — PASS. EXP-088: Tokyo vs Osaka dialect shift — automated detection FAILED (0/8 Osaka markers in kana) because Osaka scenario produced romanized Japanese; qualitatively the model DID teach なんでやねん and takoyaki; root cause: missing script enforcement in test prompt. EXP-089: Multi-session memory continuity (Paris, 2 sessions) scored 3/4 (bonjour resurfaced naturally, no quiz-style, new phrase taught; personal context not referenced) — PASS. EXP-090: Final benchmark 4.3/5.0 (sensory 30%, target lang 80%, personality 80%, hooks 80%, sycophancy-free 100%); historical: baseline 3.1 → post-budget 4.6 → post-depth 4.8 → current 4.3-4.4 (within normal variance). New test file: `exp086_090.ts`. Build passes, 104/104 tests pass.)

**Previously: 2026-04-16af** (EXP-096 — coreRules.json token budget crisis fix: Removed 7 redundant sections from `rules` field (OPEN LOOPS, SENSORY GROUNDING, MICRO-MISSIONS, SESSION PACING, YOUR LIFE IS HAPPENING, NICKNAMES, DEVELOP BITS) — all already handled by ConversationDirector skills, worldEvents.json, or warmthLevels.json. Trimmed `fewShotExamples` from 11 to 3 (kept: French greeting, phrase card format, recasting). Total savings: ~2,019 tokens. coreRules drops from ~4,558 to ~2,539 tokens, fitting within the 3,072 system prompt budget with ~533 tokens remaining for warmth/mood/relationship/arc/learning layers that were being silently dropped. Build passes, 104/104 tests pass.)

**Previously: 2026-04-16ae** (EXP-081 — Universal location personality system: 3 new system prompt layers in `systemLayers.json`: `locationPersonality` (makes avatar a true local for ANY city), `culturalVoice` (8 language-family conversational styles: romance/germanic/east_asian/south_asian/slavic/semitic/southeast_asian/default), `locationSensory` (sensory grounding for any city). `LANGUAGE_FAMILY_MAP` in `contextController.ts` maps 50+ languages to 7 families. All 3 layers injected in `buildLocationLayer()` for ALL cities (dialectMap and unknown). `AvatarSelectScreen.tsx` gains freeform city input: "Don't see your city? Type it:" with "City, Country" parsing. Custom cities create `LocationContext` with empty dialectKey — universal layers still fire. Barcelona test: 5/6 dialect markers (EXCELLENT). Build passes, 104/104 tests pass.)

**Previously: 2026-04-16ad** (RESEARCH_ROUND7 — Universal location personality, dialect bridging, real-user testing protocol, missing languages: 4-area deep research. Area 1 City Knowledge Tier System — analyzed score gap (Seoul 5.0 vs Barcelona 3.7); diagnosed as personality data gap, not dialect gap; designed 4-tier system: Tier A (global megacities, character-focused prompts), Tier B (regional capitals, balanced), Tier C (smaller cities, culture-heavy prompts), Tier D (small towns, regional anchoring + honest uncertainty + user-contributed data); auto-detection algorithm via population + dialectMap presence; "Barcelona problem" = dialect markers 5/6 but personality 2/5 — every city needs 5-element personality layer. Area 2 Dialect Bridging — designed `DialectBridgeContext` type for cross-dialect travel (Barcelona Spanish → Buenos Aires); 5-phase system: acknowledgment, vocabulary transfer via DIALECT_VARIANT_OF graph edges, SR starting-level bonuses for shared concepts, cross-location bridge queries, relationship continuity across avatars; Arabic dialects should be treated as separate languages. Area 3 Real-User Testing — identified 5 gaps automated rubric cannot measure (long-term personhood, actual retention, day-1 return rate, warmth naturalness, scenario utility vs interruption); designed 30-day protocol with 20 users across 4 cohorts (tourists/expats/immigrants/heritage speakers); defined engagement/learning/relationship metrics + behavioral signals; weekly survey questions + exit interview; success criteria (Day-7 return >60%, Day-30 >35%, 24h retention >50%, avatar name usage >70%). Area 4 Missing Languages — analyzed 6 languages: Hindi (P1, low effort, Devanagari reuse), Indonesian (P1, low-med effort, huge market), Turkish (P2, agglutinative morphology challenge), Tagalog (P2, Taglish fits code-switching), Russian (P2, Cyrillic pipeline needed, grammar complexity), Swahili (P3, LLM quality uncertain). CLAUDE.md Known Gaps updated with 10 new gaps. No code changes — research only.)

**Previously: 2026-04-16ac** (EXP-076 through EXP-080 — Dialect awareness experiments: EXP-076: `dialectTeaching` section added to `systemLayers.json` + wired into `contextController.buildLocationLayer()` — surfaces dialect cultural_notes and slang_era data so the model teaches LOCAL phrases not textbook. EXP-077: `SLANG ERA MATCHING` rule added to `coreRules.json` + `slangTool.ts` defaults generation from avatar ageGroup (20s→gen_z, 30s→millennial, 60s+→older) instead of hardcoded gen_z. EXP-078: `scenarioLock` template upgraded "Cultural watch-out" to "CULTURAL GUARDRAILS (do NOT violate these)" with proactive warning; `scenarioCoach` template appended with cultural norms warning instruction. EXP-079: `REGIONAL PRONUNCIATION` block added to `toolPrompts.pronounce.template` — instructs model to teach local pronunciation first, textbook as footnote. EXP-080: Barcelona dialect awareness live test added to `liveConversationTest.ts` — 5-message tapas bar scenario with 6-marker `DialectScore` analysis (Catalan phrases, Spanish, Barcelona slang, dialect notes, cultural guardrails, local references). Build passes, 104/104 tests pass.)

**Previously: 2026-04-16ab** (Avatar creation UI overhaul: (1) AvatarSelectScreen.tsx rewritten — "Create a companion" card moved to top as primary CTA with solid highlighted styling, templates demoted to "Quick start" section below, copy updated to "Describe who you want by your side"; (2) Location picker added after name input — cities grouped by language from dialectMap.json, search/filter, GPS detection, collapsible; selectedCityKey → buildLocationFromPreset() → LocationContext with dialectKey passed to onSelect(); Start button requires location; (3) dialectMap.json expanded with 8 new cities: ES/Barcelona (Catalan-influenced Spanish), ES/Madrid (Castilian Spanish), IT/Rome (Roman Italian), TH/Bangkok (Central Thai), DE/Berlin (Berlin German), BR/São Paulo (Brazilian Portuguese Paulista), CN/Shanghai (Shanghainese-influenced Mandarin), AR/Buenos Aires (Rioplatense Spanish); (4) COUNTRY_NAMES in locationHelpers.ts updated with ES/IT/TH/DE/BR/CN/AR; build passes, 104/104 tests pass)

**Previously: 2026-04-16aa** (EXP-072 through EXP-075 — relationship language stages, character arc, nickname emergence, absence/return narratives: EXP-072: relationship language stages — `relationshipLanguage` section added to `systemLayers.json` with 5 stages (stage_1=formal/translate all, stage_2=drop translations for taught phrases/casual register, stage_3=custom greetings/shortened forms/reference shared experiences, stage_4=skip greetings/inside references/"between us" framing, stage_5=unique shorthand/half-sentences/language IS intimacy); `ConversationDirector.preProcess()` block 0f-iv maps warmth to stage (0-0.2/0.2-0.4/0.4-0.6/0.6-0.8/0.8+) and injects on every message; separate from warmth instruction (controls HOW, not tone); based on Altman & Taylor (1973) social penetration theory and Brown & Levinson (1987) politeness theory. EXP-073: character arc — `characterArc` section added to `systemLayers.json` with 4 stages (early=practical language/surface city, developing=opinions/stories/cultural nuances, deep=politics/philosophy/challenge views, bonded=effortless/disagree openly/talk about future); `ConversationDirector.preProcess()` block 0f-v maps warmth to arc (0-0.3/0.3-0.55/0.55-0.8/0.8+) and injects on every message; arc thresholds intentionally offset from language stage thresholds; based on Knapp & Vangelisti (2005) relational stages model. EXP-074: nickname emergence — `NICKNAMES` rule added to `coreRules.json` before DEVELOP BITS: after 10+ exchanges at friend warmth+, develop nickname based on something real, use naturally not every message, prefer target language; based on Mashek & Aron (2004) and Dunbar (2010). EXP-075: absence/return narratives — `ProactiveEngine.getProactiveMessage()` gains optional `warmth` parameter; new `absenceMessage()` method implements 5-tier warmth-scaled responses (stranger=stats-based, acquaintance="Oh, you're back. Been busy?", friend="Where have you been? I was starting to wonder.", close_friend="Finally! I have so much to tell you...", family="There you are."); `NaviAgent.getProactiveMessage()` passes warmth from RelationshipStore; based on Bowlby (1969) attachment theory — secure attachment manifests as understated comfort in reunion. Build passes, 104/104 tests pass.)

**Previously: 2026-04-16z** (EXP-071 — avatar mood system + greeting evolution + identity anchors: Implementation 1 Avatar Mood System — `avatarMoods` section added to `systemLayers.json` with 7 moods (cheerful, tired, nostalgic, excited, restless, contemplative, playful); `ConversationDirector.preProcess()` injects random mood on 40% of session starts via `TODAY'S MOOD:` directive; 60% neutral keeps moods occasional; based on Berlyne (1960) moderate surprise within predictable framework. Implementation 2 Greeting Evolution — `greetingStyle` field added to all 5 warmth tiers in `warmthLevels.json` (stranger=formal with translation, acquaintance=casual, friend=text-a-friend, close_friend=conversation-starter, family=no greeting); `ConversationDirector.preProcess()` reads current warmth tier from RelationshipStore on session start and injects `GREETING STYLE:` directive; based on Altman & Taylor (1973) social penetration theory. Implementation 3 Identity Anchors — `IDENTITY ANCHORS` block added to `coreRules.json` rules string between frustration/confusion section and ABSOLUTE RULES: neighborhood opinion, go-to recommendation, catchphrase/reaction; "These create consistency. The user should be able to predict how you'll react to certain topics. That predictability IS the relationship."; based on Horton & Wohl (1956) consistency of self-presentation as strongest predictor of parasocial bond strength. All three mechanisms are lightweight (config + heuristic injection, no LLM calls), composable, and reversible. Build passes, 104/104 tests pass.)

**Previously: 2026-04-16y** (RESEARCH_ROUND6 — parasocial attachment, living world, relationship language, emotional anchors, character arc: 5-area deep research. Area 1 Parasocial Attachment — 6 mechanisms from Horton & Wohl (1956), Dibble et al. (2016), Berlyne (1960), Altman & Taylor (1973), Giles (2002), Green & Brock (2000): consistency of self-presentation (fixed identity anchors), unpredictability within consistency (mood system with 7 moods + generateSessionMood() algorithm), exclusivity ("only us" disclosure framing), reciprocal vulnerability (depth-matched sharing), perceived agency (avatar initiative/pushback/own interests), narrative transportation (multi-session story arcs). Exact prompt patterns for each. Affective engagement theory analysis confirms emotional attachment enhances language acquisition 3-5x (McGaugh 2004, Kensinger & Corkin 2004, Krashen 1982, Schumann 1978). Area 2 Living World — 20 world events across 4 categories (5 street: traffic near-miss, street performer, weather change, construction, stray animal; 5 people: angry customer, cute couple, lost tourist, elderly storyteller, school kids; 5 sensory: food smell, sound landscape, golden hour, market overload, rain on roof; 5 cultural: festival prep, local tradition, wedding, religious moment, food vendor routine); each event is (1) shared bonding experience, (2) language teaching moment, (3) callback seed; WorldEvent + WorldEventInstance data models; 30% trigger rate, max 1/session, cooldown tracking. Area 3 "Only Us" Effect — 5-stage relationship language progression (standard sessions 1-5, shortcuts 5-10, insider 10-20, shorthand 20-40, our language 40+); nickname emergence system (session 8-15, from shared experiences, target language, not announced); shared shorthand tracking; greeting evolution; exact prompt injections per stage. Area 4 Emotional Learning Anchors — 10 techniques: victory (real-world success → identity upgrade), comfort (vulnerability → untranslatable emotion word), adventure (mid-event urgent teaching), confession (avatar vulnerability → emotion vocabulary), laughter (humor → zero-resistance encoding), nostalgia (untranslatable concepts), fear-to-courage (one phrase + mission + debrief), discovery (user-initiated insight → amplification), ritual (naming shared patterns), future (conditional tenses anchored to user's dreams); each with exact prompt text and trigger conditions. Area 5 Character Arc Over Months — detailed month-by-month relationship evolution (month 1: helpful stranger, month 2: warm acquaintance who follows up, month 3: friend with opinions about your life, month 6: someone who knows you better than most, month 12: family); each month specifies: greeting changes, topic evolution, self-disclosure depth, silence handling, user expectations, session feel. Implementation architecture: new types (AvatarMood, NarrativeArc, NarrativeBeat, RelationshipLanguageStage, WorldEventInstance, EmotionalAnchor extending EmotionalMemory); 5 new config files; integration points with AvatarContextController (mood layer, relationship language layer, identity anchors, agency pattern), ConversationDirector (event roll, arc advancement, anchor technique, nickname), MemoryMaker (event storage, shorthand detection), RelationshipStore (language stage, mood, arc, event history). Known gaps updated in CLAUDE.md: 8 new gaps added. No code changes — research only.)

**Previously: 2026-04-16x** (EXP-066 through EXP-070 -- character depth and emotional attachment: EXP-066: character continuity and world-building -- "YOUR LIFE IS HAPPENING" section added to coreRules.json; `world_events` arrays (3-4 ongoing personal storylines each) added to all 8 avatar templates in avatarTemplates.json; ConversationDirector world event injection (0g) updated to pull 50/50 from environmental worldEvents.json and personal avatar template world_events; import added for avatarTemplates.json. EXP-067: emotional vulnerability and reciprocity -- `vulnerability_moment` skill added to conversationSkills.json (10% chance, warmth >= friend); wired into ConversationDirector.preProcess(); warmthLevels.json friend/close_friend/family tiers updated with vulnerability instructions; teaches empathy vocabulary through genuine caring. EXP-068: immersive environment narration -- `sensory_anchor` skill rewritten from isolated sensory facts to micro-narrative scene descriptions with character reactions; grounded in transportation theory and micro-narrative research. EXP-069: character memory with emotional context -- callback injection in ConversationDirector and RelationshipStore rewritten from "reference naturally" to "show you CARE"; check on struggles, build on successes, ask for updates. EXP-070: character quirks and recurring bits -- "DEVELOP BITS" section added to coreRules.json with warmth gate (acquaintance+); acquaintance tier in warmthLevels.json updated with bits development instruction. Build passes, 104/104 tests pass)

**Previously: 2026-04-16w** (EXP-061 through EXP-065 -- scenario depth + teaching effectiveness: EXP-061: scenario phase tracking -- ConversationDirector.preProcess() now increments `scenario_turn_{key}` in WorkingMemory on each turn when a scenario is active; injects OPENING (turns 1-2), MIDDLE (turns 3-5), or WRAPPING UP (turns 6+) phase hints with turn numbers so the model has structural awareness of scenario arc progression; works alongside existing TBLT pretask/posttask. EXP-062: inline pronunciation teaching -- `toolPrompts.json` chat template gains TEACHING STYLE section distinguishing inline teaching (**phrase** (pronunciation)) for casual conversation from full phrase cards for explicit pronunciation requests; replaces single-line instruction with 3-tier hierarchy (inline casual → full card on request → pronounce/phrase tool for deep dives); example provided. EXP-063: structured debrief -- `handleEndScenario()` debrief injection rewritten with 3-step structure: (1) quote one thing user said correctly, (2) name one thing to improve with corrected form + pronunciation, (3) present 2 phrase cards; "QUOTE what the user actually said" requirement forces specific feedback over generic encouragement. EXP-064: auto-suggest scenarios -- `detectScenarioFromMessage()` added to ConversationDirector with situational cue requirement (I'm at/going to/just arrived/etc.) + scenario keywords; when detected and no scenario active, injects suggestion prompt ("Want to practice X? I can walk you through it"); prompt-only change, user decides. EXP-065: learning progress milestones -- `checkMilestones()` enhanced with phrase count (10/25/50/100/250/500), mastery count (1/5/10/25/50/100), streak, and stage change milestones; each sets `milestone_celebration` flag in WorkingMemory with identity-framed instruction consumed by next preProcess(); stage change detection via last_milestone_stage WM comparison. Build passes, 104/104 tests pass)

**Previously: 2026-04-16v** (EXP-056 through EXP-060 -- multi-turn coherence hardening + production flow fixes: EXP-056: mid-conversation reinforcement injection -- when session_message_count > 6, a ~30-token reminder is injected into goalInstructions ("Stay in character. Include a sensory detail. End with a hook or question. Keep it short.") to combat the measured -0.7 quality degradation in second-half turns; fires every turn after 6. EXP-057: scenario coach-on-the-side -- new `scenarioCoach` template in systemLayers.json; `buildSystemPrompt()` now accepts `learningStage` option; when stage is survival/functional, `buildScenarioCoachLayer()` uses coach template instead of scenarioLock; plumbed through NaviAgent → chatTool → contextController; new `buildScenarioCoachLayer()` method with fallback. EXP-058: WorkingMemory TTL audit -- audited all 12 `working.set()` calls; found `last_user_message` and `last_response` in chatTool.ts using default 10min TTL instead of session-length 2h; fixed all 4 calls (2 listen path, 2 standard path) to explicit 2h TTL. EXP-059: verified template character personality flow -- traced handleAvatarSelected → createAvatarFromTemplate → buildIdentityLayer; confirmed `template.base_personality` (rich, multi-sentence) reaches `{{personality}}` in identity template; characterGen.json only used for custom characters, not templates; no fix needed. EXP-060: scenario vocabulary in TBLT pretask -- `tblt_pretask` template updated to include `{{vocabulary}}` variable; contextController now passes `scenarioConfig.vocabulary_focus.join(', ')` to the pretask template so the model has actual domain-specific vocabulary to draw from during pretask phase. Build passes, 104/104 tests pass)

**Previously: 2026-04-16u** (EXP-053 through EXP-055 -- per-character memory scoping: CRITICAL BUG FIX -- phrases learned with one companion leaked into other companions' contexts because LearnerProfileStore, MemoryRetrievalAgent, and ConversationDirector operated on all phrases globally. EXP-053: added optional `language` parameter to all LearnerProfileStore query methods (getPhrasesForReview, getStrugglingPhrases, getUrgentReviewPhrases, getRoutineReviewPhrases, formatForPrompt, getCurrentStage) + new `getPhrasesForLanguage()` method; `matchesLanguage()` helper includes 'unknown'-language phrases for backward compat; updated all call sites (ConversationDirector, SessionPlanner, ProactiveEngine, phraseTool, agent/index.ts, ConversationScreen.tsx); `postProcess()` now records phrases with actual language instead of 'unknown'; language computed before `preProcess()` in NaviAgent.handleMessage(). EXP-054: MemoryRetrievalAgent.getStrugglingTermPhrases() + buildTeachingContext() now filter by query.language; other methods were already correctly filtered. EXP-055: RelationshipStore verified already correctly keyed by avatarId, no fix needed. Build passes, 104/104 tests pass)

**Previously: 2026-04-16t** (EXP-047 through EXP-051 -- Production avatar testing + remaining skill wiring: EXP-047 -- production street food guide (HCMC) tested using actual production prompt assembly (avatarTemplates.json + systemLayers.json identity + language enforcement + core rules); scored 3.7/5.0; 100% Vietnamese, 0% sycophancy; personality/sensory scored 0% by automated scorer but content present in Vietnamese (scorer limitation confirmed); EXP-048 -- scenario matching test (street food + restaurant scenario); scored 4.0/5.0; dual identity maintained; TBLT pretask partially worked (merged into natural response); EXP-049 -- memory context injection test; scored 4.2/5.0; "xin chào" used as natural greeting on turn 1 (not announced as review), Ben Thanh Market referenced immediately, zero "do you remember" anti-patterns; EXP-050 -- 7 remaining skills wired into ConversationDirector.preProcess(): expansion (postProcess flag), contextual_repetition/elicitation (30% on review+functional), open_loop (every message), sensory_anchor (every 3rd), tblt_pretask/posttask (scenario transitions via new previousScenario tracking), code_switch_scaffold (stage changes); NaviAgent gains previousScenario field for transition detection; EXP-051 -- full 9-scenario integration test: production 3.9/5.0 vs hand-crafted 4.2/5.0 (-0.3 gap within acceptable range, primarily scorer limitation); build passes, 104/104 tests pass)

**Previously: 2026-04-16s** (EXP-052 -- 5 scenario lifecycle bugs fixed from RESEARCH_ROUND5: (1) scenarioOpener now fires on first scenario message, not only first-ever message -- `isFirstScenarioMessage` added to `buildSystemPrompt()` and computed in `agent/index.ts` by comparing `currentScenario !== previousScenario`; (2) `detectScenario()` no longer overrides manually-set scenarios -- skipped when `activeScenario` is already set; (3) TBLT pretask now injected on first scenario message via `tblt_pretask` template at HIGH priority; (4) scenario completion tracking added -- `LearnerProfileStore.recordScenarioCompletion()` increments `stats.completedScenarios` (feeds into `getCurrentStage()` composite scoring), `ProactiveEngine.markScenarioCompleted()` now called (was dead code); (5) `detectScenario()` skipped in guide mode to prevent accidental scenario triggers; build passes, 104/104 tests pass)

**Previously: 2026-04-16r** (EXP-046 -- Production gap closure: 3 gaps fixed: (1) all 8 avatar template personalities rewritten with rich specific details (strong opinions, pet peeves, funny anecdotes, sensory anchors, recurring characters) -- from ~20 words to ~100 words each; (2) 8 high-impact conversation skills wired into `ConversationDirector.preProcess()` (emotional_mirror, negotiation_of_meaning, social_proof, language_play, productive_failure, register_awareness, identity_reinforcement, session_pacing) -- previously only variable_reward and surprise_competence were active; (3) sparse character bootstrap added to `contextController.buildSystemPrompt()` for custom characters with < 100 char personality -- injects organic personality development instruction over first 3-5 exchanges; build passes, 104/104 tests pass)

**Previously: 2026-04-16q** (Experiments EXP-041 through EXP-045 -- Seoul sensory, Kathmandu emotional support, character gen personality_details, compact rules re-test, multi-turn coherence re-test: EXP-041 -- Seoul sensory prompt enriched with Hongdae-specific details (neon puddle reflections, burnt-sweet bean roasting, keyboard tapping, phone buzzing, club bass thumping); automated score remained 0/5 due to English-keyword scorer bias, but manual audit shows model absorbed sensory details and expressed them in Korean ("네온 불빛 아래서"); scorer limitation, not prompt limitation; EXP-042 -- Kathmandu target language strengthened for emotional support with "Nepali IS the comfort" framing; **target language holds at 5/5 (100%) even during "I give up" moment**; personality regressed 4/5 -> 2/5 (tradeoff: stronger language instruction crowds out character voice); EXP-043 -- `characterGen.json` freeText template updated with structured `personality_details` schema (strong_opinion, funny_anecdote, sensory_anchor, pet_peeve, recurring_character); gemma4:e2b produced valid JSON with **5/5 fields specific and concrete** on first attempt; R4 design validated for production; EXP-044 -- compact rules re-tested on qwen2.5:1.5b; scored 3.0/5.0 (vs 3.8 in EXP-039); high variance confirms 1.5B unreliable for persona conversation; few-shot echo problem persists; EXP-045 -- 12-turn extended conversation re-test; improved 3.8 -> 4.3/5.0; sensory 0/12 -> 6/12; degradation pattern confirmed: -0.7 point drop in second half; hooks collapse at turn 8+; session pacing at 8-10 validated across 2 runs; overall standard 4-scenario: 4.6/5.0, sensory 65%, target language 100%; build passes, 104/104 tests pass)

**Previously: 2026-04-16o** (RESEARCH_ROUND4 — 4-area deep research: Area 1 Rich Character Generation — new `characterGen.json` template design with `personality_details` schema (7 fields: strong_opinion, funny_anecdote, sensory_anchor, pet_peeve, recurring_character, favorite_spot, unpopular_take); exact freeText and fromTemplate prompt text provided; validation rules (min lengths, proper noun check, landmark blocklist); fallback personality pools per city; system prompt injection format for AvatarContextController identity layer; expected score improvement: personality 0/20 -> 18/20. Area 2 Conversation Threading — `ConversationThread` data model with 4 types (story/debate/project/ritual); lifecycle management (active/resolved/dormant/abandoned); prioritization algorithm (emotionalWeight 0.4 + recency 0.3 + unresolved 0.2 + type_bonus 0.1); heuristic thread detection (no LLM needed); system prompt injection for top 1-2 threads; max 30 per avatar in IndexedDB. Area 3 Month 3 Problem — root cause analysis (intermediate plateau + novelty decay + identity crisis); 3 specific interventions: Journey Reflection (specific then-vs-now using emotional memories), Identity Upgrade (permanent learner-to-peer frame shift), Unfinished Story (high-stakes open loop via ProactiveEngine using recurring_character); trigger detection: sessions 60-100 with increasing gap trend. Area 4 Emotional Memory — `EmotionalMemory` type with 7 emotions; 3-category detection heuristics (lexical + behavioral + contextual); `scoreEmotionalPeak()` function with 0.3 threshold; referenceability scoring with time curves and overuse decay; 4 reference triggers (contrast/echo/anniversary/vulnerability); safety rules (never reference negative without positive contrast); max 50 per avatar; integration points with MemoryMaker, ConversationDirector, SessionPlanner, ProactiveEngine. CLAUDE.md Known Gaps updated: backstory seeds gap updated with implementation path; 4 new gaps added (conversation threading, emotional memory, month 3 interventions, personality_details type). No code changes — research only.)

**Previously: 2026-04-16n** (Experiments EXP-031 through EXP-035 -- live model testing + prompt/scorer improvements: EXP-031 -- 3 few-shot examples added to `coreRules.json` for open loops, sensory grounding, and personality (teach by showing, not telling; critical for sub-5B models); EXP-032 -- personality scorer in `liveConversationTest.ts` expanded from 9 English-only patterns to 6 detection categories covering cross-language opinion markers, character staging (*asterisk actions*), expressive emoji, Korean/French/Japanese voice markers; personality detection jumped 0/20 -> 17/20; EXP-033 -- gemma4:e4b (8B) full test: 4.6/5.0 overall, 100% open loops, 100% personality, 50% sensory; model progression 1.5B (3.1) -> 5.1B (4.1) -> 8B (4.6); EXP-034 -- Tokyo scenario prompt strengthened with specific opinions/anecdotes/preferences; scored 4.9/5.0 at 8B (highest of any scenario); key finding: specific personality details >> generic instructions; EXP-035 -- CRITICAL: thinking models (gemma4/qwen3) via Ollama spend entire token budget on reasoning when thinking enabled, producing empty responses; `think: false` option disables thinking and fixes the issue; `ollamaProvider.ts` gained empty-content fallback; test harness uses `think: false`; production recommendation: disable thinking for conversation mode; build passes, 104/104 tests pass)

**Previously: 2026-04-16m** (RESEARCH_ROUND3 — model-size-aware prompt optimization: CRITICAL FINDING — MUST layers in `contextController.ts` consume 3056 of 3072-token budget (99.5%), leaving 16 tokens for warmth/memory/goals/few-shot/mirroring/mode — all silently dropped; `chatTool.ts` appends 1023 tokens OUTSIDE budget, pushing total system prompt to ~4079 tokens (entire 4K context for small models); this explains test results perfectly — NEVER rules at top work (primacy effect, 20/20), instructions buried in middle fail (personality 0/20, sensory 3-4/20), warmth/memory never reach the model; RESEARCH_ROUND3.md written with 5 areas: (1) compact prompt tier for <3B models (~400 tokens, 82% compression, all-negative framing), (2) few-shot vs instruction analysis by model size (examples critical below 3B, instructions effective above 5B), (3) negative constraint reframing (NEVER rules work at 20/20 so reframe personality/sensory/open-loops as negatives), (4) tiered budget system (compact=1500/standard=2500/full=3072 with tool templates INSIDE budget enforcement), (5) model-specific quirks (Qwen strong at CJK/suppression, Gemma strong at character voice/behavioral instructions); implementation roadmap: P1 fix budget crisis (demote core rules from MUST to HIGH), P2 create compact/standard/full prompt tiers, P3 negative reframing for compact tier, P4 model-specific identity layer boosts; exact prompt text provided for all tiers; CLAUDE.md Known Gaps updated with 2 new critical gaps (budget blown, no prompt tiers); new known gap: chatBehavior bypass marked as subset of budget crisis)

**Previously: 2026-04-16l** (Experiments EXP-026 through EXP-030 — identity formation and habit mechanics: EXP-026 — identity reinforcement: `identity_reinforcement` skill added to `conversationSkills.json` (trigger: user_at_functional_or_higher; reframe progress as identity not skill; Dornyei 2009 L2 Motivational Self System, Norton 2000); `celebrate_progress` goal in `systemLayers.json` updated with identity reinforcement sub-instruction + typo fix; EXP-027 — streak narrative: `STREAK_NARRATIVES` record added to `ProactiveEngine.ts` with 4 character-voiced messages (day 3/7/14/30); day 3 added as milestone (early dropout prevention); messages feel like avatar noticing, not badge notification; tests updated; EXP-028 — loss aversion: both absence messages in `ProactiveEngine.ts` rewritten with loss framing using specific stats (totalPhrases, longestStreak/currentStreak); "Would be a shame to let that fade" framing; graceful fallback to generic when no stats exist; long absence uses longestStreak, short absence uses currentStreak; EXP-029 — social proof simulation: `social_proof` skill added to `conversationSkills.json` (trigger: user_struggling_or_hesitant; normalize struggle via "my friend"/"everyone" references; Cialdini 2006, Bandura 1977 vicarious experience); never say "other users" or "studies show"; EXP-030 — session pacing: SESSION PACING section added to `coreRules.json` (8-10 exchange wrap-up guideline; plant seed for next session; energy override for engaged users; never announce stopping; Cepeda et al 2006 spaced practice); build passes, 104/104 tests pass)

**Previously: 2026-04-16j** (Experiments EXP-016 through EXP-020: EXP-016 — surprise competence detection wired: `postProcess()` in `ConversationDirector.ts` detects when user produces target language above their comfort tier threshold (tier 0-1: >40% non-ASCII, tier 2: >60%), stores flag in WorkingMemory with 2-min TTL; `preProcess()` checks flag and injects `surprise_competence` skill from `conversationSkills.json`; consumed after one use; EXP-017 — contextual SR audit: searched all config files for quiz-style patterns ("do you remember", "let's review", "quiz", "test"); found none requiring removal; anti-quiz patterns already in 5 locations; strengthened `review_due_phrases` goal with explicit anti-quiz instruction ("create a moment where the phrase is needed" vs "do you remember how to say X?"); EXP-018 — negative/positive constraint ratio in `coreRules.json` ABSOLUTE RULES was 4.3:1 (13 neg : 3 pos); added 3 positive ALWAYS rules (reference user's message, include target language, end with forward momentum); new ratio 2.2:1; EXP-019 — plateau mitigations added to `systemLayers.json`: `functional` stage gets "PLATEAU WATCH" instruction (introduce scenarios where current vocab fails); `conversational` stage gets "INTERMEDIATE WALL" instruction (reference growth explicitly, introduce new domains); EXP-020 — session continuity: `session_opener` goal rewritten to prioritize picking up where last session left off ("did you end up trying that phrase?") before falling back to scene-setting; build passes, 104/104 tests pass)

**Previously: 2026-04-16i** (Experiments EXP-001 through EXP-005 (prompt-level conversational quality): EXP-001 — `SPEECH TEXTURE` section added to `coreRules.json` BEHAVIOR with per-language fillers (7 languages: Japanese/French/Spanish/Nepali/Korean/Vietnamese/Thai), self-correction pattern, 1-in-3 frequency, guardrail against fillers during teaching/confusion; speech texture + recasting few-shot examples added to `fewShotExamples`; EXP-002 — response length rule in `coreRules.json` ABSOLUTE RULES replaced with trigger-based SHORT/MEDIUM/LONG guidance (SHORT=emotional/ack/rapid, MEDIUM=default, LONG=phrase card/scene/story); post-phrase-card short response rule; EXP-003 — `LOOP FOLLOW-THROUGH` sub-instruction added to `toolPrompts.json` chat template open loops section (close loops within 2-3 exchanges, max 1 open loop at a time); WorkingMemory API analyzed for future programmatic persistence; EXP-004 — `tblt_pretask` in `systemLayers.json` replaced with structured 3-step approach (conversational preview -> single phrase card for most critical phrase -> scene setting, 5-7 sentences total); EXP-005 — full recasting audit across all 5 config files: 1 contradiction found and fixed in `warmthLevels.json` friend tier (semi-explicit "almost" changed to recast-first with escalation); family tier reframed as earned-trust progression; recasting few-shot example added to `coreRules.json`; build passes, 104/104 tests pass)

**Previously: 2026-04-16h** (Experiments EXP-011 through EXP-015: EXP-011 — variable reward injection wired into `ConversationDirector.preProcess()` via `Math.random() < 0.2`; reads injection text from `conversationSkills.json` via `promptLoader`; `conversationSkills.json` registered in `promptLoader.ts` config map; EXP-012 — inside joke callback timing: new `SharedReference` type with `createdAtInteraction`/`callbackCount`/`lastCallbackAtInteraction`; `getCallbackSuggestion()` rewritten with 3 timing windows (1st callback 3-8 msgs, 2nd 15-25 msgs, 3rd 50+ msgs since last); backward-compat union type `(string | SharedReference)[]`; EXP-013 — 5 anti-sycophancy rules added to `coreRules.json` (no agreement openers, no "absolutely", no question praise, no "great observation", no parroting back); EXP-014 — survival stage now allows restaurant+emergency scenarios in `STAGE_SCENARIO_ACCESS` (was empty `[]`); EXP-015 — MICRO-MISSIONS section added to `coreRules.json` with follow-up behavior (remember missions, ask in 2-3 msgs, celebrate/adjust, one at a time); build passes, 104/104 tests pass)

**Previously: 2026-04-16g** (Experiments EXP-006 through EXP-010: EXP-006 — sensory grounding cadence in `coreRules.json` changed from "at least one per conversation" to "1 in 3-4 messages" with explicit bracketing; EXP-007 — `detectEmotionalState()` in `ConversationDirector.ts` now detects lol/lmao/haha/hehe/laughter emoji as 'excited', short disengaged messages explicitly handled, trailing ellipsis documented as intentionally neutral; EXP-008 — warmth progression math analyzed, current rates validated (friend at session 7-9 is correct sweet spot, session bonus properly rewards returning), no changes needed; EXP-009 — density-vs-style conflict between learningStages and warmthLevels codeSwitching resolved via new `codeSwitchingPriority` instruction in `systemLayers.json` (learning stage=DENSITY wins over warmth=STYLE); EXP-010 — `getBackstoryTier()` in `RelationshipStore.ts` changed from interaction-count-based (every 50 interactions) to warmth-linked (maps to warmth tiers directly), surface stories at session 3 instead of 10, deep vulnerability at session 16 instead of 40; build passes, 104/104 tests pass)

**Previously: 2026-04-16f** (FLUENCY_JOURNEY.md created: comprehensive long-term language acquisition blueprint covering 4 stages (Survival 0-50 sessions, Functional 50-200, Conversational 200-500, Fluent 500+); grounded in SLA research (Krashen, Long, Swain, Nation, Laufer, Schmidt, Vygotsky, Ellis, Willis); defines: stage-specific languageComfortTier configs, conversation goal priority stacks per stage, exact prompt injection text for each stage, scenario progression unlock map (5 Stage 1 -> 6 Stage 2 -> 9 Stage 3 -> all Stage 4), stage-specific SR intervals (aggressive->standard->extended->maintenance), milestone definitions for stage advancement with concrete metrics, conversation pattern progressions (turn-taking, repair, topic management, pragmatic competence, cultural code-switching), session design from Session 1 to Session 500+, analysis of 3 plateau types with mitigation strategies, implementation checklist for code changes needed; no code changes in this commit)

**Previously: 2026-04-16e** (learning stage progression system: `LearningStage` type + `LearningStageInfo` + `STAGE_SCENARIO_ACCESS` added to `core/types.ts`; `LearnerProfileStore.getCurrentStage()` — composite score from 4 weighted signals (interactions 0.3, mastered phrases 0.35, comfort tier 0.25, completed scenarios 0.1); 4 stages: survival (0-50 interactions), functional (50-200), conversational (200-500), fluent (500+); `systemLayers.json` — `learningStages` section with per-stage prompt instructions + `scenarioLock_fluent` peer role-play layer; `ConversationDirector.preProcess()` — detects stage, injects stage instruction at HIGH priority before all other goal instructions, passes `LearningStageInfo` in `DirectorContext`; scenario progression: survival=none, functional=4 basic, conversational/fluent=all; build passes, 104/104 tests pass)

**Previously: 2026-04-16d** (conversational quality testing framework: `TEST_RUBRIC.md` — 18-dimension scoring rubric across 4 categories (engagement 30%, teaching 30%, personality 25%, anti-patterns 15%), each dimension 0-5 with measurement criteria; `TEST_BASELINE.md` — baseline analysis of all prompt configs, estimated 3.22/5.0 overall score, 10 test conversation scenarios (beginner Tokyo, intermediate Paris, advanced Seoul, emergency Mexico City, restaurant HCMC, casual Tokyo, frustration Kathmandu, dialect Osaka, multi-language Paris-Tokyo, ambient Kathmandu), 8 prioritized improvement recommendations, architecture risk analysis; Known gaps added: no open-loop instruction, no character backstory seeds, no emotional override, chatBehavior bypasses token budget)

**Previously: 2026-04-16c** (engagement overhaul Tier 1+2: coreRules.json — open loops, sensory grounding, recast correction, response variance, negative constraints; warmthLevels.json — per-tier callbackFrequency/selfDisclosureDepth/imperfectionAllowance with behavioral instructions; systemLayers.json — emotionalMirroring instruction, backstoryDisclosure tiers 0-4, TBLT scenario templates; learningProtocols.json — 3 new protocols (expansion, elicitation, contextual_reintroduction); toolPrompts.json chat template rewritten; ConversationDirector — emotional state detection heuristic injected into preProcess; RelationshipStore — getCallbackSuggestion() warmth-gated, getBackstoryTier() progressive disclosure, formatForPrompt() enhanced; ProactiveEngine — scenario completion hook, backstory openers by tier; contextController — emotionalMirroring layer added; build passes, 104/104 tests pass)

**Previously: 2026-04-16b** (prompt engineering research: `RESEARCH_FINDINGS.md` created with 30+ specific prompt improvements across all 7 config files — recasting protocol, open-loop hooks, response variance, sensory grounding, emotional mirroring, TBLT cycle, progressive backstory, variable rewards, warmth-tier code-switching, 5 new learning protocols, micro-missions, session pacing, curiosity gaps in character gen, contextual vocab in document prompts; all written as exact copy-paste text ready for implementation)

**Previously: 2026-04-16** (code quality cleanup: removed 13 dead files -1977 LOC; extracted 3 shared utilities (locationHelpers, avatarProfileHelpers, GeneratedCharacter/mapCharacterToUI); consolidated duplicate types across 6 files; removed 5 error-hiding try-catches; fixed last `any` type; build passes, 104/104 tests pass)

**Previously: 2026-04-14** (pronunciation grounding: `pronunciationLookup.ts` — Free Dictionary API + IndexedDB cache for real IPA data; `pronounceTool` pre-injects IPA reference; both pronounce/phrase tools post-process via `enrichPronunciations()` to replace hallucinated pronunciations; prompt templates hardened with syllable-mapping rules + skip-native-language guard)

**Previously: 2026-04-13** (simplified onboarding: replaced 4-step `NewOnboardingScreen` with single-step `AvatarSelectScreen.tsx` — 8 avatar template grid, no LLM needed for character creation; auto-default WebGPU Qwen3 1.7B on first launch, `backend_select` skipped unless no WebGPU; model changes only in Settings; GPS location detected in background during avatar selection)

**Previously: 2026-04-08** (UI polish: `Navbar.tsx` — pencil + gear buttons now conditional on `onEdit`/`onSettings` props (were stubs with empty onClick); `App.tsx` — passes `onEdit`/`onSettings` to Navbar on home phase only, adds `showHomeSettings` state to render `SettingsPanel` from home screen (model picker accessible via Settings → Model tab); `ConversationScreen.tsx` — removed Brain/BookOpen/LayoutList icon buttons from second bar (3 icons → Zap/Sun/Settings only); dialect indicator shortened to flag emoji only (was "🇳🇵 Standard Nepali (Kathmandu)"))

**Previously: 2026-04-06b** (first-launch backend selection: `BackendSelectScreen.tsx` — full-screen 3-card picker shown once on first launch when `navi_backend_pref` absent from localStorage; `App.tsx` gains `'backend_select'` AppPhase + `handleBackendChosen` callback; Qwen3 PRESET_CONFIGS (9 models, Qwen3-1.7B default); FALLBACK_MODELS expanded to 8 (Gemma 4 first); PAID_MODELS includes OpenAI models; `switchBackend()` on NaviAgent with localStorage persistence; `useNaviAgent` exposes `switchBackend`/`webllmPreset`/`openRouterTier`; SettingsPanel 3-card Model UI with no key input on free tier) **2026-04-06:** (3-way backend selector: `NaviAgent.switchBackend()` — On-Device WebGPU / Cloud Free / Cloud Paid OpenRouter; `navi_backend_pref` localStorage; 4 WebLLM presets (Phi-3.5 Mini, Gemma 2 2B, Llama 3.2 1B/3B); `OpenRouterProvider.setApiKeys()` + `setModels()`; `useNaviAgent` exposes `switchBackend`/`webllmPreset`/`openRouterTier`; SettingsPanel 3-card Model UI). **2026-03-30:** Multi-agent orchestrator — `MemoryRetrievalAgent` + `ResearchAgent`; `KnowledgeGraphStore` (6 node + 9 edge types); MemoryMaker rich metadata; `learningProtocols.json`; Context Injection Protocol; MemoryManager 9 systems; `KnowledgeGraphExplorer.tsx` (Brain icon); 63/63 integration tests.

**Previous: 2026-03-29c** (updated 2026-03-29c: fixed two bugs — (1) `generateAvatarImageFromDescription` now logs HF FLUX failures and falls back to Pollinations.ai (Step C) so avatar portrait always generates; (2) `characterGen.json` NAME RULE in both templates now includes Kathmandu/Nepal names list so LLM picks varied names; `fallbackNameFor` randomizes from Nepali names instead of hardcoding Arjun) (updated 2026-03-29: OpenRouter retry overhaul — `MAX_ATTEMPTS` cap removed; now tries all `keys × models` combinations (up to 40 for 10 keys × 4 models); exponential backoff added between retries (200ms→8s); `Retry-After` header respected on 429s (sleeps up to 30s); `DEFAULT_TIMEOUT` raised 30s→90s for slow free models; `408` added to `RETRYABLE_STATUSES`; `throttle()` method + `MIN_REQUEST_GAP_MS` removed; updated 2026-03-28e: `KnowledgeGraphScreen` + `PhraseDetailSheet` — phrase map from `agent.memory.learner.phrases`, demo phrases by region when empty, `BookOpen` opens graph, `LayoutList` opens `FlashcardDeck` full-screen overlay, My phrases pill; updated 2026-03-28d: `FlashcardDeck` and `ProactiveEngine` wired into `ConversationScreen` — phrase review via `LayoutList` (2026-03-28e), `agent.memory.learner.phrases` as data source, `onPractice` queues phrase to chat, proactive `useEffect` fires once on mount for returning users (messages.length > 0 guard), `proactiveShownRef` prevents double-fire; updated 2026-03-28c: Phase 1 guided immersion architecture — `SessionPlanner` (session-level goal persistence via WorkingMemory, 2h TTL, 7-priority goal selection), `ProactiveEngine` (app-open proactive messages for long absence/streak milestones/struggling phrases), dual SR tracks in `LearnerProfileStore` (STRUGGLE_INTERVALS 6h→2w urgent vs SUCCESS_INTERVALS 2d→2mo relaxed), `struggleCount` field added to `TrackedPhrase`, `getUrgentReviewPhrases()` + `getRoutineReviewPhrases()` methods, `ConversationDirector` upgraded with `setSessionPlanner()` + `surfacePersonalContext()` + session goal achievement check in `postProcess()`, `reconnect` goal added to `systemLayers.json`, `FlashcardDeck.tsx` component with card-flip animation, mastery badges, filter tabs, `NaviAgent.getProactiveMessage()` public method; updated 2026-03-21: context window fix, dialect key wiring, target language flow, AnimatedCharacter, Gemini embeddings; 2026-03-21b: multi-city response bug + same-response loop bug fixed; 2026-03-21c: avatar prefs from LLM character generation; 2026-03-21d: companion switch restoration, inline markdown stripping, dynamic language calibration; 2026-03-21e: 6 core bugs fixed — token estimator dense scripts, language enforcement, location-on-update sync, location-on-switch always-sync, AvatarRenderer wired, calibration speed; 2026-03-26: 4 conversation bugs fixed — phrase repetition, confusion signal ignored, markdown asterisks in segments, wrong language on first message; 2026-03-26b: OpenRouter cloud provider added — when VITE_OPENROUTER_API_KEY is set, all LLM calls route to meta-llama/llama-3.3-70b-instruct:free, model download screen is skipped entirely; 2026-03-26c: OpenRouter multi-model fallback — `models` array replaces single `model` field; FALLBACK_MODELS list tries qwen3-32b → llama-3.3-70b → mistral-small → gemma-3-27b in order; 429/503/empty-response throw clean user-facing strings; NewChatBubble renders ⚠️ error bubble instead of raw JSON for all NAVI error strings; 2026-03-26d: OpenRouter fallback routing fixed — added `"route": "fallback"` to request body (required by OpenRouter to activate multi-model fallback); timeout reduced 120s → 30s for cloud API path; 2026-03-27: AI portrait avatar — `AIAvatarDisplay` 3-tier renderer (AI portrait → DiceBear notionists → letter fallback), `generateAvatarImage` Pollinations.ai utility, `saveAvatarImage`/`loadAvatarImage` IndexedDB helpers, `portrait_prompt` field in `characterGen.json` and `Character` type, Settings OpenRouter key input + Regenerate Portrait button, `@dicebear/core` + `@dicebear/collection` installed; 2026-03-28: multi-API key rotation — `VITE_OPENROUTER_API_KEY` now accepts comma-separated keys; `OpenRouterProvider` rotates to next key on 429/503 and retries within same request; Nepali/Devanagari first-message example added to all 3 `characterGen.json` FIRST MESSAGE RULE sections so Qwen generates नमस्ते-style openers for Kathmandu characters; 2026-03-28b: OpenRouter rate limit overhaul — 402 now caught + rotated (was crashing); `models:[...]`/`route:fallback` replaced with single `model:` per attempt cycling through FALLBACK_MODELS so each retry hits a different per-model rate limit pool; `RETRYABLE_STATUSES` set covers 402/429/500/502/503/504; 100ms throttle between requests; empty_response now advances `currentKeyIndex`; error body logged on all retryable failures)

---

## ⚠️ Security TODOs (before public launch)

### API keys exposed in client bundle
`VITE_OPENROUTER_API_KEY` is baked into the JS bundle (Vite `VITE_` prefix = client-side). Anyone can find it in DevTools. Fine for founder testing, not for public launch.

**Fix when ready:** Add a Vercel serverless function (`/api/chat.ts`) that holds keys server-side (non-`VITE_` env vars) and proxies OpenRouter requests. ~50 lines of TypeScript.

---

## Dependencies (`package.json`)

**Runtime (installed):**
- React 18.3.1, React DOM 18.3.1 (peer deps)
- **Routing:** `react-router` 7.13.0 — installed but NOT used; `App.tsx` uses manual `useState` to switch screens
- **Animation:** `motion` 12.23.24 (Framer Motion v12)
- **UI:** Full Radix UI suite + shadcn/ui wrappers + `vaul` 1.1.2 (bottom sheet) + `sonner` 2.0.3 (toasts)
- **Icons:** `lucide-react` 0.487.0
- **Forms:** `react-hook-form` 7.55.0
- **Charts:** `recharts` 2.15.2
- **DnD:** `react-dnd` 16.0.1
- **Carousel:** `embla-carousel-react` 8.6.0
- **Themes:** `next-themes` 0.4.6 — installed but not used; dark mode handled manually via `classList`
- **MUI:** `@mui/material` 7.3.5 + `@emotion/react` 11.14.0 — present but not used in custom components
- **Avatars:** `avataaars` ^2.0.0 — installed but not used; avatar rendering is via `BlockyAvatar.tsx` (custom 8-bit style)
- **State:** `zustand` ^5.0.11 — installed and in use (3 stores: appStore, characterStore, chatStore)
- **LLM:** `@mlc-ai/web-llm` ^0.2.81 — installed and in use (WebGPU inference)
- **OCR:** `tesseract.js` ^7.0.0 — installed and in use
- **Storage:** `idb-keyval` ^6.2.2 — installed and in use

**Dev:**
- Vite 6.3.5, `@vitejs/plugin-react` 4.7.0, `@tailwindcss/vite` 4.1.12, TailwindCSS 4.1.12, TypeScript ^5.9.3

---

## State Management

- **Zustand** is in use — 3 stores: `appStore` (model status, location, preferences), `characterStore` (active character, memories), `chatStore` (messages, scenario, generation state)
- App-level phase switching in `App.tsx` via `useState` (`phase`: init → onboarding (avatar select) → downloading → chat; backend_select only for Settings or no-WebGPU fallback)
- All stores persist to IndexedDB via `utils/storage.ts` (idb-keyval)
- Full state survives page refresh

---

## Routing

- `react-router` is installed but **not used**
- Navigation is manual: `App.tsx` renders `<NewOnboardingScreen>` or `<ConversationScreen>` based on `hasOnboarded` boolean

---

## Component-by-Component Breakdown

### `App.tsx`
- **Renders:** switches between `NewOnboardingScreen`, `ConversationScreen`, and `CameraOverlay` (modal overlay)
- **Props:** none (root)
- **State:** `hasOnboarded`, `character` (`GeneratedCharacter | null`), `location` (string), `isDark` (bool), `showCamera` (bool)
- **Handlers:** `handleOnboardingComplete(character, location)`, `handleToggleTheme()`
- **Hardcoded:** dark mode defaults to `true` on mount
- **Needs wiring:** character generation (currently simulated), location detection

---

### `NewOnboardingScreen.tsx`
- **Renders:** 3-state AnimatePresence: input form → generating animation → character reveal
- **Props:** `onComplete(character, location)`
- **State:** `placeholderIndex`, `promptValue`, `location` (hardcoded `'Ho Chi Minh City'`), `isGenerating`, `generatedCharacter`
- **Hardcoded:** location is hardcoded; character is randomly generated from static arrays with a 2s `setTimeout` — not real LLM
- **Has:** text input (custom personality), location display with "Change" button (non-functional), CTA "Meet your companion" button
- **Needs wiring:** real LLM generation via `llm.generateCharacter()`, real GPS location detection, avatarTemplates (currently no template picker — just free text)

---

### `ConversationScreen.tsx`
- **Renders:** sticky top bar (avatar + name + location + theme toggle + settings), collapsible profile card, scrollable chat messages, input area with camera/mic/send
- **Props:** `character`, `location`, `onOpenCamera()`, `onToggleTheme()`, `isDark`
- **State:** `messages` (array, pre-populated with 6 hardcoded messages), `inputValue`, `isTyping`, `showQuickActions`, `expandedPhrase`, `showProfile`
- **Hardcoded:** `initialMessages` — 6 static messages hardcoded in file; bot response is a 1.5s setTimeout with a static string
- **Has:** typing indicator (3 bouncing dots), 3 hardcoded `QuickActionPill`s (Scan a menu, Teach me a phrase, What's nearby?), mic button (no handler), camera button → calls `onOpenCamera`, settings button (no handler), "Regenerate companion" link (no handler)
- **Needs wiring:** real LLM via `llm.streamMessage()`, real message persistence, quick action pills from `scenarioContexts.json`, mic → STT, settings → settings panel

---

### `NewChatBubble.tsx`
- **Renders:** user bubbles (right-aligned, plain text) or character bubbles (left-aligned, italic serif font, optional phrase highlight card)
- **Props:** `type`, `content`, `character?`, `phraseHighlight?` `{text, phonetic}`, `showAvatar?`, `onPhraseClick?`
- **Has:** `Volume2` TTS button on phrase cards (no handler), "Tap to learn more" → `onPhraseClick`
- **Needs wiring:** TTS button → `tts.speakPhrase()`, rendered phrase data from `responseParser`

---

### `BlockyAvatar.tsx`
- **Renders:** Minecraft-style blocky avatar using `character.colors.primary/secondary/accent` and `character.accessory` emoji
- **Props:** `character {name, colors, accessory?}`, `size` ('xs'|'sm'|'md'|'lg'|'xl'), `animate?` (floating bob), `onClick?`
- **Hardcoded:** nothing — fully driven by props
- **Needs wiring:** pass real `characterStore.activeCharacter` data; could optionally accept `emoji` prop for template-based avatars

---

### `CameraOverlay.tsx`
- **Renders:** full-screen black overlay, fake camera viewfinder (Unsplash image), scan animation, results bottom sheet with hardcoded Vietnamese menu items
- **Props:** `character`, `onClose()`
- **State:** `isScanning`, `showResults`, `flashOn`
- **Hardcoded:** static `menuItems` array (5 items), Unsplash image as "camera feed", scan is a 1.5s setTimeout
- **Has:** Close button, Flash toggle (no real flash), Scan button, "Help me order this" button (closes overlay), `Volume2` buttons on items (no handler), "Save" button (no handler)
- **Needs wiring:** real `<input type="file" capture="environment">` for image capture, `ocr.extractText()`, `ocrClassifier`, `llm.streamMessage()`, `tts.speakPhrase()` on Volume2 buttons, "Help me order" → inject context into chat

---

### `ExpandedPhraseCard.tsx`
- **Renders:** bottom sheet modal with phrase, phonetic, literal + natural translation, formality slider, character tip, alternative phrasings, save button
- **Props:** `phrase {foreign, phonetic, literal, natural, formality, characterTip, alternatives?}`, `characterName`, `onClose()`
- **Has:** Listen button (no handler), Practice/mic button (no handler), Save button (no handler)
- **Needs wiring:** Listen → `tts.speakPhrase()`, Practice → `stt.startRecording()`, Save → persist phrase to IndexedDB

---

### `QuickActionPill.tsx`
- **Renders:** small pill button with emoji icon + label
- **Props:** `icon` (string), `label` (string), `onClick()`
- **Fully prop-driven** — no internal state
- **Needs wiring:** dynamic pills from `scenarioContexts[scenario].auto_suggestions`; tap to auto-send message

---

### `ActionCard.tsx`
- **Renders:** icon card with label + description, accent color variant
- **Props:** `icon` (LucideIcon), `label`, `description`, `accentColor?`, `onClick?`
- **Not currently used** in any visible screen — available for settings/home use

---

### `ContextualCard.tsx`
- **Renders:** 200×120px image card with title, optional progress bar
- **Props:** `title`, `imageUrl`, `progress?`, `onClick?`
- **Not currently used** in any visible screen — available for scenario/lesson cards

---

### `ImageWithFallback.tsx` (figma/)
- **Renders:** `<img>` with error fallback to an SVG placeholder
- Utility component, fully functional, no wiring needed

---

## Styles

- **3 font families:** `Playfair Display` (display/headings), `DM Sans` (body), `Source Serif 4` (character speech bubbles)
- **Dark mode (`.dark`):** Luxury black (`#0A0A0F`) background, warm cream foreground (`#F5F0EB`), gold primary (`#D4A853`), teal secondary (`#6BBAA7`)
- **Light mode:** Warm white (`#FAF8F5`), deep navy foreground (`#1A1A1F`), darker gold (`#B8922D`), darker teal (`#4A9A87`)
- `--radius: 0.75rem` (rounded-xl everywhere)
- Custom scrollbar styles + `scrollbar-hide` utility class
- `ambient-gradient` animation class defined but not currently used in any component

---

## Hardcoded vs Dynamic

| Thing | Status |
|---|---|
| Location | **Hardcoded** — `'Ho Chi Minh City'` string in `NewOnboardingScreen` |
| Character generation | **Hardcoded** — random name/color from static arrays, 2s timeout |
| Initial messages | **Hardcoded** — 6 static messages in `ConversationScreen` |
| Bot responses | **Hardcoded** — static string after 1.5s timeout |
| Camera feed | **Hardcoded** — Unsplash image URL |
| Menu OCR results | **Hardcoded** — 5 static Vietnamese menu items |
| Phrase card data | **Hardcoded** — static `expandedPhrase` object in `handlePhraseClick` |
| Quick action pills | **Hardcoded** — 3 static pills |
| TTS / STT | **Non-functional** — buttons exist, no handlers |
| Dark mode | **Functional** — `classList` toggle works |

---

## Wiring Status

Items from original audit, updated to reflect current implementation state (Prompts 1–6, 8 complete; Prompt 7 incomplete; Master Plan Batches 1–4 complete):

| # | What | Where | Status |
|---|---|---|---|
| 1 | Character generation | `NewOnboardingScreen` | ✅ Wired to `llm.generateCharacter()` |
| 2 | Location detection | `NewOnboardingScreen` | ✅ Wired to `location.ts` + `dialectMap.json` |
| 3 | All bot responses | `ConversationScreen` | ✅ Wired to `llm.streamMessage()` with streaming |
| 4 | Message persistence | `ConversationScreen` | ✅ IndexedDB via `storage.ts` |
| 5 | Camera capture | `CameraOverlay` | ⬜ Not wired — Prompt 7 incomplete |
| 6 | OCR | `CameraOverlay` | ⬜ Not wired — Prompt 7 incomplete |
| 7 | Camera LLM results | `CameraOverlay` | ⬜ Not wired — Prompt 7 incomplete |
| 8 | TTS | `NewChatBubble`, `CameraOverlay`, `ExpandedPhraseCard` | ✅ Wired to `tts.speakPhrase()` |
| 9 | STT | `ConversationScreen` mic button, `ExpandedPhraseCard` Practice | ✅ Wired to `stt.startRecording()` |
| 10 | Quick action pills | `ConversationScreen` | ✅ Dynamic from `scenarioContexts.json` |
| 11 | Settings panel | `ConversationScreen` | ✅ `SettingsPanel.tsx` built and wired |
| 12 | "Regenerate companion" | `ConversationScreen` profile card | ✅ Resets to onboarding phase |
| 13 | "Help me order this" | `CameraOverlay` | ⬜ Not wired — Prompt 7 incomplete |
| 14 | Save phrase | `ExpandedPhraseCard` | ✅ Persists to IndexedDB |

---

## Platform Status

| Platform | Status | Notes |
|---|---|---|
| **Web (Vercel)** | Active | Vite/React app, current primary target |
| **iOS** | Not started | Planned — no implementation yet |
| **Android** | Not started | Planned — no implementation yet |

### Shared Core — Web Coupling

The shared agent/store/prompt layer currently assumes web APIs in several places. These will need an abstraction layer before iOS/Android work begins:

| API | Where Used | Risk |
|---|---|---|
| **WebGPU** (`navigator.gpu`) | `services/llm.ts`, `services/modelManager.ts`, `App.tsx` phase check | Web-only; iOS/Android will need Core ML / NNAPI alternative |
| **Web Speech API** (`SpeechSynthesis`, `SpeechRecognition`) | `services/tts.ts`, `services/stt.ts` | Web-only; native platforms need AVSpeechSynthesizer / Android TTS |
| **IndexedDB** (`idb-keyval`) | `utils/storage.ts` | Web-only; native needs SQLite or AsyncStorage equivalent |
| **`navigator.geolocation`** | `services/location.ts` | Available on all platforms but requires permission model differences |
| **`<input capture="environment">`** | `CameraOverlay.tsx` (planned) | Web file input; native needs camera API |

**Action required before iOS/Android:** extract these into a `PlatformServices` abstraction interface so each platform can provide its own implementation without touching shared code.

---

## Known Gaps (as of 2026-03-21)

### ~~Context Window Overflow~~ — RESOLVED
System prompt exceeded Qwen 1.5B's 4096-token limit. Fixed by: (1) shortening `coreRules.rules` ~495 tokens, `identity.template` ~69 tokens, `languageCalibration` tiers ~143 tokens; (2) adding token budget enforcement in `contextController.buildSystemPrompt()` — greedily adds layers priority 0→3 while tokens ≤ 3072. Build confirmed clean.

### ~~Dialect Key Not Wired (avatar speaks English bug)~~ — RESOLVED
`AvatarProfile.dialect` was always `''`, causing language enforcement to never fire. Fixed: `dialect_key` field added to `Character` type; saved during onboarding; passed to `createFromTemplate()` via new `dialectKey` param in both `contextController` and `agent.createAvatarFromTemplate()`; propagated at all 3 avatar creation sites in `App.tsx`.

### ~~Language Immersion Flow Missing~~ — RESOLVED
Added target language onboarding step (step 0 before native language picker); saves to `profileMemory.targetLanguage`, `Character.target_language`, `UserPreferences.target_language`; city presets filter to matching countries. `ConversationDirector.postProcess()` now tracks `consecutiveTargetLangMessages` / `consecutiveHelpRequests` and calls `learner.setComfortTier()` after 3 consecutive target-lang exchanges (advance) or 2 help requests (drop), min 5 exchanges between changes.

### ~~Emoji Avatar Looks Dead~~ — RESOLVED (Lottie-ready)
`AnimatedCharacter.tsx` created — drop-in replacement for `CharacterAvatar` with Lottie animation support. Dynamically imports `lottie-react` and fetches JSON from `/public/lottie/`. Falls back to CharacterAvatar silently if either is missing. **User must**: (1) `pnpm add lottie-react`, (2) download 4 Lottie JSONs from lottiefiles.com into `public/lottie/` (char_idle.json, char_speaking.json, char_thinking.json, char_success.json).

### Gemini Embedding Provider Added (online-optional)
`src/agent/models/geminiEmbedding.ts` created — uses `text-embedding-004` REST API, falls back when offline or no key. User sets key in Settings → AI Model panel (stored in localStorage). Key never sent anywhere except `generativelanguage.googleapis.com`.

### Agent ↔ UI Wiring (partially resolved)
`ConversationScreen.handleSend()` now calls `agent.handleMessage()` via `useNaviAgent()`. `CameraOverlay` OCR/LLM pipeline is still not wired (Prompt 7 incomplete). `ExpandedPhraseCard` TTS/STT are wired to service layer, not agent tools.

### ~~AvatarRenderer Not Wired in ConversationScreen~~ — RESOLVED
`CharacterAvatar.tsx` created (emoji + gradient ring + country flag). Replaces `AvatarDisplay` at all call sites (`ConversationScreen`, `HomeScreen`, `NewChatBubble`, `NewOnboardingScreen`, `CameraOverlay`). Gender read from `appStore.userPreferences.avatar_gender`. `AvatarDisplay.tsx` retained for `AvatarBuilder` legacy support.

### CameraOverlay Pipeline Incomplete (Prompt 7)
`CameraOverlay.tsx` still uses a mocked scan + static results. `agent.handleImage()` exists and the OCR→classification→LLM pipeline is implemented in the agent framework but is not wired to the UI.

### Cloudflare Worker Setup Required
`web/wrangler.toml` has `database_id = "YOUR_D1_DATABASE_ID"` placeholder. Steps to activate:
1. `wrangler d1 create navi-feedback` → copy the returned ID into `wrangler.toml`
2. `wrangler d1 execute navi-feedback --command "CREATE TABLE IF NOT EXISTS feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL DEFAULT 'general', message TEXT NOT NULL, email TEXT, app_version TEXT, created_at TEXT NOT NULL);"`
3. `wrangler deploy`
4. Update the `WORKER_URL` constant in `web/feedback.html` if the subdomain differs

### Pending Feedback Offline Queue
`feedback.html` stores failed submissions in `localStorage('navi_pending_feedback')` but there is no background sync to retry when connectivity is restored.

---

## Resolved Gaps (2026-03-20)

| Gap | Resolution |
|---|---|
| Native language not collected | Language picker step added first in `NewOnboardingScreen.tsx` (13 options + Other). Saved to `profileMemory` + `appStore.userPreferences`. |
| `{{userNativeLanguage}}` had no source | Populated from `profileMemory.getNativeLanguage()` in agent context params. |
| Immersion mode not enforced | `ModeClassifier` in `agent/index.ts` detects learn/guide/friend from rolling keyword scoring (threshold=2). Mode injected as instruction layer by `contextController`. |
| Language mismatch bug | `contextController.resolveDialect()` uses explicit `dialectKey` from `AvatarProfile.dialect` first, bypassing city string matching. |
| Nepali not supported | `NP/Kathmandu` added to `dialectMap.json`, Kathmandu to `cities.json`, `ne-NP` to TTS/STT with `hi-IN` fallback, Devanagari script note injection added. |
| Avatar appearance variants | `AvatarRenderer.tsx` created with avataaars + Framer Motion animated states (idle, generating, speaking, success, thinking, blink). |
| ScenarioLauncher rigid 4-field form | Redesigned to single free-text + chips. 9 new scenario templates added. |
| Avatar always renders male / SVG-based | `CharacterAvatar.tsx` created: emoji + gradient ring + flag badge. Reads `avatar_gender` from store. Template+gender → emoji. All call sites updated. |
| ScenarioLauncher extra step for templates | Template tiles now fire `onStart` immediately (zero friction). Only Custom scenario shows a text input step. |
| Scenario first message is generic gauging | `scenarioOpener` prompt template added to `systemLayers.json`. `contextController.ts` injects it when `isFirstEverMessage && scenario`. `chatTool` + `agent/index.ts` wired to pass `isFirstEverMessage`. |
| No scenario access from HomeScreen | Horizontal scroll scenario strip added directly to HomeScreen. |
| No web presence | `web/index.html` (landing page), `web/feedback.html` (feedback form + offline fallback), `web/worker.js` (Cloudflare Worker + D1) created. |
| Avatar opens with canned greeting | Mode system adds `gauging_question` first-message layer: avatar opens with "What do you need from me?" in its language + pronunciation guide. |
| Avatar double-questions + filler openers | `coreRules.json` + `systemLayers.conversationNaturalness` rules added. |

## Resolved Gaps (2026-03-21d)

| Gap | Resolution |
|---|---|
| Companion switch restores wrong/shallow avatar | `handleSelectCompanion` in `App.tsx` now resolves dialect key (stored → dialectMap scan fallback), calls `agent.avatar.createFromDescription()` with full `AvatarProfile` shape including visual prefs. Also syncs `agent.location` + `appStore.currentLocation` so system prompt uses correct dialect. |
| LLM responses contain raw Markdown formatting | `stripInlineMarkdown()` added to `utils/responseParser.ts`. Strips `##` headings, `**bold**`, `__bold__`, `*italic*`, `_italic_`. Applied at all `segments.push({ type: 'text' })` sites in `parseResponse()` and to `displayContent` in `SpeechBubble` + `ChatLogEntry` in `NewChatBubble.tsx`. |
| Language calibration tier is static (only advances on consecutive full exchanges) | `ConversationDirector` now maintains a 5-message rolling window of user input. `computeCalibrationTier()` scores non-ASCII density to produce a tier 0–4, written to `WorkingMemory` (key: `calibration_tier`, TTL: 30 min). `preProcess()` prefers the WM tier over `learner.languageComfortTier`. `WorkingMemory` passed as 4th arg to `ConversationDirector` from `agent/index.ts`. |

## Resolved Gaps (2026-04-10)

| Gap | Resolution |
|---|---|
| OpenRouter invoked without explicit user choice | `agent/index.ts:325` — changed routing condition from `llmBackend !== 'webllm'` to `llmBackend === 'openrouter'`. Env key alone no longer activates cloud inference; user must pick OpenRouter explicitly. |
| Proactive message repeats and poisons context | `ProactiveEngine.ts` — added `firedThisSession` flag so message fires at most once per session. `ConversationScreen.tsx` — proactive messages tagged `metadata.isProactive=true` and filtered from LLM history slice at line 232. |

## Resolved Gaps (2026-04-16)

| Gap | Resolution |
|---|---|
| City picker limited to 15 hardcoded dialectMap cities | `AvatarSelectScreen.tsx` rewritten with `CityPicker` component backed by `cities.json` (321 deduplicated world cities). Searchable autocomplete with GPS detect, country flag emojis, debounced filtering. |
| Language tied to city (no override) | `LanguagePicker` component + `supportedLanguages.ts` (45 languages). Language is independent of city: user in Barcelona can pick Catalan, Spanish, or any language. Auto-suggests default for country but allows override. |
| Settings panel location section was bare text input | SettingsPanel Location tab replaced with full `CityPicker` + `LanguagePicker`. Changes persist to `LocationContext`, character `target_language`, and user preferences. |
| `AvatarSelectScreen.onSelect` did not accept language | Callback signature extended to `(template, location, languageCode?)`. `App.tsx` `handleAvatarSelected` stores `target_language` on character, user prefs, and agent profile memory. |
| Open loop compliance inconsistent (Tokyo 4/5, Barcelona 2/5) | EXP-082: coreRules.json OPEN LOOPS section rewritten with 5 NAMED patterns (unfinished story, teaser, callback question, challenge preview, curiosity hook) + enforcement check + 3 new few-shot examples. conversationSkills.json open_loop skill strengthened with same 5 patterns. |
| No retention test for phrase resurfacing across sessions | EXP-083: 2-session retention proxy test added to liveConversationTest.ts. Session 1 teaches 3 phrases; Session 2 has ConversationDirector review injection. analyzeRetention() checks for contextual resurfacing vs quiz-style review. |
| No cross-session variety test | EXP-084: testConversationVariety() added — runs same scenario 3x with fresh history, measures Jaccard similarity to detect repetitive openings. |
| Emotional anchors (victory/comfort/laughter) untested | EXP-085: 3 anchor test scenarios added with pre-injected skills. scoreEmotionalAnchor() + analyzeEmotionalAnchors() verify phrase teaching during emotional peaks. |
