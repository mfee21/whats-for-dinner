-- Whats For Dinner core schema
-- Run this in Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  ingredients jsonb not null default '[]'::jsonb,
  instructions text not null default '',
  tags text[] not null default '{}',
  rating int check (rating between 1 and 5),
  notes text,
  image_url text,
  favorited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  planned_date date not null,
  meal_slot text not null default 'meal',
  calendar_event_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.shopping_list_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  items jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  constraint shopping_list_cache_user_week_unique unique (user_id, week_start)
);

create index if not exists recipes_user_id_created_idx on public.recipes (user_id, created_at desc);
create index if not exists meal_plans_user_id_planned_date_idx on public.meal_plans (user_id, planned_date);
create index if not exists shopping_list_cache_user_id_week_start_idx on public.shopping_list_cache (user_id, week_start);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_recipes_updated_at on public.recipes;
create trigger set_recipes_updated_at
before update on public.recipes
for each row
execute function public.set_updated_at();

alter table public.recipes enable row level security;
alter table public.meal_plans enable row level security;
alter table public.shopping_list_cache enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.recipes to authenticated;
grant select, insert, update, delete on public.meal_plans to authenticated;
grant select, insert, update, delete on public.shopping_list_cache to authenticated;

drop policy if exists recipes_select_own on public.recipes;
create policy recipes_select_own
on public.recipes
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists recipes_insert_own on public.recipes;
create policy recipes_insert_own
on public.recipes
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists recipes_update_own on public.recipes;
create policy recipes_update_own
on public.recipes
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists recipes_delete_own on public.recipes;
create policy recipes_delete_own
on public.recipes
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists meal_plans_select_own on public.meal_plans;
create policy meal_plans_select_own
on public.meal_plans
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists meal_plans_insert_own on public.meal_plans;
create policy meal_plans_insert_own
on public.meal_plans
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists meal_plans_update_own on public.meal_plans;
create policy meal_plans_update_own
on public.meal_plans
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists meal_plans_delete_own on public.meal_plans;
create policy meal_plans_delete_own
on public.meal_plans
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists shopping_list_cache_select_own on public.shopping_list_cache;
create policy shopping_list_cache_select_own
on public.shopping_list_cache
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists shopping_list_cache_insert_own on public.shopping_list_cache;
create policy shopping_list_cache_insert_own
on public.shopping_list_cache
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists shopping_list_cache_update_own on public.shopping_list_cache;
create policy shopping_list_cache_update_own
on public.shopping_list_cache
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists shopping_list_cache_delete_own on public.shopping_list_cache;
create policy shopping_list_cache_delete_own
on public.shopping_list_cache
for delete
to authenticated
using (auth.uid() = user_id);

-- pantry_needs: ingredients flagged as "need to buy"
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

-- user_settings: per-user settings (AnyList credentials, etc.)
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
