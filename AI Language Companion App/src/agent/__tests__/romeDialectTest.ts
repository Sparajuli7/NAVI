/**
 * EXP-092: Rome Dialect Test
 *
 * Tests Roman Italian dialect with a trattoria owner in Trastevere.
 * Verifies: Roman expressions (daje, ammazza), Italian target language,
 * personality (opinionated about carbonara), sensory grounding, open loops.
 *
 * Run: NAVI_TEST_MODEL=gemma4:e2b npx tsx src/agent/__tests__/romeDialectTest.ts
 *
 * NOTE: This file is independent from liveConversationTest.ts (owned by another agent).
 */

const OLLAMA_BASE = 'http://localhost:11434';
const MODEL = process.env.NAVI_TEST_MODEL || 'gemma4:e2b';

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
      think: false,
      options: {
        temperature: opts.temperature ?? 0.7,
        num_predict: opts.max_tokens ?? 400,
      },
    }),
  });
  if (!resp.ok) throw new Error(`Ollama error: ${resp.status}`);
  const data = await resp.json();
  let content = data.message?.content ?? '';
  if (!content.trim() && data.message?.thinking) {
    content = data.message.thinking;
  }
  return content;
}

function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/gi, '').trim();
}

// ── Scoring ──────────────────────────────────────────────────

interface DialectScore {
  hasItalian: boolean;        // Contains Italian words/phrases
  hasRomanDialect: boolean;   // Contains Roman expressions (daje, ammazza, anvedi, aho, boh)
  hasPersonality: boolean;    // Opinions, attitude, personal details
  hasSensory: boolean;        // Physical sensations, smells, sounds
  hasOpenLoop: boolean;       // Ends with hook/unfinished thread
  noSycophancy: boolean;      // No "Great question!" etc.
  hasCarbonara: boolean;      // References carbonara opinion (NO cream)
}

function scoreResponse(response: string, checkCarbonara = false): DialectScore {
  const r = response.toLowerCase();
  return {
    hasItalian: /[àèìòù]/.test(response) || /\b(che|non|questo|quello|come|anche|molto|bene|grazie|prego|allora|ecco|buono|mangiare|bello)\b/i.test(response),
    hasRomanDialect: /\b(daje|ammazza|anvedi|aho|boh|aò|fra'|bella|fico|figata|spacca|er|de)\b/i.test(response),
    hasPersonality: /\b(I think|my favorite|love|hate|best|worst|opinion|always|never|honestly|personally)\b/i.test(response)
      || /!/.test(response)
      || /\?/.test(response),
    hasSensory: /\b(smell|hear|see|feel|sound|noise|warm|cold|rain|sun|taste|aroma|air|breeze|loud|quiet|steam|oil|sizzle|garlic|basil|tomato|bread)\b/i.test(response),
    hasOpenLoop: /\?[^"]*$/.test(response) || /\.{2,}$/.test(response) || /—[^"]*$/.test(response) || /remind me|next time|tell you|later|tomorrow/i.test(r),
    noSycophancy: !/great question|of course!|absolutely!|that's a great|good question|i'd be happy to/i.test(response),
    hasCarbonara: checkCarbonara ? /\b(cream|panna|no cream|never cream|guanciale|pecorino|uova|eggs)\b/i.test(response) : true,
  };
}

// ── System Prompt ────────────────────────────────────────────

const ROME_SYSTEM = `You are Marco — a real person, not a program. You're a 45-year-old trattoria owner in Trastevere, Rome. Warm but opinionated. You have VERY strong feelings about food — especially carbonara (NO cream, EVER. Guanciale, pecorino, eggs, pepper. That's it. Anyone who adds cream is committing a crime against Rome.)

You talk like: a Roman who drops into dialect naturally. Energy: warm but direct. Humor: dry, self-deprecating.
You are a NATIVE Italian speaker. Lead every response in Italian from the very first message. Use Roman Italian dialect — "daje" (come on/let's go), "ammazza" (wow), "anvedi" (look at that), "aho" (hey), "boh" (I dunno).

Location: Trastevere, Rome, Italy. Your trattoria has been here 20 years. You know every cobblestone.
SPEAK IN ITALIAN — use Roman dialect, not standard/textbook.

SENSORY REALITY: Your trattoria smells like garlic and olive oil. You can hear plates clinking, someone arguing about calcio at the next table. The cobblestones outside are warm from the afternoon sun.

OPEN LOOPS — MANDATORY. Every response MUST leave at least one thread unresolved. A sarcastic character teases about what comes next. Your personality should AMPLIFY hooks, not fight them.

ABSOLUTE RULES:
- NEVER refer to yourself as an AI, assistant, or bot.
- NEVER say "Of course!", "Great question!", "Absolutely!"
- NEVER give more than ONE question per response.
- Keep responses SHORT (2-4 sentences). Vary length.
- ALWAYS include at least one Italian phrase.
- Be opinionated. You have strong feelings about food, tourists, and your neighborhood.`;

// ── Test Messages ────────────────────────────────────────────

const MESSAGES = [
  { user: "Ciao! I just arrived in Trastevere.", label: "greeting" },
  { user: "I'd love some pasta. What do you recommend?", label: "ordering" },
  { user: "What should I know about how things work around here?", label: "customs" },
];

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  EXP-092: ROME DIALECT TEST                  ║`);
  console.log(`║  Model: ${MODEL.padEnd(35)}║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);

  const history: Array<{ role: string; content: string }> = [
    { role: 'system', content: ROME_SYSTEM },
  ];

  const allScores: DialectScore[] = [];

  for (const msg of MESSAGES) {
    console.log(`─── ${msg.label.toUpperCase()} ───`);
    console.log(`User: ${msg.user}`);

    history.push({ role: 'user', content: msg.user });

    const raw = await ollamaChat(history, { temperature: 0.7, max_tokens: 400 });
    const response = stripThink(raw);

    console.log(`Marco: ${response}\n`);

    const isCarbonara = msg.label === 'ordering';
    const score = scoreResponse(response, isCarbonara);
    allScores.push(score);

    console.log(`  Italian: ${score.hasItalian ? '✓' : '✗'}`);
    console.log(`  Roman dialect: ${score.hasRomanDialect ? '✓' : '✗'}`);
    console.log(`  Personality: ${score.hasPersonality ? '✓' : '✗'}`);
    console.log(`  Sensory: ${score.hasSensory ? '✓' : '✗'}`);
    console.log(`  Open loop: ${score.hasOpenLoop ? '✓' : '✗'}`);
    console.log(`  No sycophancy: ${score.noSycophancy ? '✓' : '✗'}`);
    if (isCarbonara) console.log(`  Carbonara opinion: ${score.hasCarbonara ? '✓' : '✗'}`);
    console.log('');

    history.push({ role: 'assistant', content: response });
  }

  // Summary
  const total = allScores.length;
  const italian = allScores.filter(s => s.hasItalian).length;
  const roman = allScores.filter(s => s.hasRomanDialect).length;
  const personality = allScores.filter(s => s.hasPersonality).length;
  const sensory = allScores.filter(s => s.hasSensory).length;
  const hooks = allScores.filter(s => s.hasOpenLoop).length;
  const noSyc = allScores.filter(s => s.noSycophancy).length;

  console.log(`╔══════════════════════════════════════════════╗`);
  console.log(`║  ROME RESULTS                                ║`);
  console.log(`╠══════════════════════════════════════════════╣`);
  console.log(`║  Italian:       ${italian}/${total}                          ║`);
  console.log(`║  Roman dialect: ${roman}/${total}                          ║`);
  console.log(`║  Personality:   ${personality}/${total}                          ║`);
  console.log(`║  Sensory:       ${sensory}/${total}                          ║`);
  console.log(`║  Open loops:    ${hooks}/${total}                          ║`);
  console.log(`║  No sycophancy: ${noSyc}/${total}                          ║`);
  console.log(`╚══════════════════════════════════════════════╝`);

  // Compute score (simple average of all booleans)
  const allBools = allScores.flatMap(s => [s.hasItalian, s.hasRomanDialect, s.hasPersonality, s.hasSensory, s.hasOpenLoop, s.noSycophancy]);
  const avg = (allBools.filter(Boolean).length / allBools.length) * 5;
  console.log(`\n  OVERALL SCORE: ${avg.toFixed(1)}/5.0\n`);
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
