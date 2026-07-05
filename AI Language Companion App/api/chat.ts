/**
 * Vercel Serverless Function — OpenRouter Proxy
 *
 * Forwards chat completion requests to OpenRouter.
 * The API key lives in OPENROUTER_API_KEY (server env only — never sent to the client).
 *
 * Usage: POST /api/chat  { model, messages, temperature?, max_tokens?, top_p?, stream? }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'OPENROUTER_API_KEY not configured on server' });
    return;
  }

  try {
    const { model, messages, temperature, max_tokens, top_p, stream } = req.body as {
      model: string;
      messages: Array<{ role: string; content: string }>;
      temperature?: number;
      max_tokens?: number;
      top_p?: number;
      stream?: boolean;
    };

    const upstream = await fetch(OPENROUTER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://navi.app',
        'X-Title': 'NAVI Language Companion',
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens, top_p, stream }),
    });

    res.status(upstream.status);
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('content-type', ct);

    if (stream && upstream.body) {
      // Pipe SSE stream back to client
      const reader = upstream.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) { res.end(); break; }
        res.write(value);
      }
    } else {
      res.send(await upstream.text());
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(502).json({ error: message });
  }
}
