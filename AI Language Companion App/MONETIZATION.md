# NAVI monetization — managed free-credits model

The initial model: **NAVI fronts a shared pool of OpenRouter credits** and gives every
signed-in user a small **free cloud allowance**. When someone exceeds it, they fall back
to the free on-device model (never hard-blocked). Later, a paid **NAVI Plus** tier raises
the allowance. All the knobs live in **one file** so you can tune the free/paid split as
you learn the real usage.

## The one file you tune

**`src/config/monetization.ts`** — tiers, models, caps, and the shared-pool budget.
Edit the numbers; nothing else needs to change. Both the client (limit display) and the
server proxy (enforcement) import from it.

```
TIERS.free.model                  which OpenRouter model free users get
TIERS.free.dailyMessageCap        friendly per-user daily cap (e.g. 15)
TIERS.free.monthlyCostCeilingUsd  per-user $ backstop for the month
TIERS.free.price*                 model price, used to estimate cost per request
POOL.monthlyBudgetUsd             hard ceiling across ALL users — protects the pool
MANAGED_CLOUD.enabled             master switch for the whole NAVI Cloud option
```

Three guardrails stack; a request must pass all three, else the user drops to on-device:
1. **daily message cap** (per user, resets UTC midnight)
2. **monthly cost ceiling** (per user, resets on the 1st)
3. **pool budget** (all users combined) — set this at/below the credits you loaded.

## How it fits together

```
Browser (ManagedCloudProvider)                Vercel Edge (api/chat.ts)          OpenRouter
  POST /api/chat + Supabase JWT   ─────────▶   verify JWT → tier → limits  ──▶   (server key)
                                               meter usage → Supabase
  reply + "N left today"          ◀─────────   return content + remaining
```

- **`api/chat.ts`** — the only place the OpenRouter key lives. Verifies the JWT, enforces
  limits, forwards to OpenRouter, records usage. Non-streaming (so token metering is exact).
- **`api/usage.ts`** — read-only "X of N free messages left today" for the UI.
- **`ManagedCloudProvider`** (`src/agent/models/managedCloudProvider.ts`) — a normal
  `ChatLLM` backend that calls the proxy with the session token. Selectable in the app as
  **NAVI Cloud** (sign-in required); throws `ManagedCloudLimitError` when a limit is hit.
- **`supabase/migrations/0001_cloud_usage.sql`** — `cloud_usage` (metering) + `subscriptions`
  (drives free vs plus; Stripe fills it later). RLS: users read only their own rows; writes
  are service-role only.

## Deploy checklist

1. **DB:** run `supabase/migrations/0001_cloud_usage.sql` in the Supabase SQL editor.
2. **OpenRouter:** create a key and load the credits you're willing to spend (e.g. $50).
3. **Vercel env vars** (Production + Preview) — see `.env.example`:
   `OPENROUTER_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_URL` / `SUPABASE_ANON_KEY`
   (the last two fall back to the `VITE_` ones). **None** of these are `VITE_`-prefixed —
   they must never reach the browser.
4. Set `POOL.monthlyBudgetUsd` ≤ the credits you loaded, and pick your `dailyMessageCap`.
5. Deploy. Sign in, pick **NAVI Cloud**, and confirm usage rows land in `cloud_usage`.

## Tuning as you go

- **Too generous / pool draining?** Lower `dailyMessageCap` or `monthlyCostCeilingUsd`,
  or switch `TIERS.free.model` to a cheaper one.
- **Want to watch spend:** `select date_trunc('day', created_at), sum(cost_usd) from cloud_usage group by 1 order by 1;`
- **Keep prices honest:** update `price*` in the config when OpenRouter's pricing changes,
  so the metered cost matches reality.

## Not built yet (next passes)

- **Stripe** for NAVI Plus (checkout, customer portal, webhook → `subscriptions`). Tier
  detection already reads `subscriptions`, so wiring Stripe is additive.
- **In-app usage meter** using `api/usage.ts` (show remaining before the cap bites).
- **Streaming** through the proxy (currently non-streaming for exact metering).
