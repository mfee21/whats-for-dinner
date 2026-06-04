-- Run this in the Supabase SQL Editor.
-- Adds the cooks table and a cook_id FK on meal_plans.

create table if not exists public.cooks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  color      text not null default '#6366f1',
  created_at timestamptz not null default now()
);

alter table public.cooks enable row level security;

create policy "Users manage their own cooks"
  on public.cooks for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant all on public.cooks to authenticated;
grant all on public.cooks to anon;

alter table public.meal_plans
  add column if not exists cook_id uuid references public.cooks(id) on delete set null;
