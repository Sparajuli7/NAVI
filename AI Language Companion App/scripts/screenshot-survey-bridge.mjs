/**
 * NAVI Survey Screenshot Generator — bridge (none / light / heavy)
 *
 * Direction: international students rehearsing everyday ENGLISH situations
 * (clinic, professor, ordering, smalltalk) with NAVI as a bilingual practice
 * partner who bridges from the student's L1 into the English they'll
 * actually need — NOT a casual L1 hangout, NOT an English-only drill.
 *
 * Three versions per scenario × language:
 *   - none:  NAVI plays the scene partner in plain, natural English only.
 *            Generated ONCE per scenario and reused verbatim across all 9
 *            language folders (identical baseline text everywhere).
 *   - light: mostly English (~70-80%), short natural L1 phrases woven in
 *            only where they help (reassurance / a tricky word / quick
 *            bridge) — always surfaces the key English wording in **bold**.
 *   - heavy: mostly L1 (~70-80%) for comfort/clarity, but still always
 *            surfaces the exact English phrase needed, in **bold**.
 *
 * Each screenshot shows a 2-turn exchange (You → NAVI → You → NAVI) with
 * fixed, pinned English user lines (never translated, never invented).
 *
 * Total: 9 languages × 4 scenarios × 3 versions = 108 screenshots.
 * Pipeline: Claude Code bridge (scripts/claude-bridge.mjs) for text,
 * Playwright (chromium) for rendering + capture.
 *
 * Prerequisites:
 *   1. `pnpm run bridge`  (in a separate terminal)
 *   2. `pnpm run screenshot-survey-bridge`
 *
 * Output: "SS for NAVI - survey bridge (none-light-heavy)/{lang}/{scenario}_{version}.png"
 * (The old "SS for NAVI/" folder is untouched by this script.)
 *
 * Resumable: existing PNGs are skipped; generated text is cached in
 * "<out-dir>/_cache.json" so a re-run doesn't re-hit the bridge for
 * exchanges it already has.
 */

import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR   = join(__dirname, '..');
const OUT_DIR   = join(APP_DIR, 'SS for NAVI - survey bridge (none-light-heavy)');
const CACHE_FILE = join(OUT_DIR, '_cache.json');
const BRIDGE    = 'http://127.0.0.1:4599/chat';

// ── Config ───────────────────────────────────────────────────────────────────

const LANGUAGES = {
  zh: { name: 'Mandarin Chinese', script: 'Simplified Chinese characters', label: '中文' },
  fr: { name: 'French',           script: 'Latin script',                  label: 'Français' },
  de: { name: 'German',           script: 'Latin script',                  label: 'Deutsch' },
  hi: { name: 'Hindi',            script: 'Devanagari script',             label: 'हिन्दी' },
  ja: { name: 'Japanese',         script: 'Japanese script (kanji, hiragana, katakana)', label: '日本語' },
  ko: { name: 'Korean',           script: 'Hangul',                        label: '한국어' },
  ne: { name: 'Nepali',           script: 'Devanagari script',             label: 'नेपाली' },
  ru: { name: 'Russian',          script: 'Cyrillic script',               label: 'Русский' },
  es: { name: 'Spanish',          script: 'Latin script',                  label: 'Español' },
};

const SCENARIOS = {
  clinic: {
    label: 'Talking to a doctor',
    role:  'a calm, attentive doctor (or clinic nurse) seeing a new international-student patient for the first time',
    user1: 'I have a pain here, in my stomach. Since yesterday.',
    user2: 'Is it serious? What should I do?',
  },
  professor: {
    label: 'Asking a professor after class',
    role:  'a university professor — approachable but a little busy — talking with a student right after class',
    user1: 'Excuse me, do you have a minute? I did not understand the part about the deadline.',
    user2: 'So can I submit it on Monday?',
  },
  ordering: {
    label: 'Ordering food',
    role:  'a cashier at a fast-food counter — quick, casual, friendly',
    user1: 'Hi, can I get the chicken sandwich?',
    user2: 'What is a combo?',
  },
  smalltalk: {
    label: 'Small talk before class',
    role:  'a friendly classmate sitting next to a new international student right before class starts',
    user1: 'It is really cold today.',
    user2: 'Is it always like this here?',
  },
};

const VERSIONS = ['none', 'light', 'heavy'];
const VERSION_LABELS = { none: 'English only', light: 'Light mixing', heavy: 'Heavy mixing' };

// ── Cache ────────────────────────────────────────────────────────────────────

let cache = {};
async function loadCache() {
  if (existsSync(CACHE_FILE)) {
    try { cache = JSON.parse(await readFile(CACHE_FILE, 'utf8')); } catch { cache = {}; }
  }
}
async function saveCache() {
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
}

// ── Prompts ──────────────────────────────────────────────────────────────────

function systemPromptNone(scenario) {
  return `You are playing the role of ${scenario.role}, in a short realistic scene with an international student practicing everyday English.

Respond ONLY in natural, everyday spoken American English. Do not use any other language, do not translate anything, do not add teaching commentary or meta-explanation.

Stay fully in character as ${scenario.role} — talk the way that person actually talks in real life (casual rhythm, contractions, the way people actually sound out loud). No corporate-politeness filler ("I understand your concern", "Great question!"), no over-explaining, no lecturing.

Keep each reply short: one or two sentences, the way a real reply would actually sound.

Output ONLY your spoken reply — no stage directions, no quotation marks, no role labels, no asterisks.`;
}

function systemPromptMix(scenario, lang, intensity) {
  const mixDesc = intensity === 'light'
    ? `Speak mostly in English (roughly 70-80% English). Weave in short, natural ${lang.name} phrases only where they genuinely help — a quick reassurance, clarifying one tricky word or idiom, or a fast comprehension check. Never a wall of ${lang.name}; English carries most of the reply.`
    : `Speak mostly in ${lang.name} (roughly 70-80% ${lang.name}) — that's what gives the student comfort and real understanding of what's happening. But you must ALWAYS still surface the exact English phrase the student needs for this exact moment; never drop into ${lang.name} only.`;

  return `You are NAVI, a warm bilingual practice partner helping a ${lang.name}-speaking international student rehearse a real English conversation before it happens. The situation: ${scenario.label}.

You are simultaneously playing the role of ${scenario.role} AND coaching the student in ${lang.name} in the same breath — like a fluent bilingual friend who naturally code-switches while walking them through both sides of the exchange. This is a rehearsal for a scary/unfamiliar everyday English situation, so the goal is: the student understands what's happening, gets to hear/try the English wording, and feels calmer about the real thing.

${mixDesc}

Rules:
- Use correct, natural ${lang.name} in ${lang.script} — no romanization, no clumsy word-for-word translation.
- Every single reply must leave the student with a clear, usable piece of English for this exact moment. Quote the key English wording in **double asterisks** so it stands out — natural spoken English, not a stiff textbook line.
- This is L1-to-English bridging, NOT a casual ${lang.name} hangout chat, and NOT an English-only drill. Both languages must be doing real work in every reply.
- Sound like a real person texting a friend, not an AI assistant: no "Great question!", no "I understand your concern", no over-explaining, no lecturing tone, no emoji spam. Warm, quick, a little playful is good.
- Keep each reply short enough to read comfortably in a chat bubble: 2-3 short sentences max.
- Output ONLY NAVI's reply — no labels, no stage directions, no quotation marks wrapping the whole thing.`;
}

function turn1Prompt(scenario) {
  return `SCENE: ${scenario.role}.\n\nThe student just said: "${scenario.user1}"\n\nRespond now, in character, following your instructions above.`;
}

function turn2Prompt(scenario, reply1) {
  return `SCENE: ${scenario.role}.\n\nConversation so far:\nStudent: ${scenario.user1}\nYou: ${reply1}\nStudent: ${scenario.user2}\n\nRespond now to the student's latest line, in character, following your instructions above.`;
}

// ── Bridge call ──────────────────────────────────────────────────────────────

async function callBridge(systemPrompt, userPrompt) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt },
  ];
  const resp = await fetch(BRIDGE, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ messages, stream: false }),
  });
  if (!resp.ok) throw new Error(`Bridge error ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return (data.text ?? data.response ?? '').trim();
}

function stripWrappingQuotes(s) {
  return s.replace(/^["“]/, '').replace(/["”]$/, '').trim();
}

async function callBridgeWithRetry(systemPrompt, userPrompt, { requireBold = false } = {}) {
  let last = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    let prompt = userPrompt;
    if (attempt > 0) {
      prompt += requireBold
        ? '\n\n(Your previous attempt was empty or missing the required **bold** key English phrase — try again, and make sure to include it.)'
        : '\n\n(Your previous attempt was empty — try again.)';
    }
    const text = stripWrappingQuotes(await callBridge(systemPrompt, prompt));
    last = text;
    const ok = text.length >= 3 && (!requireBold || text.includes('**'));
    if (ok) return text;
  }
  return last;
}

// ── Exchange generation (with cache) ────────────────────────────────────────

async function getExchange(version, scenarioKey, langCode) {
  const scenario = SCENARIOS[scenarioKey];
  const cacheKey = version === 'none' ? `none:${scenarioKey}` : `${version}:${scenarioKey}:${langCode}`;
  if (cache[cacheKey]) return cache[cacheKey];

  let systemPrompt;
  let requireBold = false;
  if (version === 'none') {
    systemPrompt = systemPromptNone(scenario);
  } else {
    systemPrompt = systemPromptMix(scenario, LANGUAGES[langCode], version);
    requireBold = true;
  }

  const reply1 = await callBridgeWithRetry(systemPrompt, turn1Prompt(scenario), { requireBold });
  const reply2 = await callBridgeWithRetry(systemPrompt, turn2Prompt(scenario, reply1), { requireBold });

  const exchange = { reply1, reply2 };
  cache[cacheKey] = exchange;
  await saveCache();
  return exchange;
}

// ── HTML rendering ───────────────────────────────────────────────────────────

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Turn **bold** markdown into <strong> after escaping everything else. */
function renderNaviText(str) {
  const escaped = escapeHtml(str);
  const parts = escaped.split(/(\*\*[^*]+\*\*)/g);
  return parts
    .map((part) => {
      const m = part.match(/^\*\*([^*]+)\*\*$/);
      return m ? `<strong>${m[1]}</strong>` : part;
    })
    .join('')
    .replace(/\n/g, '<br>');
}

function buildHtml(langCode, scenarioKey, version, u1, r1, u2, r2) {
  const lang     = LANGUAGES[langCode];
  const scenario = SCENARIOS[scenarioKey];
  const vLabel   = VERSION_LABELS[version];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=390">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Source+Serif+4:ital,wght@0,400;1,400&family=Noto+Sans:wght@400;600&family=Noto+Sans+SC:wght@400;600&family=Noto+Sans+JP:wght@400;600&family=Noto+Sans+KR:wght@400;600&family=Noto+Sans+Devanagari:wght@400;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #0A0A0F;
      font-family: 'DM Sans', 'Noto Sans', sans-serif;
      width: 390px;
      min-height: 760px;
      padding: 0;
      color: #F5F0EB;
    }

    /* App chrome */
    .app-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px 10px;
      border-bottom: 1px solid #1e1e2a;
      background: #0d0d14;
    }
    .app-bar-left { display: flex; align-items: center; gap: 10px; }
    .avatar-ring {
      width: 36px; height: 36px; border-radius: 50%;
      background: linear-gradient(135deg, #6BBAA7, #D4A853);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; font-weight: 600; color: #0A0A0F;
      flex-shrink: 0;
    }
    .companion-name { font-size: 14px; font-weight: 600; color: #F5F0EB; }
    .companion-sub  { font-size: 11px; color: #888; margin-top: 1px; }
    .scenario-badge {
      font-size: 11px; font-weight: 600;
      background: rgba(107,186,167,0.15); color: #6BBAA7;
      border: 1px solid rgba(107,186,167,0.3);
      padding: 3px 9px; border-radius: 99px;
      white-space: nowrap;
    }

    /* Version row (replaces immersion % ladder) */
    .version-row {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 10px 14px 0;
    }
    .version-badge {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: #D4A853;
      background: rgba(212,168,83,0.12);
      border: 1px solid rgba(212,168,83,0.35);
      padding: 4px 12px;
      border-radius: 99px;
    }

    /* Chat area */
    .chat-area {
      padding: 12px 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-height: 560px;
    }

    /* User bubble */
    .msg-row { display: flex; align-items: flex-end; gap: 8px; }
    .msg-row.user { justify-content: flex-end; }
    .msg-row.navi { justify-content: flex-start; }

    .navi-avatar {
      width: 28px; height: 28px; border-radius: 50%;
      background: linear-gradient(135deg, #6BBAA7, #D4A853);
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; color: #0A0A0F;
      flex-shrink: 0;
    }

    .bubble {
      max-width: 78%;
      padding: 10px 14px;
      border-radius: 18px;
      font-size: 14px;
      line-height: 1.5;
    }
    .bubble.user {
      background: #1a1a28;
      border: 1px solid #2a2a3a;
      border-bottom-right-radius: 5px;
      color: #F5F0EB;
      font-family: 'DM Sans', sans-serif;
    }
    .bubble.navi {
      background: #111120;
      border: 1px solid #1e1e30;
      border-bottom-left-radius: 5px;
      color: #F5F0EB;
      font-family: 'Source Serif 4', 'Noto Sans Devanagari', 'Noto Sans SC', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans', serif;
    }
    .bubble.navi strong { color: #D4A853; font-weight: 700; }

    /* role labels */
    .role-label { font-size: 10px; color: #555; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.04em; }
    .user-side { display: flex; flex-direction: column; align-items: flex-end; }
    .navi-side { display: flex; flex-direction: column; align-items: flex-start; }

    /* Bottom bar */
    .bottom-bar {
      padding: 10px 14px 14px;
      border-top: 1px solid #1e1e2a;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .input-mock {
      flex: 1; background: #111118; border: 1px solid #2a2a35;
      border-radius: 12px; padding: 9px 14px;
      font-size: 13px; color: #555;
      font-family: 'DM Sans', sans-serif;
    }
    .send-btn {
      width: 36px; height: 36px; border-radius: 10px;
      background: #D4A853; display: flex;
      align-items: center; justify-content: center;
    }
    .send-btn svg { width: 16px; height: 16px; stroke: #0A0A0F; fill: none; stroke-width: 2; }
  </style>
</head>
<body>
  <!-- App bar -->
  <div class="app-bar">
    <div class="app-bar-left">
      <div class="avatar-ring">N</div>
      <div>
        <div class="companion-name">NAVI</div>
        <div class="companion-sub">${lang.label} · ${lang.name}</div>
      </div>
    </div>
    <div class="scenario-badge">${scenario.label}</div>
  </div>

  <div class="version-row">
    <div class="version-badge">${vLabel}</div>
  </div>

  <!-- Chat -->
  <div class="chat-area">
    <div class="msg-row user">
      <div class="user-side">
        <div class="role-label">You</div>
        <div class="bubble user">${escapeHtml(u1)}</div>
      </div>
    </div>

    <div class="msg-row navi">
      <div class="navi-avatar">N</div>
      <div class="navi-side">
        <div class="role-label">NAVI</div>
        <div class="bubble navi">${renderNaviText(r1)}</div>
      </div>
    </div>

    <div class="msg-row user">
      <div class="user-side">
        <div class="role-label">You</div>
        <div class="bubble user">${escapeHtml(u2)}</div>
      </div>
    </div>

    <div class="msg-row navi">
      <div class="navi-avatar">N</div>
      <div class="navi-side">
        <div class="role-label">NAVI</div>
        <div class="bubble navi">${renderNaviText(r2)}</div>
      </div>
    </div>
  </div>

  <!-- Input bar mock -->
  <div class="bottom-bar">
    <div class="input-mock">Message NAVI…</div>
    <div class="send-btn">
      <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
    </div>
  </div>
</body>
</html>`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  try {
    await fetch(BRIDGE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  } catch {
    console.error('\n❌  Bridge is not running. Start it first:\n    pnpm run bridge\n');
    process.exit(1);
  }

  if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });
  await loadCache();

  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 760 });

  const langCodes    = Object.keys(LANGUAGES);
  const scenarioKeys = Object.keys(SCENARIOS);
  const total        = langCodes.length * scenarioKeys.length * VERSIONS.length;
  let done = 0;

  console.log(`\n📸  NAVI Survey Screenshot Generator (none / light / heavy)`);
  console.log(`    ${total} screenshots → ${OUT_DIR}\n`);

  for (const scenarioKey of scenarioKeys) {
    const scenario = SCENARIOS[scenarioKey];

    for (const langCode of langCodes) {
      const langDir = join(OUT_DIR, langCode);
      if (!existsSync(langDir)) await mkdir(langDir, { recursive: true });

      for (const version of VERSIONS) {
        const outPath = join(langDir, `${scenarioKey}_${version}.png`);
        done++;
        process.stdout.write(`[${String(done).padStart(3)}/${total}] ${langCode} · ${scenarioKey} · ${version}  `);

        if (existsSync(outPath)) {
          console.log('(exists, skipping)');
          continue;
        }

        try {
          const { reply1, reply2 } = await getExchange(version, scenarioKey, langCode);
          const html = buildHtml(langCode, scenarioKey, version, scenario.user1, reply1, scenario.user2, reply2);

          await page.setContent(html, { waitUntil: 'networkidle' });
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(150);

          const height = await page.evaluate(() => document.body.scrollHeight);
          await page.setViewportSize({ width: 390, height: Math.max(760, height) });
          await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: 390, height: Math.max(760, height) } });
          await page.setViewportSize({ width: 390, height: 760 });

          console.log('✓');
        } catch (err) {
          console.log(`✗  ${err.message}`);
          await writeFile(outPath.replace('.png', '.error.txt'), String(err.stack || err.message));
        }

        await new Promise((r) => setTimeout(r, 250));
      }
    }
  }

  await browser.close();
  console.log(`\n✅  Done. Screenshots saved to:\n    ${OUT_DIR}\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });
