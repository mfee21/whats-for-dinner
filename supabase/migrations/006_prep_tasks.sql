-- Adds an advanced prep tasks array to recipes.
-- Each task: { id, task, timing, notify }

alter table public.recipes
  add column if not exists prep_tasks jsonb not null default '[]';
