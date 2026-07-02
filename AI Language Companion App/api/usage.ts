/**
 * NAVI managed-cloud usage — Vercel Edge Function (GET /api/usage)
 *
 * Returns the signed-in user's current allowance so the client can show a
 * "X of N free messages left today" meter. Read-only; enforces nothing.
 * Same env vars as api/chat.ts.
 */

import { createClient } from '@supabase/supabase-js';
import { TIERS, type TierId } from '../src/config/monetization';

export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'NAVI Cloud is not configured on the server.' }, 500);
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return json({ error: 'not_signed_in' }, 401);

  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await anon.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: 'not_signed_in' }, 401);
  const userId = userData.user.id;

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let tierId: TierId = 'free';
  const { data: sub } = await db
    .from('subscriptions')
    .select('tier,status')
    .eq('user_id', userId)
    .maybeSingle();
  if (sub && sub.status === 'active' && sub.tier === 'plus') tierId = 'plus';
  const tier = TIERS[tierId];

  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const { count: usedToday } = await db
    .from('cloud_usage')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfDay);

  const { data: monthRows } = await db
    .from('cloud_usage')
    .select('cost_usd')
    .eq('user_id', userId)
    .gte('created_at', startOfMonth);
  const monthCostUsd = (monthRows ?? []).reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);

  return json({
    tier: tierId,
    dailyCap: tier.dailyMessageCap,
    usedToday: usedToday ?? 0,
    remainingToday: Math.max(0, tier.dailyMessageCap - (usedToday ?? 0)),
    monthlyCeilingUsd: tier.monthlyCostCeilingUsd,
    monthCostUsd,
  });
}
