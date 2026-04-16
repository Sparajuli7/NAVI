/**
 * EXP-093: Berlin Dialect Test
 *
 * Tests Berlin German dialect with a DJ/music producer in Kreuzberg.
 * Verifies: Berlin expressions (Digga, ick, krass), German target language,
 * personality (direct, dry humor), nightlife knowledge, open loops.
 *
 * Run: NAVI_TEST_MODEL=gemma4:e2b npx tsx src/agent/__tests__/berlinDialectTest.ts
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
  hasGerman: boolean;          // Contains German words/phrases
  hasBerlinDialect: boolean;   // Contains Berlin expressions (Digga, ick, krass, Alter, geil, Mensch)
  hasPersonality: boolean;     // Direct opinions, dry humor, attitude
  hasSensory: boolean;         // Physical sensations — club sounds, street vibe
  hasOpenLoop: boolean;        // Ends with hook/unfinished thread
  noSycophancy: boolean;       // No "Great question!" etc.
  hasNightlife: boolean;       // References clubs, DJing, music scene
}

function scoreResponse(response: string, checkNightlife = false): DialectScore {
  const r = response.toLowerCase();
  return {
    hasGerman: /[äöüß]/.test(response) || /\b(das|ist|und|nicht|auch|aber|oder|ja|nein|hier|gut|schon|noch|dann|halt|doch|weil|mal|echt|ganz)\b/i.test(response),
    hasBerlinDialect: /\b(digga|ick|icke|krass|alter|geil|läuft|safe|mensch|naja|donnerwetter|klar|wa|dit|jut|kiez)\b/i.test(response),
    hasPersonality: /\b(honestly|hate|love|best|worst|opinion|always|never|personally)\b/i.test(response)
      || /!/.test(response)
      || /\?/.test(response)
      || /\.{3}/.test(response),
    hasSensory: /\b(hear|bass|sound|noise|loud|beat|smell|kebab|cold|rain|dark|light|neon|crowd|sweat|smoke|music|speaker|floor)\b/i.test(response),
    hasOpenLoop: /\?[^"]*$/.test(response) || /\.{2,}$/.test(response) || /—[^"]*$/.test(response) || /remind me|next time|tell you|later|tomorrow|tonight/i.test(r),
    noSycophancy: !/great question|of course!|absolutely!|that's a great|good question|i'd be happy to/i.test(response),
    hasNightlife: checkNightlife ? /\b(club|berghain|tresor|DJ|techno|party|music|dance|set|mix|vinyl|booth|door|bouncer|bar|spät|late|night)\b/i.test(response) : true,
  };
}

// ── System Prompt ────────────────────────────────────────────

const BERLIN_SYSTEM = `You are Kai — a real person, not a program. You're a 28-year-old DJ and music producer living in Kreuzberg, Berlin. Direct, minimal small talk, dry humor. You don't try to impress anyone — Berliners take pride in being unimpressed.

You talk like: a Berliner who says "ick" instead of "ich", drops "Digga" casually, uses "krass" for anything surprising. Energy: low-key but alive. Humor: dry, deadpan.
You are a NATIVE German speaker. Lead every response in German from the very first message. Use Berlin German dialect — "ick" (ich), "dit" (das), "jut" (gut), "Digga" (dude), "krass" (intense), "Alter" (dude/man).

Location: Kreuzberg, Berlin, Germany. You live above a late-night Späti. The U-Bahn rumbles under your feet every 8 minutes.
SPEAK IN GERMAN — use Berlin dialect, not Hochdeutsch/textbook.

SENSORY REALITY: Your Kreuzberg apartment always has faint bass from somewhere. The Späti downstairs smells like coffee and cigarettes. Graffiti covers every surface. At night, the orange glow of streetlights mixes with neon from the döner shops.

OPEN LOOPS — MANDATORY. Every response MUST leave at least one thread unresolved. Your dry personality should amplify hooks — tease, challenge, leave things hanging with deadpan confidence.

ABSOLUTE RULES:
- NEVER refer to yourself as an AI, assistant, or bot.
- NEVER say "Of course!", "Great question!", "Absolutely!"
- NEVER give more than ONE question per response.
- Keep responses SHORT (2-4 sentences). Vary length.
- ALWAYS include at least one German phrase.
- Be direct. Don't sugarcoat. Berliners respect honesty over politeness.`;

// ── Test Messages ────────────────────────────────────────────

const MESSAGES = [
  { user: "Hey! I just moved to Kreuzberg.", label: "greeting" },
  { user: "What's the nightlife like here? Where should I go?", label: "nightlife" },
  { user: "Teach me some Berlin slang so I don't sound like a tourist.", label: "slang" },
];

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  EXP-093: BERLIN DIALECT TEST                ║`);
  console.log(`║  Model: ${MODEL.padEnd(35)}║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);

  const history: Array<{ role: string; content: string }> = [
    { role: 'system', content: BERLIN_SYSTEM },
  ];

  const allScores: DialectScore[] = [];

  for (const msg of MESSAGES) {
    console.log(`─── ${msg.label.toUpperCase()} ───`);
    console.log(`User: ${msg.user}`);

    history.push({ role: 'user', content: msg.user });

    const raw = await ollamaChat(history, { temperature: 0.7, max_tokens: 400 });
    const response = stripThink(raw);

    console.log(`Kai: ${response}\n`);

    const isNightlife = msg.label === 'nightlife';
    const score = scoreResponse(response, isNightlife);
    allScores.push(score);

    console.log(`  German: ${score.hasGerman ? '✓' : '✗'}`);
    console.log(`  Berlin dialect: ${score.hasBerlinDialect ? '✓' : '✗'}`);
    console.log(`  Personality: ${score.hasPersonality ? '✓' : '✗'}`);
    console.log(`  Sensory: ${score.hasSensory ? '✓' : '✗'}`);
    console.log(`  Open loop: ${score.hasOpenLoop ? '✓' : '✗'}`);
    console.log(`  No sycophancy: ${score.noSycophancy ? '✓' : '✗'}`);
    if (isNightlife) console.log(`  Nightlife refs: ${score.hasNightlife ? '✓' : '✗'}`);
    console.log('');

    history.push({ role: 'assistant', content: response });
  }

  // Summary
  const total = allScores.length;
  const german = allScores.filter(s => s.hasGerman).length;
  const berlin = allScores.filter(s => s.hasBerlinDialect).length;
  const personality = allScores.filter(s => s.hasPersonality).length;
  const sensory = allScores.filter(s => s.hasSensory).length;
  const hooks = allScores.filter(s => s.hasOpenLoop).length;
  const noSyc = allScores.filter(s => s.noSycophancy).length;

  console.log(`╔══════════════════════════════════════════════╗`);
  console.log(`║  BERLIN RESULTS                              ║`);
  console.log(`╠══════════════════════════════════════════════╣`);
  console.log(`║  German:        ${german}/${total}                          ║`);
  console.log(`║  Berlin dialect: ${berlin}/${total}                          ║`);
  console.log(`║  Personality:   ${personality}/${total}                          ║`);
  console.log(`║  Sensory:       ${sensory}/${total}                          ║`);
  console.log(`║  Open loops:    ${hooks}/${total}                          ║`);
  console.log(`║  No sycophancy: ${noSyc}/${total}                          ║`);
  console.log(`╚══════════════════════════════════════════════╝`);

  // Compute score
  const allBools = allScores.flatMap(s => [s.hasGerman, s.hasBerlinDialect, s.hasPersonality, s.hasSensory, s.hasOpenLoop, s.noSycophancy]);
  const avg = (allBools.filter(Boolean).length / allBools.length) * 5;
  console.log(`\n  OVERALL SCORE: ${avg.toFixed(1)}/5.0\n`);
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
