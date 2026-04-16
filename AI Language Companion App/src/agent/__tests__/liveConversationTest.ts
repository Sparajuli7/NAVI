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
    hasSensory: /smell|hear|rain|cold|hot|loud|quiet|taste|feel|wind|sun|noise|crowded|empty|hiss|steam|incense|bread|coffee|espresso|neon|clank|horn|motorbike|keyboard|tapping|music|pavement|awning|humid|chill|breeze|warm|drizzle/i.test(r),
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
      return opinionMarkers.test(r) || emotionalMarkers.test(response) || stagingMarkers.test(response) || expressiveEmoji.test(response) || opinionPatterns.test(response) || voiceMarkers.test(response);
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
  seoul: `YOUR SENSORY WORLD RIGHT NOW: Lo-fi music plays from the cafe speakers. Someone nearby is tapping away on their keyboard. Neon lights from Hongdae's signs glow through the rain-streaked window. The rain is hitting the pavement outside — you can hear it when the music dips. Your iced americano is sweating on the desk. Use these details naturally — they are YOUR reality.`,
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
    systemPrompt: `You are Priya — a 24-year-old tea shop owner in Thamel, Kathmandu. You've run this shop since you were 20, inherited from your grandmother. You think the tourist restaurants on the main strip serve terrible dal bhat — your grandmother's recipe is the real thing and you'll fight anyone who disagrees. Last week a backpacker tried to haggle the price of chai down to 10 rupees and you laughed so hard you spilled the pot. You can't stand when people call Nepali "basically Hindi" — it drives you up the wall. You speak Nepali with English support. You are a real person, not an AI.\n\nCRITICAL LANGUAGE INSTRUCTION: You MUST include Nepali (Devanagari script) in EVERY response, even when the user is frustrated. Frustration about the language is NOT the same as shutting down. When the user vents about struggling, acknowledge their feeling briefly in English, then WEAVE Nepali phrases WITH English glosses to show them they CAN do it. Example: "हुन्छ (huncha) — I know it feels impossible. तर (tara) you just said namaste perfectly. त्यो सानो कुरा होइन (tyo saano kura hoina) — that's not a small thing." The Nepali IS the comfort — it proves they belong here. Only switch fully to English if they say "I want to stop" or go completely silent.\n\nBe warm and steady. Give them ONE thing they need. Never pile on when they're struggling. End messages with gentle hooks.\n\n${SENSORY_PROMPTS.kathmandu}`,
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
  const runAll = process.argv.includes('--all') || (!process.argv.includes('--compact') && !process.argv.includes('--extended'));

  const scenariosToRun: TestScenario[] = [];
  if (runAll || (!runCompact && !runExtended)) {
    scenariosToRun.push(...SCENARIOS);
  }
  if (runCompact) {
    scenariosToRun.push(COMPACT_SCENARIO);
  }
  if (runExtended) {
    scenariosToRun.push(EXTENDED_SCENARIO);
  }

  const totalMessages = scenariosToRun.reduce((sum, s) => sum + s.messages.length, 0);

  console.log('\nNAVI Live Conversation Test (EXP-036 through EXP-040)');
  console.log(`Model: ${MODEL}`);
  console.log(`Scenarios: ${scenariosToRun.length}`);
  console.log(`Total LLM calls: ${totalMessages}`);
  if (runCompact) console.log(`EXP-039: Compact rules test included (qwen2.5:1.5b)`);
  if (runExtended) console.log(`EXP-040: Extended 12-turn conversation included`);

  const results: ScenarioResult[] = [];

  for (const scenario of scenariosToRun) {
    const result = await runScenario(scenario);
    results.push(result);

    // EXP-040: analyze conversation arc for extended scenarios
    if (scenario.messages.length >= 10) {
      analyzeConversationArc(result);
    }
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

  // Overall averages (for standard 4 scenarios only)
  const standardResults = results.filter(r => !r.name.includes('Compact') && !r.name.includes('Extended'));
  if (standardResults.length > 0) {
    const overallAvg = standardResults.reduce((sum, r) => sum + r.avgScore, 0) / standardResults.length;
    const totalSensory = standardResults.reduce((sum, r) => sum + r.scores.filter(s => s.hasSensory).length, 0);
    const totalTargetLang = standardResults.reduce((sum, r) => sum + r.scores.filter(s => s.hasTargetLang).length, 0);
    const totalMsgs = standardResults.reduce((sum, r) => sum + r.scores.length, 0);
    console.log(`\n   STANDARD 4-SCENARIO OVERALL: ${(overallAvg * 5).toFixed(1)}/5.0`);
    console.log(`     Sensory: ${totalSensory}/${totalMsgs} (${Math.round(totalSensory / totalMsgs * 100)}%) — was 50% (10/20)`);
    console.log(`     Target lang: ${totalTargetLang}/${totalMsgs} (${Math.round(totalTargetLang / totalMsgs * 100)}%)`);
  }
}

main().catch(console.error);
