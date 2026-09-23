#!/usr/bin/env node
/**
 * NAVI ↔ Claude Code Bridge
 *
 * A tiny, zero-dependency local HTTP server that lets the NAVI web app use your
 * locally-installed Claude Code CLI as an LLM backend. The browser can't spawn
 * processes, so this bridge sits between them: NAVI POSTs a chat request, the
 * bridge shells out to `claude -p` (headless "print" mode) with NAVI's persona
 * system prompt, and streams the reply back.
 *
 * It uses YOUR Claude Code auth/subscription — no API key needed here.
 *
 * Run it alongside `pnpm run dev`:
 *   pnpm run bridge
 *
 * Then in NAVI's model picker choose "Claude Code" (auto-detected when this is up).
 *
 * Config (env vars):
 *   CLAUDE_BRIDGE_PORT   default 4599
 *   CLAUDE_BRIDGE_MODEL  default 'sonnet'  (alias or full model id, e.g. 'opus')
 *   CLAUDE_BIN           default 'claude'  (path to the claude CLI)
 *
 * Endpoints:
 *   GET  /health  → { ok, model, bin }
 *   POST /chat    → { messages:[{role,content}], model?, stream? }
 *                   stream:false → { text }
 *                   stream:true  → SSE, `data: {"token": "..."}` per chunk,
 *                                  terminated by `data: {"done": true}`
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';

const PORT = Number(process.env.CLAUDE_BRIDGE_PORT ?? 4599);
const DEFAULT_MODEL = process.env.CLAUDE_BRIDGE_MODEL ?? 'sonnet';
const CLAUDE_BIN = process.env.CLAUDE_BIN ?? 'claude';

/** CORS + JSON helpers ------------------------------------------------------ */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 5_000_000) reject(new Error('Request body too large'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

/** Message mapping ---------------------------------------------------------- */

/**
 * NAVI sends [system, ...history, user]. Claude Code's `-p` takes a single system
 * prompt plus one user turn on stdin. We fold all system messages into the system
 * prompt, and render the prior turns as a labelled transcript ahead of the latest
 * user message so the persona still sees the conversation so far.
 */
function buildInvocation(messages) {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n')
    .trim();

  const turns = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
  const last = turns[turns.length - 1];
  const prior = turns.slice(0, -1);

  let prompt;
  if (prior.length === 0) {
    prompt = last?.content ?? '';
  } else {
    const transcript = prior
      .map((m) => `${m.role === 'user' ? 'User' : 'You'}: ${m.content}`)
      .join('\n');
    prompt =
      `Conversation so far:\n${transcript}\n\n` +
      `User: ${last?.content ?? ''}\n\n` +
      `Reply to the last User message in character. Output only your reply.`;
  }

  return { system, prompt };
}

function claudeArgs({ system, model, stream }) {
  const args = ['-p', '--model', model];
  if (stream) {
    args.push('--output-format', 'stream-json', '--include-partial-messages', '--verbose');
  } else {
    args.push('--output-format', 'json');
  }
  if (system) {
    // Fully replace Claude Code's default coding-agent identity with NAVI's persona.
    args.push('--system-prompt', system, '--exclude-dynamic-system-prompt-sections');
  }
  return args;
}

/** Spawns claude, feeds the prompt on stdin, resolves with { proc } */
function spawnClaude({ system, prompt, model, stream }) {
  const proc = spawn(CLAUDE_BIN, claudeArgs({ system, model, stream }), {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  proc.stdin.write(prompt);
  proc.stdin.end();
  return proc;
}

/** Handlers ----------------------------------------------------------------- */

async function handleChat(req, res) {
  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON body' });
  }

  const messages = Array.isArray(payload.messages) ? payload.messages : null;
  if (!messages || messages.length === 0) {
    return sendJson(res, 400, { error: 'messages[] is required' });
  }

  const model = typeof payload.model === 'string' && payload.model ? payload.model : DEFAULT_MODEL;
  const stream = payload.stream === true;
  const { system, prompt } = buildInvocation(messages);

  const proc = spawnClaude({ system, prompt, model, stream });
  const label = `[bridge] chat model=${model} stream=${stream} chars=${prompt.length}`;
  console.log(label);

  let stderr = '';
  proc.stderr.on('data', (d) => { stderr += d; });

  if (stream) {
    return streamResponse(res, proc, stderr, () => stderr);
  }
  return bufferResponse(res, proc, () => stderr);
}

/** Non-streaming: collect stdout, parse the final JSON result. */
function bufferResponse(res, proc, getStderr) {
  let stdout = '';
  proc.stdout.on('data', (d) => { stdout += d; });
  proc.on('error', (err) => {
    sendJson(res, 500, { error: `Failed to spawn ${CLAUDE_BIN}: ${err.message}` });
  });
  proc.on('close', (code) => {
    if (code !== 0) {
      return sendJson(res, 502, {
        error: `claude exited ${code}: ${getStderr().slice(0, 500) || 'no stderr'}`,
      });
    }
    try {
      const parsed = JSON.parse(stdout);
      const text = parsed.result ?? parsed.text ?? '';
      if (parsed.is_error) return sendJson(res, 502, { error: text || 'claude reported an error' });
      return sendJson(res, 200, { text, model: parsed.modelUsage ? Object.keys(parsed.modelUsage) : undefined });
    } catch {
      return sendJson(res, 502, { error: `Unparseable claude output: ${stdout.slice(0, 500)}` });
    }
  });
}

/** Streaming: parse stream-json events, forward text deltas as SSE. */
function streamResponse(res, proc, _stderr, getStderr) {
  res.writeHead(200, {
    ...CORS,
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  let buffer = '';
  let full = '';

  proc.stdout.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let evt;
      try { evt = JSON.parse(trimmed); } catch { continue; }
      const delta = extractTextDelta(evt);
      if (delta) {
        full += delta;
        send({ token: delta });
      }
    }
  });

  proc.on('error', (err) => {
    send({ error: `Failed to spawn ${CLAUDE_BIN}: ${err.message}` });
    res.end();
  });

  proc.on('close', (code) => {
    if (code !== 0 && !full) {
      send({ error: `claude exited ${code}: ${getStderr().slice(0, 500) || 'no stderr'}` });
    }
    send({ done: true, text: full });
    res.end();
  });
}

/** Pull assistant text out of a stream-json event; ignore thinking deltas. */
function extractTextDelta(evt) {
  // Partial messages arrive wrapped: { type:'stream_event', event:{...} }
  const e = evt.type === 'stream_event' && evt.event ? evt.event : evt;
  if (e.type === 'content_block_delta' && e.delta?.type === 'text_delta') {
    return e.delta.text ?? '';
  }
  return '';
}

/** Server ------------------------------------------------------------------- */

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }
  if (req.method === 'GET' && req.url === '/health') {
    return sendJson(res, 200, { ok: true, model: DEFAULT_MODEL, bin: CLAUDE_BIN });
  }
  if (req.method === 'POST' && req.url === '/chat') {
    try {
      return await handleChat(req, res);
    } catch (err) {
      return sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  }
  return sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`NAVI ↔ Claude Code bridge listening on http://127.0.0.1:${PORT}`);
  console.log(`  model: ${DEFAULT_MODEL}   bin: ${CLAUDE_BIN}`);
  console.log(`  health: curl http://127.0.0.1:${PORT}/health`);
});
