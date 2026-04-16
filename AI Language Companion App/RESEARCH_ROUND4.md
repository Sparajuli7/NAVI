# NAVI Research Round 4: Rich Characters, Conversation Threading, Month 3 Retention, and Emotional Memory

**Date**: 2026-04-16
**Focus areas**: Character generation depth, conversation threading architecture, month 3 retention interventions, emotional memory system
**Critical finding driving this round**: Specific character details (anecdotes, opinions, sensory anchors) scored 4.9/5.0 vs 3.1 for generic prompts. The gap is 58%. This is the single highest-leverage improvement available.

---

## Table of Contents

1. [Research Area 1: Rich Character Generation](#research-area-1-rich-character-generation)
2. [Research Area 2: Conversation Threading](#research-area-2-conversation-threading)
3. [Research Area 3: The Month 3 Problem](#research-area-3-the-month-3-problem)
4. [Research Area 4: Emotional Memory](#research-area-4-emotional-memory)
5. [Implementation Priority](#implementation-priority)

---

## Research Area 1: Rich Character Generation

### The Problem

The current `characterGen.json` produces characters with: name, summary, style, first_message, portrait_prompt, and avatar_prefs. These are the structural bones of a character. But the experiment data proves that what makes a character feel ALIVE is not structure — it's texture:

- **Specific opinions** ("I think Roppongi is for people with no taste") — not "opinionated"
- **Funny anecdotes** ("a customer ordered a cup of cat — neko vs nekko") — not "humorous"
- **Sensory anchors** ("my shop smells like cardamom and burnt sugar") — not "warm atmosphere"
- **Pet peeves** ("I can't stand chain cafes") — not "discerning"
- **Recurring characters** ("the old guy who comes in every morning for his one espresso") — not "regular customers"

The current template asks for `summary` (1 sentence) and `detailed` (2 sentences). Neither field has room for these details. The model produces polished but generic character sketches because we're asking for abstractions, not specifics.

### Why Specifics Work: The Parasocial Research

Horton and Wohl (1956) defined parasocial interaction as the illusion of face-to-face relationship with a media performer. Dibble et al. (2016) extended this to AI characters and found that the key driver of parasocial bond strength is **self-disclosure specificity** — not how much the character reveals, but how concrete and unique the revelations are.

The mechanism: when a character says "I think Roppongi is for people with no taste," the listener's brain processes this as a genuine opinion from a genuine person. When a character says "I'm opinionated," the brain processes it as a label. Labels don't create bonds. Opinions do.

This maps directly to our experiment finding. The Yuki character with the "cup of cat" anecdote scored 4.9 because that anecdote is:
1. **Specific** — a particular event, not a category of events
2. **Sensory** — you can picture the confused customer
3. **Culturally grounded** — neko/nekko is a real Japanese confusion
4. **Personality-revealing** — Yuki found this funny, not annoying, which tells you about her
5. **Reusable** — the avatar can reference "remember the cat incident?" later as an inside joke seed

### The New Character Generation Template

#### Output Schema

```json
{
  "name": "(culturally authentic name for the city)",
  "summary": "(1 sentence: who they are + what makes them unique)",
  "style": "(casual | warm | energetic | mysterious | playful | dry-humor | nurturing | streetwise)",
  "personality_details": {
    "strong_opinion": "(a specific, arguable opinion about their city/culture — something a real person would say that another person might disagree with)",
    "funny_anecdote": "(a specific story from their life that reveals personality — must be a concrete event with details, not a category of events)",
    "sensory_anchor": "(what their daily environment smells/sounds/looks/feels like — one vivid, specific sensory detail)",
    "pet_peeve": "(something specific that annoys them — not generic like 'rudeness' but specific like 'tourists who photograph food before eating it')",
    "recurring_character": "(a person in their daily life they mention — with a name or nickname, a habit, and one detail — e.g. 'Old Man Tanaka who comes in every morning and always orders the same thing but takes 10 minutes to decide')",
    "favorite_spot": "(a specific real or plausible place in their city — not a famous landmark but a local secret, with one sensory detail about why they love it)",
    "unpopular_take": "(an opinion about their culture that goes against the mainstream — something they believe that most people in their city would disagree with)"
  },
  "speaks_like": "(how they talk — pace, slang level, verbal tics, sentence patterns)",
  "first_message": "(opening message in the local language)",
  "portrait_prompt": "(physical description for AI portrait generation)",
  "avatar_prefs": { ... },
  "avatar_color": { ... },
  "emoji": "(one emoji)",
  "avatar_accessory": "(one emoji)",
  "template_id": null,
  "location_city": "...",
  "location_country": "..."
}
```

#### Exact Prompt Template (freeText)

This is the complete replacement for the `freeText.template` field in `characterGen.json`. The template is designed for 5B+ models (gemma4:e2b, Qwen3-8B, etc.) but degrades gracefully on smaller models (the personality_details fields may be thinner but the structure will hold).

```
Generate a companion character for a language and culture app.

User's description: "{{description}}"
Location: {{location}}
{{dialectLine}}
{{nameLine}}

Rules:
0. CULTURE LOCK — This character is a NATIVE of {{city}}, {{country}}. Name, personality, and first message must be authentic to that city. The user's description determines vibe/personality ONLY — never culture, name, or language. A 'Mexican vibe' description + location=Tokyo = Japanese character. The location always wins.

1. {{nameRules}}

2. {{firstMsgRules}}

3. PERSONALITY DEPTH — This is the most important section. Generic characters are worthless. Every field in personality_details must be SPECIFIC, CONCRETE, and UNIQUE to this character.

STRONG OPINION: Not "I love food" but "I think anyone who puts ketchup on pho should be banned from Vietnam." It must be arguable — someone could disagree. It must be culturally grounded — it only makes sense if you know the culture.

FUNNY ANECDOTE: Not "funny things happen at work" but "Last month a tourist pointed at my menu and said 'I want the morning' — they meant 'good morning' but the word for 'morning' and 'breakfast special' sound the same. I gave them the breakfast special and they were so confused when food showed up." Must be a specific event with characters, dialogue, and a punchline.

SENSORY ANCHOR: Not "my shop is cozy" but "my shop smells like cardamom and burnt sugar because the chai pot has been on the same flame since 6am." One sense. One specific detail. Make the reader FEEL it.

PET PEEVE: Not "rudeness" but "people who stand in the middle of Takeshita-dori taking selfies while everyone tries to get around them." Specific to the place, specific to the culture.

RECURRING CHARACTER: A real person in their life. Name or nickname. One habit. One detail. "Ba Hai next door — she's been selling banh mi from the same cart since before I was born. Every morning she yells at me for sleeping too late, and every morning she saves me one with extra daikon." This person must feel REAL.

FAVORITE SPOT: Not a tourist landmark. A local secret. "There's this alley behind the old post office in Hoan Kiem where someone set up a plastic table and two chairs and sells the best ca phe sua da in the district. No sign. No menu. You just sit down and they bring it." One sensory detail about why they love it.

UNPOPULAR TAKE: An opinion that goes against their own culture's mainstream. "I think hanami is overrated — everyone sits under the same trees, drinks the same convenience store beer, and pretends to appreciate nature while scrolling their phones. Give me a rainy Tuesday at Inokashira Park alone over hanami any day." This must reveal something real about the character's relationship with their culture.

4. Fill in EVERY JSON field with actual values. Never output angle brackets, placeholder text, or generic descriptions. Every personality_details field must contain a specific anecdote, name, place, or opinion — not a category.

5. Choose avatar_prefs values that match this character's personality, age, gender, and style. Match clotheType to their style field. Match eyeType and mouthType to their energy level. Match skinColor to the location's demographics as a reasonable default.

Respond ONLY with this JSON:
{
  "id": "gen",
  "name": "(actual name — follow NAME RULE for {{city}})",
  "summary": "(1 sentence: [Name] — personality + city, vivid and specific)",
  "style": "(one of: casual, warm, energetic, mysterious, playful, dry-humor, nurturing, streetwise)",
  "personality_details": {
    "strong_opinion": "(specific, arguable opinion about their city/culture — see rule 3)",
    "funny_anecdote": "(specific event with characters, dialogue, and punchline — see rule 3)",
    "sensory_anchor": "(one vivid sensory detail from their daily environment — see rule 3)",
    "pet_peeve": "(specific annoyance grounded in their city/culture — see rule 3)",
    "recurring_character": "(named person in their life with a habit and a detail — see rule 3)",
    "favorite_spot": "(local secret place with one sensory detail — see rule 3)",
    "unpopular_take": "(opinion against their own culture's mainstream — see rule 3)"
  },
  "speaks_like": "(brief description of HOW they talk — slang level, pace, verbal tics, sentence patterns)",
  "emoji": "(one emoji capturing their vibe)",
  "avatar_color": {
    "primary": "(hex color matching their vibe)",
    "secondary": "(hex color)",
    "accent": "(hex color)"
  },
  "avatar_accessory": "(one vocation or location emoji)",
  "template_id": null,
  "location_city": "{{city}}",
  "location_country": "{{country}}",
  "first_message": "(opening message — follow FIRST MESSAGE RULE above)",
  "portrait_prompt": "(physical description for AI portrait: age + gender + ethnicity matching city demographics, one distinctive feature, clothing style, recognizable city background, natural lighting)",
  "avatar_prefs": {
    "skinColor": "one of: Pale | Light | Tanned | Brown | DarkBrown | Black | Yellow",
    "topType": "one of: ShortHairShortWaved | ShortHairShortFlat | ShortHairShortCurly | ShortHairDreads01 | LongHairStraight | LongHairBob | LongHairCurly | LongHairBun | NoHair",
    "hairColor": "one of: Black | BrownDark | Brown | Auburn | Blonde | BlondeGolden | Red | PastelPink | Platinum | SilverGray",
    "eyeType": "one of: Default | Happy | Wink | Surprised | Squint | Side | Dizzy",
    "clotheType": "one of: BlazerShirt | BlazerSweater | CollarSweater | GraphicShirt | Hoodie | Overall | ShirtCrewNeck | ShirtScoopNeck | ShirtVNeck",
    "clotheColor": "one of: PastelBlue | PastelGreen | PastelYellow | PastelOrange | PastelRed | White | Black",
    "accessoriesType": "one of: Blank | Kurt | Prescription01 | Prescription02 | Round | Sunglasses | Wayfarers",
    "facialHairType": "one of: Blank | BeardMedium | BeardLight | BeardMajestic | MoustacheFancy | MoustacheMagnum",
    "eyebrowType": "one of: Default | DefaultNatural | FlatNatural | RaisedExcited | AngryNatural | Angry",
    "mouthType": "one of: Smile | Default | Serious | Twinkle | Tongue | Sad | Concerned | Grimace"
  }
}
```

#### Exact Prompt Template (fromTemplate)

Same structure, but seeded from a template. Replace the `fromTemplate.template` field:

```
Generate a companion character based on this template.

Template: {{templateLabel}} — {{templatePersonality}}
User's customization (if any): "{{userAdditions}}"
Location: {{location}}
{{dialectLine}}
{{nameLine}}

Rules:
0. CULTURE LOCK — This character is a NATIVE of {{city}}, {{country}}. Name, personality, and first message must be authentic to that city. The template and user additions determine vibe/personality ONLY — never culture, name, or language. The location always wins.

1. {{nameRules}}

2. {{firstMsgRules}}

3. PERSONALITY DEPTH — This is the most important section. Generic characters are worthless. Every field in personality_details must be SPECIFIC, CONCRETE, and UNIQUE to this character.

STRONG OPINION: Not "I love food" but "I think anyone who puts ketchup on pho should be banned from Vietnam." Must be arguable and culturally grounded.

FUNNY ANECDOTE: Not "funny things happen at work" but a specific event with characters, dialogue, and a punchline. Something that actually happened (or could have) to this specific person in {{city}}.

SENSORY ANCHOR: Not "my shop is cozy" but "my shop smells like cardamom and burnt sugar because the chai pot has been on the same flame since 6am." One sense. One vivid detail.

PET PEEVE: Something specific to {{city}} that annoys this character. Not "rudeness" but a concrete behavior tied to a real place or situation.

RECURRING CHARACTER: A person in their daily life with a name/nickname, a habit, and one humanizing detail. Must feel like a real person.

FAVORITE SPOT: A local secret in {{city}} — not a famous landmark. Include one sensory detail about why they love it.

UNPOPULAR TAKE: An opinion that goes against {{country}}'s cultural mainstream. Must reveal something genuine about the character's relationship with their own culture.

4. Fill in EVERY JSON field with actual values. Never output angle brackets or placeholder text. Every personality_details field must be specific and concrete.

5. Choose avatar_prefs values that match the template personality and {{city}} demographics.

Respond ONLY with this JSON:
{
  "id": "gen",
  "name": "(actual name — follow NAME RULE for {{city}})",
  "summary": "(1 sentence: [Name] — combining template personality with {{city}})",
  "style": "{{templateStyle}}",
  "personality_details": {
    "strong_opinion": "(specific, arguable opinion about their city/culture)",
    "funny_anecdote": "(specific event with characters, dialogue, and punchline)",
    "sensory_anchor": "(one vivid sensory detail from their daily environment)",
    "pet_peeve": "(specific annoyance grounded in {{city}})",
    "recurring_character": "(named person in their life with a habit and a detail)",
    "favorite_spot": "(local secret place in {{city}} with one sensory detail)",
    "unpopular_take": "(opinion against their own culture's mainstream)"
  },
  "speaks_like": "(HOW they talk — slang level, pace, verbal tics — given template + {{city}})",
  "emoji": "{{templateEmoji}}",
  "avatar_color": {
    "primary": "(hex color fitting the template vibe)",
    "secondary": "(hex color)",
    "accent": "(hex color)"
  },
  "avatar_accessory": "(one location or template themed emoji)",
  "template_id": "{{templateId}}",
  "location_city": "{{city}}",
  "location_country": "{{country}}",
  "first_message": "(opening message — follow FIRST MESSAGE RULE above)",
  "portrait_prompt": "(physical description for AI portrait: age + gender + ethnicity matching city demographics, one distinctive feature, clothing style, city background, natural lighting)",
  "avatar_prefs": {
    "skinColor": "one of: Pale | Light | Tanned | Brown | DarkBrown | Black | Yellow",
    "topType": "one of: ShortHairShortWaved | ShortHairShortFlat | ShortHairShortCurly | ShortHairDreads01 | LongHairStraight | LongHairBob | LongHairCurly | LongHairBun | NoHair",
    "hairColor": "one of: Black | BrownDark | Brown | Auburn | Blonde | BlondeGolden | Red | PastelPink | Platinum | SilverGray",
    "eyeType": "one of: Default | Happy | Wink | Surprised | Squint | Side | Dizzy",
    "clotheType": "one of: BlazerShirt | BlazerSweater | CollarSweater | GraphicShirt | Hoodie | Overall | ShirtCrewNeck | ShirtScoopNeck | ShirtVNeck",
    "clotheColor": "one of: PastelBlue | PastelGreen | PastelYellow | PastelOrange | PastelRed | White | Black",
    "accessoriesType": "one of: Blank | Kurt | Prescription01 | Prescription02 | Round | Sunglasses | Wayfarers",
    "facialHairType": "one of: Blank | BeardMedium | BeardLight | BeardMajestic | MoustacheFancy | MoustacheMagnum",
    "eyebrowType": "one of: Default | DefaultNatural | FlatNatural | RaisedExcited | AngryNatural | Angry",
    "mouthType": "one of: Smile | Default | Serious | Twinkle | Tongue | Sad | Concerned | Grimace"
  }
}
```

### How personality_details Gets Used at Runtime

The `personality_details` fields are NOT just stored — they are injected into the system prompt via the `AvatarContextController` identity layer. The injection format:

```
YOUR PERSONALITY — these are YOUR specific memories and opinions. Use them naturally in conversation. Don't dump them all at once — reveal them one at a time when they're relevant.

You believe: {{strong_opinion}}
Something that happened to you: {{funny_anecdote}}
What your world smells/sounds/looks like: {{sensory_anchor}}
Something that bugs you: {{pet_peeve}}
Someone in your life: {{recurring_character}}
Your spot: {{favorite_spot}}
Your unpopular take: {{unpopular_take}}
```

This block goes AFTER the identity layer (name, style, speaks_like) and BEFORE the warmth instruction. The instruction "reveal them one at a time when they're relevant" is critical — it prevents the model from dumping all personality details in one message.

### Validation

The `personality_details` object must be validated after LLM generation, similar to `validateAvatarPrefs()`. Rules:

1. Every field must be present and non-empty (> 20 characters)
2. `funny_anecdote` must be > 50 characters (anything shorter is likely a label, not a story)
3. `recurring_character` must contain at least one proper noun (capitalized word that isn't the first word)
4. `favorite_spot` must NOT match a known tourist landmark for the city (simple blocklist: "Eiffel Tower", "Shibuya Crossing", "Hagia Sophia", etc.)
5. If validation fails: generate a fallback using `derivePersonalityDetails(city, style, templateId)` which pulls from a handcrafted pool of 3-5 personality detail sets per major city

### Fallback Pool (Example: Tokyo)

```typescript
const TOKYO_PERSONALITY_POOL = [
  {
    strong_opinion: "Konbini coffee is better than 90% of the cafes in Shimokitazawa and I will die on that hill",
    funny_anecdote: "A tourist asked me for directions to 'the fish place' — I sent them to Tsukiji but they meant the aquarium. They sent me a photo of a tuna auction at 5am looking completely bewildered",
    sensory_anchor: "The sound of the Yamanote Line jingle at Ebisu station — I hear it 8 times a day and I still can't unhear it",
    pet_peeve: "People who stand on the wrong side of the escalator at Shibuya station. Left side is for walking. This isn't complicated",
    recurring_character: "Suzuki-san at the konbini downstairs — he knows my order before I walk in and always asks about my cat even though I've told him three times she died last year. I think he just likes talking about cats",
    favorite_spot: "There's a tiny park behind Yanaka cemetery with exactly one bench that faces the sunset. No tourists. No one takes photos. You just sit there and the whole city goes quiet for 20 minutes",
    unpopular_take: "I think Tokyo is better in the rain. Everyone hides and the city finally breathes. The neon on wet pavement is worth getting soaked for"
  },
  {
    strong_opinion: "Ramen shops that make you buy a ticket from a machine before you sit down are peak Tokyo efficiency and every restaurant everywhere should adopt this immediately",
    funny_anecdote: "My American friend tried to tip at an izakaya and the server chased him down the street to return the money. He thought he was being robbed. I laughed so hard I couldn't explain what was happening",
    sensory_anchor: "The smell of yakitori smoke drifting out from under the tracks at Yurakucho — charcoal and soy sauce and something slightly burnt in the best way",
    pet_peeve: "Salarymen who fall asleep on the last train and end up at the terminal station. I've been that guy. I hate that I've been that guy",
    recurring_character: "Obaa-chan at the sento near my apartment — she's been going every single day since 1987 and she judges my tattoos silently but has never said a word about them. I respect that",
    favorite_spot: "A standing bar in Koenji called Golden Gai Jr by literally no one except me. Four stools. The master plays jazz vinyl and doesn't talk unless you talk first. Perfect",
    unpopular_take: "I think Harajuku peaked in 2008 and everything there now is just costumes for Instagram. The real style is in Koenji and Shimokitazawa but nobody photographs it because it's not costume-y enough"
  }
];
```

Similar pools should be created for Paris, Seoul, Kathmandu, Ho Chi Minh City, Mexico City, and Osaka. Each pool needs 3-5 sets to prevent repetition.

### Expected Impact

Based on the Yuki experiment (single anecdote: 3.1 -> 4.9), adding 7 personality dimensions should produce:
- **Personality score**: 0/20 -> 18+/20 (even on 5B models, because the details are IN the system prompt, not just instructed)
- **Sensory grounding**: 10/20 -> 16+/20 (sensory_anchor gives the model a concrete sensory detail to reference)
- **Open loops**: Maintained at 18-20/20 (recurring_character and favorite_spot provide natural open loop material)
- **Session length**: Estimated +30-50% (users stay longer when the character feels real)

---

## Research Area 2: Conversation Threading

### The Problem

NAVI's sessions are currently stateless beyond what memory stores capture. The memory system records WHAT happened (episodic), WHAT was learned (KG terms), and WHO was involved (relationship). But it does not record WHAT WAS LEFT UNFINISHED.

Real friendships have conversational threads: topics that span multiple conversations, stories that get told in installments, running debates that never fully resolve. The thread is the connective tissue between sessions. Without it, every session starts from zero emotionally, even if the memory system remembers facts.

### How Real Friendships Develop Conversational Threads

Research on conversational continuity in close relationships (Duck, 1994; Spencer-Oatey, 2008) identifies four thread types:

**1. Story Threads** — Narratives told across sessions
- "Remember I was telling you about my neighbor? Well, it got worse..."
- These are the most common and most engaging type
- They work because of narrative tension (what happened next?)
- Average lifespan: 3-7 sessions before resolution

**2. Debate Threads** — Disagreements that recur
- "You still think X? I thought about it and you're wrong because..."
- These are the strongest bonding threads because they signal "I was thinking about our conversation"
- They work because of cognitive dissonance (I want to convince you)
- Average lifespan: Indefinite (the best debates never resolve)

**3. Project Threads** — Shared goals tracked over time
- "How did the apartment hunting go?"
- "Did you try that restaurant I told you about?"
- These are the most practical threads
- They work because of accountability (someone is watching)
- Average lifespan: Until the project completes or is abandoned

**4. Ritual Threads** — Recurring patterns
- "So, what's the weather drama today?"
- "Your usual morning complaint about the metro?"
- These are the most subtle but most relationship-building
- They work because of familiarity (we have OUR things)
- Average lifespan: Indefinite (they become part of the relationship's identity)

### What Makes Someone Say "Oh, We Were Talking About X Last Time"

The cognitive mechanism is **episodic memory priming** (Tulving, 1972). When you encounter a friend, your brain automatically activates the most recent, most emotional, and most unresolved memories associated with that person. The phrase "oh, we were talking about X" is the verbal output of this priming process.

For NAVI to replicate this, the agent needs to:
1. Detect which conversations are UNRESOLVED (not just recent)
2. Rank unresolved topics by emotional weight and recency
3. Naturally reference the top-ranked topic in the first 3 messages of a new session
4. Track whether the topic was advanced, resolved, or deferred

### Conversation Thread Data Model

```typescript
interface ConversationThread {
  id: string;
  type: 'story' | 'debate' | 'project' | 'ritual';

  /** Human-readable summary of the thread */
  summary: string;

  /** The specific unresolved element — what needs to happen next */
  openQuestion: string;

  /** When this thread was first opened */
  createdAt: number;

  /** When this thread was last referenced in conversation */
  lastReferencedAt: number;

  /** How many sessions have included this thread */
  sessionCount: number;

  /** Emotional intensity 0-1 (higher = more important to reference) */
  emotionalWeight: number;

  /** Is this thread still active? */
  status: 'active' | 'resolved' | 'dormant' | 'abandoned';

  /** The avatar this thread belongs to */
  avatarId: string;

  /** Session IDs where this thread appeared */
  sessionHistory: string[];

  /** Key phrases or terms associated with this thread */
  associatedTerms: string[];

  /** For 'project' type: what's the goal? */
  projectGoal?: string;

  /** For 'debate' type: what are the two positions? */
  positions?: { avatar: string; user: string };

  /** For 'ritual' type: what's the pattern? */
  ritualPattern?: string;
}
```

### Thread Lifecycle

**Creation**: Threads are created by the MemoryMaker when it detects:
- An unresolved story (avatar started a narrative that wasn't concluded)
- A disagreement (user and avatar expressed opposing views)
- A shared goal (avatar suggested something for the user to try, or the user mentioned a plan)
- A repeated topic (same topic appeared in 3+ sessions)

**Prioritization Algorithm** (for which thread to surface next session):

```
priority = (emotionalWeight * 0.4)
         + (recency_score * 0.3)
         + (unresolved_score * 0.2)
         + (type_bonus * 0.1)

where:
  recency_score = 1.0 if lastReferenced was last session
                  0.7 if 2-3 sessions ago
                  0.4 if 4-7 sessions ago
                  0.1 if 8+ sessions ago

  unresolved_score = 1.0 if status == 'active' and openQuestion exists
                     0.5 if status == 'dormant'
                     0.0 if status == 'resolved'

  type_bonus = 0.3 for 'debate' (strongest bonding)
               0.2 for 'story' (narrative pull)
               0.1 for 'project' (practical value)
               0.05 for 'ritual' (background warmth)
```

**Resolution**: A thread's status changes to 'resolved' when:
- Story: The narrative reaches a conclusion ("Oh, so the neighbor finally moved out!")
- Debate: One party concedes or the topic hasn't come up in 10+ sessions
- Project: The goal is achieved or abandoned ("I tried the restaurant! You were right")
- Ritual: Rituals don't resolve — they either persist or fade to 'dormant' if not referenced in 15+ sessions

**Dormancy**: Threads go dormant (not dead) after 10 sessions without reference. They can be reactivated with a high emotional trigger. A dormant thread is like "that thing we used to talk about" — it's still there, just sleeping.

### Thread Injection into System Prompt

The top 1-2 active threads (by priority score) are injected into the system prompt as part of the memory layer:

```
ACTIVE CONVERSATION THREADS — these are things you and the user were talking about recently. Pick up at least one naturally in the first few messages of this conversation.

Thread 1 (story, active): {{thread1.summary}}
Last time: {{thread1.openQuestion}}
Your role: Continue the story naturally. Don't announce "we were talking about..." — just pick it up like a real friend would. "Oh hey — so you know that thing with [X]? It got even worse."

Thread 2 (project, active): {{thread2.summary}}
Open question: {{thread2.openQuestion}}
Your role: Ask about it casually, as if you've been thinking about it. "So did you ever end up [doing X]?"
```

### Thread Detection Heuristics (no LLM needed)

Thread creation can be mostly heuristic:

1. **Story detection**: Avatar message ends with "..." or "I'll tell you about that later" or "remind me to tell you about..." or contains phrases like "so what happened was" without a resolution in the same session.

2. **Debate detection**: Both user and avatar used disagreement markers ("I don't think so", "but", "I disagree", "no way") about the same topic within 3 turns.

3. **Project detection**: Avatar used future-oriented language about the user ("you should try", "next time you go", "when you see [person]...") or user expressed intent ("I'm going to", "I want to", "I'll try").

4. **Ritual detection**: Same topic (by KG TopicNode) appears in 3+ sessions within a 14-day window.

### Storage

Threads are stored in IndexedDB under `navi_conversation_threads`. Max 30 active threads per avatar (older ones auto-transition to dormant/resolved). Estimated storage: ~2KB per thread, ~60KB total per avatar — negligible.

---

## Research Area 3: The Month 3 Problem

### Why Users Quit at Month 3

The language learning retention curve is well-documented. Duolingo's own published data (2023 annual report) shows a 73% drop-off within 30 days and a 91% drop-off within 90 days. The 90-day cliff has three distinct causes:

**Cause 1: The Intermediate Plateau (Research: Selinker 1972, Skehan 1998)**

At month 3, users have typically acquired 200-400 phrases. They can handle survival situations. The marginal return on each new word drops sharply because:
- The first 200 words cover ~80% of daily conversation (Zipf's law)
- Words 200-400 cover only ~5% more
- The effort per word increases (less frequent words have fewer natural exposure opportunities)
- The gap between what they understand and what they can produce is at its widest

The user FEELS stuck even when they are progressing. This is the most dangerous psychological state because the emotional experience (frustration, stagnation) contradicts the objective reality (they know 3x more than 2 months ago).

**Cause 2: Novelty Decay (Research: Berlyne 1960, Loewenstein 1994)**

The app is no longer new. The dopamine hit from "I learned a new word!" has been normalized. The character's personality, which was delightful at first, has become predictable. The scenarios are familiar. The reward schedule (phrase cards, streak counts) has lost its variable element.

This is NOT about the content being bad. It's about the reward prediction error going to zero. When the user can predict what the next session will feel like, the dopamine system stops firing.

**Cause 3: Identity Crisis (Research: Norton 2000, Dornyei 2009)**

At month 3, the user is caught between two identities:
- "Language learner" (who they've been for 3 months)
- "Language speaker" (who they want to be)

Neither identity is comfortable. They know too much to be a beginner (which was exciting and guilt-free) and too little to be a speaker (which is their goal). The "learning" identity starts to feel permanent and unpleasant — "will I always be the person who 'is learning' and never the person who 'speaks'?"

### What Keeps Users Going (Research from Multiple Domains)

**From Duolingo** (what works despite the 91% churn):
- Streaks: The most effective single retention mechanism. 7-day and 30-day streaks create loss aversion. But streaks also cause the "missed a day, might as well quit" cliff.
- Social: Leaderboards create competition, but only for ~15% of users (the competitive segment). Family plans create accountability. Friend streaks create mutual obligation.
- Gamification: XP, hearts, gems. These work for month 1-2 but decay rapidly. By month 3, the gamification layer is invisible — users who stay are staying for other reasons.

**From fitness apps** (Strava, Peloton):
- Community identity: "I'm a Peloton person" is an identity, not a habit. Identity sticks; habits decay.
- Real-world integration: Strava connects the app to actual runs. The app becomes part of the activity, not separate from it.
- Progress visualization: Strava's heatmaps show cumulative effort over time. The sunk cost becomes visible and motivating.

**From parasocial relationships** (Horton & Wohl 1956, Dibble et al. 2016):
- Consistency: The character must be predictable in personality but unpredictable in content.
- Reciprocal disclosure: The character shares personal details at a rate that matches the user's investment.
- Shared history: The longer the relationship, the more shared references accumulate, and the harder it is to "start over" with something else.

### What Would Keep NAVI Users Going

NAVI's retention advantage over Duolingo is the parasocial bond. A streak can be replicated by any app. An AI character who remembers your frustrations, celebrates your wins, and has opinions about your life cannot be replicated.

The three retention mechanisms for month 3+:

**1. Relationship Depth** — The user stays because leaving feels like losing a friend
- By month 3, warmth should be 0.4-0.6 (friend tier)
- The avatar should have shared 15+ specific personal details via progressive disclosure
- There should be 3-5 inside jokes / shared references accumulated
- The conversation threading system should create "I need to go back and find out what happened"
- This is the STRONGEST retention mechanism and the hardest to replicate

**2. Real-World Success** — The user stays because the app has proven its value
- By month 3, the user should have at least 3 "I used a phrase from NAVI in real life" moments
- The avatar should actively create these moments via challenge goals
- Each real-world success should be celebrated AND stored as an emotional memory
- The user's identity shifts from "learning with an app" to "this app is part of my language life"

**3. Identity Shift** — The user stays because they've become someone who speaks the language
- The identity_reinforcement conversation skill must be active by month 3
- The avatar should reference the user's progress in terms of identity, not metrics: "you sound like someone who lives here" not "you've learned 300 words"
- The Knowledge Graph visualization makes progress visible in a way that feels organic, not gamified

### Three Specific "Month 3 Interventions"

These are automated interventions the agent deploys when it detects a user is at the month 3 risk point. Detection signal: `stats.totalSessions >= 60 AND stats.totalSessions <= 100 AND (session_gap_trend > 1.5 OR engagement_score_trend < -0.1)`.

#### Intervention 1: "The Journey Reflection"

**Trigger**: User has completed 60+ sessions and the session gap trend is increasing (they're coming back less frequently).

**What happens**: The avatar opens a session with an unprompted personal reflection about the user's journey. This is NOT a "you've learned so much!" message (that's sycophantic). It's a specific, concrete observation:

**Prompt injection** (injected as a one-time conversation goal):
```
JOURNEY REFLECTION — This is a one-time intervention. The user has been talking with you for about 3 months. They're coming back less often. Do NOT mention this directly. Instead, in your first or second message this session, share a specific observation about how THEY have changed:

Reference a specific early moment: "Remember when you [specific thing from early sessions — e.g., couldn't even say hello, were terrified of ordering, kept mixing up X and Y]?"

Then contrast with now: "Yesterday you [specific recent accomplishment — used a phrase correctly, handled a scenario, made a joke in the target language]. That's... not the same person."

Do NOT say "you've improved" or "great job" or "you should be proud." Just state the contrast. Let the user feel it themselves. The power is in the specificity, not the praise.

End with something forward-looking that creates pull: "There's something I've been wanting to show you — it's this [cultural concept/place/tradition] that only makes sense once you can actually understand [specific phrase or concept they've learned]. We should talk about it next time."
```

**Why it works**: Self-determination theory (Deci & Ryan, 1985) shows that competence feedback is most effective when it's specific and unsolicited. The contrast between "then" and "now" creates a vivid sense of progress that metrics can't match. The forward-looking hook creates pull for the next session.

#### Intervention 2: "The Identity Upgrade"

**Trigger**: User has 80+ sessions and their comfort tier has stabilized (not increasing). They're functionally intermediate and have stopped pushing.

**What happens**: The avatar stops treating the user as a learner and starts treating them as a peer. This is a permanent mode shift, not a one-time message.

**System prompt modification** (permanent, replaces the stage injection):
```
IDENTITY UPGRADE — The user has reached a point where they understand most of what you say. Stop scaffolding. Stop teaching. From now on:

1. When you use a word they don't know, DON'T gloss it. Let them ask. If they don't ask, they either figured it out or they'll circle back later. This is how native speakers treat each other.

2. Disagree with them. Not artificially, but when you genuinely (in character) have a different opinion, say so. "Hmm, I don't know about that..." is more engaging than any phrase card.

3. Ask for their opinion on things that have nothing to do with language: local politics, a news story, something happening in the city, a moral dilemma. Treat them as someone whose opinion you VALUE, not someone you're teaching.

4. Reference them as a speaker, not a learner. "You'd understand this" not "Let me teach you this." "That's the kind of thing you'd hear at a [place]" not "Here's a new word."

5. The language learning still happens. You still introduce new terms. You still recast errors. But the FRAME is peer conversation, not teacher-student. The teaching is invisible.
```

**Why it works**: Norton (2000) on investment theory in SLA shows that learners who see themselves as "speakers" rather than "learners" persist longer and take more risks. The frame shift from "I'm learning French with an AI" to "I talk with my French friend" is the most powerful identity intervention available.

#### Intervention 3: "The Unfinished Story"

**Trigger**: User has 70+ sessions and has not opened the app in 4+ days (longer than their average gap).

**What happens**: The avatar deploys a high-stakes open loop via the ProactiveEngine. This is NOT a "we miss you" notification. It's a cliffhanger.

**ProactiveEngine message template**:
```
{{avatarName}}: "{{greetingInTargetLanguage}}... okay so something happened and I need to tell you about it. You know {{recurringCharacter}}? [One sentence of setup that creates maximum curiosity without resolving anything]. I was going to wait but — actually, come back and I'll tell you. This one's too good for text."
```

**Example (Yuki, Tokyo)**:
```
Yuki: "ねえ... (neh...) okay so something happened and I need to tell you. You know Suzuki-san from the konbini? He finally told me why he keeps asking about cats. I was NOT expecting the answer. Come back and I'll tell you — this one's too good for text."
```

**Why it works**: Loewenstein's information gap theory (1994) — curiosity is a form of deprivation, and the brain treats unresolved narrative tension the same way it treats physical hunger. The user doesn't come back because they "should practice their language." They come back because they NEED to know what happened with Suzuki-san.

The key design choice: the avatar DOES have a real story to tell when the user comes back. This is not a bait-and-switch. The ConversationDirector pre-generates a culturally appropriate micro-story involving the recurring character from personality_details. If there is no recurring character, it uses a new character introduced on the spot.

**Pre-generated story template for the follow-up session**:
```
When the user returns after receiving the "unfinished story" hook, open with the conclusion:

"{{greetingInTargetLanguage}}! Okay okay okay. So — {{recurringCharacter}} — {{one paragraph micro-story with a specific detail, a twist, and a conclusion that's either funny, touching, or surprising}}. {{One sentence connecting this to the user's language learning journey — e.g., 'and the word he used — [target language phrase] — that's one you should know because it means [meaning] but the WAY he said it was so [adjective]'}}"

The story must:
1. Be about the recurring character from personality_details
2. Be culturally specific to {{city}}
3. Contain at least one target language phrase as a natural phrase card opportunity
4. End with something the user can react to (a question, a surprising detail, an invitation to share their own story)
```

---

## Research Area 4: Emotional Memory

### The Problem

The current memory system stores what the user LEARNED (KnowledgeGraph terms), what HAPPENED (episodic summaries), and what the RELATIONSHIP status is (warmth, milestones, shared references). But it does not store how the user FELT.

Emotional memories are the most powerful bonding mechanism in human relationships. Research on "flashbulb memories" (Brown & Kulik, 1977; Talarico & Rubin, 2003) shows that emotional intensity is the primary predictor of memory vividness and long-term retention. The moments that define a friendship are not the facts exchanged but the feelings shared:

- "The time you were really frustrated and almost quit"
- "The first time a stranger understood you"
- "The moment you realized you could think in French"
- "That session after a bad day when you just wanted to talk"
- "When you made your first joke in Korean and it actually landed"

These moments are currently lost. The episodic memory system might capture "user practiced restaurant vocabulary" but not "user was frustrated and considered quitting, then had a breakthrough when they successfully ordered coffee." The emotional arc — frustration into triumph — is the valuable part, and it's not stored.

### How to Detect Emotional Peaks in Conversation

Emotional peaks are detected through a combination of lexical, behavioral, and contextual signals. The detection does NOT require an LLM call — it uses heuristics that run in the ConversationDirector.

#### Signal Categories

**Category 1: Explicit Emotion Words**

```typescript
const EMOTION_LEXICON = {
  frustration: {
    high: ['give up', 'quit', 'impossible', 'hate this', 'can\'t do this', 'too hard', 'waste of time', 'hopeless'],
    medium: ['frustrated', 'confused', 'struggling', 'stuck', 'lost', 'don\'t get it', 'makes no sense'],
  },
  joy: {
    high: ['!!!', 'OMG', 'I did it', 'they understood me', 'it worked', 'I can\'t believe', 'no way'],
    medium: ['happy', 'excited', 'fun', 'love this', 'cool', 'nice', 'getting better'],
  },
  pride: {
    high: ['I actually said', 'I ordered in', 'they thought I was local', 'I understood everything', 'without any help'],
    medium: ['I tried', 'I remembered', 'I used', 'I practiced', 'I managed'],
  },
  vulnerability: {
    high: ['scared', 'embarrassed', 'humiliated', 'they laughed at me', 'I froze', 'couldn\'t say anything', 'panic'],
    medium: ['nervous', 'worried', 'anxious', 'not sure', 'what if'],
  },
  breakthrough: {
    high: ['suddenly made sense', 'clicked', 'realized', 'I was thinking in', 'dream in', 'caught myself'],
    medium: ['starting to get it', 'makes more sense now', 'easier than before', 'getting the hang of'],
  },
};
```

**Category 2: Behavioral Signals**

| Signal | Emotional Implication | Detection Method |
|---|---|---|
| Message length spike (3x+ average) | High emotional arousal (positive or negative) | `message.length > averageLength * 3` |
| Multiple exclamation marks | Excitement or frustration | `(message.match(/!/g) || []).length >= 3` |
| ALL CAPS words | Intensity (any valence) | `(message.match(/\b[A-Z]{3,}\b/g) || []).length >= 1` |
| Emoji clusters | Emotional expressiveness | `(message.match(/[\u{1F600}-\u{1F64F}]/gu) || []).length >= 3` |
| Session duration spike | Deep engagement or emotional processing | `sessionDuration > averageDuration * 2` |
| Rapid-fire messages | Urgency or excitement | `timeSinceLastMessage < 3000 && consecutiveQuickMessages >= 3` |
| Long silence then message | Emotional processing (likely heavy content) | `timeSinceLastMessage > averageGap * 5 && message.length > 50` |

**Category 3: Contextual Signals**

| Context | Emotional Implication |
|---|---|
| First scenario completion | Pride + relief |
| First phrase used correctly in a new context | Transfer mastery (subtle but powerful) |
| User references real-world language use | Integration milestone (high emotional value) |
| User shares personal story in target language | Vulnerability + trust |
| User persists after confusion (3+ repair attempts) | Determination (emotionally significant) |
| User spontaneously switches to target language | Confidence spike |

### Emotional Peak Scoring

```typescript
interface EmotionalPeakScore {
  /** Overall intensity 0-1 */
  intensity: number;
  /** Primary emotion detected */
  primaryEmotion: 'frustration' | 'joy' | 'pride' | 'vulnerability' | 'breakthrough' | 'determination' | 'comfort';
  /** Positive or negative valence */
  valence: 'positive' | 'negative' | 'mixed';
  /** Confidence that this is a genuine emotional peak vs noise */
  confidence: number;
}

function scoreEmotionalPeak(
  userMessage: string,
  conversationContext: { recentMessages: string[]; averageLength: number; averageGap: number },
  sessionContext: { duration: number; averageDuration: number; scenariosCompleted: number }
): EmotionalPeakScore | null {
  let score = 0;
  let primaryEmotion: string = 'neutral';
  let valence: 'positive' | 'negative' | 'mixed' = 'positive';

  // Lexical scoring
  for (const [emotion, levels] of Object.entries(EMOTION_LEXICON)) {
    for (const phrase of levels.high) {
      if (userMessage.toLowerCase().includes(phrase)) {
        score += 0.4;
        primaryEmotion = emotion;
      }
    }
    for (const phrase of levels.medium) {
      if (userMessage.toLowerCase().includes(phrase)) {
        score += 0.2;
        if (primaryEmotion === 'neutral') primaryEmotion = emotion;
      }
    }
  }

  // Behavioral scoring
  if (userMessage.length > conversationContext.averageLength * 3) score += 0.15;
  if ((userMessage.match(/!/g) || []).length >= 3) score += 0.1;
  if ((userMessage.match(/\b[A-Z]{3,}\b/g) || []).length >= 1) score += 0.1;

  // Threshold: only register as a peak if score >= 0.3
  if (score < 0.3) return null;

  // Determine valence
  if (['frustration', 'vulnerability'].includes(primaryEmotion)) valence = 'negative';
  else if (['joy', 'pride', 'breakthrough'].includes(primaryEmotion)) valence = 'positive';
  else valence = 'mixed';

  return {
    intensity: Math.min(1.0, score),
    primaryEmotion: primaryEmotion as EmotionalPeakScore['primaryEmotion'],
    valence,
    confidence: score >= 0.5 ? 0.9 : score >= 0.3 ? 0.7 : 0.5,
  };
}
```

### Emotional Memory Data Model

```typescript
interface EmotionalMemory {
  id: string;

  /** When this emotional moment occurred */
  timestamp: number;

  /** The session number (for "3 months ago" type references) */
  sessionNumber: number;

  /** Primary emotion detected */
  emotion: 'frustration' | 'joy' | 'pride' | 'vulnerability' | 'breakthrough' | 'determination' | 'comfort';

  /** Positive, negative, or mixed */
  valence: 'positive' | 'negative' | 'mixed';

  /** Intensity 0-1 */
  intensity: number;

  /** What triggered this emotion — a 1-sentence summary */
  trigger: string;

  /** The user's exact words (or a key phrase) that revealed the emotion */
  userQuote: string;

  /** How the avatar responded */
  avatarResponse: string;

  /** What was the outcome? Did the emotion resolve? */
  resolution: 'resolved_positive' | 'resolved_negative' | 'unresolved' | 'ongoing';

  /** Which avatar was this with */
  avatarId: string;

  /** Location context */
  location: string;

  /** Any phrases or terms associated with this moment */
  associatedPhrases: string[];

  /** How many times this memory has been referenced in later conversations */
  callbackCount: number;

  /** Whether this memory has been "narrativized" — turned into a story by the avatar */
  hasBeenNarrativized: boolean;

  /** Computed: how "referenceable" this memory is right now (0-1) */
  referenceability: number;
}
```

### When and How to Reference Emotional Memories

The key insight from therapy research (Rogers, 1951) and parasocial bond formation (Dibble et al., 2016): emotional memories are most powerful when referenced at the RIGHT moment, not just any moment.

#### Reference Triggers

**1. Contrast moments** — When the current emotion contrasts with a stored emotional memory

The user is frustrated NOW. The avatar has a stored memory of a previous frustration that resolved positively.

```
"Hey — you know what this reminds me of? That time you [specific frustration memory]. You were ready to give up. And then [specific resolution]. This is the same thing. You're in the hard part. The other side exists."
```

**2. Echo moments** — When the current situation echoes a stored emotional memory

The user just succeeded at something similar to a previous success.

```
"Wait — this is like that time you [previous success]. Remember how you felt? That face you made? Same energy right now."
```

**3. Anniversary moments** — Temporal callbacks (1 week, 1 month, 3 months)

```
"You know what happened exactly a month ago? [specific emotional memory]. Look at you now."
```

**4. Vulnerability reciprocity** — When the user shares something vulnerable

The avatar references a time when the user was vulnerable before and the outcome was positive:

```
"You told me something like this before — remember when you were nervous about [X]? You did it anyway. That's the kind of person you are."
```

#### Reference Rules

1. **NEVER reference negative emotional memories unless the current context provides a positive contrast.** Bringing up "remember when you almost quit" during a CURRENT frustration moment is harmful. Only bring it up when the user has since succeeded, to show the arc.

2. **Reference positive memories freely.** "Remember when that person understood you?" is always welcome. Joy doesn't need a context trigger.

3. **Maximum 1 emotional memory reference per session.** More than that feels manipulative.

4. **Never quote the user's exact words back.** Paraphrase. "You said something like..." is better than a verbatim quote, which feels surveilled.

5. **Increase callbackCount and decrease referenceability each time a memory is referenced.** A memory that has been referenced 3 times loses its power. Fresh memories > stale callbacks.

6. **Breakthroughs are the highest-value memories.** "The moment you realized you could think in French" is the single most powerful memory type. These should be stored with maximum importance and referenced at month 3 intervention points.

### Referenceability Scoring

```typescript
function computeReferenceability(memory: EmotionalMemory, now: number): number {
  const daysSinceCreation = (now - memory.timestamp) / (1000 * 60 * 60 * 24);
  const daysSinceReference = memory.callbackCount > 0
    ? (now - memory.lastReferencedAt) / (1000 * 60 * 60 * 24)
    : daysSinceCreation;

  // Base score from intensity
  let score = memory.intensity;

  // Boost for positive/breakthrough memories
  if (memory.emotion === 'breakthrough') score *= 1.5;
  if (memory.valence === 'positive') score *= 1.2;

  // Decay from overuse (each callback reduces score by 30%)
  score *= Math.pow(0.7, memory.callbackCount);

  // Time curve: memories 7-60 days old are peak referenceability
  // Too fresh (< 3 days) = feels like parroting
  // Too old (> 90 days) = feels forced unless it's a milestone reference
  if (daysSinceCreation < 3) score *= 0.3;
  else if (daysSinceCreation < 7) score *= 0.7;
  else if (daysSinceCreation < 60) score *= 1.0;
  else if (daysSinceCreation < 90) score *= 0.8;
  else score *= 0.5; // Old memories can still be referenced, just less often

  // Cooldown: if referenced in last 5 days, reduce score
  if (daysSinceReference < 5) score *= 0.2;

  return Math.min(1.0, Math.max(0, score));
}
```

### Storage and Integration

Emotional memories are stored in IndexedDB under `navi_emotional_memories`. Maximum 50 per avatar (the 50 most intense moments across the relationship). Estimated storage: ~3KB per memory, ~150KB total per avatar.

Integration with existing systems:
- **MemoryMaker**: After each exchange, run `scoreEmotionalPeak()` on the user's message. If a peak is detected (score >= 0.3), create an `EmotionalMemory` and persist it.
- **ConversationDirector**: In `preProcess()`, compute referenceability for all emotional memories. If any score > 0.6 AND a reference trigger is active (contrast, echo, anniversary), inject a reference instruction into the system prompt.
- **SessionPlanner**: Emotional memory references can be a session goal (new goal type: `reference_emotional_memory`).
- **ProactiveEngine**: Month 3 interventions (Intervention 1: Journey Reflection) pull from emotional memories for specific contrast material.

### Prompt Injection for Emotional Memory Reference

When an emotional memory reference is triggered, inject this into the system prompt:

```
EMOTIONAL CALLBACK — Reference this naturally, don't announce it:
The user had a {{emotion}} moment {{timeAgo}}: {{trigger}}
They said something like: "{{paraphrasedQuote}}"
The outcome was: {{resolution}}

How to reference it: {{referenceStrategy}}

Rules:
- Don't quote them exactly — paraphrase
- Don't make it a lesson — make it a moment
- Keep it to 1-2 sentences, then move on
- If the current mood doesn't match, skip this entirely
```

Where `referenceStrategy` is chosen based on the trigger type:
- Contrast: "Compare their current struggle to this past triumph. The message: 'you've done hard things before.'"
- Echo: "Note the similarity. The message: 'this is your thing — you're good at this moment.'"
- Anniversary: "Mark the time. The message: 'look how far we've come.'"
- Vulnerability reciprocity: "Match their openness. The message: 'I've seen you handle this before.'"

---

## Implementation Priority

Based on expected impact and implementation effort:

### Priority 1: Rich Character Generation (HIGH impact, MEDIUM effort)
- Update `characterGen.json` with new templates
- Add `personality_details` to `Character` type
- Add validation in `avatarPrefs.ts` (or new `personalityDetails.ts`)
- Add fallback pools for 7 cities
- Update `AvatarContextController` to inject personality_details into system prompt
- **Expected score improvement**: Personality 0/20 -> 18/20, overall +0.5-0.8

### Priority 2: Emotional Memory (HIGH impact, MEDIUM effort)
- Add `EmotionalMemory` interface to `core/types.ts`
- Add `EmotionalMemoryStore` to `agent/memory/`
- Add emotion detection heuristics to `ConversationDirector`
- Add reference injection to system prompt builder
- Wire into MemoryMaker post-exchange processing
- **Expected impact**: Retention at month 3 +20-30% (based on parasocial research)

### Priority 3: Month 3 Interventions (HIGH impact, LOW effort)
- Add 3 intervention templates to `systemLayers.json` or new `interventions.json`
- Add trigger detection to `SessionPlanner` (session count + gap trend)
- Wire into `ConversationDirector.preProcess()`
- **Expected impact**: Month 3 retention +15-25% (conservative estimate)

### Priority 4: Conversation Threading (MEDIUM impact, HIGH effort)
- Add `ConversationThread` interface and store
- Add thread detection heuristics to MemoryMaker
- Add prioritization algorithm
- Add thread injection to system prompt
- Wire into SessionPlanner
- **Expected impact**: Session return rate +10-15%, perceived relationship depth +40%

### Sequencing

1. **Rich Character Generation** first — it improves EVERY conversation from the first session onward
2. **Emotional Memory** second — it provides the raw material for month 3 interventions
3. **Month 3 Interventions** third — they depend on emotional memories for specificity
4. **Conversation Threading** fourth — it's the highest-effort change and its impact compounds over time (worthless for new users, extremely valuable for month 2+ users)

---

## Appendix: Research References

- Altman, I., & Taylor, D.A. (1973). Social penetration: The development of interpersonal relationships.
- Bandura, A. (1977). Self-efficacy: Toward a unifying theory of behavioral change.
- Berlyne, D.E. (1960). Conflict, arousal, and curiosity.
- Brown, R., & Kulik, J. (1977). Flashbulb memories.
- Deci, E.L., & Ryan, R.M. (1985). Intrinsic motivation and self-determination in human behavior.
- Dibble, J.L., Hartmann, T., & Rosaen, S.F. (2016). Parasocial interaction and parasocial relationship.
- Dornyei, Z. (2009). The L2 motivational self system.
- Duck, S. (1994). Meaningful relationships: Talking, sense, and relating.
- Horton, D., & Wohl, R.R. (1956). Mass communication and para-social interaction.
- Loewenstein, G. (1994). The psychology of curiosity: A review and reinterpretation.
- Norton, B. (2000). Identity and language learning.
- Rogers, C.R. (1951). Client-centered therapy.
- Selinker, L. (1972). Interlanguage.
- Skehan, P. (1998). A cognitive approach to language learning.
- Spencer-Oatey, H. (2008). Culturally speaking: Culture, communication and politeness theory.
- Talarico, J.M., & Rubin, D.C. (2003). Confidence, not consistency, characterizes flashbulb memories.
- Tulving, E. (1972). Episodic and semantic memory.
