/**
 * NAVI monetization config — THE SINGLE SOURCE OF TRUTH for the free/paid model.
 *
 * This is the file to edit as you tune the initial "NAVI fronts some OpenRouter
 * credits, users get minimal free cloud use" model. Change the numbers here and
 * nothing else needs to change — both the client (to show limits) and the server
 * proxy (`api/chat.ts`, which enforces them) import from this one file.
 *
 * IMPORTANT: keep this file free of imports and browser/node APIs so it can be
 * imported from BOTH the Vite client bundle AND the Vercel Edge function.
 *
 * How the guardrails stack (all must pass for a managed-cloud request to go through):
 *   1. dailyMessageCap        — per user, resets at UTC midnight   (friendly cap)
 *   2. monthlyCostCeilingUsd  — per user, resets on the 1st        (per-user backstop)
 *   3. POOL.monthlyBudgetUsd  — ALL users combined                 (protects the pool)
 * When any is exceeded the user gracefully falls back to on-device (which is free
 * to serve), so nobody is ever hard-blocked from the app.
 */

export type TierId = 'free' | 'plus';

export interface Tier {
  id: TierId;
  label: string;
  /** OpenRouter model id used for this tier's managed-cloud requests.
   *  Browse + price-check models at https://openrouter.ai/models */
  model: string;
  /** Max output tokens per reply (also caps cost per request). */
  maxTokens: number;
  /** Hard cap on managed-cloud messages per UTC day. */
  dailyMessageCap: number;
  /** Hard cap on the inference $ a single user can cost us per calendar month. */
  monthlyCostCeilingUsd: number;
  /** Model price, used to estimate per-request cost for metering.
   *  Keep roughly in sync with OpenRouter's listed price for `model`. */
  priceUsdPerMTokIn: number;
  priceUsdPerMTokOut: number;
}

// ── Tiers ───────────────────────────────────────────────────────────────────
// Tune these freely. Defaults are deliberately conservative for the initial pool.
export const TIERS: Record<TierId, Tier> = {
  free: {
    id: 'free',
    label: 'Free',
    model: 'meta-llama/llama-3.1-8b-instruct', // cheap, capable, multilingual
    maxTokens: 512,
    dailyMessageCap: 15,
    monthlyCostCeilingUsd: 0.15,
    priceUsdPerMTokIn: 0.02,
    priceUsdPerMTokOut: 0.03,
  },
  plus: {
    id: 'plus',
    label: 'NAVI Plus',
    model: 'anthropic/claude-3.5-sonnet', // upgrade target once Stripe is wired
    maxTokens: 1024,
    dailyMessageCap: 500,
    monthlyCostCeilingUsd: 5.0,
    priceUsdPerMTokIn: 3.0,
    priceUsdPerMTokOut: 15.0,
  },
};

// ── Shared pool guardrail ─────────────────────────────────────────────────────
/**
 * Global ceiling on the shared OpenRouter credit pool NAVI funds. When the sum of
 * ALL users' managed-cloud cost for the current calendar month reaches this, managed
 * cloud is paused for everyone (they fall back to on-device) until the next month.
 * Set this at or below the credits you've actually loaded onto OpenRouter.
 */
export const POOL = {
  monthlyBudgetUsd: 50,
  pauseWhenExhausted: true,
};

// ── Managed-cloud client settings ─────────────────────────────────────────────
export const MANAGED_CLOUD = {
  /** Master switch — set false to hide the NAVI Cloud option everywhere. */
  enabled: true,
  /** Same-origin serverless endpoints (Vercel functions in /api). */
  endpoint: '/api/chat',
  usageEndpoint: '/api/usage',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
/** Machine-readable reasons the proxy can refuse a request. */
export type LimitReason =
  | 'daily_cap'
  | 'monthly_ceiling'
  | 'pool_exhausted'
  | 'not_signed_in';

/** Estimate the USD cost of one completion for metering. */
export function costUsd(
  tier: Tier,
  promptTokens: number,
  completionTokens: number,
): number {
  return (
    (promptTokens / 1_000_000) * tier.priceUsdPerMTokIn +
    (completionTokens / 1_000_000) * tier.priceUsdPerMTokOut
  );
}
