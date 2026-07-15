/**
 * Shared BFL FLUX Pro avatar generation handler.
 * Used by the Vercel serverless wrapper and Vite configureServer middleware.
 * BFL_API_KEY must come from server env — never VITE_*.
 */

const BFL_BASE = 'https://api.us1.bfl.ai/v1';
const POLL_INTERVAL_MS = 800;
const MAX_POLL_ATTEMPTS = 75; // ~60s max

export interface GenerateAvatarResult {
  status: number;
  body: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function handleGenerateAvatar(
  prompt: string | undefined,
  apiKey: string | undefined,
): Promise<GenerateAvatarResult> {
  if (!apiKey) {
    return {
      status: 500,
      body: JSON.stringify({ error: 'BFL_API_KEY not configured on server' }),
    };
  }

  if (!prompt) {
    return {
      status: 400,
      body: JSON.stringify({ error: 'prompt is required' }),
    };
  }

  try {
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
      return {
        status: submitRes.status,
        body: JSON.stringify({ error: `BFL submit failed: ${err}` }),
      };
    }

    const { id } = await submitRes.json() as { id: string };
    if (!id) {
      return {
        status: 502,
        body: JSON.stringify({ error: 'BFL returned no task id' }),
      };
    }

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
        return {
          status: 200,
          body: JSON.stringify({ imageUrl: result.result.sample }),
        };
      }

      if (result.status === 'Error' || result.status === 'Failed') {
        return {
          status: 502,
          body: JSON.stringify({ error: `BFL generation failed: ${result.status}` }),
        };
      }
    }

    return {
      status: 504,
      body: JSON.stringify({ error: 'BFL generation timed out' }),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      status: 502,
      body: JSON.stringify({ error: message }),
    };
  }
}
