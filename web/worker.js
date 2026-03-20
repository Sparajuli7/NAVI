/**
 * NAVI Feedback Worker
 * Cloudflare Worker + D1 — stores feedback submissions
 *
 * Routes:
 *   POST /feedback  — submit feedback
 *   GET  /health    — health check
 *
 * D1 binding name: DB
 * D1 table: feedback
 *
 * Deploy:
 *   wrangler deploy
 *
 * Create the D1 table before first deploy:
 *   wrangler d1 execute navi-feedback --command "
 *     CREATE TABLE IF NOT EXISTS feedback (
 *       id        INTEGER PRIMARY KEY AUTOINCREMENT,
 *       type      TEXT NOT NULL DEFAULT 'general',
 *       message   TEXT NOT NULL,
 *       email     TEXT,
 *       app_version TEXT,
 *       created_at TEXT NOT NULL
 *     );"
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // ── Health check ───────────────────────────────────────────────
    if (url.pathname === '/health' && request.method === 'GET') {
      return json({ ok: true });
    }

    // ── POST /feedback ─────────────────────────────────────────────
    if (url.pathname === '/feedback' && request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid JSON body' }, 400);
      }

      const { type, message, email, app_version } = body;

      // Validate
      if (!message || typeof message !== 'string' || message.trim().length < 10) {
        return json({ error: 'Message must be at least 10 characters.' }, 422);
      }

      const validTypes = ['bug', 'feature', 'ux', 'general'];
      const safeType = validTypes.includes(type) ? type : 'general';
      const safeMessage = message.trim().slice(0, 5000);
      const safeEmail = typeof email === 'string' ? email.trim().slice(0, 320) : null;
      const safeVersion = typeof app_version === 'string' ? app_version.trim().slice(0, 32) : null;
      const createdAt = new Date().toISOString();

      try {
        await env.DB.prepare(
          'INSERT INTO feedback (type, message, email, app_version, created_at) VALUES (?, ?, ?, ?, ?)'
        )
          .bind(safeType, safeMessage, safeEmail, safeVersion, createdAt)
          .run();

        return json({ ok: true, message: 'Feedback received.' });
      } catch (err) {
        console.error('D1 insert error:', err);
        return json({ error: 'Failed to save feedback. Please try again.' }, 500);
      }
    }

    // ── Not found ─────────────────────────────────────────────────
    return json({ error: 'Not found' }, 404);
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
