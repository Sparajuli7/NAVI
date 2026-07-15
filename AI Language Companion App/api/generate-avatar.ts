/**
 * Vercel Serverless Function — BFL FLUX Pro Avatar Generation
 *
 * Thin wrapper around shared generateAvatarHandler.
 * BFL_API_KEY lives in server env only — never exposed to client.
 *
 * Usage: POST /api/generate-avatar  { prompt: string }
 * Returns: { imageUrl: string }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleGenerateAvatar } from './generateAvatarHandler';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { prompt } = (req.body ?? {}) as { prompt?: string };
  const result = await handleGenerateAvatar(prompt, process.env.BFL_API_KEY);

  res.setHeader('content-type', 'application/json');
  res.status(result.status).send(result.body);
}
