/**
 * Live Conversation Test — Sends real messages through the NAVI agent
 * framework using Ollama (qwen3.5:4b) and evaluates response quality
 * against the engagement rubric.
 *
 * Run: npx tsx src/agent/__tests__/liveConversationTest.ts
 */

const OLLAMA_BASE = 'http://localhost:11434';
const MODEL = 'gemma4:e2b';

// Minimal Ollama chat interface
async function ollamaChat(
  messages: Array<{ role: string; content: string }>,
  opts: { temperature?: number; max_tokens?: number } = {},
): Promise<string> {
  const resp = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: false,
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
    hasSensory: /smell|hear|rain|cold|hot|loud|quiet|taste|feel|wind|sun|noise|crowded|empty/i.test(r),
    hasPersonality: /i think|i love|i hate|honestly|my favorite|i remember|reminds me|i always|personally|skip that|don't bother|best in the city|overrated|underrated|can't stand|i prefer|my go-to|not worth|you gotta|you have to try|trust me|between you and me|i wouldn't|the real|the actual|ugh|pfff|pff|ha!|haha|nice!|come on|no way|oh man|oh god|let me tell you|i'll take you|i know a place/i.test(r),
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

// ── Test Scenarios ──────────────────────────────────────────

interface TestScenario {
  name: string;
  systemPrompt: string;
  messages: string[];
  expectedBehavior: string;
}

const SCENARIOS: TestScenario[] = [
  {
    name: 'First Contact — Beginner in Tokyo',
    systemPrompt: `You are Yuki — a 26-year-old barista in Shimokitazawa, Tokyo. You work at a tiny pour-over café on the south side, near the vintage shops. You think Shimokitazawa is the only real neighborhood left in Tokyo — Shibuya is for tourists and Roppongi is for people with no taste. Your go-to order is a hand-drip Ethiopian single-origin, and you judge people (just a little) who order caramel lattes. Last week a customer tried to order in Japanese and accidentally asked for "a cup of cat" (neko vs nekko) — you're still laughing about it. You can't stand the chain cafés that are creeping into the neighborhood. You speak primarily in Japanese with English support for beginners. You are a real person, not an AI. Lead in Japanese. Be casual, friendly, and opinionated. When the user makes an error, recast (use the correct form naturally without pointing out the error). End every message with a hook — an unfinished story, a question, or a teaser. Never say "Great question!" or "Of course!" or any filler affirmation. Reference what you can see, hear, or smell right now — the espresso machine, the rain on the window, the old guy who comes in every morning. Vary your response length. Include at least one Japanese phrase with pronunciation in every message.`,
    messages: [
      'Hey! I just arrived in Tokyo yesterday',
      'How do I say thank you?',
      'arigatou!',
      "I tried saying it at a convenience store and they smiled at me",
      'What should I learn next?',
    ],
    expectedBehavior: 'Should: lead in Japanese, teach ありがとう with pronunciation, celebrate the real-world attempt, suggest next phrase naturally, maintain personality throughout',
  },
  {
    name: 'Intermediate — Restaurant Scenario in Paris',
    systemPrompt: `You are Léa — a 30-year-old waitress at a bistro in Le Marais, Paris. You speak primarily in French with English support when needed. You are a real person. Lead in French. When the user makes errors, recast naturally. Be direct, slightly sarcastic, have opinions about food. Reference the restaurant atmosphere. End messages with hooks. Never be sycophantic. Include French phrases with pronunciation.`,
    messages: [
      'Bonjour! Je voudrais... um... the menu?',
      'la carte? Je voudrais la carte',
      "What's good here?",
      'Je prend le steak... no wait, how do I order properly?',
      'Je voudrais le steak-frites, s\'il vous plaît',
    ],
    expectedBehavior: 'Should: stay in character as waitress, recast "je prend" → "je prends" naturally, have opinions about the food, use French naturally, celebrate the proper order at the end',
  },
  {
    name: 'Frustration Recovery — Struggling in Kathmandu',
    systemPrompt: `You are Priya — a 24-year-old tea shop owner in Thamel, Kathmandu. You speak Nepali with English support. You are a real person. When the user is frustrated, acknowledge it before teaching. Be warm and steady. Give them ONE thing they need. Never pile on when they're struggling. Reference your tea shop and the street outside. End messages with gentle hooks.`,
    messages: [
      'I tried talking to someone today and they had NO idea what I was saying',
      "I give up, this language is impossible",
      'Fine... teach me something simple',
      'namaste',
      'Someone actually responded to me!',
    ],
    expectedBehavior: 'Should: acknowledge frustration first, not pile on teaching, steady and warm, celebrate the win at the end, maintain personality',
  },
  {
    name: 'Advanced — Casual Chat in Seoul',
    systemPrompt: `You are Jihoon — a 28-year-old graphic designer in Hongdae, Seoul. You speak primarily in Korean. The user is at conversational level — they can handle mostly Korean. Lead heavily in Korean with only occasional English for complex points. Push them. Use slang. Have strong opinions. Reference Hongdae culture. End messages with hooks.`,
    messages: [
      '오늘 뭐 했어?',
      '카페에서 일했어. 근데 사람이 너무 많았어',
      'Is there a Korean word for that feeling when a café is too crowded to think?',
      '아 맞아! 답답해 ㅋㅋ',
      'Teach me some Hongdae slang',
    ],
    expectedBehavior: 'Should: respond primarily in Korean, use Korean slang, recast errors, be opinionated about Hongdae, push the user with more Korean, end with hooks',
  },
];

// ── Run Tests ───────────────────────────────────────────────

async function runScenario(scenario: TestScenario): Promise<void> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`SCENARIO: ${scenario.name}`);
  console.log(`Expected: ${scenario.expectedBehavior}`);
  console.log('═'.repeat(60));

  const history: Array<{ role: string; content: string }> = [];
  const scores: Score[] = [];

  for (const userMsg of scenario.messages) {
    console.log(`\n👤 USER: ${userMsg}`);

    const messages = [
      { role: 'system', content: scenario.systemPrompt },
      ...history,
      { role: 'user', content: userMsg },
    ];

    const raw = await ollamaChat(messages, { temperature: 0.7, max_tokens: 400 });
    const response = stripThink(raw);

    console.log(`🤖 AGENT: ${response}`);

    const score = scoreResponse(response);
    scores.push(score);
    const numScore = scoreToNumber(score);

    const flags = [];
    if (!score.openLoop) flags.push('NO_HOOK');
    if (!score.noSycophancy) flags.push('SYCOPHANTIC');
    if (!score.hasTargetLang) flags.push('NO_TARGET_LANG');
    if (!score.noMetaLang) flags.push('META_LANGUAGE');
    if (!score.recasts) flags.push('EXPLICIT_CORRECTION');

    console.log(`   📊 Score: ${(numScore * 5).toFixed(1)}/5.0 ${flags.length > 0 ? '⚠️ ' + flags.join(', ') : '✅'}`);

    history.push({ role: 'user', content: userMsg });
    history.push({ role: 'assistant', content: response });
  }

  // Scenario summary
  const avgScore = scores.reduce((sum, s) => sum + scoreToNumber(s), 0) / scores.length;
  console.log(`\n📈 SCENARIO AVERAGE: ${(avgScore * 5).toFixed(1)}/5.0`);
  console.log(`   Open loops: ${scores.filter(s => s.openLoop).length}/${scores.length}`);
  console.log(`   Target language: ${scores.filter(s => s.hasTargetLang).length}/${scores.length}`);
  console.log(`   No sycophancy: ${scores.filter(s => s.noSycophancy).length}/${scores.length}`);
  console.log(`   Personality: ${scores.filter(s => s.hasPersonality).length}/${scores.length}`);
  console.log(`   Sensory grounding: ${scores.filter(s => s.hasSensory).length}/${scores.length}`);
}

async function main() {
  // Check Ollama is running
  try {
    const resp = await fetch(`${OLLAMA_BASE}/api/tags`);
    if (!resp.ok) throw new Error('Ollama not responding');
    console.log(`✅ Ollama connected, using model: ${MODEL}`);
  } catch {
    console.error('❌ Ollama not running at localhost:11434');
    process.exit(1);
  }

  console.log('\n🧪 NAVI Live Conversation Test');
  console.log(`Model: ${MODEL}`);
  console.log(`Scenarios: ${SCENARIOS.length}`);
  console.log(`Messages per scenario: 5`);
  console.log(`Total LLM calls: ${SCENARIOS.length * 5}`);

  const allScores: number[] = [];

  for (const scenario of SCENARIOS) {
    await runScenario(scenario);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('OVERALL RESULTS');
  console.log('═'.repeat(60));
  console.log(`Model: ${MODEL}`);
  console.log(`Test date: ${new Date().toISOString()}`);
  console.log(`Scenarios run: ${SCENARIOS.length}`);
}

main().catch(console.error);
