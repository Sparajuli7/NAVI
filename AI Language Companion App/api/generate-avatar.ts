/**
 * Vercel Serverless Function — BFL FLUX Pro Avatar Generation
 *
 * Generates a portrait image using Black Forest Labs FLUX Pro 1.1.
 * BFL_API_KEY lives in server env only — never exposed to client.
 *
 * Usage: POST /api/generate-avatar  { prompt: string }
 * Returns: { imageUrl: string } — a signed BFL CDN URL
 *
 * BFL API pattern:
 *   1. POST /v1/flux-pro-1.1 → { id }
 *   2. Poll GET /v1/get_result?id=... until status === "Ready"
 *   3. result.sample contains the image URL
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const BFL_BASE = 'https://api.us1.bfl.ai/v1';
const POLL_INTERVAL_MS = 800;
const MAX_POLL_ATTEMPTS = 75; // ~60s max

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.BFL_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'BFL_API_KEY not configured on server' });
    return;
  }

  const { prompt } = req.body as { prompt?: string };
  if (!prompt) {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }

  try {
    // Step 1: Submit generation request
    const submitRes = await fetch(`${BFL_BASE}/flux-pro-1.1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Key': apiKey,
      },
      body: JSON.stringify({
        prompt,
        width: 512,
        height: 512,
        safety_tolerance: 6,
      }),
    });

    if (!submitRes.ok) {
      const err = await submitRes.text().catch(() => '');
      res.status(submitRes.status).json({ error: `BFL submit failed: ${err}` });
      return;
    }

    const { id } = await submitRes.json() as { id: string };
    if (!id) {
      res.status(502).json({ error: 'BFL returned no task id' });
      return;
    }

    // Step 2: Poll until Ready
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await sleep(POLL_INTERVAL_MS);

      const pollRes = await fetch(`${BFL_BASE}/get_result?id=${encodeURIComponent(id)}`, {
        headers: { 'X-Key': apiKey },
      });

      if (!pollRes.ok) continue;

      const result = await pollRes.json() as {
        status: string;
        result?: { sample?: string };
      };

      if (result.status === 'Ready' && result.result?.sample) {
        res.status(200).json({ imageUrl: result.result.sample });
        return;
      }

      if (result.status === 'Error' || result.status === 'Failed') {
        res.status(502).json({ error: `BFL generation failed: ${result.status}` });
        return;
      }
      // status === 'Pending' | 'Processing' → keep polling
    }

    res.status(504).json({ error: 'BFL generation timed out' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(502).json({ error: message });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
