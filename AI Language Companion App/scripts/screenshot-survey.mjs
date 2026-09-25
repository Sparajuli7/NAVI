/**
 * NAVI Survey Screenshot Generator
 *
 * Calls the Claude Code bridge for each language × scenario × immersion level,
 * renders responses in NAVI-styled HTML, and saves labeled PNGs to "SS for NAVI/".
 *
 * Prerequisites:
 *   1. `pnpm run bridge`  (in a separate terminal)
 *   2. `pnpm run screenshot-survey`
 *
 * Output: SS for NAVI/{lang}/{scenario}_{immersion}pct.png
 * Total:  9 languages × 4 scenarios × 10 immersion levels = 360 screenshots
 */

import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR   = join(__dirname, '..');
const OUT_DIR   = join(APP_DIR, 'SS for NAVI');
const BRIDGE    = 'http://127.0.0.1:4599/chat';

// ── Config ───────────────────────────────────────────────────────────────────

const LANGUAGES = {
  zh: { name: 'Chinese (Mandarin)', native: 'Chinese',  label: '中文'      },
  fr: { name: 'French',             native: 'French',   label: 'Français'  },
  de: { name: 'German',             native: 'German',   label: 'Deutsch'   },
  hi: { name: 'Hindi',              native: 'Hindi',    label: 'हिन्दी'     },
  ja: { name: 'Japanese',           native: 'Japanese', label: '日本語'     },
  ko: { name: 'Korean',             native: 'Korean',   label: '한국어'     },
  ne: { name: 'Nepali',             native: 'Nepali',   label: 'नेपाली'    },
  ru: { name: 'Russian',            native: 'Russian',  label: 'Русский'   },
  es: { name: 'Spanish',            native: 'Spanish',  label: 'Español'   },
};

const SCENARIOS = {
  clinic: {
    label:   'Talking to a doctor',
    context: 'You are a doctor or clinic receptionist. The user (a recent international student) is describing a health concern.',
    user:    'I have a pain here, in my stomach. Since yesterday.',
  },
  professor: {
    label:   'Asking a professor after class',
    context: 'You are a university professor. A student has approached you after class with a question about an assignment deadline.',
    user:    'Excuse me, do you have a minute? I did not understand the part about the deadline.',
  },
  ordering: {
    label:   'Ordering food',
    context: 'You are a cashier or server at a fast-food counter. The customer is ordering.',
    user:    'Hi, can I get the chicken sandwich?',
  },
  smalltalk: {
    label:   'Small talk before class',
    context: 'You are a classmate sitting next to a new international student before class starts. Make friendly small talk.',
    user:    'It is really cold today.',
  },
};

const IMMERSION_LEVELS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

// ── Helpers ──────────────────────────────────────────────────────────────────

function immersionLabel(pct) {
  if (pct <= 15) return 'early beginner';
  if (pct <= 35) return 'beginner';
  if (pct <= 55) return 'intermediate';
  if (pct <= 75) return 'upper-intermediate';
  if (pct < 100) return 'advanced';
  return 'full immersion';
}

function buildSystemPrompt(langCode, pct) {
  const lang = LANGUAGES[langCode];
  const nativePct = 100 - pct;
  const desc = pct <= 15  ? `use 1–2 ${lang.name} words or short phrases per message, everything else in English`
             : pct <= 35  ? `mix short ${lang.name} phrases naturally into English sentences`
             : pct <= 55  ? `roughly half your sentences in ${lang.name}, half in English`
             : pct <= 75  ? `most sentences in ${lang.name}, switch to English only for key explanations`
                          : `speak almost entirely in ${lang.name}; English only when confusion signals appear`;

  return `You are NAVI, an AI language companion helping an English-speaking international student learn ${lang.name} in everyday situations.

IMMERSION LEVEL: Speak exactly ${pct}% ${lang.name} / ${nativePct}% English. ${desc}. Do not deviate from this ratio.

When mixing languages:
- Use the correct ${lang.name} script (${lang.name === 'Chinese (Mandarin)' ? 'Simplified Hanzi' : lang.name === 'Japanese' ? 'Hiragana/Katakana/Kanji' : lang.name === 'Korean' ? 'Hangul' : lang.name === 'Hindi' || lang.name === 'Nepali' ? 'Devanagari' : lang.name === 'Russian' ? 'Cyrillic' : 'Latin script'})
- Keep replies short (2–4 sentences max)
- Be warm and helpful
- React naturally to what the user says`;
}

async function callBridge(systemPrompt, scenarioContext, userMessage) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'system', content: `SCENE: ${scenarioContext}` },
    { role: 'user',   content: userMessage },
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

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHtml(langCode, scenarioKey, pct, userMsg, naviReply) {
  const lang     = LANGUAGES[langCode];
  const scenario = SCENARIOS[scenarioKey];
  const label    = immersionLabel(pct);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=390">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Source+Serif+4:ital,wght@0,400;1,400&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #0A0A0F;
      font-family: 'DM Sans', sans-serif;
      width: 390px;
      min-height: 700px;
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
    }

    /* Chat area */
    .chat-area {
      padding: 16px 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-height: 500px;
    }

    /* Immersion badge */
    .immersion-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-bottom: 4px;
    }
    .immersion-track {
      flex: 1;
      height: 4px;
      border-radius: 2px;
      background: #1e1e2a;
      overflow: hidden;
    }
    .immersion-fill {
      height: 100%;
      border-radius: 2px;
      background: linear-gradient(90deg, #6BBAA7, #D4A853);
    }
    .immersion-label {
      font-size: 11px;
      color: #D4A853;
      font-weight: 600;
      white-space: nowrap;
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
    }
    .bubble.navi {
      background: #111120;
      border: 1px solid #1e1e30;
      border-bottom-left-radius: 5px;
      color: #F5F0EB;
      font-family: 'Source Serif 4', serif;
    }

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

  <!-- Chat -->
  <div class="chat-area">
    <!-- Immersion indicator -->
    <div class="immersion-row">
      <div class="immersion-track">
        <div class="immersion-fill" style="width: ${pct}%"></div>
      </div>
      <span class="immersion-label">${pct}% — ${label}</span>
    </div>

    <!-- User message -->
    <div class="msg-row user">
      <div class="user-side">
        <div class="role-label">You</div>
        <div class="bubble user">${escapeHtml(userMsg)}</div>
      </div>
    </div>

    <!-- NAVI response -->
    <div class="msg-row navi">
      <div class="navi-avatar">N</div>
      <div class="navi-side">
        <div class="role-label">NAVI</div>
        <div class="bubble navi">${escapeHtml(naviReply)}</div>
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
  // Check bridge is up
  try {
    await fetch(BRIDGE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  } catch {
    console.error('\n❌  Bridge is not running. Start it first:\n    pnpm run bridge\n');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 700 });

  const langCodes    = Object.keys(LANGUAGES);
  const scenarioKeys = Object.keys(SCENARIOS);
  const total        = langCodes.length * scenarioKeys.length * IMMERSION_LEVELS.length;
  let done = 0;

  console.log(`\n📸  NAVI Survey Screenshot Generator`);
  console.log(`    ${total} screenshots → ${OUT_DIR}\n`);

  for (const langCode of langCodes) {
    const lang = LANGUAGES[langCode];
    const langDir = join(OUT_DIR, langCode);
    if (!existsSync(langDir)) await mkdir(langDir, { recursive: true });

    for (const scenarioKey of scenarioKeys) {
      const scenario = SCENARIOS[scenarioKey];

      for (const pct of IMMERSION_LEVELS) {
        const outPath = join(langDir, `${scenarioKey}_${pct}pct.png`);
        done++;

        process.stdout.write(`[${String(done).padStart(3)}/${total}] ${langCode} · ${scenarioKey} · ${pct}%  `);

        try {
          const systemPrompt = buildSystemPrompt(langCode, pct);
          const naviReply    = await callBridge(systemPrompt, scenario.context, scenario.user);
          const html         = buildHtml(langCode, scenarioKey, pct, scenario.user, naviReply);

          await page.setContent(html, { waitUntil: 'networkidle' });
          await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: 390, height: 700 } });

          console.log('✓');
        } catch (err) {
          console.log(`✗  ${err.message}`);
          // Write an error placeholder so we can retry just failures
          await writeFile(outPath.replace('.png', '.error.txt'), String(err.message));
        }

        // Small delay to avoid hammering Claude Code
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  }

  await browser.close();
  console.log(`\n✅  Done. Screenshots saved to:\n    ${OUT_DIR}\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });
