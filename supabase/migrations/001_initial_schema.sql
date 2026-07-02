-- ═══════════════════════════════════════════════════════════════════════
-- NAVI — Initial Database Schema
-- Run this in your Supabase SQL editor (Project → SQL Editor → New query)
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ── Characters (companion avatars) ───────────────────────────────────────────
-- `id` matches the existing client-generated `char_TIMESTAMP` format.
-- `data` stores the full Character object (minus avatarImageUrl — too large).
create table if not exists public.characters (
  id           text        not null,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  data         jsonb       not null default '{}',
  updated_at   timestamptz not null default now(),
  primary key (user_id, id)
);

-- ── Conversations (per character) ────────────────────────────────────────────
create table if not exists public.conversations (
  character_id text        not null,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  messages     jsonb       not null default '[]',
  updated_at   timestamptz not null default now(),
  primary key (user_id, character_id)
);

-- ── Character Memories (MemoryEntry[] per character) ─────────────────────────
create table if not exists public.character_memories (
  character_id text        not null,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  entries      jsonb       not null default '[]',
  updated_at   timestamptz not null default now(),
  primary key (user_id, character_id)
);

-- ── Learner Profile (phrases, topics, spaced repetition data) ────────────────
create table if not exists public.learner_profiles (
  user_id      uuid        primary key references auth.users(id) on delete cascade,
  data         jsonb       not null default '{}',
  updated_at   timestamptz not null default now()
);

-- ── Relationships (per-avatar warmth + shared history) ───────────────────────
-- Stores Record<avatarId, RelationshipState> as a single JSONB blob per user.
create table if not exists public.relationships (
  user_id      uuid        primary key references auth.users(id) on delete cascade,
  data         jsonb       not null default '{}',
  updated_at   timestamptz not null default now()
);

-- ── Profile Memory (user notes, preferences, learning progress) ──────────────
create table if not exists public.profile_memories (
  user_id      uuid        primary key references auth.users(id) on delete cascade,
  data         jsonb       not null default '{}',
  updated_at   timestamptz not null default now()
);

-- ── User Preferences (native/target language, formality, focus areas) ────────
create table if not exists public.user_preferences (
  user_id      uuid        primary key references auth.users(id) on delete cascade,
  data         jsonb       not null default '{}',
  updated_at   timestamptz not null default now()
);

-- ── Episodic Memory (summarized conversation episodes) ───────────────────────
create table if not exists public.episodic_memories (
  user_id      uuid        primary key references auth.users(id) on delete cascade,
  entries      jsonb       not null default '[]',
  updated_at   timestamptz not null default now()
);

-- ── Situation Model (user urgency, comfort, goals) ───────────────────────────
create table if not exists public.situation_models (
  user_id      uuid        primary key references auth.users(id) on delete cascade,
  data         jsonb       not null default '{}',
  updated_at   timestamptz not null default now()
);

-- ── Knowledge Graph (graph nodes + edges — always loaded wholesale) ───────────
-- Stored as two JSONB arrays (not relational rows) because the graph is always
-- loaded entirely into memory and traversed in-process. Max ~500KB per user.
create table if not exists public.knowledge_graphs (
  user_id      uuid        primary key references auth.users(id) on delete cascade,
  nodes        jsonb       not null default '[]',
  edges        jsonb       not null default '[]',
  updated_at   timestamptz not null default now()
);

-- ── Auto-update trigger ───────────────────────────────────────────────────────
create or replace function public.navi_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ declare tbl text;
begin
  foreach tbl in array array[
    'characters','conversations','character_memories','learner_profiles',
    'relationships','profile_memories','user_preferences',
    'episodic_memories','situation_models','knowledge_graphs'
  ] loop
    execute format(
      'create trigger navi_set_updated_at before update on public.%I
       for each row execute function public.navi_set_updated_at()', tbl);
  end loop;
end $$;

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Each user can only read/write their own rows. The anon key is safe to expose.

alter table public.characters         enable row level security;
alter table public.conversations      enable row level security;
alter table public.character_memories enable row level security;
alter table public.learner_profiles   enable row level security;
alter table public.relationships      enable row level security;
alter table public.profile_memories   enable row level security;
alter table public.user_preferences   enable row level security;
alter table public.episodic_memories  enable row level security;
alter table public.situation_models   enable row level security;
alter table public.knowledge_graphs   enable row level security;

create policy "own_characters"         on public.characters         for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_conversations"      on public.conversations      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_char_memories"      on public.character_memories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_learner_profile"    on public.learner_profiles   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_relationships"      on public.relationships      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_profile_memory"     on public.profile_memories   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_preferences"        on public.user_preferences   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_episodic_memory"    on public.episodic_memories  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_situation_model"    on public.situation_models   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_knowledge_graph"    on public.knowledge_graphs   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
