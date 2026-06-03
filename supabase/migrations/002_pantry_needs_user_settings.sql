-- Run this in the Supabase SQL Editor.
-- Adds pantry_needs (per-user flagged ingredients) and user_settings (AnyList credentials).

-- pantry_needs: ingredients the user has flagged as "need to buy"
create table if not exists public.pantry_needs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ingredient_name text not null,
  added_at timestamptz not null default now(),
  constraint pantry_needs_user_ingredient_unique unique (user_id, ingredient_name)
);

create index if not exists pantry_needs_user_id_idx on public.pantry_needs (user_id);

alter table public.pantry_needs enable row level security;

grant select, insert, delete on public.pantry_needs to authenticated;

create policy pantry_needs_select_own on public.pantry_needs for select to authenticated using (auth.uid() = user_id);
create policy pantry_needs_insert_own on public.pantry_needs for insert to authenticated with check (auth.uid() = user_id);
create policy pantry_needs_delete_own on public.pantry_needs for delete to authenticated using (auth.uid() = user_id);

-- user_settings: one row per user, stores AnyList credentials
-- Note: password is stored as plaintext — acceptable for a personal family app behind RLS,
-- but should be encrypted at rest if this ever becomes multi-tenant.
create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  anylist_email text,
  anylist_password text,
  anylist_list_name text,
  updated_at timestamptz not null default now(),
  constraint user_settings_user_unique unique (user_id)
);

alter table public.user_settings enable row level security;

grant select, insert, update, delete on public.user_settings to authenticated;

create policy user_settings_select_own on public.user_settings for select to authenticated using (auth.uid() = user_id);
create policy user_settings_insert_own on public.user_settings for insert to authenticated with check (auth.uid() = user_id);
create policy user_settings_update_own on public.user_settings for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy user_settings_delete_own on public.user_settings for delete to authenticated using (auth.uid() = user_id);
