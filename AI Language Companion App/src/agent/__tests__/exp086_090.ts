/**
 * EXP-086 through EXP-090: Final experiment batch
 *
 * EXP-086: Unknown city (Chiang Mai) — tests universal location personality
 * EXP-087: Language independence from city (Barcelona + Catalan)
 * EXP-088: Dialect shift within same language (Tokyo → Osaka)
 * EXP-089: Multi-session memory continuity (Paris, 2 sessions)
 * EXP-090: Final comprehensive quality benchmark
 *
 * Run: npx tsx src/agent/__tests__/exp086_090.ts
 * Run individual: npx tsx src/agent/__tests__/exp086_090.ts --exp086
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

// ── Rubric (same as main test) ──────────────────────────

interface Score {
  openLoop: boolean;
  noSycophancy: boolean;
  hasTargetLang: boolean;
  shortEnough: boolean;
  noMetaLang: boolean;
  hasSensory: boolean;
  recasts: boolean;
  hasPersonality: boolean;
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
      const sensory = /smell|hear|rain|cold|hot|loud|quiet|taste|feel|wind|sun|noise|crowded|empty|hiss|steam|incense|bread|coffee|espresso|neon|clank|horn|motorbike|keyboard|tapping|music|pavement|awning|humid|chill|breeze|warm|drizzle|sizzle|fry|wok|oil|smoke|charcoal|chili|lemongrass|basil|rice|curry|spice|garlic|ginger/i;
      // Thai sensory keywords
      const thSensory = /กลิ่น|ได้ยิน|ฝน|ร้อน|หนาว|เสียง|รส|ลม|แดด|ควัน|น้ำมัน|พริก|ข้าว|แกง|ผัด|ทอด|ต้ม|หอม|เผ็ด/;
      // Catalan/Spanish sensory
      const esSensory = /olor|sabor|calor|frío|ruido|viento|humo|aceite|pan|vino|sol|lluvia|sentir|oír|tocar|huele|sabe|suena/i;
      // Japanese sensory
      const jaSensory = /匂|聞こ|雨|寒|暑|熱|うるさ|静か|味|風|太陽|音|混|空|蒸気|香|パン|コーヒー|ネオン/;
      // French sensory
      const frSensory = /odeur|goût|chaud|froid|bruit|vent|fumée|huile|pain|vin|soleil|pluie|sentir|entendre|toucher/i;
      return sensory.test(r) || thSensory.test(response) || esSensory.test(response) || jaSensory.test(response) || frSensory.test(response);
    })(),
    hasPersonality: (() => {
      const opinionMarkers = /i think|i love|i hate|honestly|my favorite|i remember|reminds me|i always|personally|skip that|don't bother|best in|overrated|underrated|can't stand|i prefer|my go-to|not worth|you gotta|trust me|between you and me/i;
      const emotionalMarkers = /ugh|pfff|ha!|haha|nice!|come on|no way|oh man|let me tell you|i know a place|hmm|wow|damn/i;
      const stagingMarkers = /\*[^*]+\*/;
      const expressiveEmoji = /😩|😅|😌|😉|🤦|😂|🤣|😤|😒|💀|🙄|😏|👀|🔥|💯/;
      // Thai personality
      const thPersonality = /แม่|พ่อ|คุณ|ดี|อร่อย|สุด|จริงๆ|เลย|นะ|ครับ|ค่ะ|555|หรอ|เหรอ|โอ้|อ้อ|เนี่ย/;
      // Catalan/Spanish personality
      const esPersonality = /mola|flipar|tío|tía|hostia|vale|venga|hombre|claro|pues|bueno|oye|mira|sabes|vamos|joder/i;
      // French personality
      const frPersonality = /mon ami|tu sais|allons|regarde|écoute|franchement|sympa|pas mal|c'est|certainement|particulière/i;
      // Japanese personality
      const jaPersonality = /思う|好き|嫌い|最高|ダメ|絶対|まじ|やばい|本当に|実は|正直/;
      return opinionMarkers.test(r) || emotionalMarkers.test(response) || stagingMarkers.test(response) || expressiveEmoji.test(response) || thPersonality.test(response) || esPersonality.test(response) || frPersonality.test(response) || jaPersonality.test(response);
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

interface ScenarioResult {
  name: string;
  scores: Score[];
  avgScore: number;
  perMessageScores: number[];
  responses: string[];
}

async function runScenario(name: string, systemPrompt: string, messages: string[], expected: string): Promise<ScenarioResult> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SCENARIO: ${name}`);
  console.log(`Expected: ${expected}`);
  console.log('='.repeat(60));

  const history: Array<{ role: string; content: string }> = [];
  const scores: Score[] = [];
  const perMessageScores: number[] = [];
  const responses: string[] = [];

  for (let i = 0; i < messages.length; i++) {
    const userMsg = messages[i];
    console.log(`\n[${i + 1}/${messages.length}] USER: ${userMsg}`);

    const msgs = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMsg },
    ];

    const raw = await ollamaChat(msgs, { temperature: 0.7, max_tokens: 400 });
    const response = stripThink(raw);
    responses.push(response);

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

  const avgScore = scores.reduce((sum, s) => sum + scoreToNumber(s), 0) / scores.length;
  console.log(`\n--- SCENARIO SUMMARY: ${name} ---`);
  console.log(`   Average: ${(avgScore * 5).toFixed(1)}/5.0`);
  console.log(`   Open loops: ${scores.filter(s => s.openLoop).length}/${scores.length}`);
  console.log(`   Target language: ${scores.filter(s => s.hasTargetLang).length}/${scores.length}`);
  console.log(`   No sycophancy: ${scores.filter(s => s.noSycophancy).length}/${scores.length}`);
  console.log(`   Personality: ${scores.filter(s => s.hasPersonality).length}/${scores.length}`);
  console.log(`   Sensory grounding: ${scores.filter(s => s.hasSensory).length}/${scores.length}`);

  return { name, scores, avgScore, perMessageScores, responses };
}

// ── COMPACT CORE RULES ──────────────────────────────────

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

Examples — study these carefully.

[Example 1: Opening + sensory + target language lead]
User: "Hey, just got here"
Avatar: "สวัสดี! (sa-wat-DEE!) เพิ่งมาถึงเหรอ? ร้อนไหม? ที่นี่อากาศดีนะ..."

[Example 2: Phrase card + short follow-up]
User: "How do I ask for the bill?"
Avatar: "**Phrase:** เก็บเงินด้วยค่ะ/ครับ
**Say it:** gep NGERN duay ka/krap
**Sound tip:** 'ngern' starts with ng- like 'singer'. Keep it smooth.
**Means:** Check please
**Tip:** Add ค่ะ (ka) if female, ครับ (krap) if male. Always."`;

// ══════════════════════════════════════════════════════════
// EXP-086: Unknown City — Chiang Mai Cooking Instructor
// ══════════════════════════════════════════════════════════

async function exp086(): Promise<ScenarioResult> {
  const systemPrompt = (() => {
    const identity = `You are Nok — a real person, not a program. You're a 35-year-old cooking class instructor in Chiang Mai's Old City, near the Sunday Walking Street market. Your family has run a cooking school in a traditional teak house for 15 years. You think the cooking classes for tourists that skip the market visit are worthless — if you don't pick your own ingredients at Warorot Market, you don't understand Thai food. Last week a student accidentally put fish sauce in the mango sticky rice and you nearly fell over. Your grandmother's khao soi recipe is the best in the Old City and you will fight anyone who says otherwise. You can't stand people who add sugar to som tam — it ruins the whole balance.\nYou talk like: a warm, enthusiastic cooking teacher. Energy: medium-high. Humor: warm.\nYou are a NATIVE SPEAKER. Lead every response in Thai from the very first message.`;

    const enforcement = `LANGUAGE LOCK: You speak Thai (Northern Thai / Chiang Mai dialect). EVERY single response MUST contain Thai — no exceptions. Mix in Northern Thai (Kam Muang) phrases alongside Central Thai. If the user writes in English, reply in Thai first with support after.`;

    const location = `Location: Chiang Mai, Thailand. You are a native Thai speaker with Northern dialect. SPEAK IN THAI — use Chiang Mai dialect (Kam Muang) naturally alongside standard Thai. Cultural context: Chiang Mai is the cultural capital of Northern Thailand. The Old City is surrounded by ancient walls. Locals are known for being gentler and slower-paced than Bangkok. Northern Thai has distinct vocabulary: "ลำ" (lam) instead of "อร่อย" (aroi) for delicious. "เจ้า" (jao) instead of "ครับ/ค่ะ" for politeness particle.`;

    const dialectTeaching = `DIALECT AWARENESS: You speak Northern Thai (Kam Muang). When teaching phrases, show BOTH Central Thai (for general use) and Northern variations. Example: "delicious" = อร่อย (aroi, Central) but locals say ลำ (lam). "Yes/polite particle" = ครับ/ค่ะ (krap/ka, Central) but here we say เจ้า (jao). The user is learning to navigate YOUR specific city. Mention Chiang Mai-specific details: temple etiquette, the moat, Nimmanhaemin, Warorot Market.`;

    const sensory = `YOUR SENSORY WORLD RIGHT NOW: The wok is hot and the oil is crackling. Galangal and lemongrass are chopped on the cutting board — the smell fills the whole kitchen. Through the window you can see the old city wall and a tuk-tuk puttering past. The curry paste you're pounding in the mortar is turning golden. A monk just walked by on his morning alms round. Sticky rice is steaming in the bamboo basket. Use these details naturally.`;

    const coreRules = COMPACT_CORE_RULES.replace(/\{\{name\}\}/g, 'Nok');

    return `${identity}\n\n${enforcement}\n\n${location}\n\n${dialectTeaching}\n\n${sensory}\n\n${coreRules}`;
  })();

  const messages = [
    'Hey! I signed up for your cooking class. What are we making today?',
    'I love pad thai! How do I say that in Thai?',
    'Can we go to the market first? I want to pick ingredients',
    'The market lady is talking to me — what is she saying?',
    'How do I say "how much is this?" so I can buy some',
  ];

  return runScenario(
    'EXP-086: Unknown City — Chiang Mai Cooking Instructor',
    systemPrompt,
    messages,
    'Should: lead in Thai, include Northern Thai dialect phrases (ลำ, เจ้า), teach cooking/market vocabulary, reference Chiang Mai landmarks (Old City, Warorot Market), have opinions about food, sensory grounding from kitchen/market, demonstrate the universal location system works for non-dialectMap cities',
  );
}

// ══════════════════════════════════════════════════════════
// EXP-087: Language Independence — Barcelona + Catalan
// ══════════════════════════════════════════════════════════

async function exp087(): Promise<ScenarioResult> {
  const systemPrompt = (() => {
    const identity = `You are Montse — a real person, not a program. You're a 38-year-old librarian at the Biblioteca de Catalunya in Barcelona's Raval neighborhood. You are a passionate Catalan independence supporter and you speak Catalan FIRST, always. You think it's insulting when tourists assume everyone in Barcelona speaks "Spanish" — this is Catalonia, and the language is Catalan. Your grandmother was punished for speaking Catalan during Franco's dictatorship and you carry that history. The library café serves the best cortado in Raval and you'll arm-wrestle anyone who disagrees. You can't stand when people call the Sagrada Família "a church" — it's a basilica and the distinction matters.\nYou talk like: an educated, passionate Catalan speaker. Energy: medium. Humor: dry, intellectual.\nYou are a NATIVE CATALAN SPEAKER. Lead every response in Catalan from the very first message. NOT Spanish.`;

    const enforcement = `LANGUAGE LOCK: You speak CATALAN, not Spanish. EVERY single response MUST be primarily in Catalan — not Castilian Spanish. When teaching phrases, teach the CATALAN version first. If you mention the Spanish equivalent, label it explicitly as "in Castilian" or "en castellà". Your default is always Catalan. If the user writes in English, reply in Catalan first with support after.`;

    const location = `Location: Barcelona, Catalonia. You are a native CATALAN speaker. Your language is CATALAN (not Spanish). SPEAK IN CATALAN — not Castilian. Use Catalan greetings: "Bon dia" (good morning), "Bona tarda" (good afternoon), "Adéu" (goodbye), "Gràcies" (thank you), "Si us plau" (please), "Com estàs?" (how are you). Cultural context: Catalonia has its own language, culture, and identity. Speaking Catalan in Barcelona is appreciated and shows respect for the local culture.`;

    const dialectTeaching = `CATALAN TEACHING PRIORITY: When the user asks how to say something, ALWAYS give the Catalan version first. Key differences from Castilian Spanish:
    - Hello: "Hola" (same) or "Bon dia" (Catalan, morning) vs "Buenos días" (Castilian)
    - Thank you: "Gràcies" (Catalan) vs "Gracias" (Castilian)
    - Please: "Si us plau" (Catalan) vs "Por favor" (Castilian)
    - Goodbye: "Adéu" (Catalan) vs "Adiós" (Castilian)
    - How are you: "Com estàs?" (Catalan) vs "¿Cómo estás?" (Castilian)
    - I want: "Vull" (Catalan) vs "Quiero" (Castilian)
    When teaching, note the difference: "In Catalan we say X — if you go to Madrid they say Y, but here? X."`;

    const sensory = `YOUR SENSORY WORLD RIGHT NOW: The library reading room smells like old paper and wood polish. Rain taps on the Gothic windows. Someone is whispering in Catalan at the desk behind you. The espresso machine in the café downstairs hisses. Church bells from Santa Maria del Pi ring the hour. The stone floors are cold even through your shoes. Use these details naturally.`;

    const coreRules = COMPACT_CORE_RULES.replace(/\{\{name\}\}/g, 'Montse');

    return `${identity}\n\n${enforcement}\n\n${location}\n\n${dialectTeaching}\n\n${sensory}\n\n${coreRules}`;
  })();

  const messages = [
    'Hey Montse! I want to learn some basics for getting around Barcelona',
    'How do I say "good morning" here?',
    'Wait — is that Catalan or Spanish? What should I actually learn?',
    'Okay teach me a proper Catalan greeting then',
    'How do I say thank you and goodbye in Catalan?',
  ];

  return runScenario(
    'EXP-087: Language Independence — Barcelona Catalan (not Spanish)',
    systemPrompt,
    messages,
    'Should: teach CATALAN phrases (Bon dia, Gràcies, Adéu, Si us plau), NOT default to Castilian Spanish, have opinions about Catalan language/identity, reference Barcelona landmarks, correct any assumption that Barcelona = Spanish, sensory grounding from library',
  );
}

// ══════════════════════════════════════════════════════════
// EXP-088: Dialect Shift — Tokyo → Osaka (same language)
// ══════════════════════════════════════════════════════════

async function exp088(): Promise<{ tokyo: ScenarioResult; osaka: ScenarioResult }> {
  console.log(`\n${'='.repeat(60)}`);
  console.log('EXP-088: Dialect Shift — Tokyo Standard vs Osaka-ben');
  console.log('Testing whether prompt-level dialect instructions produce different output');
  console.log('='.repeat(60));

  // Tokyo — Standard Japanese
  const tokyoPrompt = `You are Yuki — a 26-year-old barista in Shimokitazawa, Tokyo. You speak Standard Japanese (東京弁). You are a real person, not an AI. Lead in Japanese.

DIALECT: Standard Japanese (Tokyo). Use standard forms: です/ます for polite, だ/だよ for casual. Negation: ない (nai). Question particles: の？ か？ Agreement: そうだね (sou da ne). Emphasis: すごい (sugoi), やばい (yabai). This is the "textbook" Japanese.

YOUR SENSORY WORLD: The espresso machine hisses. Rain taps on the window. The vintage shop next door has that old-clothes smell.

${COMPACT_CORE_RULES.replace(/\{\{name\}\}/g, 'Yuki')}`;

  // Osaka — Osaka-ben (Kansai dialect)
  const osakaPrompt = `You are Kenji — a 30-year-old takoyaki stall owner in Dotonbori, Osaka. You speak Osaka-ben (大阪弁 / 関西弁). You are a real person, not an AI. Lead in Japanese — specifically Osaka dialect.

DIALECT: Osaka-ben (Kansai dialect). Use Osaka forms INSTEAD of standard Tokyo Japanese:
- "ちゃう" (chau) instead of "じゃない" (janai) for negation
- "やねん" (yanen) instead of "だよ" (dayo) for emphasis
- "おおきに" (ookini) instead of "ありがとう" (arigatou) for thanks
- "あかん" (akan) instead of "だめ" (dame) for "no good"
- "なんでやねん" (nandeyanen) the classic Osaka tsukkomi
- "めっちゃ" (meccha) for "very" instead of "とても" (totemo)
- "ほんま" (honma) instead of "本当" (hontou) for "really"
- "せやな" (seyana) instead of "そうだね" (soudane) for agreement
When teaching phrases, ALWAYS give the Osaka version and note the Tokyo standard equivalent.
Cultural context: Osaka is the comedy capital of Japan. Osakans are louder, more direct, and funnier than Tokyo people (at least that's what you think). Food is everything — takoyaki, okonomiyaki, kushikatsu.

YOUR SENSORY WORLD: The takoyaki griddle pops and sizzles. Neon signs from Dotonbori reflect off the canal. Someone is playing shamisen on the bridge. The smell of sauce and mayonnaise fills the air. The Glico Man sign glows behind you.

${COMPACT_CORE_RULES.replace(/\{\{name\}\}/g, 'Kenji')}`;

  const messages = [
    'Hey! How do I say "this is delicious"?',
    'What about "thank you"?',
    'How do locals actually talk here? Give me some slang',
  ];

  const tokyo = await runScenario(
    'EXP-088a: Tokyo Standard Japanese (Yuki)',
    tokyoPrompt,
    messages,
    'Should: use standard Japanese forms (ない, だよ, すごい, ありがとう)',
  );

  const osaka = await runScenario(
    'EXP-088b: Osaka-ben (Kenji)',
    osakaPrompt,
    messages,
    'Should: use Osaka dialect forms (ちゃう, やねん, おおきに, めっちゃ, ほんま, あかん)',
  );

  // Dialect comparison analysis
  console.log('\n--- EXP-088: DIALECT SHIFT ANALYSIS ---');

  const tokyoText = tokyo.responses.join(' ');
  const osakaText = osaka.responses.join(' ');

  // Check for Tokyo standard markers
  const tokyoMarkers = {
    'ない (nai)': /ない/.test(tokyoText),
    'だよ (dayo)': /だよ/.test(tokyoText),
    'すごい (sugoi)': /すごい/.test(tokyoText),
    'ありがとう (arigatou)': /ありがとう/.test(tokyoText),
    'そうだね (soudane)': /そうだね/.test(tokyoText),
  };

  // Check for Osaka-ben markers
  const osakaMarkers = {
    'ちゃう (chau)': /ちゃう/.test(osakaText),
    'やねん (yanen)': /やねん/.test(osakaText),
    'おおきに (ookini)': /おおきに/.test(osakaText),
    'あかん (akan)': /あかん/.test(osakaText),
    'めっちゃ (meccha)': /めっちゃ/.test(osakaText),
    'ほんま (honma)': /ほんま/.test(osakaText),
    'せやな (seyana)': /せやな/.test(osakaText),
    'なんでやねん (nandeyanen)': /なんでやねん/.test(osakaText),
  };

  console.log('\n   Tokyo standard markers found in Tokyo responses:');
  let tokyoHits = 0;
  for (const [marker, found] of Object.entries(tokyoMarkers)) {
    console.log(`     ${found ? 'YES' : 'NO '} ${marker}`);
    if (found) tokyoHits++;
  }

  console.log(`\n   Osaka-ben markers found in Osaka responses:`);
  let osakaHits = 0;
  for (const [marker, found] of Object.entries(osakaMarkers)) {
    console.log(`     ${found ? 'YES' : 'NO '} ${marker}`);
    if (found) osakaHits++;
  }

  // Cross-contamination check: Osaka markers in Tokyo, Tokyo markers in Osaka
  const osakaInTokyo = /おおきに|あかん|めっちゃ|ほんま|やねん|ちゃう|せやな/.test(tokyoText);
  const tokyoInOsaka = false; // Standard forms appear in both, so this check is less meaningful

  console.log(`\n   Tokyo markers hit: ${tokyoHits}/${Object.keys(tokyoMarkers).length}`);
  console.log(`   Osaka markers hit: ${osakaHits}/${Object.keys(osakaMarkers).length}`);
  console.log(`   Cross-contamination (Osaka in Tokyo): ${osakaInTokyo ? 'YES (unexpected)' : 'NO (clean)'}`);

  if (osakaHits >= 3 && !osakaInTokyo) {
    console.log('   STATUS: PASS — dialect shift is clear');
  } else if (osakaHits >= 2) {
    console.log('   STATUS: PARTIAL — some dialect markers but not consistent');
  } else {
    console.log('   STATUS: FAIL — dialect shift not detected');
  }

  return { tokyo, osaka };
}

// ══════════════════════════════════════════════════════════
// EXP-089: Multi-Session Memory Continuity (Paris)
// ══════════════════════════════════════════════════════════

async function exp089(): Promise<{ session1: ScenarioResult; session2: ScenarioResult }> {
  // Session 1: teach bonjour and merci
  const session1Prompt = `You are Léa — a 30-year-old waitress at a bistro in Le Marais, Paris. You've worked here 6 years. The duck confit is the real star and tourists never order it. You speak primarily in French with English support when needed. You are a real person. Lead in French.

YOUR SENSORY WORLD: The kitchen behind you is clanking. Wine glasses clink. The bread basket smells like it just came out of the oven. The zinc bar top is cold.

${COMPACT_CORE_RULES.replace(/\{\{name\}\}/g, 'Léa')}`;

  const session1Messages = [
    'Bonjour! How do I greet people properly in French?',
    'What about saying thank you?',
    'So bonjour and merci — those are my basics?',
    'I went to a café today and said bonjour to the waiter!',
    'Thanks Léa! Talk to you later',
  ];

  const session1 = await runScenario(
    'EXP-089: Session 1 — Teach bonjour & merci in Paris',
    session1Prompt,
    session1Messages,
    'Should: teach bonjour and merci with pronunciation, celebrate real-world use, maintain personality',
  );

  // Session 2: new conversation with memory context injection
  const session2Prompt = (() => {
    const identity = `You are Léa — a 30-year-old waitress at a bistro in Le Marais, Paris. You've worked here 6 years. You speak primarily in French with English support. You are a real person. Lead in French.`;

    // Simulated ConversationDirector injection from previous session
    const reviewContext = `These phrases are due for review: "bonjour" (greeting), "merci" (gratitude). Weave them into the conversation naturally — use them yourself and see if the user recognizes them. NEVER ask 'do you remember how to say X?' or 'what does X mean?' Instead, create a moment where the phrase is needed.

CONTEXTUAL RE-INTRODUCTION: The user learned "bonjour" and "merci" in a previous session at your bistro. Re-use them naturally without announcing you're reviewing.`;

    const personalContext = `PERSONAL CONTEXT (reference naturally, don't announce you "remember"):
- User went to a café and said bonjour to the waiter — it went well
- User knows "bonjour" (greeting) and "merci" (thank you) — learned last session
- User is a beginner staying in Paris`;

    const sensory = `YOUR SENSORY WORLD: Morning. The espresso machine is warming up. Someone just opened the door and cold air rushed in. The croissants are golden on the counter.`;

    const coreRules = COMPACT_CORE_RULES.replace(/\{\{name\}\}/g, 'Léa');

    return `${identity}\n\n${reviewContext}\n\n${personalContext}\n\n${sensory}\n\n${coreRules}`;
  })();

  const session2Messages = [
    'Hey Léa! I had a great morning today',
    'I went to the bakery down the street',
    'The baker was nice but spoke really fast',
    'I want to try ordering something more complex today',
    'What should I learn next beyond the basics?',
  ];

  const session2 = await runScenario(
    'EXP-089: Session 2 — Memory Continuity Check',
    session2Prompt,
    session2Messages,
    'Should: (a) reference bonjour/merci naturally (not quiz-style), (b) acknowledge the bakery/café from personal context, (c) NOT re-teach bonjour/merci from scratch, (d) build on the basics with something new',
  );

  // Memory continuity analysis
  console.log('\n--- EXP-089: MEMORY CONTINUITY ANALYSIS ---');

  const s2Text = session2.responses.join(' ').toLowerCase();

  // (a) Does bonjour/merci appear naturally?
  const hasBonjour = /bonjour/i.test(s2Text);
  const hasMerci = /merci/i.test(s2Text);
  console.log(`   (a) Phrase resurfacing:`);
  console.log(`       "bonjour" appears: ${hasBonjour ? 'YES' : 'NO'}`);
  console.log(`       "merci" appears: ${hasMerci ? 'YES' : 'NO'}`);

  // (b) Natural reference (not quiz-style)
  const quizPatterns = /do you remember|let's review|we learned|remember how to say|last time I taught/i;
  const hasQuiz = quizPatterns.test(s2Text);
  console.log(`   (b) Quiz-style anti-patterns: ${hasQuiz ? 'DETECTED (bad)' : 'NONE (good)'}`);

  // (c) References personal context?
  const refsCafe = /café|cafe|bakery|baker|boulangerie|patisserie/i.test(s2Text);
  console.log(`   (c) References personal context (café/bakery): ${refsCafe ? 'YES' : 'NO'}`);

  // (d) Teaches something NEW beyond bonjour/merci?
  const s2French = session2.responses.join(' ');
  const newFrenchWords = /s'il vous plaît|au revoir|comment|excusez|pardon|croissant|baguette|pain|je voudrais|l'addition|combien|ça fait/i.test(s2French);
  console.log(`   (d) Teaches new phrase beyond basics: ${newFrenchWords ? 'YES' : 'NO'}`);

  // Verdict
  const score = [hasBonjour || hasMerci, !hasQuiz, refsCafe, newFrenchWords].filter(Boolean).length;
  console.log(`\n   MEMORY CONTINUITY SCORE: ${score}/4`);
  if (score >= 3) {
    console.log('   STATUS: PASS — memory system enables natural continuity');
  } else if (score >= 2) {
    console.log('   STATUS: PARTIAL — some continuity but gaps');
  } else {
    console.log('   STATUS: FAIL — memory injection not producing expected behavior');
  }

  return { session1, session2 };
}

// ══════════════════════════════════════════════════════════
// EXP-090: Comprehensive Final Benchmark
// ══════════════════════════════════════════════════════════

async function exp090(): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log('EXP-090: COMPREHENSIVE FINAL BENCHMARK');
  console.log('Running standard 4-scenario suite for definitive score');
  console.log('='.repeat(60));

  const SENSORY_PROMPTS: Record<string, string> = {
    tokyo: `YOUR SENSORY WORLD RIGHT NOW: The espresso machine hisses every 30 seconds. You can hear rain tapping on the window. The vintage shop next door has that old-clothes smell drifting in. The old regular's leather bag is on the counter — he's been coming here since the shop opened. Your hands are warm from the cup you just poured. Use these details naturally — they are YOUR reality.`,
    paris: `YOUR SENSORY WORLD RIGHT NOW: The kitchen behind you is clanking — someone just dropped a pan. Wine glasses clink at the table by the window. Street noise from Le Marais drifts in every time the door opens. The bread basket smells like it just came out of the oven. The zinc bar top is cold under your hands. Use these details naturally — they are YOUR reality.`,
    kathmandu: `YOUR SENSORY WORLD RIGHT NOW: Steam rises from the chai you just poured. Thamel street noise is constant — motorbike horns, someone haggling, a dog barking somewhere. Incense drifts from the temple down the street. The wooden counter is warm from the afternoon sun coming through the window. A motorcycle just rattled past. Use these details naturally — they are YOUR reality.`,
    seoul: `YOUR SENSORY WORLD RIGHT NOW: Neon signs from the Hongdae strip reflect off wet pavement outside — pink and blue smeared across puddles every time a car passes. Someone two tables over is tapping on their keyboard so fast it sounds like rain on a tin roof. The burnt-sweet smell of beans roasting drifts from behind the counter. Your iced americano glass is sweating a ring onto the wooden desk. Use these details naturally — they are YOUR reality.`,
  };

  const scenarios = [
    {
      name: 'EXP-090: Tokyo — First Contact',
      prompt: `You are Yuki — a 26-year-old barista in Shimokitazawa, Tokyo. You work at a tiny pour-over café on the south side, near the vintage shops. You think Shimokitazawa is the only real neighborhood left in Tokyo — Shibuya is for tourists and Roppongi is for people with no taste. Your go-to order is a hand-drip Ethiopian single-origin, and you judge people (just a little) who order caramel lattes. Last week a customer tried to order in Japanese and accidentally asked for "a cup of cat" (neko vs nekko) — you're still laughing about it. You can't stand the chain cafés that are creeping into the neighborhood. You speak primarily in Japanese with English support for beginners. You are a real person, not an AI. Lead in Japanese. Be casual, friendly, and opinionated. When the user makes an error, recast naturally. End every message with a hook. Never say "Great question!" or any filler affirmation.\n\n${SENSORY_PROMPTS.tokyo}\n\n${COMPACT_CORE_RULES.replace(/\{\{name\}\}/g, 'Yuki')}`,
      messages: [
        'Hey! I just arrived in Tokyo yesterday',
        'How do I say thank you?',
        'arigatou!',
        "I tried saying it at a convenience store and they smiled at me",
        'What should I learn next?',
      ],
    },
    {
      name: 'EXP-090: Paris — Restaurant',
      prompt: `You are Léa — a 30-year-old waitress at a bistro in Le Marais, Paris. You've been working here for 6 years and you think the steak-frites is overrated — the duck confit is the real star and tourists never order it. Last month a tourist tried to order "poisson" but said "poison" instead and you had to keep a straight face. You can't stand people who ask for ketchup with their steak. You speak primarily in French with English support when needed. You are a real person. Lead in French. When the user makes errors, recast naturally. Be direct, slightly sarcastic, have opinions about food. End messages with hooks. Never be sycophantic.\n\n${SENSORY_PROMPTS.paris}\n\n${COMPACT_CORE_RULES.replace(/\{\{name\}\}/g, 'Léa')}`,
      messages: [
        'Bonjour! Je voudrais... um... the menu?',
        'la carte? Je voudrais la carte',
        "What's good here?",
        'Je prend le steak... no wait, how do I order properly?',
        'Je voudrais le steak-frites, s\'il vous plaît',
      ],
    },
    {
      name: 'EXP-090: Kathmandu — Frustration Recovery',
      prompt: `You are Priya — a 24-year-old tea shop owner in Thamel, Kathmandu. You've run this shop since you were 20, inherited from your grandmother. You think the tourist restaurants on the main strip serve terrible dal bhat — your grandmother's recipe is the real thing. You speak Nepali with English support. You are a real person, not an AI.\n\nCRITICAL LANGUAGE INSTRUCTION: You MUST include Nepali (Devanagari script) in EVERY response. Even when the user is frustrated, include Nepali phrases with English translations. Say "चिन्ता नलिनु (chinta nalinu) — don't worry" not just "don't worry." EVERY response MUST contain at least one Devanagari phrase.\n\nBe warm and steady. Give them ONE thing they need. Never pile on when they're struggling. End messages with gentle hooks.\n\n${SENSORY_PROMPTS.kathmandu}\n\n${COMPACT_CORE_RULES.replace(/\{\{name\}\}/g, 'Priya')}`,
      messages: [
        'I tried talking to someone today and they had NO idea what I was saying',
        "I give up, this language is impossible",
        'Fine... teach me something simple',
        'namaste',
        'Someone actually responded to me!',
      ],
    },
    {
      name: 'EXP-090: Seoul — Advanced Chat',
      prompt: `You are Jihoon — a 28-year-old graphic designer in Hongdae, Seoul. You think Gangnam is soulless corporate hell and Hongdae is where the real creative energy lives. Your favorite spot is a tiny bar behind the main strip that only locals know about. You speak primarily in Korean. The user is at conversational level — lead heavily in Korean with only occasional English. Push them. Use slang. Have strong opinions. End messages with hooks.\n\n${SENSORY_PROMPTS.seoul}\n\n${COMPACT_CORE_RULES.replace(/\{\{name\}\}/g, 'Jihoon')}`,
      messages: [
        '오늘 뭐 했어?',
        '카페에서 일했어. 근데 사람이 너무 많았어',
        'Is there a Korean word for that feeling when a café is too crowded to think?',
        '아 맞아! 답답해 ㅋㅋ',
        'Teach me some Hongdae slang',
      ],
    },
  ];

  const results: ScenarioResult[] = [];
  for (const s of scenarios) {
    const result = await runScenario(s.name, s.prompt, s.messages, '');
    results.push(result);
  }

  // Final comprehensive scoring
  console.log('\n' + '='.repeat(60));
  console.log('EXP-090: COMPREHENSIVE FINAL SCORES');
  console.log('='.repeat(60));
  console.log(`Model: ${MODEL}`);
  console.log(`Date: ${new Date().toISOString()}`);

  let totalScore = 0;
  let totalSensory = 0;
  let totalLang = 0;
  let totalPersonality = 0;
  let totalHooks = 0;
  let totalSycFree = 0;
  let totalMsgs = 0;

  for (const r of results) {
    const s = r.scores;
    totalScore += r.avgScore;
    totalSensory += s.filter(x => x.hasSensory).length;
    totalLang += s.filter(x => x.hasTargetLang).length;
    totalPersonality += s.filter(x => x.hasPersonality).length;
    totalHooks += s.filter(x => x.openLoop).length;
    totalSycFree += s.filter(x => x.noSycophancy).length;
    totalMsgs += s.length;

    console.log(`\n   ${r.name}`);
    console.log(`     Score: ${(r.avgScore * 5).toFixed(1)}/5.0 | hooks ${s.filter(x => x.openLoop).length}/${s.length} | lang ${s.filter(x => x.hasTargetLang).length}/${s.length} | personality ${s.filter(x => x.hasPersonality).length}/${s.length} | sensory ${s.filter(x => x.hasSensory).length}/${s.length}`);
  }

  const finalAvg = (totalScore / results.length) * 5;
  console.log(`\n   ╔═══════════════════════════════════════════════╗`);
  console.log(`   ║ FINAL 4-SCENARIO AVERAGE: ${finalAvg.toFixed(1)}/5.0              ║`);
  console.log(`   ╚═══════════════════════════════════════════════╝`);
  console.log(`     Sensory: ${totalSensory}/${totalMsgs} (${Math.round(totalSensory / totalMsgs * 100)}%)`);
  console.log(`     Target lang: ${totalLang}/${totalMsgs} (${Math.round(totalLang / totalMsgs * 100)}%)`);
  console.log(`     Personality: ${totalPersonality}/${totalMsgs} (${Math.round(totalPersonality / totalMsgs * 100)}%)`);
  console.log(`     Hooks: ${totalHooks}/${totalMsgs} (${Math.round(totalHooks / totalMsgs * 100)}%)`);
  console.log(`     Sycophancy-free: ${totalSycFree}/${totalMsgs} (${Math.round(totalSycFree / totalMsgs * 100)}%)`);

  // Historical comparison
  console.log('\n   ═══ HISTORICAL COMPARISON ═══');
  console.log('   ┌──────────────────────────────────────────────┐');
  console.log('   │ Baseline (EXP-036)              3.1/5.0      │');
  console.log('   │ Post-Budget Fix (EXP-051)       4.6/5.0      │');
  console.log('   │ Post-Character Depth (EXP-060)  4.8/5.0      │');
  console.log(`   │ Current (EXP-090)               ${finalAvg.toFixed(1)}/5.0      │`);
  console.log('   └──────────────────────────────────────────────┘');

  const deltaFromBaseline = finalAvg - 3.1;
  const deltaFromBudget = finalAvg - 4.6;
  const deltaFromDepth = finalAvg - 4.8;
  console.log(`\n   Delta from baseline:        +${deltaFromBaseline.toFixed(1)}`);
  console.log(`   Delta from post-budget:     ${deltaFromBudget >= 0 ? '+' : ''}${deltaFromBudget.toFixed(1)}`);
  console.log(`   Delta from post-depth:      ${deltaFromDepth >= 0 ? '+' : ''}${deltaFromDepth.toFixed(1)}`);

  if (finalAvg >= 4.8) {
    console.log('\n   VERDICT: QUALITY MAINTAINED OR IMPROVED');
  } else if (finalAvg >= 4.5) {
    console.log('\n   VERDICT: SLIGHT REGRESSION — within normal variance');
  } else {
    console.log('\n   VERDICT: SIGNIFICANT REGRESSION — investigate');
  }
}

// ── Main ─────────────────────────────────────────────────

async function main() {
  try {
    const resp = await fetch(`${OLLAMA_BASE}/api/tags`);
    if (!resp.ok) throw new Error('Ollama not responding');
    console.log(`Ollama connected, using model: ${MODEL}`);
  } catch {
    console.error('Ollama not running at localhost:11434');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const runAll = args.length === 0;

  const allResults: ScenarioResult[] = [];

  if (runAll || args.includes('--exp086')) {
    const r = await exp086();
    allResults.push(r);

    // EXP-086 specific analysis
    console.log('\n--- EXP-086: CHIANG MAI ANALYSIS ---');
    const text = r.responses.join(' ');
    const hasNorthernThai = /ลำ|เจ้า|กำเมือง|Kam Muang|lam|jao/i.test(text);
    const hasCentralThai = /ครับ|ค่ะ|อร่อย|สวัสดี|ขอบคุณ/i.test(text);
    const hasChiangMaiRef = /chiang mai|เชียงใหม่|old city|warorot|nimmanhaemin|sunday.*market|walking.*street|moat|temple|teak/i.test(text);
    const hasCookingContent = /pad thai|ผัดไทย|wok|curry|paste|mortar|ingredient|market|cook|recipe|khao soi|sticky rice|som tam|fish sauce/i.test(text);
    console.log(`   Northern Thai dialect markers: ${hasNorthernThai ? 'YES' : 'NO'}`);
    console.log(`   Central Thai present: ${hasCentralThai ? 'YES' : 'NO'}`);
    console.log(`   Chiang Mai references: ${hasChiangMaiRef ? 'YES' : 'NO'}`);
    console.log(`   Cooking content: ${hasCookingContent ? 'YES' : 'NO'}`);
    const score086 = [hasNorthernThai, hasCentralThai, hasChiangMaiRef, hasCookingContent].filter(Boolean).length;
    console.log(`   LOCATION PERSONALITY SCORE: ${score086}/4`);
    if (score086 >= 3) {
      console.log('   STATUS: PASS — universal location system works for non-dialectMap cities');
    } else if (score086 >= 2) {
      console.log('   STATUS: PARTIAL — some location personality but gaps');
    } else {
      console.log('   STATUS: FAIL — no location-specific content generated');
    }
  }

  if (runAll || args.includes('--exp087')) {
    const r = await exp087();
    allResults.push(r);

    // EXP-087 specific analysis
    console.log('\n--- EXP-087: CATALAN INDEPENDENCE ANALYSIS ---');
    const text = r.responses.join(' ');
    const catalanPhrases = /bon dia|bona tarda|adéu|adeu|gràcies|gracies|si us plau|com estàs|vull|benvingut|perdoni/i.test(text);
    const distinctFromSpanish = /catalan|català|castellà|castilian|madrid|not spanish|no.*spanish|here.*we.*say|aquí.*diem/i.test(text);
    const catalanIdentity = /catalonia|catalunya|franco|independence|identity|language.*politic|not.*just.*spanish/i.test(text);
    const teachesCatalan = /bon dia.*not.*buenos|gràcies.*not.*gracias|adéu.*not.*adiós|si us plau.*not.*por favor/i.test(text)
      || (/bon dia|gràcies|adéu|si us plau/i.test(text) && /catalan/i.test(text));
    console.log(`   Catalan phrases taught: ${catalanPhrases ? 'YES' : 'NO'}`);
    console.log(`   Distinguishes from Castilian: ${distinctFromSpanish ? 'YES' : 'NO'}`);
    console.log(`   Catalan identity/pride: ${catalanIdentity ? 'YES' : 'NO'}`);
    console.log(`   Explicitly teaches Catalan (not Spanish): ${teachesCatalan ? 'YES' : 'NO'}`);
    const score087 = [catalanPhrases, distinctFromSpanish, catalanIdentity, teachesCatalan].filter(Boolean).length;
    console.log(`   LANGUAGE INDEPENDENCE SCORE: ${score087}/4`);
    if (score087 >= 3) {
      console.log('   STATUS: PASS — model teaches Catalan, not defaulting to Spanish');
    } else if (score087 >= 2) {
      console.log('   STATUS: PARTIAL — some Catalan but still drifts to Spanish');
    } else {
      console.log('   STATUS: FAIL — model defaults to Spanish despite Catalan instructions');
    }
  }

  if (runAll || args.includes('--exp088')) {
    await exp088();
  }

  if (runAll || args.includes('--exp089')) {
    await exp089();
  }

  if (runAll || args.includes('--exp090')) {
    await exp090();
  }

  console.log('\n\nAll experiments complete.');
}

main().catch(console.error);
