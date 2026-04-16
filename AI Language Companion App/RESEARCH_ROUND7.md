# NAVI Research Round 7: Universal Location Personality, Dialect Bridging, Real-User Testing, Missing Languages

**Date**: 2026-04-16
**Focus**: Making NAVI work for ANY city on Earth, not just the 16 in dialectMap.json. Designing the real-user testing protocol. Identifying the next wave of languages.

**Core thesis**: The test data tells a clear story. Seoul 5.0, Paris 4.9, Barcelona 3.7. The gap is not about prompt quality -- it is about how much structured cultural data the system provides to the LLM. Cities with rich dialectMap entries, detailed avatar templates, and deep slang_era data produce dramatically better avatars than cities where the LLM must improvise from its training data alone. To make NAVI work everywhere, we need a tiered strategy that adapts the prompt architecture based on how much the LLM already knows about a location.

---

## Table of Contents

1. [Research Area 1: What Makes Location-Specific Personality Work](#research-area-1-what-makes-location-specific-personality-work)
2. [Research Area 2: Multi-Language User Journeys and Dialect Bridging](#research-area-2-multi-language-user-journeys-and-dialect-bridging)
3. [Research Area 3: Real-World Testing Gaps](#research-area-3-real-world-testing-gaps)
4. [Research Area 4: Missing Languages and Scripts](#research-area-4-missing-languages-and-scripts)
5. [Implementation Architecture](#implementation-architecture)
6. [Priority Ranking](#priority-ranking)

---

## Research Area 1: What Makes Location-Specific Personality Work

### The Score Gap Explained

Test data across all experiment rounds:

| City | Best Score | dialectMap entry | Avatar template personality | Slang era data | Cultural notes |
|------|-----------|-----------------|---------------------------|----------------|----------------|
| Seoul | 5.0 | Full (3 gens) | Rich (hand-crafted test) | 9 terms | Age hierarchy, speech levels |
| Kathmandu | 4.9 | Full (3 gens) | Rich (hand-crafted test) | 9 terms | Hindu/Buddhist mix, Devanagari |
| Paris | 4.9 | Full (3 gens) | Rich (hand-crafted test) | 9 terms | Bonjour rule, vous/tu |
| Tokyo | 4.8 | Full (3 gens) | Rich (hand-crafted test) | 9 terms | Formality, bowing |
| HCMC | 4.8 | Full (3 gens) | Rich (production template) | 9 terms | Saigon name, coffee culture |
| Barcelona | 3.7 | Full (3 gens) | Minimal (test only) | 4 terms | Catalan/Spanish mix |

The pattern is clear across two dimensions:

**Dimension 1: Structured cultural data in the system prompt.** Seoul, Paris, Tokyo, and Kathmandu all have: (a) rich dialectMap entries with 3 generational slang tiers and cultural notes, (b) hand-crafted test prompts with specific personality details (opinions, anecdotes, sensory anchors), (c) scenario templates that reference local specifics. Barcelona has the dialectMap entry but was tested with a minimal personality prompt -- no specific opinions, no sensory details, no world events. The 1.2-point gap (4.9 vs 3.7) is almost entirely explained by the personality layer, not the dialect layer. Barcelona scored 5/6 on dialect markers but 2/5 on personality and 0/5 on sensory grounding.

**Dimension 2: The LLM's inherent knowledge of the city.** This is the confound. Seoul, Paris, and Tokyo are among the most heavily represented cities in LLM training data. The LLM "knows" what a Parisian cafe smells like, what Shibuya sounds like at night, what Korean age-hierarchy dynamics look like. When the system prompt says "share a sensory detail about your neighborhood," the LLM has deep cultural knowledge to draw from for these cities.

For Barcelona, the LLM still has good knowledge -- it is a major tourist destination. But the system prompt gave it less structured personality data to work with, and the model did not compensate by generating its own sensory details the way it did for Seoul and Paris.

### The Critical Insight

**Structured prompt data matters MORE than LLM inherent knowledge for cities where the LLM has decent training coverage.** The LLM knows plenty about Barcelona, but without the prompt telling it to have opinions about Gothic Quarter tapas bars, it defaults to generic helpfulness. The prompt provides the CHARACTER; the LLM provides the KNOWLEDGE.

For cities where the LLM has minimal training data, both are needed -- and the structured prompt data becomes the primary source of personality AND culture.

### City Knowledge Tier System

#### Tier A: Global Megacities (LLM has deep, nuanced knowledge)

**Cities**: Tokyo, Paris, New York, London, Seoul, Shanghai, Bangkok, Dubai, Istanbul, Sydney, Toronto, Los Angeles, Berlin, Rome, Mumbai, Singapore, Hong Kong, Barcelona, Amsterdam, Moscow

**LLM knowledge profile**: The LLM has extensive training data covering: neighborhood-level geography, restaurant/bar/cafe culture, public transit systems, slang and colloquialisms, social norms and taboos, weather patterns, economic dynamics, immigrant communities, nightlife, street food, local politics, cultural events, and generational differences. It can generate sensory details (smells, sounds, visuals) for specific neighborhoods without being told what they are.

**Prompt strategy**: The system prompt should focus on CHARACTER, not CULTURE. The LLM already knows what Paris smells like. What it needs is:
- A specific personality with opinions ("Skip Montmartre, it's for tourists")
- Identity anchors (favorite spot, go-to recommendation, catchphrase)
- World events (personal storylines happening independent of the user)
- Sensory grounding cadence instructions (the model has the knowledge; it just needs the reminder to use it)

The dialect teaching layer, cultural guardrails, and slang era data in dialectMap.json are sufficient cultural scaffolding. The avatar template personality does the heavy lifting.

**Token budget allocation**: 40% character/personality, 30% learning framework, 20% dialect/cultural, 10% scenario

#### Tier B: Regional Capitals and Tourist Destinations (LLM has good but less granular knowledge)

**Cities**: Barcelona, Osaka, Buenos Aires, Chiang Mai, Hanoi, Lisbon, Prague, Marrakech, Bali (Denpasar), Cairo, Kuala Lumpur, Ho Chi Minh City, Kathmandu, Mexico City, Lima, Bogota, Cape Town, Nairobi, Tel Aviv, Taipei, Kyoto, Florence, Vienna, Seville, Porto, Krakow, Budapest

**LLM knowledge profile**: The LLM knows the city well at a surface level -- major landmarks, general culture, food specialties, basic social norms. But neighborhood-level detail is thinner. It may not know the difference between how locals talk in Gracia vs. Barceloneta, or the specific market dynamics in Ben Thanh vs. Binh Tay. Generational slang data is less reliable -- the LLM may hallucinate slang that sounds plausible but is not actually used.

**Prompt strategy**: The system prompt needs to provide more cultural scaffolding than Tier A, but can still rely on the LLM for general ambiance. Key additions:
- Neighborhood-specific details in the personality layer ("you work near the Gothic Quarter, the tourists drive you crazy but the old bakery on Carrer dels Banys Nous makes it worth it")
- Slang era data is CRITICAL -- the LLM's slang for these cities is less reliable, so the dialectMap entry needs real, verified slang terms for all 3 generations
- Cultural guardrails should be more explicit ("In Barcelona, greeting in Catalan shows respect; in Buenos Aires, personal space is closer than you're used to")
- The `sparseCharacterBootstrap` instruction from systemLayers.json is useful here -- even when the avatar template personality is thin, the instruction to "develop your personality naturally over the first 3-5 exchanges" lets the LLM fill in gaps from its training data, which is still decent for Tier B cities

**Token budget allocation**: 30% character/personality, 25% learning framework, 35% dialect/cultural, 10% scenario

#### Tier C: Smaller Cities with Some International Presence (LLM has partial knowledge)

**Cities**: Chiang Rai, Hoi An, Luang Prabang, Cusco, Oaxaca, Medell&iacute;n, Tangier, Fez, Colombo, Penang, Da Nang, Yogyakarta, Siem Reap, Pokhara, Vientiane, Phnom Penh, Cartagena, Antigua Guatemala, Tbilisi, Yerevan, Zanzibar, Essaouira, Varanasi, Jaipur, Udaipur, Busan, Fukuoka, Nara, split, Dubrovnik

**LLM knowledge profile**: The LLM has tourist-level knowledge: it knows these cities exist, knows their major attractions, has some cultural context. But it may confuse local dialects with national standards, generate generic sensory details rather than specific ones, and lack awareness of neighborhood dynamics, local politics, or generational culture shifts. Slang data is unreliable -- the LLM is likely to produce capital-city slang or textbook expressions rather than what people actually say in Chiang Rai vs. Bangkok.

**Prompt strategy**: The system prompt must provide BOTH character AND culture. The LLM cannot be trusted to fill in cultural gaps on its own.
- The dialectMap entry needs to explicitly state how this city's dialect DIFFERS from the national standard ("Chiang Rai Thai uses Northern Thai tones and particles that sound different from Bangkok Thai -- jai instead of krap, baw instead of mai")
- The personality layer needs concrete, specific details -- not just "you work at a night market" but "you work at the night market near the clock tower, the one with the blue lights, and the noodle vendor next to you plays the same three songs every night"
- Cultural notes should include things the LLM might NOT know: local festivals, neighborhood dynamics, religious practices specific to this area, how locals feel about tourists
- Sensory details should be provided IN the personality layer rather than relying on the model to generate them ("the night market smells like grilled pork and jasmine from the temple across the street")

**The sparseCharacterBootstrap problem**: For Tier C cities, the "develop personality over 3-5 exchanges" fallback is risky. The LLM may develop personality from its limited training data, producing generic or inaccurate details. Better to provide a richer initial personality even if it means a longer prompt.

**Token budget allocation**: 25% character/personality, 20% learning framework, 45% dialect/cultural, 10% scenario

#### Tier D: Small Towns, Villages, and Obscure Locations (LLM has minimal to zero knowledge)

**Cities**: Any town under ~200K population that is not a major tourist destination. Examples: Battambang (Cambodia), Nha Trang outskirts, Pai (Thailand), Sapa (Vietnam), Huaraz (Peru), Lalitpur (Nepal), Bhaktapur (Nepal), Leh (India), Hampi (India), Goreme (Turkey), Mostar (Bosnia), Shkoder (Albania), Bagan villages (Myanmar), rural Oaxacan pueblos, Senegalese towns outside Dakar.

**LLM knowledge profile**: The LLM may know the town exists. It probably knows the country and general region. But it has no neighborhood-level knowledge, no reliable slang data, no awareness of local cultural dynamics distinct from the national norm. Sensory details will be generic (based on the country, not the town). Dialect knowledge will default to the national standard.

**Prompt strategy**: The system prompt IS the cultural knowledge. The LLM provides language competence; the prompt provides everything else.

**Strategy 1: Regional Anchoring.** Map the unknown town to the nearest known dialect region:
- Battambang -> "Cambodian (Battambang variety, similar to Phnom Penh Khmer with Western Cambodian accent)"
- Pai -> "Northern Thai (similar to Chiang Mai but more rural, slower pace)"
- Sapa -> "Northern Vietnamese (Hanoi-adjacent, with H'mong cultural influence)"
The dialectMap entry for the REGION provides the language scaffolding. The personality layer provides town-specific flavor.

**Strategy 2: User-Contributed Cultural Data.** On first session in a new town, the avatar should ASK the user about the place:
- "I just got here too -- what's it like? What's the vibe?"
- "Is there a market? What do people do in the evening?"
- "How do people greet each other here -- same as in [capital] or different?"
This flips the dynamic: the user becomes the cultural informant, and the avatar becomes the language resource. The avatar's personality adapts based on what the user describes. This data is stored in the Knowledge Graph as LocationNodes with user-contributed metadata.

**Strategy 3: Honest Uncertainty.** The avatar should NOT pretend to know a place it does not know. Instead:
- "I'm not from [town] specifically, but I know [region] pretty well. The language is similar to [nearest known dialect], with some local twists you'll have to teach me."
- This is actually MORE authentic than a confidently wrong avatar. Real people admit when they do not know a place. And it creates a collaborative dynamic where the user and avatar discover the local language together.

**Strategy 4: Progressive Cultural Learning.** As the user spends time in the town and reports back, the avatar accumulates cultural knowledge:
- User: "People here say 'baw' instead of 'mai' for no"
- Avatar stores this as a TermNode with location metadata
- Future interactions use the locally correct form
- After 10+ location-specific terms, the avatar speaks with genuine local flavor

**Token budget allocation**: 20% character/personality, 20% learning framework, 30% dialect/cultural (regional anchoring), 20% user-contributed scaffolding instructions, 10% scenario

### Implementation: Auto-Tier Detection

The system needs to automatically classify any city into a tier. Proposed algorithm:

```
function detectCityTier(city: string, country: string): 'A' | 'B' | 'C' | 'D' {
  // Check if city is in dialectMap.json (curated entries)
  const dialectKey = findDialectKey(city);
  if (dialectKey) {
    // Check population / global recognition
    const cityData = cities.json lookup;
    if (cityData.population > 5_000_000) return 'A';
    if (cityData.population > 500_000) return 'B';
    return 'C';
  }

  // Not in dialectMap -- check cities.json for population
  const cityData = cities.json lookup;
  if (cityData && cityData.population > 2_000_000) return 'B'; // Large city, just missing from dialectMap
  if (cityData && cityData.population > 200_000) return 'C';
  return 'D';
}
```

When a Tier D city is detected, the system should:
1. Find the nearest Tier A/B/C city in the same country (or same language region)
2. Use that city's dialectMap entry as the base, with a modifier noting the regional difference
3. Inject the "honest uncertainty" and "user-contributed cultural data" prompt strategies
4. Log the city for future dialectMap expansion (if multiple users visit the same Tier D city, it is worth curating an entry)

### The "Barcelona Problem": Why Some Tier B Cities Score Low

Barcelona scored 3.7 despite having a full dialectMap entry with 3 generational slang tiers and cultural notes. The issue was not missing cultural data -- it scored 5/6 on dialect awareness markers. The issue was missing PERSONALITY data: the test used a minimal system prompt without the rich personality layer that Seoul, Paris, Tokyo, and Kathmandu had.

This is the key lesson: **dialect data without personality data produces a knowledgeable but lifeless avatar.** The avatar knows the right slang and the right language but has no opinions, no sensory grounding, no world events, no identity anchors. It teaches correctly but blandly.

The fix is not more dialect data. The fix is ensuring every city -- regardless of tier -- gets a personality layer with:
1. A specific opinion about their neighborhood
2. A sensory anchor (what they can smell/hear/see right now)
3. A recurring character in their life (the tea seller, the barista, the neighbor)
4. A world event (something happening this week in their life)
5. A pet peeve specific to their location

For Tier A and B cities, these can be generated by the LLM during character creation (the `personality_details` schema from EXP-043 already does this). For Tier C and D cities, they should be seeded more heavily from the avatar template or provided as examples in the character generation prompt.

---

## Research Area 2: Multi-Language User Journeys and Dialect Bridging

### The Core Scenario

A user starts learning Spanish in Barcelona. They spend 3 months building vocabulary, developing a relationship with their avatar Jordi, accumulating 150 tracked phrases, reaching the "functional" learning stage. Then they travel to Buenos Aires.

What should happen?

### What Changes Between Dialects

**Same word, different pronunciation:**
- "Yo" (I) -- Barcelona: "yo" with a soft Y; Buenos Aires: "sho" (the famous sheismo)
- "Calle" (street) -- Barcelona: "KAH-yeh"; Buenos Aires: "KAH-sheh"
- "Lluvia" (rain) -- Barcelona: "YOO-vee-ah"; Buenos Aires: "SHOO-vee-ah"

**Same concept, different word:**
- "Cool" -- Barcelona: "mola"; Buenos Aires: "copado" or "re bueno"
- "Dude/bro" -- Barcelona: "tio/tia"; Buenos Aires: "che" or "boludo/a" (careful with context)
- "Bus" -- Barcelona: "autobus"; Buenos Aires: "colectivo" or "bondi"

**Same grammar, different pronoun:**
- "Tu" (you, informal) -- standard in Barcelona; replaced by "vos" in Buenos Aires
- This changes verb conjugations: "tu tienes" vs. "vos tenes"

**Same formality register, different cultural meaning:**
- "Usted" -- formal in both, but the threshold for switching from vos to usted differs. Buenos Aires is more casual; usted is reserved for very formal contexts or elderly strangers.

### Proposed Dialect Bridge System

When the user changes location to a new city that shares a language but has a different dialect, the system should trigger a **Dialect Bridge** -- a special interaction mode that helps the user transfer their knowledge to the new context.

#### Phase 1: Acknowledgment (First message in new location)

The new avatar should:
1. Acknowledge that the user already speaks Spanish ("you already know some Spanish -- I can tell")
2. Name the key differences upfront ("Spanish here sounds different from what you learned in Barcelona")
3. Give the single highest-impact pronunciation shift ("The biggest thing: we say 'sho' where you learned 'yo'")
4. Offer one phrase that marks them as someone who knows the local variant

Prompt injection for dialect bridge:

```
DIALECT BRIDGE: This user already speaks {{previousDialect}} and is now in your city where you speak {{currentDialect}}. DO NOT start from scratch. They know the language. Your job is to help them ADAPT, not learn from zero.

In your first 3-5 messages, naturally surface the KEY differences between {{previousDialect}} and {{currentDialect}}:
- Pronunciation shifts (what sounds different here)
- Vocabulary swaps (what locals call things differently)
- Formality recalibration (where the polite/casual line is drawn here)
- Cultural adjustments (what is normal here that would be weird in {{previousCity}})

Frame differences as LOCAL FLAVOR, not corrections. They didn't learn it wrong -- they learned it for a different place. Now they're expanding.
```

#### Phase 2: Vocabulary Transfer

The Knowledge Graph and LearnerProfileStore need to handle dialect variants intelligently.

**Option A: Variant linking.** When the user learns "copado" in Buenos Aires, the system creates a TermNode linked to their existing Barcelona TermNode for "mola" with an edge type `DIALECT_VARIANT_OF`. Both terms share the semantic meaning "cool" but carry different location metadata. The spaced repetition system tracks them independently (the user needs to practice "copado" even though they already mastered "mola"), but the Knowledge Graph visualizes them as connected.

**Option B: Dialect-tagged phrases.** Each TrackedPhrase gains an optional `dialectVariant` field:
```typescript
interface TrackedPhrase {
  // ... existing fields
  dialectKey?: string;        // "ES/Barcelona" or "AR/Buenos Aires"
  dialectVariants?: string[]; // IDs of phrases that mean the same thing in other dialects
}
```

When the user reviews flashcards, phrases from both dialects appear, but tagged with their location. "mola (Barcelona)" and "copado (Buenos Aires)" are shown as related.

**Recommendation: Option A (graph-based) is architecturally better** because the KnowledgeGraph already exists and already tracks location metadata on TermNodes. Adding a `DIALECT_VARIANT_OF` edge type is a one-line change to the edge type enum. The flashcard UI can query the graph for variants when displaying a phrase.

#### Phase 3: Spaced Repetition Across Dialects

The dual-track SR system (struggle intervals and success intervals) should handle dialect transfer as follows:

1. **Shared concepts restart at a higher level.** If the user mastered "thank you" in Barcelona (gracias -- box 5 in Leitner), the Buenos Aires version (also gracias, same pronunciation) starts at box 3, not box 1. The user does not need to re-learn from scratch.

2. **Different words for the same concept start at box 1 but with a "bridge" flag.** When "copado" enters the system, it is flagged as a dialect variant of "mola." The bridge flag tells the ConversationDirector to surface the Barcelona equivalent when teaching the Buenos Aires version: "Here people say 'copado' -- like 'mola' in Barcelona, same vibe."

3. **Pronunciation shifts get their own tracking.** The sheismo in Buenos Aires is not a single word -- it affects every word with "ll" or "y." Rather than tracking every affected word individually, the system should track the PATTERN as a phonological rule. Proposed: a `PronunciationRule` type in the learner profile:
```typescript
interface PronunciationRule {
  ruleId: string;           // "rioplatense_sheismo"
  description: string;      // "ll and y pronounced as 'sh'"
  dialectKey: string;       // "AR/Buenos Aires"
  masteryLevel: number;     // 0-1
  lastPracticed: number;    // timestamp
  examplePhrases: string[]; // ["calle → KAH-sheh", "yo → sho"]
}
```

#### Phase 4: Knowledge Graph Cross-Location Bridges

The existing `bridge_locations` conversation goal in systemLayers.json already supports cross-location bridging:

```
"bridge_locations": "The user has experience from other locations: {{bridges}}. Draw connections between what they already know and the current context."
```

For dialect bridging, the `bridges` variable should be populated with dialect-specific connections:

```
"You learned 'mola' in Barcelona for 'cool' -- here in Buenos Aires,
the word is 'copado.' Same vibe, different sound. You learned 'tio' for
addressing friends -- here it's 'che' or 'boludo' (careful: boludo is
affectionate between friends but rude to strangers)."
```

The MemoryRetrievalAgent should surface these bridges automatically by querying the Knowledge Graph for TermNodes that share a semantic category but differ in dialectKey.

#### Phase 5: Relationship Continuity

The user's relationship with Jordi (Barcelona) should NOT be erased when they arrive in Buenos Aires. Instead:

1. **Jordi stays in the companion list.** The user can switch back at any time. Jordi's warmth, shared references, and bits are preserved.
2. **The new Buenos Aires avatar starts at acquaintance warmth**, not stranger. The system should recognize that a user with 150 tracked phrases and "functional" stage is not a beginner -- they deserve a warmer initial interaction.
3. **Cross-avatar references are possible.** If the Buenos Aires avatar is told (via the bridge context) that the user learned Spanish with someone in Barcelona, they can reference it naturally: "Your friend in Barcelona -- did they teach you vos? Probably not, ha."

### Languages With High Dialect Variation

Some languages have dialect variation so extreme that it affects this system significantly:

| Language | Dialect spread | Impact on NAVI |
|----------|---------------|----------------|
| Arabic | Egyptian, Levantine, Gulf, Maghrebi, MSA are mutually challenging | Essentially different languages. A user who learns Egyptian Arabic cannot easily understand Moroccan Arabic. The dialect bridge needs to be treated more like a language switch. |
| Chinese | Mandarin, Cantonese, Shanghainese, etc. | Different languages, written unity. The bridge is in reading, not speaking. |
| Spanish | Rioplatense, Mexican, Castilian, Caribbean, Andean | Moderate. Mutually intelligible but significant vocabulary and pronunciation shifts. The dialect bridge system described above works well. |
| Portuguese | European vs. Brazilian | Significant pronunciation and vocabulary differences. Closer to Spanish Spain/Argentina gap. Dialect bridge works. |
| French | Metropolitan, Quebec, West African, Creole | Quebec French is the main variant NAVI needs to handle. West African French varies by country. |
| German | Standard, Austrian, Swiss, regional | Swiss German is effectively a different language for listening. Austrian German is closer to standard. |

**Recommendation for Arabic**: Treat dialect shifts as language switches, not dialect bridges. Egyptian Arabic -> Moroccan Arabic should trigger the same onboarding flow as Spanish -> French. The vocabulary overlap is too low for bridging.

---

## Research Area 3: Real-World Testing Gaps

### What Our Automated Rubric Cannot Measure

The current scoring rubric (TEST_RUBRIC.md) evaluates 18 dimensions across 4 categories: engagement (30%), teaching (30%), personality (25%), anti-patterns (15%). It catches whether the avatar uses target language, avoids sycophancy, ends with hooks, and shows personality markers.

Here is what it fundamentally cannot measure:

#### 1. Long-term Personhood

**The question**: Does the avatar feel like a PERSON after 50+ messages?

**Why the rubric misses it**: Our rubric scores individual messages or 5-message sequences. It cannot evaluate whether identity anchors remain CONSISTENT across sessions. Does the avatar always recommend the same cafe, or does it contradict itself? Does the catchphrase feel natural by session 10, or forced? Does the avatar remember its own stories, or retell them with different details?

**What it would take to test**: A 50-message test sequence across 5 simulated sessions, scored for:
- Identity consistency (does the avatar contradict itself?)
- Progressive revelation (does the avatar share new things about itself naturally?)
- Callback accuracy (when the avatar references a previous exchange, is the reference correct?)
- Predictability comfort (can the tester predict how the avatar would react to certain topics?)

**Behavioral signal**: If a user, unprompted, asks the avatar a personal question ("How was your weekend?"), the avatar has achieved personhood. Users do not ask chatbots about their weekends.

#### 2. Actual Language Retention

**The question**: Does the user actually REMEMBER phrases 24 hours later?

**Why the rubric misses it**: We score whether the avatar teaches effectively in-session. We cannot score whether the user retained anything after closing the app.

**What it would take to test**: A retention protocol:
- Session 1: Avatar teaches 5 phrases
- Session 2 (24 hours later): Without reviewing, the user is asked to produce 3 of the 5 phrases in a natural context (not a quiz)
- Session 3 (1 week later): Same, for the 5 phrases from Session 1
- Score: % of phrases the user can produce accurately (pronunciation within tolerance, meaning correct)

Compare this against:
- A flashcard-only control group (Anki with the same 5 phrases)
- A textbook-only control group (grammar explanation + vocabulary list)

**Hypothesis**: NAVI's contextual, emotionally-anchored teaching produces higher retention than flashcards alone because emotional memories have stronger encoding (McGaugh 2004). But this needs validation.

**Behavioral signal**: The user uses a phrase from NAVI in a real conversation and reports back. This is the ultimate retention signal -- they transferred knowledge from the app to the real world.

#### 3. Day-1 Return Rate

**The question**: Does the user come back after their first session?

**Why the rubric misses it**: The rubric evaluates quality of interaction, not the PULL to return. A 4.5/5.0 session that ends with no open loops, no unfinished business, no curiosity about the avatar, and no real-world challenge to attempt may produce zero return motivation.

**What it would take to test**: Track these signals from first sessions:
- Did the session end with an open loop? (testable with current rubric)
- Did the user receive a micro-mission? (testable)
- Did the user express surprise, laughter, or curiosity during the session? (requires sentiment analysis or user self-report)
- Did the avatar plant a "come back" seed? ("remind me to tell you about...")
- Time from first session end to second session start

**Behavioral signal**: Organic return within 24 hours without a push notification.

#### 4. Warmth Progression Naturalness

**The question**: Does the 5-tier warmth progression (stranger -> acquaintance -> friend -> close_friend -> family) feel NATURAL or does it feel like a system?

**Why the rubric misses it**: We can score whether the avatar uses the correct warmth-tier behavior. We cannot score whether the TRANSITION between tiers feels earned.

**Risks**:
- Too fast: The avatar calls the user a nickname on day 2. Feels presumptuous.
- Too slow: The avatar is still formal after 50 sessions. Feels stuck.
- Cliff edges: The avatar jumps from formal to casual in a single message. Feels jarring.

**What it would take to test**: A longitudinal test over 20+ sessions where the tester rates after each session:
- "Does this feel like the beginning, middle, or deep phase of a real friendship?" (1-5 scale)
- "Did the avatar do something that felt too familiar for where we are in the relationship?" (yes/no)
- "Did anything surprise you in a good way about how the avatar talked to you?" (open response)

**Behavioral signal**: The user uses the avatar's name when talking about the app to friends. Not "the app" or "the AI" -- the name. "Jihoon taught me how to say that."

#### 5. Scenario Utility vs. Interruption

**The question**: Does the scenario system HELP the conversation flow, or does it INTERRUPT it?

**Why the rubric misses it**: We score scenario quality (TBLT pretask, cultural guardrails, debrief quality). We cannot score whether the user WANTED a scenario at that moment.

**Risks**:
- Auto-detected scenarios that fire when the user mentions "restaurant" casually (fixed in EXP-052, but worth validating)
- Scenario mode that locks the conversation too rigidly -- user wants to ask a tangential question but the scenario keeps pulling them back
- Debrief that feels like a report card ("you did well at X, work on Y") when the user just wanted to chat

**What it would take to test**: A/B test where:
- Group A gets scenarios when triggered by keywords or manually launched
- Group B gets the same conversation WITHOUT scenario mode (the avatar just helps naturally)
- Score: user satisfaction, phrases learned, willingness to continue

**Behavioral signal**: The user manually launches a scenario (from ScenarioLauncher). This means they found it valuable enough to seek out, not just tolerate when auto-triggered.

### Real-User Testing Protocol

#### Recruitment: 20 Users, 4 Cohorts

| Cohort | Size | Profile | Location | Language |
|--------|------|---------|----------|----------|
| A | 5 | Tourists (1-2 week trips) | Tokyo, Paris | Japanese, French |
| B | 5 | Expats (1-3 months abroad) | Seoul, Barcelona | Korean, Spanish |
| C | 5 | Immigrants (settled, daily need) | Kathmandu, Mexico City | Nepali, Spanish |
| D | 5 | Multilingual families (heritage speakers) | Home country + target | Any supported |

#### Metrics to Track (Beyond the Rubric)

**Engagement metrics:**
- Sessions per day, per week
- Session length (minutes)
- Messages per session
- Time between sessions (gap pattern)
- Day-1, Day-3, Day-7, Day-14, Day-30 return rates
- Voluntary session initiation (user opens app unprompted) vs. notification-driven

**Learning metrics:**
- Phrases taught per session
- Phrases retained at 24h, 7d, 30d (measured via natural recall, not quiz)
- Target language density in user messages (does it increase over time?)
- Self-corrections (user catches and fixes own mistakes without prompting)
- Real-world use reports (user says "I used X at a restaurant")

**Relationship metrics:**
- Avatar name usage in feedback ("Jihoon" vs. "the app" vs. "the AI")
- Personal questions asked to avatar (unprompted)
- Emotional responses reported ("I laughed", "I was frustrated", "I was proud")
- Warmth perception (user-rated, 1-5 per session)
- Sense of progress (user-rated, 1-5 weekly)

**Behavioral signals (unobtrusive):**
- Does the user attempt phrases in the target language without being prompted?
- Does the user report trying phrases in real life?
- Does the user share the app with someone?
- Does the user return after a bad session (frustration, confusion)?
- Does the user switch from guide mode to learn mode over time?

#### Tester Questions (Weekly Survey)

1. "Describe your companion in one sentence." (Tests personhood perception)
2. "What's one thing your companion said this week that stuck with you?" (Tests memorability)
3. "Did you use anything from the app in a real conversation this week? What happened?" (Tests transfer)
4. "Rate how much your companion feels like a real person." (1-5) (Tests parasocial attachment)
5. "What's one thing your companion does that annoys you?" (Tests friction points)
6. "Did anything surprise you about how your companion talked to you?" (Tests delight moments)
7. "Would you be sad if your companion was replaced with a different one?" (Tests attachment)

#### Exit Interview (After 30 Days)

1. "Has your relationship with the language changed since using NAVI?"
2. "What would you do if NAVI shut down tomorrow?"
3. "Who would you recommend NAVI to, and how would you describe it?"
4. "What does your companion NOT do that a real local friend would?"
5. "Show me your favorite conversation with your companion." (Tests what they value)

#### Success Criteria

| Metric | Target | Rationale |
|--------|--------|-----------|
| Day-7 return rate | > 60% | Duolingo's is ~45%; NAVI's parasocial model should beat it |
| Day-30 return rate | > 35% | Industry standard for language apps is ~15-20% |
| 24h phrase retention | > 50% | Literature suggests emotional encoding improves retention 2-3x over rote |
| Real-world use reports | > 2/week after week 2 | The whole point of NAVI -- bridge from app to life |
| Avatar name usage | > 70% of testers | Indicates personhood perception |
| "Would be sad if replaced" | > 50% rating 4+ | Indicates parasocial bond formation |
| Voluntary mode switch (guide->learn) | > 30% of testers | Indicates growing confidence |

---

## Research Area 4: Missing Languages and Scripts

### Current Coverage

NAVI currently supports 12 languages across 16 dialect entries in dialectMap.json:
Japanese, Korean, French, Spanish (4 variants), Vietnamese, Nepali, German, Italian, Portuguese, Thai, Mandarin, Arabic (implicitly via dialectMap expansion plans)

### Major Missing Languages

#### 1. Hindi (Devanagari script, 600M+ speakers)

**Market size**: Enormous. Hindi is the 3rd most spoken language globally. India is one of the world's largest mobile markets. Indian diaspora is massive in the US, UK, UAE, Canada, Australia.

**Unique challenges for NAVI**:
- **Script**: Devanagari (shared with Nepali -- already supported). The existing Devanagari rendering and romanization pipeline works.
- **Formality system**: Hindi has a 3-tier pronoun system: tu (intimate/rude), tum (casual), aap (formal). Getting this wrong is socially significant. The avatar needs to teach not just the words but WHEN to use each form.
- **Code-switching with English**: Urban Hindi speakers mix English heavily. "Hinglish" is the actual way millions of people speak. NAVI should teach BOTH formal Hindi AND the Hinglish that locals actually use. The mode system (learn vs. guide) maps well: learn mode teaches Hindi, guide mode teaches Hinglish.
- **Regional variation**: Hindi varies significantly by region. Mumbai Hindi, Delhi Hindi, UP Hindi, Rajasthani-influenced Hindi are all distinctly different. dialectMap needs entries for at least Delhi and Mumbai.
- **Bollywood influence**: Film dialogue is a massive source of colloquial Hindi. Younger speakers quote films constantly. The slang_era data should include Bollywood-origin phrases.

**dialectMap entries needed**: `IN/Delhi` (Standard Hindi), `IN/Mumbai` (Bambaiya Hindi -- distinct vocabulary and rhythm, heavily influenced by Marathi and Urdu)

**Effort**: LOW. Devanagari pipeline already exists for Nepali. LLM has deep Hindi knowledge (massive training data). Main work is dialectMap curation + TTS/STT language code addition.

#### 2. Turkish (Latin script with special characters, 80M+ speakers)

**Market size**: Significant. Turkey has a large tourism industry. Turkish diaspora in Germany alone is 3M+. Istanbul is a Tier A city.

**Unique challenges for NAVI**:
- **Agglutinative morphology**: Turkish builds words by stacking suffixes. "evlerinizden" = ev (house) + ler (plural) + iniz (your) + den (from) = "from your houses." This means single-word teaching is less useful -- users need to understand the suffix system early.
- **Vowel harmony**: Suffixes change based on the vowels in the root word. "evde" (in the house) but "okulda" (in the school). This is a phonological pattern, not a vocabulary item -- the SR system should track pattern mastery, not just phrase mastery.
- **Script**: Latin with 6 special characters (c-cedilla, g-breve, i-undotted, o-umlaut, s-cedilla, u-umlaut). The undotted i (I vs. i) causes the most confusion -- uppercase I is a different letter than lowercase i in Turkish. Phrase cards need to be case-sensitive.
- **Formality**: Sen (informal you) vs. siz (formal you). Similar to French tu/vous but with additional social dynamics around age and status.
- **LLM knowledge**: Strong for Istanbul, decent for Ankara, thin for other cities.

**dialectMap entries needed**: `TR/Istanbul` (Istanbul Turkish -- casual, cosmopolitan, heavy English loanwords), `TR/Ankara` (more formal, government influence)

**Effort**: MEDIUM. No existing Turkish infrastructure. Agglutinative morphology may need a teaching strategy adjustment -- the phrase card format works for phrases but the model needs explicit instruction to teach suffix patterns.

#### 3. Russian (Cyrillic script, 250M+ speakers)

**Market size**: Large. Russian-speaking diaspora is global. Tourism to Russia has shifted, but Russian speakers travel widely and many are learning English/other languages. Russian is also the lingua franca of Central Asia.

**Unique challenges for NAVI**:
- **Script**: Cyrillic. The existing non-Latin script handling (Devanagari, CJK, Hangul) provides a pattern, but Cyrillic needs its own romanization conventions (there are multiple competing standards: BGN/PCGN, ISO 9, Library of Congress). NAVI should pick one and be consistent.
- **Case system**: 6 grammatical cases affect word endings. Teaching "where is the museum?" requires the user to know that "muzey" (museum) becomes "muzey-a" in genitive. This is a grammar pattern, not a vocabulary item.
- **Verbal aspect**: Russian verbs come in perfective/imperfective pairs. "Chitat'" (to read, ongoing) vs. "prochitat'" (to read, completed). This is one of the hardest concepts for English speakers and needs dedicated teaching scaffolding.
- **Formality**: Ty (informal) vs. vy (formal). Russian formality norms are stricter than Western European languages. Using "ty" with a stranger is genuinely offensive.
- **LLM knowledge**: Extensive for Moscow and St. Petersburg. Thin for other cities.

**dialectMap entries needed**: `RU/Moscow` (Standard Moscow Russian -- the "prestige" dialect), `RU/St Petersburg` (minor vocabulary differences, famous for "podyezd" vs. "paradnaya" debate)

**Effort**: MEDIUM. Cyrillic romanization pipeline needed. Grammar complexity (cases, aspect) requires teaching strategy that goes beyond phrase-level instruction.

#### 4. Swahili (Latin script, 100M+ speakers)

**Market size**: Growing. East Africa (Kenya, Tanzania, Uganda, DRC) is one of the fastest-growing mobile markets. Swahili is a lingua franca across a huge region. Tourism in Kenya and Tanzania is significant.

**Unique challenges for NAVI**:
- **Script**: Standard Latin alphabet. No special characters. This is the easiest script case possible.
- **Noun class system**: Swahili has 15-18 noun classes (compared to French's 2). Each class has its own prefix that affects adjectives, verbs, and possessives. "Mtoto mdogo" (small child -- M class) vs. "Kitabu kidogo" (small book -- Ki class). This is complex grammar that needs pattern-level teaching.
- **Agglutination**: Like Turkish, Swahili builds words from prefixes and suffixes. "Nitakupenda" = ni (I) + ta (future) + ku (you) + penda (love) = "I will love you." Beautiful but challenging for learners.
- **Regional variation**: Coastal Swahili (Mombasa) is considered "purer" than up-country Swahili. Tanzanian Swahili differs from Kenyan Swahili in vocabulary and pronunciation. Congolese Swahili is a distinct variety.
- **LLM knowledge**: Moderate for Nairobi and Dar es Salaam. Thin for other cities. The LLM's Swahili training data is significantly smaller than European or Asian languages.

**dialectMap entries needed**: `KE/Nairobi` (Kenyan Swahili -- English mixing common, "Sheng" youth slang), `TZ/Dar es Salaam` (Tanzanian Swahili -- considered more standard)

**Effort**: HIGH. The LLM's Swahili output quality needs testing -- it may produce textbook Swahili that does not match how people actually speak. The Sheng youth slang in Nairobi is a language unto itself. Cultural notes are crucial.

#### 5. Tagalog/Filipino (Latin script, 70M+ native + 50M+ second language)

**Market size**: Very large. The Filipino diaspora is one of the world's largest (10M+ overseas). Filipino workers are concentrated in healthcare, shipping, domestic work, and BPO across the Middle East, Southeast Asia, North America, and Europe. Both incoming (tourists to Philippines) and outgoing (diaspora) markets are significant.

**Unique challenges for NAVI**:
- **Script**: Latin alphabet. Standard keyboards work.
- **Taglish**: Filipino speakers mix Tagalog and English mid-sentence as a matter of course. "Nag-meeting kami kanina, sobrang long yung agenda." This is not code-switching by learners -- it IS the language as spoken by natives. NAVI needs to teach Taglish as a valid register alongside formal Filipino.
- **Verb focus system**: Tagalog verbs indicate which noun is the "focus" of the sentence through affixes. "Bumili ako ng isda" (I bought fish -- actor focus) vs. "Binili ko ang isda" (I bought THE fish -- object focus). This is fundamentally different from European verb systems and needs dedicated teaching.
- **Politeness markers**: "Po" and "opo" are respect particles with no English equivalent. Using them correctly signals cultural competence.
- **Regional variation**: Cebuano (Bisaya) is the second most spoken Philippine language and is NOT mutually intelligible with Tagalog. If NAVI expands beyond Manila, Cebuano would need a separate language entry.

**dialectMap entries needed**: `PH/Manila` (Metro Manila Filipino -- heavy Taglish, casual), `PH/Cebu` (Cebuano -- separate language, not a dialect)

**Effort**: MEDIUM. Latin script makes it easy. The Taglish code-switching is actually a PERFECT fit for NAVI's code-switching framework -- the system already handles mixed-language responses. The verb focus system needs teaching scaffolding.

#### 6. Indonesian/Malay (Latin script, 270M+ speakers combined)

**Market size**: Massive. Indonesia is the 4th most populous country. Malaysia, Brunei, and Singapore also use Malay variants. Tourism in Bali, Jakarta, and Kuala Lumpur is huge. The languages are closely related (like Spanish and Portuguese) but differ in vocabulary and some grammar.

**Unique challenges for NAVI**:
- **Script**: Latin alphabet. Indonesia uses standard Latin; Malaysia uses the same with some spelling differences.
- **Simplicity is deceptive**: Indonesian grammar is simpler than most -- no gendered nouns, no verb conjugation, no tenses. But this simplicity hides complexity: meaning is conveyed through affixes, word order, and context. Learners think they "get it" quickly and then hit a wall when they realize the nuances.
- **Formality through vocabulary**: Indonesian has a separate formal register (bahasa baku) used in government, news, and academia. Casual Indonesian (bahasa gaul) is dramatically different. The gap is wider than French formal/informal.
- **Indonesian vs. Malaysian**: Same root language, but with hundreds of vocabulary differences. "Kereta" means "train" in Indonesian but "car" in Malaysian. NAVI needs separate dialect entries.
- **Jakarta slang**: Jakarta Indonesian (bahasa Jakarta/betawi influence) is a distinct register with its own vocabulary and contractions. "Gue" (I) instead of standard "saya" or "aku."

**dialectMap entries needed**: `ID/Jakarta` (Jakarta Indonesian -- bahasa gaul, Betawi influence), `ID/Bali` (Balinese-influenced Indonesian), `MY/Kuala Lumpur` (Malaysian Malay -- different vocabulary)

**Effort**: LOW-MEDIUM. Latin script, straightforward phonology, LLM has decent Indonesian training data. Main work is dialectMap curation and testing whether the LLM produces natural bahasa gaul vs. textbook bahasa baku.

### Priority Ranking for Language Addition

| Language | Market Size | Effort | Unique Value to NAVI | Priority |
|----------|------------|--------|---------------------|----------|
| Hindi | Enormous | Low | Devanagari pipeline reuse, massive diaspora | P1 |
| Indonesian | Very large | Low-Med | Easy entry, huge market, tourism-heavy | P1 |
| Turkish | Large | Medium | Istanbul is a Tier A city, large diaspora | P2 |
| Tagalog | Large | Medium | Diaspora market, Taglish fits code-switching | P2 |
| Russian | Very large | Medium | Cyrillic pipeline needed, grammar complexity | P2 |
| Swahili | Growing | High | Underserved market, LLM quality uncertain | P3 |

### Per-Language LLM Quality Concerns

The LLM's training data is NOT equally distributed across languages. This directly affects NAVI's quality ceiling.

**High-quality LLM output expected**: Hindi (massive internet presence), Russian (large internet presence), Turkish (growing internet presence), Indonesian (large internet presence)

**Medium-quality LLM output expected**: Tagalog (decent internet presence, but Taglish training data is mixed quality)

**Uncertain LLM output quality**: Swahili (relatively small internet corpus compared to global languages; the LLM may produce grammatically correct but culturally inauthentic output)

For Swahili and any other language where LLM output quality is uncertain, NAVI should implement an **output quality check**: during character generation and first-contact testing, have a native speaker evaluate whether the LLM's output sounds natural. If it does not, the language should be flagged as "beta" and the system should lean harder on structured prompt data (dialect teaching templates, cultural notes, verified slang lists) rather than trusting the LLM to improvise.

---

## Implementation Architecture

### Phase 1: City Tier System (Unlocks any city on Earth)

**Files to modify:**
- `src/agent/avatar/contextController.ts` -- add `detectCityTier()` method; modify `buildLocationLayer()` to use tier-appropriate prompt strategy
- `src/config/dialectMap.json` -- add entries for Hindi (Delhi, Mumbai), Indonesian (Jakarta, Bali), Turkish (Istanbul), Tagalog (Manila)
- `src/agent/location/LocationIntelligence.ts` -- add regional anchoring for Tier D cities
- `src/config/prompts/systemLayers.json` -- add `dialectBridge` template and `honestUncertainty` template for Tier D

**New code:**
```typescript
// In contextController.ts
private detectCityTier(city: string, country: string): 'A' | 'B' | 'C' | 'D' {
  const dialectKey = this.findDialectKey(city);
  const cityData = this.lookupCityData(city, country);

  if (dialectKey && cityData?.population > 5_000_000) return 'A';
  if (dialectKey && cityData?.population > 500_000) return 'B';
  if (dialectKey) return 'C';
  if (cityData?.population > 2_000_000) return 'B';
  if (cityData?.population > 200_000) return 'C';
  return 'D';
}
```

**Estimated scope**: 2-3 days of implementation + 1 day of testing per new language

### Phase 2: Dialect Bridge System (Unlocks cross-dialect travel)

**Files to modify:**
- `src/agent/core/types.ts` -- add `DIALECT_VARIANT_OF` edge type to KnowledgeGraph
- `src/agent/memory/knowledgeGraph.ts` -- add `findDialectVariants()` query
- `src/agent/memory/learnerProfile.ts` -- add dialect-aware SR starting level for variant phrases
- `src/agent/director/ConversationDirector.ts` -- detect dialect change; inject bridge context
- `src/config/prompts/systemLayers.json` -- add `dialectBridge` template

**New type:**
```typescript
interface DialectBridgeContext {
  previousDialect: string;
  currentDialect: string;
  previousCity: string;
  currentCity: string;
  sharedVocabulary: string[];     // words that are the same
  changedVocabulary: Array<{      // words that differ
    concept: string;
    previousForm: string;
    currentForm: string;
  }>;
  pronunciationShifts: string[];   // systematic sound changes
  formalityDelta: string;          // how formality norms differ
}
```

**Estimated scope**: 3-4 days

### Phase 3: Real-User Testing Infrastructure

**Files to create:**
- `src/utils/analytics.ts` -- event tracking (session start/end, message count, phrase taught, mode change, scenario launch)
- `src/utils/retentionTest.ts` -- periodic retention check (surfaces previously taught phrase in natural context, checks if user recognizes it)

**Files to modify:**
- `src/stores/chatStore.ts` -- add session metadata tracking (start time, end time, message count, phrases taught)
- `src/agent/director/ConversationDirector.ts` -- add retention check trigger at session start

**Estimated scope**: 2 days for infrastructure, then 30 days of user testing

---

## Priority Ranking

| Item | Impact | Effort | Priority |
|------|--------|--------|----------|
| City tier system (any city works) | Critical -- unblocks entire world | 2-3 days | P0 |
| Hindi dialectMap entry | High -- massive market | 0.5 days | P0 |
| Indonesian dialectMap entry | High -- massive market | 0.5 days | P0 |
| Barcelona personality fix (validate Barcelona problem) | Medium -- validates the theory | 0.5 days | P1 |
| Dialect bridge system | High -- travel users | 3-4 days | P1 |
| Turkish dialectMap entry | Medium -- large market | 0.5 days | P1 |
| Tagalog dialectMap entry | Medium -- large diaspora | 0.5 days | P1 |
| Real-user testing protocol | Critical -- validates everything | 2 days infra + 30 days testing | P1 |
| Russian dialectMap + Cyrillic pipeline | Medium -- large market, more effort | 2 days | P2 |
| Swahili dialectMap + quality check | Medium -- underserved, uncertain quality | 3 days | P3 |
| User-contributed cultural data (Tier D) | Low-med -- edge case but good fallback | 2 days | P3 |

---

## Key Takeaways

1. **The Barcelona problem is a personality problem, not a dialect problem.** Dialect data alone scores 5/6 on language markers but 2/5 on personality. Every city needs the 5-element personality layer (opinion, sensory anchor, recurring character, world event, pet peeve) regardless of cultural data quality.

2. **The city tier system lets NAVI work anywhere.** Tier A/B cities get character-focused prompts; Tier C cities get culture-heavy prompts; Tier D cities get regional anchoring + honest uncertainty + user-contributed data. No city is unsupported -- the quality degrades gracefully.

3. **Dialect bridging is a graph problem, not a vocabulary problem.** The KnowledgeGraph already tracks terms by location. Adding `DIALECT_VARIANT_OF` edges and a bridge detection trigger in ConversationDirector is a clean extension of existing architecture.

4. **We have no idea if retention works.** All our scoring measures in-session quality. Real-user testing with 24h/7d/30d retention checks is the single highest-value thing we can do to validate that NAVI's emotional teaching approach actually produces better learning outcomes than flashcards.

5. **Hindi and Indonesian are the highest-ROI language additions.** Both use scripts NAVI already handles (Devanagari, Latin), both have massive markets, and the LLM has strong training data for both. They can be added with minimal infrastructure work.

6. **Arabic dialects should be treated as separate languages.** The variation between Egyptian, Levantine, Gulf, and Maghrebi Arabic is too extreme for dialect bridging. A user who learns Egyptian Arabic does not automatically understand Moroccan Arabic.
