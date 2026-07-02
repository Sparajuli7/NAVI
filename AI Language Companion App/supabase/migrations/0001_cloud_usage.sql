-- NAVI managed-cloud metering schema
-- Run in the Supabase SQL editor (or via `supabase db push`).
-- Backs api/chat.ts (enforcement + metering) and api/usage.ts (allowance readout).

-- ── Per-request usage log ─────────────────────────────────────────────────────
create table if not exists public.cloud_usage (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  created_at        timestamptz not null default now(),
  model             text not null,
  tier              text not null,
  prompt_tokens     integer not null default 0,
  completion_tokens integer not null default 0,
  cost_usd          numeric(12, 6) not null default 0
);

-- Hot paths: "this user today/this month" and "whole pool this month".
create index if not exists cloud_usage_user_created_idx on public.cloud_usage (user_id, created_at);
create index if not exists cloud_usage_created_idx on public.cloud_usage (created_at);

alter table public.cloud_usage enable row level security;

-- Users may read their own usage (for the in-app meter). No insert/update/delete
-- policy exists, so writes are only possible with the service-role key (the proxy).
drop policy if exists "cloud_usage_own_read" on public.cloud_usage;
create policy "cloud_usage_own_read"
  on public.cloud_usage for select
  using (auth.uid() = user_id);

-- ── Subscription state (drives free vs plus tier; Stripe fills this in later) ──
create table if not exists public.subscriptions (
  user_id                uuid primary key references auth.users (id) on delete cascade,
  tier                   text not null default 'free',
  status                 text not null default 'inactive',
  stripe_customer_id     text,
  stripe_subscription_id text,
  current_period_end     timestamptz,
  updated_at             timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_own_read" on public.subscriptions;
create policy "subscriptions_own_read"
  on public.subscriptions for select
  using (auth.uid() = user_id);
-- Writes happen only via the service-role key (Stripe webhook, later).
