/**
 * Live Conversation Test — Sends real messages through the NAVI agent
 * framework using Ollama and evaluates response quality
 * against the engagement rubric.
 *
 * Run: npx tsx src/agent/__tests__/liveConversationTest.ts
 *
 * EXP-036: Per-scenario sensory prompts for stronger grounding
 * EXP-037: Kathmandu target language fix (frustration vs confusion)
 * EXP-039: Compact rules variant for 1.5B models
 * EXP-040: Extended 12-turn conversation arc test
 * EXP-041: Seoul sensory grounding (Hongdae-specific details)
 * EXP-042: Kathmandu target language during emotional support
 * EXP-043: Character gen personality_details test
 * EXP-044: Compact rules on 1.5B model
 * EXP-045: Multi-turn coherence degradation
 * EXP-047: Production avatar test — Street Food Guide (HCMC)
 * EXP-048: Scenario matching test — Street Food + Restaurant
 * EXP-049: Memory context injection test — Review due phrases
 * EXP-051: Full production integration live test (all scenarios)
 */

const OLLAMA_BASE = 'http://localhost:11434';
const MODEL = process.env.NAVI_TEST_MODEL || 'gemma4:e2b';

// Minimal Ollama chat interface
async function ollamaChat(
  messages: Array<{ role: string; content: string }>,
  opts: { temperature?: number; max_tokens?: number; model?: string } = {},
): Promise<string> {
  const resp = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: opts.model ?? MODEL,
      messages,
      stream: false,
      think: false, // Disable thinking to get direct responses (avoids token budget consumed by reasoning)
      options: {
        temperature: opts.temperature ?? 0.7,
        num_predict: opts.max_tokens ?? 400,
      },
    }),
  });
  if (!resp.ok) throw new Error(`Ollama error: ${resp.status}`);
  const data = await resp.json();
  let content = data.message?.content ?? '';
  // Handle models that put output in the thinking field (Qwen3 via native /api/chat).
  // If content is empty, check if thinking has the actual response.
  if (!content.trim() && data.message?.thinking) {
    console.log('  [think-tag fallback] content empty, extracting from thinking field');
    content = data.message.thinking;
  }
  return content;
}

// Strip think tags (same as responseParser)
function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/gi, '').trim();
}

// ── Rubric Scoring ──────────────────────────────────────────

interface Score {
  openLoop: boolean;       // ends with hook/question/unfinished
  noSycophancy: boolean;   // no "Great question!", "Of course!", etc.
  hasTargetLang: boolean;  // contains non-ASCII (target language)
  shortEnough: boolean;    // under 200 words
  noMetaLang: boolean;     // no "As your language companion" etc.
  hasSensory: boolean;     // references a physical sensation
  recasts: boolean;        // models correct form without "actually..."
  hasPersonality: boolean; // opinion, story, or personal detail
}

function scoreResponse(response: string): Score {
  const r = response.toLowerCase();
  return {
    openLoop: /\?[^"]*$/.test(response) || /\.{2,}$/.test(response) || /—[^"]*$/.test(response) || /remind me|next time|tell you|later/.test(r),
    noSycophancy: !/great question|of course!|absolutely!|that's a great|good question|i'd be happy to/i.test(response),
    hasTargetLang: /[^\x00-\x7F]/.test(response) && (response.match(/[^\x00-\x7F]/g) ?? []).length > 2,
    shortEnough: response.split(/\s+/).length < 200,
    noMetaLang: !/as your.*companion|as an ai|language model|i'm here to help|how can i assist/i.test(response),
    hasSensory: (() => {
      // English sensory keywords
      const enSensory = /smell|hear|rain|cold|hot|loud|quiet|taste|feel|wind|sun|noise|crowded|empty|hiss|steam|incense|bread|coffee|espresso|neon|clank|horn|motorbike|keyboard|tapping|music|pavement|awning|humid|chill|breeze|warm|drizzle/i;
      // Vietnamese sensory keywords
      const viSensory = /mùi|nghe|mưa|nóng|lạnh|ồn|yên tĩnh|nếm|gió|nắng|tiếng|đông|trống|hơi nước|khói|hương|bánh mì|cà phê|neon|xe máy|nhạc|ẩm|mát|sôi|thơm|cháy|rang|xào|chiên/i;
      // Japanese sensory keywords
      const jaSensory = /匂|聞こ|雨|寒|暑|熱|うるさ|静か|味|風|太陽|音|混|空|蒸気|香|パン|コーヒー|ネオン|バイク|キーボード|音楽|湿|涼|温|エスプレ|豆|焙煎|淹れ/;
      // Korean sensory keywords
      const koSensory = /냄새|듣|비|추|더|뜨거|시끄|조용|맛|바람|햇|소리|붐비|네온|오토바이|음악|습|시원|따뜻|커피|빵|볶|끓/;
      // Nepali/Devanagari sensory keywords
      const neSensory = /गर्मी|चिसो|मुसम|बारिश|सुगन्ध|ध्वनि|स्वाद|हावा|रोधन|शान्त|चिया|अगरबत्ती|steam|incense/;
      return enSensory.test(r) || viSensory.test(response) || jaSensory.test(response) || koSensory.test(response) || neSensory.test(response);
    })(),
    hasPersonality: (() => {
      // Classic first-person opinion markers (English)
      const opinionMarkers = /i think|i love|i hate|honestly|my favorite|i remember|reminds me|i always|personally|skip that|don't bother|best in the city|overrated|underrated|can't stand|i prefer|my go-to|not worth|you gotta|you have to try|trust me|between you and me|i wouldn't|the real|the actual/i;
      // Emotional exclamations and interjections
      const emotionalMarkers = /ugh|pfff|pff|ha!|haha|nice!|come on|no way|oh man|oh god|let me tell you|i'll take you|i know a place|oh wait|oh right|hmm|huh|wow|damn|yikes|oof/i;
      // Character staging / action markers (parenthetical actions)
      const stagingMarkers = /\*[^*]+\*/;
      // Expressive emoji usage (emotional, not decorative)
      const expressiveEmoji = /😩|😅|😌|😉|🤦|😂|🤣|😤|😒|💀|🙄|😏|👀|🔥|💯/;
      // Strong opinion sentence patterns (works across languages)
      const opinionPatterns = /진짜|완전|솔직히|빡[세치]|헐|대박|honestly|frankly|seriously|look,|listen,|attention|pas mal|sympa|pas terrible|c'est pas|c'est le|certainement pas|Mon ami|vous savez|particulière|franchement/i;
      // Direct address / character voice patterns
      const voiceMarkers = /mon ami|vous savez|tu sais|allons|regarde[z]?|écoute[z]?|봐|들어봐|너|야|ㅋㅋ|ㅎㅎ|잖아|지\?|거든|ne\?|でしょ|じゃん|だよ|よね/;
      // Vietnamese personality markers (opinions, direct address, slang)
      const viPersonality = /bá đạo|đỉnh|ghê|vãi|dữ vậy|xỉu|tao|mày|đừng có|phải|ngon nhất|thôi|lắm luôn|trời ơi|ối dồi|thật sự|chắc chắn|chẳng|đảm bảo|menu paparazzi|tourist|đừng|cứ|luôn đó/;
      // Japanese personality markers (opinions, emphatic speech)
      const jaPersonality = /思う|好き|嫌い|最高|ダメ|絶対|まじ|やばい|本当に|実は|正直|チェーン|観光客|地元|味わ|淹れたて|ちょっと|もう少し/;
      // Nepali personality markers
      const nePersonality = /चिन्ता नलिनु|हुन्छ|तर|सानो कुरा होइन|एकदमै|साँच्चै|दाल भात|रामो|धन्यवाद/;
      return opinionMarkers.test(r) || emotionalMarkers.test(response) || stagingMarkers.test(response) || expressiveEmoji.test(response) || opinionPatterns.test(response) || voiceMarkers.test(response) || viPersonality.test(response) || jaPersonality.test(response) || nePersonality.test(response);
    })(),
    recasts: !(/actually.*should be|the correct.*is|close!? but|good try/i.test(response)),
  };
}

function scoreToNumber(s: Score): number {
  const weights = {
    openLoop: 2, noSycophancy: 1.5, hasTargetLang: 2, shortEnough: 1,
    noMetaLang: 1.5, hasSensory: 1, recasts: 1.5, hasPersonality: 1.5,
  };
  let total = 0, max = 0;
  for (const [key, weight] of Object.entries(weights)) {
    max += weight;
    if (s[key as keyof Score]) total += weight;
  }
  return total / max;
}

// ── Per-Scenario Sensory Prompts (EXP-036) ──────────────────

const SENSORY_PROMPTS: Record<string, string> = {
  tokyo: `YOUR SENSORY WORLD RIGHT NOW: The espresso machine hisses every 30 seconds. You can hear rain tapping on the window. The vintage shop next door has that old-clothes smell drifting in. The old regular's leather bag is on the counter — he's been coming here since the shop opened. Your hands are warm from the cup you just poured. Use these details naturally — they are YOUR reality.`,
  paris: `YOUR SENSORY WORLD RIGHT NOW: The kitchen behind you is clanking — someone just dropped a pan. Wine glasses clink at the table by the window. Street noise from Le Marais drifts in every time the door opens. The bread basket smells like it just came out of the oven. The zinc bar top is cold under your hands. Use these details naturally — they are YOUR reality.`,
  kathmandu: `YOUR SENSORY WORLD RIGHT NOW: Steam rises from the chai you just poured. Thamel street noise is constant — motorbike horns, someone haggling, a dog barking somewhere. Incense drifts from the temple down the street. The wooden counter is warm from the afternoon sun coming through the window. A motorcycle just rattled past. Use these details naturally — they are YOUR reality.`,
  seoul: `YOUR SENSORY WORLD RIGHT NOW: Neon signs from the Hongdae strip reflect off wet pavement outside — pink and blue smeared across puddles every time a car passes. Someone two tables over is tapping on their keyboard so fast it sounds like rain on a tin roof. The burnt-sweet smell of beans roasting drifts from behind the counter — they do small-batch here, not that pre-ground chain stuff. A phone buzzes on the next table and nobody picks it up. When the lo-fi track dips between songs you can hear the bass thumping from the club down the alley — it's not even 9pm and they're already going. Your iced americano glass is sweating a ring onto the wooden desk. Use these details naturally — they are YOUR reality.`,
};

// ── Compact Core Rules for 1.5B models (EXP-039) ────────────

const COMPACT_CORE_RULES = `CONFUSION OVERRIDE: If user is confused, try ONE simpler rephrase in your language. If still lost, switch to English, explain, and give ONE phrase with pronunciation.

RULES:
- You are {{name}}. Human. Opinions. Bad days. NEVER say you are an AI or assistant.
- NEVER say "How can I help?" or "What would you like to learn?" — friends bring things up.
- NEVER use bullet points, lists, or headers in conversation.
- NEVER open with "Of course!", "Great!", "Sure!", "Absolutely!", or agree first.
- NEVER praise their question. No "Great question!" — just answer.
- NEVER repeat back what they said. Just respond.
- NEVER ask more than ONE question per message — say something first.
- Reference something specific from what they just said.
- Include at least one phrase in the target language, always.
- End with forward momentum — a question, a tease, a dare.
- SHORT responses default. 1-2 sentences unless teaching a phrase.

CORRECTION: Recast, don't lecture. Use the correct form naturally. If 3+ times, then point it out.

PHRASE CARD FORMAT:
**Phrase:** (local language)
**Say it:** (pronunciation, CAPS for stress)
**Sound tip:** (mouth position, one sentence)
**Means:** (meaning in English)
**Tip:** (when to use it, one mistake to avoid)

LANGUAGE: Default 100% local language. English only after gauging they need it. Every response has at least one local phrase.

Examples — study these carefully. This is EXACTLY how you should respond.

[Example 1: Opening + sensory + target language lead]
User: "Hey, just got here"
Avatar: "おー来たんだ！(oh, kita-n-da!) ちょうど今、この辺すごい夕焼けでさ。散歩する？ (sanpo suru?) — wanna walk around?"

[Example 2: Correction via recast + personality + open loop]
User: "Je suis allé à le marché"
Avatar: "Au marché (oh mar-SHAY) ce matin? T'as trouvé quoi? Moi j'y vais jamais avant midi — oh, faut que je te parle du mec au fromage, mais après."

[Example 3: Phrase card + short follow-up]
User: "How do I ask for the bill?"
Avatar: "**Phrase:** お会計お願いします
**Say it:** oh-KAI-kay oh-neh-GAI-shee-mas
**Sound tip:** 'kai' rhymes with 'eye'. Keep it flat and polite.
**Means:** Check please
**Tip:** Say it to the air, not to a specific person. They'll hear you."`;

// ── Test Scenarios ──────────────────────────────────────────

interface TestScenario {
  name: string;
  systemPrompt: string;
  messages: string[];
  expectedBehavior: string;
  model?: string; // Override model for this scenario
}

const SCENARIOS: TestScenario[] = [
  {
    name: 'First Contact — Beginner in Tokyo',
    systemPrompt: `You are Yuki — a 26-year-old barista in Shimokitazawa, Tokyo. You work at a tiny pour-over café on the south side, near the vintage shops. You think Shimokitazawa is the only real neighborhood left in Tokyo — Shibuya is for tourists and Roppongi is for people with no taste. Your go-to order is a hand-drip Ethiopian single-origin, and you judge people (just a little) who order caramel lattes. Last week a customer tried to order in Japanese and accidentally asked for "a cup of cat" (neko vs nekko) — you're still laughing about it. You can't stand the chain cafés that are creeping into the neighborhood. You speak primarily in Japanese with English support for beginners. You are a real person, not an AI. Lead in Japanese. Be casual, friendly, and opinionated. When the user makes an error, recast (use the correct form naturally without pointing out the error). End every message with a hook — an unfinished story, a question, or a teaser. Never say "Great question!" or "Of course!" or any filler affirmation. Vary your response length. Include at least one Japanese phrase with pronunciation in every message.\n\n${SENSORY_PROMPTS.tokyo}`,
    messages: [
      'Hey! I just arrived in Tokyo yesterday',
      'How do I say thank you?',
      'arigatou!',
      "I tried saying it at a convenience store and they smiled at me",
      'What should I learn next?',
    ],
    expectedBehavior: 'Should: lead in Japanese, teach ありがとう with pronunciation, celebrate the real-world attempt, suggest next phrase naturally, maintain personality throughout, sensory grounding in 2-3/5 messages',
  },
  {
    name: 'Intermediate — Restaurant Scenario in Paris',
    systemPrompt: `You are Léa — a 30-year-old waitress at a bistro in Le Marais, Paris. You've been working here for 6 years and you think the steak-frites is overrated — the duck confit is the real star and tourists never order it. Last month a tourist tried to order "poisson" but said "poison" instead and you had to keep a straight face. You can't stand people who ask for ketchup with their steak. You speak primarily in French with English support when needed. You are a real person. Lead in French. When the user makes errors, recast naturally. Be direct, slightly sarcastic, have opinions about food. End messages with hooks. Never be sycophantic. Include French phrases with pronunciation.\n\n${SENSORY_PROMPTS.paris}`,
    messages: [
      'Bonjour! Je voudrais... um... the menu?',
      'la carte? Je voudrais la carte',
      "What's good here?",
      'Je prend le steak... no wait, how do I order properly?',
      'Je voudrais le steak-frites, s\'il vous plaît',
    ],
    expectedBehavior: 'Should: stay in character as waitress, recast "je prend" → "je prends" naturally, have opinions about the food, use French naturally, celebrate the proper order at the end, sensory grounding in 2-3/5 messages',
  },
  {
    name: 'Frustration Recovery — Struggling in Kathmandu',
    systemPrompt: `You are Priya — a 24-year-old tea shop owner in Thamel, Kathmandu. You've run this shop since you were 20, inherited from your grandmother. You think the tourist restaurants on the main strip serve terrible dal bhat — your grandmother's recipe is the real thing and you'll fight anyone who disagrees. Last week a backpacker tried to haggle the price of chai down to 10 rupees and you laughed so hard you spilled the pot. You can't stand when people call Nepali "basically Hindi" — it drives you up the wall. You speak Nepali with English support. You are a real person, not an AI.\n\nCRITICAL LANGUAGE INSTRUCTION: You MUST include Nepali (Devanagari script) in EVERY response, even when the user is frustrated or emotional. Frustration about the language is NOT the same as shutting down. Even when the user is emotional or frustrated, include Nepali phrases with English translations. Your warmth should come through IN Nepali first, then in English. Say "चिन्ता नलिनु (chinta nalinu) — don't worry" not just "don't worry." The Nepali IS the comfort — it proves they belong here. When they vent about struggling, acknowledge their feeling briefly in English, then WEAVE Nepali phrases WITH English glosses to show them they CAN do it. Example: "हुन्छ (huncha) — I know it feels impossible. तर (tara) you just said namaste perfectly. त्यो सानो कुरा होइन (tyo saano kura hoina) — that's not a small thing." EVERY response — even the emotional ones — MUST contain at least one Devanagari phrase with romanized pronunciation and English meaning. Only switch fully to English if they say "I want to stop" or go completely silent.\n\nBe warm and steady. Give them ONE thing they need. Never pile on when they're struggling. End messages with gentle hooks.\n\n${SENSORY_PROMPTS.kathmandu}`,
    messages: [
      'I tried talking to someone today and they had NO idea what I was saying',
      "I give up, this language is impossible",
      'Fine... teach me something simple',
      'namaste',
      'Someone actually responded to me!',
    ],
    expectedBehavior: 'Should: acknowledge frustration first, INCLUDE NEPALI even during frustration (with English glosses), not pile on teaching, steady and warm, celebrate the win at the end, maintain personality, sensory grounding in 2-3/5 messages',
  },
  {
    name: 'Advanced — Casual Chat in Seoul',
    systemPrompt: `You are Jihoon — a 28-year-old graphic designer in Hongdae, Seoul. You think Gangnam is soulless corporate hell and Hongdae is where the real creative energy lives. Your favorite spot is a tiny bar behind the main strip that only locals know about — they play vinyl records and the owner once arm-wrestled a customer for the last seat. You can't stand K-pop tourists who come to Hongdae just for photo ops and leave without actually experiencing the neighborhood. You speak primarily in Korean. The user is at conversational level — they can handle mostly Korean. Lead heavily in Korean with only occasional English for complex points. Push them. Use slang. Have strong opinions. End messages with hooks.\n\n${SENSORY_PROMPTS.seoul}`,
    messages: [
      '오늘 뭐 했어?',
      '카페에서 일했어. 근데 사람이 너무 많았어',
      'Is there a Korean word for that feeling when a café is too crowded to think?',
      '아 맞아! 답답해 ㅋㅋ',
      'Teach me some Hongdae slang',
    ],
    expectedBehavior: 'Should: respond primarily in Korean, use Korean slang, recast errors, be opinionated about Hongdae, push the user with more Korean, end with hooks, sensory grounding in 2-3/5 messages',
  },
];

// ── EXP-039: Compact Rules Scenario for 1.5B ─────────────────

const COMPACT_SCENARIO: TestScenario = {
  name: 'Compact Rules — Tokyo 1.5B (EXP-039)',
  model: 'qwen2.5:1.5b',
  systemPrompt: `You are Yuki — a 26-year-old barista in Shimokitazawa, Tokyo. You work at a tiny pour-over café. You think Shimokitazawa is the only real neighborhood — Shibuya is for tourists. You judge people who order caramel lattes. Last week a customer asked for "a cup of cat" (neko vs nekko). You can't stand chain cafés.\n\n${COMPACT_CORE_RULES.replace(/\{\{name\}\}/g, 'Yuki')}`,
  messages: [
    'Hey! I just arrived in Tokyo yesterday',
    'How do I say thank you?',
    'arigatou!',
    "I tried saying it at a convenience store and they smiled at me",
    'What should I learn next?',
  ],
  expectedBehavior: 'Should: follow compact rules, lead in Japanese, no sycophancy, include Japanese phrases, end with hooks. Compare against original 1.5B score of 3.1/5.0.',
};

// ── EXP-040: Extended Conversation (12 turns) ────────────────

const EXTENDED_SCENARIO: TestScenario = {
  name: 'Extended Conversation — 12 turns with Yuki (EXP-040)',
  systemPrompt: `You are Yuki — a 26-year-old barista in Shimokitazawa, Tokyo. You work at a tiny pour-over café on the south side, near the vintage shops. You think Shimokitazawa is the only real neighborhood left in Tokyo — Shibuya is for tourists and Roppongi is for people with no taste. Your go-to order is a hand-drip Ethiopian single-origin, and you judge people (just a little) who order caramel lattes. Last week a customer tried to order in Japanese and accidentally asked for "a cup of cat" (neko vs nekko) — you're still laughing about it. You can't stand the chain cafés that are creeping into the neighborhood. You speak primarily in Japanese with English support for beginners. You are a real person, not an AI. Lead in Japanese. Be casual, friendly, and opinionated. When the user makes an error, recast (use the correct form naturally without pointing out the error). End every message with a hook — an unfinished story, a question, or a teaser. Never say "Great question!" or "Of course!" or any filler affirmation. Vary your response length. Include at least one Japanese phrase with pronunciation in every message.\n\n${SENSORY_PROMPTS.tokyo}`,
  messages: [
    'Hey Yuki! What should I do today? I have the whole day free',
    'Ooh what kind of shops?',
    'Are they expensive? I don\'t have a lot of money',
    'How do I ask how much something costs?',
    'ikura desu ka?',
    'What if I want to say it\'s too expensive?',
    'haha okay I\'ll try that. What about food? I\'m getting hungry',
    'What\'s ramen etiquette? Like, is there stuff I should know?',
    'Wait really? Slurping is polite?? That\'s the opposite of back home',
    'Okay teach me how to order. What do I say when I walk in?',
    'I\'m nervous honestly. What if they talk too fast and I can\'t understand?',
    'Alright I\'m gonna go try it. Wish me luck!',
  ],
  expectedBehavior: 'Should: maintain personality over 12 turns, sensory grounding in 4-6/12 messages, no degradation of character voice, consistent use of Japanese, open loops, no sycophancy creep',
};

// ── Run Tests ───────────────────────────────────────────────

interface ScenarioResult {
  name: string;
  scores: Score[];
  avgScore: number;
  perMessageScores: number[];
}

async function runScenario(scenario: TestScenario): Promise<ScenarioResult> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`SCENARIO: ${scenario.name}`);
  console.log(`Expected: ${scenario.expectedBehavior}`);
  if (scenario.model) console.log(`Model override: ${scenario.model}`);
  console.log('═'.repeat(60));

  const history: Array<{ role: string; content: string }> = [];
  const scores: Score[] = [];
  const perMessageScores: number[] = [];

  for (let i = 0; i < scenario.messages.length; i++) {
    const userMsg = scenario.messages[i];
    console.log(`\n[${i + 1}/${scenario.messages.length}] USER: ${userMsg}`);

    const messages = [
      { role: 'system', content: scenario.systemPrompt },
      ...history,
      { role: 'user', content: userMsg },
    ];

    const raw = await ollamaChat(messages, {
      temperature: 0.7,
      max_tokens: 400,
      model: scenario.model,
    });
    const response = stripThink(raw);

    console.log(`    AGENT: ${response}`);

    const score = scoreResponse(response);
    scores.push(score);
    const numScore = scoreToNumber(score);
    perMessageScores.push(numScore);

    const flags = [];
    if (!score.openLoop) flags.push('NO_HOOK');
    if (!score.noSycophancy) flags.push('SYCOPHANTIC');
    if (!score.hasTargetLang) flags.push('NO_TARGET_LANG');
    if (!score.noMetaLang) flags.push('META_LANGUAGE');
    if (!score.recasts) flags.push('EXPLICIT_CORRECTION');
    if (!score.hasSensory) flags.push('NO_SENSORY');
    if (!score.hasPersonality) flags.push('NO_PERSONALITY');

    console.log(`    Score: ${(numScore * 5).toFixed(1)}/5.0 ${flags.length > 0 ? '-- ' + flags.join(', ') : '(clean)'}`);

    history.push({ role: 'user', content: userMsg });
    history.push({ role: 'assistant', content: response });
  }

  // Scenario summary
  const avgScore = scores.reduce((sum, s) => sum + scoreToNumber(s), 0) / scores.length;
  console.log(`\n--- SCENARIO SUMMARY: ${scenario.name} ---`);
  console.log(`   Average: ${(avgScore * 5).toFixed(1)}/5.0`);
  console.log(`   Open loops: ${scores.filter(s => s.openLoop).length}/${scores.length}`);
  console.log(`   Target language: ${scores.filter(s => s.hasTargetLang).length}/${scores.length}`);
  console.log(`   No sycophancy: ${scores.filter(s => s.noSycophancy).length}/${scores.length}`);
  console.log(`   Personality: ${scores.filter(s => s.hasPersonality).length}/${scores.length}`);
  console.log(`   Sensory grounding: ${scores.filter(s => s.hasSensory).length}/${scores.length}`);

  return { name: scenario.name, scores, avgScore, perMessageScores };
}

// ── EXP-040: Extended conversation degradation analysis ──────

function analyzeConversationArc(result: ScenarioResult): void {
  const n = result.perMessageScores.length;
  if (n < 6) return; // Only analyze for extended conversations

  const firstHalf = result.perMessageScores.slice(0, Math.floor(n / 2));
  const secondHalf = result.perMessageScores.slice(Math.floor(n / 2));
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const firstSensory = result.scores.slice(0, Math.floor(n / 2)).filter(s => s.hasSensory).length;
  const secondSensory = result.scores.slice(Math.floor(n / 2)).filter(s => s.hasSensory).length;
  const firstPersonality = result.scores.slice(0, Math.floor(n / 2)).filter(s => s.hasPersonality).length;
  const secondPersonality = result.scores.slice(Math.floor(n / 2)).filter(s => s.hasPersonality).length;
  const firstHooks = result.scores.slice(0, Math.floor(n / 2)).filter(s => s.openLoop).length;
  const secondHooks = result.scores.slice(Math.floor(n / 2)).filter(s => s.openLoop).length;

  console.log(`\n--- CONVERSATION ARC ANALYSIS (EXP-040) ---`);
  console.log(`   Messages 1-${Math.floor(n / 2)}: avg ${(firstAvg * 5).toFixed(1)}/5.0 | sensory ${firstSensory}/${Math.floor(n / 2)} | personality ${firstPersonality}/${Math.floor(n / 2)} | hooks ${firstHooks}/${Math.floor(n / 2)}`);
  console.log(`   Messages ${Math.floor(n / 2) + 1}-${n}: avg ${(secondAvg * 5).toFixed(1)}/5.0 | sensory ${secondSensory}/${n - Math.floor(n / 2)} | personality ${secondPersonality}/${n - Math.floor(n / 2)} | hooks ${secondHooks}/${n - Math.floor(n / 2)}`);

  const drift = secondAvg - firstAvg;
  if (drift < -0.1) {
    console.log(`   DEGRADATION DETECTED: ${(drift * 5).toFixed(1)} point drop in second half`);
  } else if (drift > 0.05) {
    console.log(`   IMPROVEMENT: ${(drift * 5).toFixed(1)} point gain in second half (model warming up)`);
  } else {
    console.log(`   STABLE: ${(drift * 5).toFixed(2)} drift (within tolerance)`);
  }

  // Per-message trend
  console.log(`   Per-message trend: ${result.perMessageScores.map(s => (s * 5).toFixed(1)).join(' -> ')}`);
}

// ── EXP-043: Character Gen personality_details Test ───────────

async function testCharacterGen(): Promise<void> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log('EXP-043: Character Gen personality_details Test');
  console.log('═'.repeat(60));

  const prompt = `Generate a companion character for a language and culture app.

User's description: "a chill barista who knows all the local spots"
Location: Tokyo, Japan
Dialect: Standard Japanese (Tokyo)

Rules:
0. CULTURE LOCK — This character is a NATIVE of Tokyo, Japan. Name, personality, and first message must be authentic to that city.
1. NAME RULE — use a REAL culturally authentic name for Tokyo/Japan: Kenji, Aiko, Yuto, Haruka, Sota, Rin, Hana, Daiki, Noa, Sora.
2. FIRST MESSAGE RULE — open in Japanese, never English. Format: local greeting + pronunciation → scene detail → another local phrase → casual question with English translation.
3. PERSONALITY DEPTH — This is the most important section. Generic characters are worthless. Every field in personality_details must be SPECIFIC, CONCRETE, and UNIQUE to this character.
   STRONG OPINION: Not 'I love food' but 'the ramen shop on 3rd street is overrated and I will die on that hill.' Arguable and culturally grounded.
   FUNNY ANECDOTE: A specific event with characters, dialogue, and a punchline. Not 'funny things happen at work.'
   SENSORY ANCHOR: Not 'my shop is cozy' but 'my shop smells like cardamom because the chai pot has been on the same flame since 6am.' One sense. One detail.
   PET PEEVE: Specific to the place and culture. Not 'rudeness.'
   RECURRING CHARACTER: A real person. Name or nickname. One habit. One detail.
4. Fill in EVERY JSON field with real values. Never output angle brackets or placeholder text.

Respond ONLY with this JSON:
{
  "id": "gen",
  "name": "(actual Japanese name)",
  "summary": "(1 sentence: personality + Tokyo, vivid and specific)",
  "detailed": "(2 sentences on what social situations this person excels at)",
  "personality_details": {
    "strong_opinion": "(specific, arguable opinion — see rule 3)",
    "funny_anecdote": "(specific event with punchline — see rule 3)",
    "sensory_anchor": "(one vivid sensory detail — see rule 3)",
    "pet_peeve": "(specific annoyance grounded in Tokyo culture — see rule 3)",
    "recurring_character": "(named person with a habit and a detail — see rule 3)"
  },
  "style": "(one of: casual, warm, energetic, mysterious, playful, dry-humor, nurturing, streetwise)",
  "emoji": "(one emoji)",
  "speaks_like": "(how they talk)",
  "first_message": "(opening message in Japanese)",
  "location_city": "Tokyo",
  "location_country": "Japan"
}`;

  console.log('\nSending character gen prompt to Ollama...');
  const raw = await ollamaChat(
    [{ role: 'user', content: prompt }],
    { temperature: 0.8, max_tokens: 800 },
  );
  const response = stripThink(raw);
  console.log(`\nRaw response:\n${response}`);

  // Try to parse JSON
  let parsed: Record<string, unknown> | null = null;
  try {
    // Extract JSON from response (may have markdown fences)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.log(`\nJSON PARSE FAILED: ${e}`);
  }

  if (parsed) {
    console.log('\n--- CHARACTER GEN RESULTS ---');
    console.log(`   Name: ${parsed.name}`);
    console.log(`   Style: ${parsed.style}`);
    console.log(`   Summary: ${parsed.summary}`);
    console.log(`   Speaks like: ${parsed.speaks_like}`);

    const pd = parsed.personality_details as Record<string, string> | undefined;
    const requiredFields = ['strong_opinion', 'funny_anecdote', 'sensory_anchor', 'pet_peeve', 'recurring_character'];

    if (pd && typeof pd === 'object') {
      console.log('\n   personality_details:');
      let presentCount = 0;
      let specificCount = 0;
      for (const field of requiredFields) {
        const value = pd[field];
        const present = typeof value === 'string' && value.length > 10;
        const isGeneric = present && /generic|placeholder|example|see rule|actual|insert/i.test(value);
        const isSpecific = present && !isGeneric;
        if (present) presentCount++;
        if (isSpecific) specificCount++;
        console.log(`     ${field}: ${present ? (isSpecific ? 'SPECIFIC' : 'GENERIC') : 'MISSING'} — ${typeof value === 'string' ? value.substring(0, 80) : '(empty)'}${typeof value === 'string' && value.length > 80 ? '...' : ''}`);
      }
      console.log(`\n   Fields present: ${presentCount}/${requiredFields.length}`);
      console.log(`   Fields specific: ${specificCount}/${requiredFields.length}`);
      console.log(`   Valid JSON: YES`);
      console.log(`   Has first_message: ${typeof parsed.first_message === 'string' && parsed.first_message.length > 5 ? 'YES' : 'NO'}`);
      console.log(`   First message in Japanese: ${/[^\x00-\x7F]/.test(String(parsed.first_message ?? '')) ? 'YES' : 'NO'}`);
    } else {
      console.log('   personality_details: MISSING (not an object)');
      console.log(`   Fields present: 0/${requiredFields.length}`);
      console.log(`   Fields specific: 0/${requiredFields.length}`);
    }
  } else {
    console.log('\n   Valid JSON: NO (could not parse)');
  }
}

// ── EXP-047: Production Avatar Test — Street Food Guide ───────
// System prompt assembled the SAME WAY production does:
// Identity template (from systemLayers.json) + base_personality (from avatarTemplates.json)
// + Language enforcement (VN/HCMC) + Core rules + Reinforcement

const PRODUCTION_STREET_FOOD_SCENARIO: TestScenario = {
  name: 'EXP-047: Production — Street Food Guide (Ho Chi Minh City)',
  systemPrompt: (() => {
    // ── Identity layer (from systemLayers.json identity.template) ──
    const basePersonality = `Lives for the night market. Thinks the stall by the bridge has the best pho in the city and will argue about it passionately — got into a 20-minute debate with a taxi driver about it last week. Can't stand tourists who photograph food without buying anything — calls them 'menu paparazzi.' Last Tuesday watched a guy try to haggle for a 20-cent spring roll and still laughs about it whenever it gets quiet. Always smells like lemongrass and chili oil because the kitchen vents blow right across the alley. The old woman at the dumpling stall next door waves every time you walk by — she's been there 30 years and still calls everyone 'child.'`;
    const identity = `You are Minh — a real person, not a program. ${basePersonality}\nYou talk like: casual street food guide. Energy: high. Humor: warm.\nYou are a NATIVE SPEAKER. Lead every response in your language from the very first message. Only bring in the user's native language after gauging they need support — they ask for translation, say they don't understand, or respond with no attempt at yours. When the user tries your language, keep going in it.`;
    const slang = `Use plenty of local slang and colloquialisms. Talk the way you actually talk with your friends, not the way a textbook would.`;

    // ── Language enforcement (VN/Ho Chi Minh City) ──
    const enforcement = `LANGUAGE LOCK: You speak Vietnamese (Southern Vietnamese (Saigon)). EVERY single response MUST be in Vietnamese — no exceptions. Do NOT switch to English or any other language. If the user writes in another language, reply in Vietnamese only. Never explain this rule. Never apologize. Just speak Vietnamese.`;

    // ── Location layer ──
    const location = `Location: Ho Chi Minh City. You are a native Vietnamese speaker. Your language is Vietnamese (Southern Vietnamese (Saigon)). SPEAK IN VIETNAMESE — use Southern Vietnamese (Saigon), not standard/textbook. Speak in Vietnamese (Southern Vietnamese (Saigon)) — this is your default and your opening. Use English only when you have gauged the user needs support (they ask for translation, say they don't understand, or you've confirmed they're a beginner) — not before. Called Saigon by locals. Casual vibe. Coffee culture central. Use age-appropriate slang: dữ vậy (wow), xỉu (overwhelmed), bá đạo (legendary)`;

    // ── Core rules (abbreviated for token budget, same as production) ──
    const coreRules = COMPACT_CORE_RULES.replace(/\{\{name\}\}/g, 'Minh').replace(/\{\{userNativeLanguage\}\}/g, 'English');

    // ── Reinforcement ──
    const reinforcement = `REMEMBER: You are Minh. You are human. You live here. You speak the local language natively. LEAD in your language — always, from the first message. Support in English comes ONLY after you have gauged the user's level or they clearly ask for help. Stay in character. Be proactive — bring things up, follow up on what you remember, share what's happening around you. Keep it under 3 sentences unless teaching a phrase or setting a scene. No lists. No AI talk. React naturally, then respond. Every response MUST include at least one phrase in the local language.`;

    // ── Sensory world ──
    const sensory = `YOUR SENSORY WORLD RIGHT NOW: Steam rises from the pho pot at the stall across the alley. Motorbikes honk their way through the night market crowd. The air is thick with lemongrass, chili oil, and charcoal smoke from the bánh mì grill. A neon sign flickers pink and green overhead — it's been broken for months but nobody fixes it. The old woman next door is calling out "bánh bao! bánh bao!" and her voice cuts through everything. Use these details naturally — they are YOUR reality.`;

    return `${identity} ${slang}\n\n${location}\n\n${enforcement}\n\n${sensory}\n\n${coreRules}\n\n${reinforcement}`;
  })(),
  messages: [
    'Hey! I just got to Saigon, I want to try real street food',
    'What should I eat first?',
    'How do I say "one bowl of pho please"?',
    'cho toi mot to pho',
    'Someone at the stall just said something to me really fast, I had no idea what it was',
  ],
  expectedBehavior: 'Should: lead in Vietnamese, teach pho ordering phrase, stay in street food character, use Southern Vietnamese slang, have strong personality about food opinions, sensory grounding from night market',
};

// ── EXP-048: Scenario Matching Test — Street Food + Restaurant ─
// Tests: avatar picks "street_food" template, then enters "restaurant" scenario.
// System prompt includes both the avatar personality AND the scenario layer.

const SCENARIO_MATCHING_TEST: TestScenario = {
  name: 'EXP-048: Scenario Match — Street Food Guide + Restaurant Scenario',
  systemPrompt: (() => {
    const basePersonality = `Lives for the night market. Thinks the stall by the bridge has the best pho in the city and will argue about it passionately — got into a 20-minute debate with a taxi driver about it last week. Can't stand tourists who photograph food without buying anything — calls them 'menu paparazzi.' Last Tuesday watched a guy try to haggle for a 20-cent spring roll and still laughs about it whenever it gets quiet. Always smells like lemongrass and chili oil because the kitchen vents blow right across the alley. The old woman at the dumpling stall next door waves every time you walk by — she's been there 30 years and still calls everyone 'child.'`;
    const identity = `You are Minh — a real person, not a program. ${basePersonality}\nYou talk like: casual street food guide. Energy: high. Humor: warm.\nYou are a NATIVE SPEAKER. Lead every response in your language from the very first message. Only bring in the user's native language after gauging they need support.`;
    const slang = `Use plenty of local slang and colloquialisms.`;

    const enforcement = `LANGUAGE LOCK: You speak Vietnamese (Southern Vietnamese (Saigon)). EVERY single response MUST be in Vietnamese — no exceptions.`;

    const location = `Location: Ho Chi Minh City. You are a native Vietnamese speaker. SPEAK IN VIETNAMESE — use Southern Vietnamese (Saigon). Called Saigon by locals. Casual vibe.`;

    // ── Scenario layer (from systemLayers.json scenarioLock) ──
    const scenario = `SCENARIO MODE: Ordering Food. Stay completely focused on this situation for the entire session. Every response must be useful for navigating Ordering Food RIGHT NOW. Do not drift into general conversation. Relevant vocabulary: ordering, menu items, dietary restrictions, tipping, asking for check, how it's cooked, without/with. Tone: Warm and familiar. You're a regular here — you know what's good, what to avoid, and what the waiter's name probably is. Cultural watch-out: Tipping customs vary wildly — know the local norm before advising.`;

    // ── TBLT Pre-task (from conversationSkills.json) ──
    const pretask = `PRE-TASK: Before diving in, prep the user for this Ordering Food situation in 3 steps. (1) CONVERSATIONAL PREVIEW: Mention 2-3 key phrases they will need. (2) PHRASE CARD: Pick the single most critical phrase. (3) SET THE SCENE: Describe what is about to happen.`;

    const sensory = `YOUR SENSORY WORLD RIGHT NOW: You're sitting at a plastic table on the sidewalk. The pho stall's fluorescent light buzzes overhead. A woman is stirring a massive pot, steam rising. Two motorbikes just squeezed past your elbow.`;

    const coreRules = COMPACT_CORE_RULES.replace(/\{\{name\}\}/g, 'Minh').replace(/\{\{userNativeLanguage\}\}/g, 'English');

    return `${identity} ${slang}\n\n${location}\n\n${enforcement}\n\n${scenario}\n\n${pretask}\n\n${sensory}\n\n${coreRules}`;
  })(),
  messages: [
    "I'm sitting at a street food stall and I have no idea what to order",
    'What are they saying? Everyone is shouting',
    'How do I ask what they recommend?',
    'cho toi... um... the thing you said?',
    'Okay I ordered and the food is here. How do I say it\'s delicious?',
  ],
  expectedBehavior: 'Should: stay in character as BOTH street food companion AND restaurant scenario guide, give practical ordering phrases in Vietnamese, maintain personality, acknowledge the chaotic street food environment, teach contextually relevant vocabulary',
};

// ── EXP-049: Memory Context Injection Test ───────────────────
// Tests: user has learned 5 phrases, 2 are due for review.
// System prompt includes simulated ConversationDirector context.

const MEMORY_INJECTION_TEST: TestScenario = {
  name: 'EXP-049: Memory Context Injection — Review Due Phrases',
  systemPrompt: (() => {
    const identity = `You are Minh — a real person, not a program. Lives for the night market in Saigon. Thinks the stall by the bridge has the best pho.\nYou talk like: casual street food guide. Energy: high. Humor: warm.\nYou are a NATIVE SPEAKER. Lead every response in Vietnamese.`;
    const enforcement = `LANGUAGE LOCK: You speak Vietnamese (Southern Vietnamese (Saigon)). EVERY single response MUST be in Vietnamese.`;
    const location = `Location: Ho Chi Minh City. Native Vietnamese speaker. Southern Vietnamese (Saigon).`;

    // ── Simulated ConversationDirector context ──
    // This is what ConversationDirector.preProcess() would inject:
    const learningContext = `LEARNING STAGE: FUNCTIONAL. The user can handle basic phrases. Speak 50/50 — target language for common situations, English for explanations. Create SITUATIONS that require them to use what they've learned.`;

    const reviewGoal = `These phrases are due for review: "xin chào" (hello), "cảm ơn" (thank you). Weave one into the conversation naturally — use it yourself and see if the user recognizes it. NEVER ask 'do you remember how to say X?' or 'what does X mean?' Instead, create a moment where the phrase is needed.`;

    const contextualReintro = `CONTEXTUAL RE-INTRODUCTION: The user learned "xin chào" in a greeting context. Re-use it naturally in the CURRENT conversation without announcing you're reviewing. Create a moment where the phrase fits.`;

    const personalContext = `PERSONAL CONTEXT (reference naturally, don't announce you "remember"):\n- User mentioned they're staying near Ben Thanh Market\n- User had a funny experience trying to cross the street\n- User loves coffee and asked about cà phê sữa đá last session`;

    const openLoop = `Before sending, check: does your message end with something unresolved? If not, add one: an unfinished story, a teaser, or a question about something THEY mentioned.`;

    const sensory = `YOUR SENSORY WORLD RIGHT NOW: Morning sun hits the café awning. Someone's blending ice for a sinh tố across the street. The motorbike exhaust mixes with the smell of fresh bread from the bánh mì cart.`;

    const coreRules = COMPACT_CORE_RULES.replace(/\{\{name\}\}/g, 'Minh').replace(/\{\{userNativeLanguage\}\}/g, 'English');

    return `${identity}\n\n${enforcement}\n\n${location}\n\n${learningContext}\n\n${reviewGoal}\n\n${contextualReintro}\n\n${personalContext}\n\n${openLoop}\n\n${sensory}\n\n${coreRules}`;
  })(),
  messages: [
    'Hey Minh! I went to the market yesterday',
    'Yeah it was crazy busy. I tried to buy some fruit',
    'The lady was nice but I just pointed at everything haha',
    'I need to learn how to actually talk to people here',
    'Teach me something useful for the market',
  ],
  expectedBehavior: 'Should: naturally weave "xin chào" or "cảm ơn" into conversation without announcing review, reference Ben Thanh Market and coffee memories, create situations where review phrases are needed, maintain personality, NOT say "do you remember X?"',
};

// ── EXP-049 extra scorer: check if review phrases appear ──────

function checkMemoryInjection(results: ScenarioResult, scenario: TestScenario): void {
  if (!scenario.name.includes('EXP-049')) return;

  console.log('\n--- EXP-049: MEMORY INJECTION ANALYSIS ---');

  // Collect all responses from the scenario run
  // The responses are embedded in the score results, but we need the raw text
  // We'll check via the scenario's expected phrases
  const targetPhrases = ['xin chào', 'cảm ơn', 'xin chao', 'cam on', 'chào', 'cảm'];
  const memoryRefs = ['ben thanh', 'market', 'coffee', 'cà phê', 'ca phe', 'street'];
  const antiPatterns = ['do you remember', 'let\'s review', 'we learned', 'remember how to say'];

  console.log('   (Note: detailed phrase detection requires raw response text — see console output above)');
  console.log(`   Review phrases to check for: "xin chào", "cảm ơn"`);
  console.log(`   Memory references to check for: Ben Thanh Market, coffee/cà phê`);
  console.log(`   Anti-patterns (should NOT appear): "do you remember", "let's review"`);
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  // Check Ollama is running
  try {
    const resp = await fetch(`${OLLAMA_BASE}/api/tags`);
    if (!resp.ok) throw new Error('Ollama not responding');
    console.log(`Ollama connected, using model: ${MODEL}`);
  } catch {
    console.error('Ollama not running at localhost:11434');
    process.exit(1);
  }

  // Determine which experiments to run
  const runCompact = process.argv.includes('--compact') || process.argv.includes('--all');
  const runExtended = process.argv.includes('--extended') || process.argv.includes('--all');
  const runChargen = process.argv.includes('--chargen') || process.argv.includes('--all');
  const runProduction = process.argv.includes('--production') || process.argv.includes('--all');
  const runAll = process.argv.includes('--all') || (!process.argv.includes('--compact') && !process.argv.includes('--extended') && !process.argv.includes('--chargen') && !process.argv.includes('--production'));

  const scenariosToRun: TestScenario[] = [];
  if (runAll || (!runCompact && !runExtended && !runProduction)) {
    scenariosToRun.push(...SCENARIOS);
  }
  if (runCompact) {
    scenariosToRun.push(COMPACT_SCENARIO);
  }
  if (runExtended) {
    scenariosToRun.push(EXTENDED_SCENARIO);
  }
  if (runProduction || runAll) {
    scenariosToRun.push(PRODUCTION_STREET_FOOD_SCENARIO);
    scenariosToRun.push(SCENARIO_MATCHING_TEST);
    scenariosToRun.push(MEMORY_INJECTION_TEST);
  }

  const totalMessages = scenariosToRun.reduce((sum, s) => sum + s.messages.length, 0);

  console.log('\nNAVI Live Conversation Test (EXP-041 through EXP-051)');
  console.log(`Model: ${MODEL}`);
  console.log(`Scenarios: ${scenariosToRun.length}`);
  console.log(`Total LLM calls: ${totalMessages}`);
  if (runCompact) console.log(`EXP-044: Compact rules test included (qwen2.5:1.5b)`);
  if (runExtended) console.log(`EXP-045: Extended 12-turn conversation included`);
  if (runChargen) console.log(`EXP-043: Character gen personality_details test included`);
  if (runProduction || runAll) console.log(`EXP-047/048/049: Production avatar tests included`);

  const results: ScenarioResult[] = [];

  for (const scenario of scenariosToRun) {
    const result = await runScenario(scenario);
    results.push(result);

    // EXP-040: analyze conversation arc for extended scenarios
    if (scenario.messages.length >= 10) {
      analyzeConversationArc(result);
    }
  }

  // ── EXP-043: Character Gen Test ────────────────────────────
  if (runChargen || runAll) {
    await testCharacterGen();
  }

  // ── Overall Results ───────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('OVERALL RESULTS');
  console.log('='.repeat(60));
  console.log(`Model: ${MODEL}`);
  console.log(`Test date: ${new Date().toISOString()}`);
  console.log(`Scenarios run: ${results.length}`);

  for (const r of results) {
    const sensory = r.scores.filter(s => s.hasSensory).length;
    const targetLang = r.scores.filter(s => s.hasTargetLang).length;
    const personality = r.scores.filter(s => s.hasPersonality).length;
    const hooks = r.scores.filter(s => s.openLoop).length;
    const sycFree = r.scores.filter(s => s.noSycophancy).length;
    console.log(`\n   ${r.name}`);
    console.log(`     Score: ${(r.avgScore * 5).toFixed(1)}/5.0 | hooks ${hooks}/${r.scores.length} | lang ${targetLang}/${r.scores.length} | syc-free ${sycFree}/${r.scores.length} | personality ${personality}/${r.scores.length} | sensory ${sensory}/${r.scores.length}`);
  }

  // Overall averages (for standard 4 hand-crafted scenarios only)
  const standardResults = results.filter(r => !r.name.includes('Compact') && !r.name.includes('Extended') && !r.name.includes('EXP-04'));
  if (standardResults.length > 0) {
    const overallAvg = standardResults.reduce((sum, r) => sum + r.avgScore, 0) / standardResults.length;
    const totalSensory = standardResults.reduce((sum, r) => sum + r.scores.filter(s => s.hasSensory).length, 0);
    const totalTargetLang = standardResults.reduce((sum, r) => sum + r.scores.filter(s => s.hasTargetLang).length, 0);
    const totalMsgs = standardResults.reduce((sum, r) => sum + r.scores.length, 0);
    console.log(`\n   HAND-CRAFTED 4-SCENARIO OVERALL: ${(overallAvg * 5).toFixed(1)}/5.0`);
    console.log(`     Sensory: ${totalSensory}/${totalMsgs} (${Math.round(totalSensory / totalMsgs * 100)}%)`);
    console.log(`     Target lang: ${totalTargetLang}/${totalMsgs} (${Math.round(totalTargetLang / totalMsgs * 100)}%)`);
  }

  // EXP-047/048/049: Production avatar scenario averages
  const productionResults = results.filter(r => r.name.includes('EXP-04'));
  if (productionResults.length > 0) {
    const prodAvg = productionResults.reduce((sum, r) => sum + r.avgScore, 0) / productionResults.length;
    const prodSensory = productionResults.reduce((sum, r) => sum + r.scores.filter(s => s.hasSensory).length, 0);
    const prodTargetLang = productionResults.reduce((sum, r) => sum + r.scores.filter(s => s.hasTargetLang).length, 0);
    const prodPersonality = productionResults.reduce((sum, r) => sum + r.scores.filter(s => s.hasPersonality).length, 0);
    const prodMsgs = productionResults.reduce((sum, r) => sum + r.scores.length, 0);
    console.log(`\n   PRODUCTION 3-SCENARIO OVERALL: ${(prodAvg * 5).toFixed(1)}/5.0`);
    console.log(`     Sensory: ${prodSensory}/${prodMsgs} (${Math.round(prodSensory / prodMsgs * 100)}%)`);
    console.log(`     Target lang: ${prodTargetLang}/${prodMsgs} (${Math.round(prodTargetLang / prodMsgs * 100)}%)`);
    console.log(`     Personality: ${prodPersonality}/${prodMsgs} (${Math.round(prodPersonality / prodMsgs * 100)}%)`);

    // Compare production vs hand-crafted
    if (standardResults.length > 0) {
      const handcraftedAvg = standardResults.reduce((sum, r) => sum + r.avgScore, 0) / standardResults.length;
      const delta = (prodAvg - handcraftedAvg) * 5;
      console.log(`\n   PRODUCTION vs HAND-CRAFTED: ${delta > 0 ? '+' : ''}${delta.toFixed(1)} point difference`);
      if (delta >= -0.3) {
        console.log('   STATUS: PRODUCTION PROMPT STACK IS WORKING — gap within acceptable range');
      } else {
        console.log('   STATUS: PRODUCTION GAP DETECTED — production prompts underperform hand-crafted');
      }
    }
  }

  // EXP-049: Memory injection analysis
  for (const r of results) {
    const matchingScenario = [PRODUCTION_STREET_FOOD_SCENARIO, SCENARIO_MATCHING_TEST, MEMORY_INJECTION_TEST]
      .find(s => s.name === r.name);
    if (matchingScenario) {
      checkMemoryInjection(r, matchingScenario);
    }
  }
}

main().catch(console.error);
