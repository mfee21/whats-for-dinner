-- Run this in the Supabase SQL Editor.
-- Adds recipe_id to pantry_needs so shopping list can group by recipe.

-- Drop the old unique constraint (user_id, ingredient_name)
alter table public.pantry_needs drop constraint if exists pantry_needs_user_ingredient_unique;

-- Add recipe_id column (nullable so existing rows aren't broken)
alter table public.pantry_needs add column if not exists recipe_id uuid references public.recipes(id) on delete cascade;

-- New unique constraint scoped to recipe
alter table public.pantry_needs add constraint pantry_needs_user_recipe_ingredient_unique
  unique (user_id, recipe_id, ingredient_name);
