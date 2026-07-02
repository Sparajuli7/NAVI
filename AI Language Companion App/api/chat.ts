/**
 * NAVI managed-cloud proxy — Vercel Edge Function (POST /api/chat)
 *
 * This is the ONLY place the real OpenRouter key lives. The browser never sees it.
 * Flow: verify the caller's Supabase JWT → resolve their tier → enforce the free
 * allowance + shared-pool guardrail (all from src/config/monetization.ts) →
 * forward to OpenRouter with the server key → record usage → return the reply.
 *
 * Required env vars (set in Vercel project settings, NOT VITE_-prefixed):
 *   OPENROUTER_API_KEY           — the key funding the shared credit pool
 *   SUPABASE_URL                 — (falls back to VITE_SUPABASE_URL)
 *   SUPABASE_ANON_KEY            — (falls back to VITE_SUPABASE_ANON_KEY) — verifies JWTs
 *   SUPABASE_SERVICE_ROLE_KEY    — server-only; reads/writes usage bypassing RLS
 *
 * NOTE: this file lives outside `src/`, so it is built by Vercel — not by the app's
 * vite build or `tsc` typecheck. Keep it dependency-light and web-standard.
 */

import { createClient } from '@supabase/supabase-js';
import { TIERS, POOL, costUsd, type TierId, type LimitReason } from '../src/config/monetization';

export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? '';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
function refuse(reason: LimitReason, message: string, status = 429): Response {
  return json({ reason, message }, status);
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!OPENROUTER_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'NAVI Cloud is not configured on the server.' }, 500);
  }

  // 1. Verify the caller's Supabase session
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return refuse('not_signed_in', 'Sign in to use NAVI Cloud.', 401);

  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await anon.auth.getUser(token);
  if (userErr || !userData?.user) {
    return refuse('not_signed_in', 'Session expired — please sign in again.', 401);
  }
  const userId = userData.user.id;

  // service-role client bypasses RLS for usage reads/writes
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // 2. Resolve tier (default free; a subscriptions row can promote to plus)
  let tierId: TierId = 'free';
  const { data: sub } = await db
    .from('subscriptions')
    .select('tier,status')
    .eq('user_id', userId)
    .maybeSingle();
  if (sub && sub.status === 'active' && sub.tier === 'plus') tierId = 'plus';
  const tier = TIERS[tierId];

  // 3. Enforce guardrails (day / month-per-user / month-pool)
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const { count: todayCount } = await db
    .from('cloud_usage')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfDay);
  if ((todayCount ?? 0) >= tier.dailyMessageCap) {
    return refuse(
      'daily_cap',
      `You've used your ${tier.dailyMessageCap} free cloud messages today. Switch to on-device to keep chatting.`,
    );
  }

  const { data: monthRows } = await db
    .from('cloud_usage')
    .select('cost_usd')
    .eq('user_id', userId)
    .gte('created_at', startOfMonth);
  const monthCost = (monthRows ?? []).reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
  if (monthCost >= tier.monthlyCostCeilingUsd) {
    return refuse('monthly_ceiling', "You've reached your monthly cloud limit. Switch to on-device, or upgrade for more.");
  }

  if (POOL.pauseWhenExhausted) {
    const { data: poolRows } = await db
      .from('cloud_usage')
      .select('cost_usd')
      .gte('created_at', startOfMonth);
    const poolCost = (poolRows ?? []).reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
    if (poolCost >= POOL.monthlyBudgetUsd) {
      return refuse('pool_exhausted', 'NAVI Cloud is taking a breather this month — on-device mode still works great!', 503);
    }
  }

  // 4. Forward to OpenRouter with the SERVER-held key
  const payload = (await req.json().catch(() => null)) as {
    messages?: unknown;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
  } | null;
  if (!payload?.messages) return json({ error: 'Missing messages' }, 400);

  const orRes = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://navi.app',
      'X-Title': 'NAVI Language Companion',
    },
    body: JSON.stringify({
      model: tier.model,
      messages: payload.messages,
      temperature: payload.temperature ?? 0.7,
      max_tokens: Math.min(payload.max_tokens ?? tier.maxTokens, tier.maxTokens),
      top_p: payload.top_p ?? 0.8,
      stream: false,
    }),
  });
  if (!orRes.ok) {
    const t = await orRes.text().catch(() => '');
    return json({ error: `Upstream error (${orRes.status}): ${t}` }, 502);
  }

  const or = (await orRes.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = or.choices?.[0]?.message?.content ?? '';
  const promptTokens = or.usage?.prompt_tokens ?? 0;
  const completionTokens = or.usage?.completion_tokens ?? 0;
  const cost = costUsd(tier, promptTokens, completionTokens);

  // 5. Record usage (awaited so it isn't dropped when the edge invocation ends)
  await db.from('cloud_usage').insert({
    user_id: userId,
    model: tier.model,
    tier: tierId,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    cost_usd: cost,
  });

  const remainingToday = Math.max(0, tier.dailyMessageCap - ((todayCount ?? 0) + 1));
  return json({ content, tier: tierId, usage: { promptTokens, completionTokens, cost }, remainingToday });
}
