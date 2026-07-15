/**
 * Shared OpenRouter chat proxy handler.
 * Used by the Vercel serverless wrapper and Vite configureServer middleware.
 * OPENROUTER_API_KEY must come from server env — never VITE_*.
 */

const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';

export interface ChatRequestBody {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
}

export interface ChatHandlerResult {
  status: number;
  headers: Record<string, string>;
  /** Non-streaming body, or null when streaming (use streamBody). */
  body: string | null;
  streamBody?: ReadableStream<Uint8Array> | null;
}

export async function handleChatRequest(
  body: ChatRequestBody,
  apiKey: string | undefined,
): Promise<ChatHandlerResult> {
  if (!apiKey) {
    return {
      status: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'OPENROUTER_API_KEY not configured on server' }),
    };
  }

  const { model, messages, temperature, max_tokens, top_p, stream } = body;
  if (!model || !messages) {
    return {
      status: 400,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'model and messages are required' }),
    };
  }

  try {
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

    const headers: Record<string, string> = {};
    const ct = upstream.headers.get('content-type');
    if (ct) headers['content-type'] = ct;

    if (stream && upstream.body) {
      return {
        status: upstream.status,
        headers,
        body: null,
        streamBody: upstream.body,
      };
    }

    return {
      status: upstream.status,
      headers,
      body: await upstream.text(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      status: 502,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: message }),
    };
  }
}
