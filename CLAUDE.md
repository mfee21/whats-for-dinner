# Claude — What's For Dinner

## Project

Family meal planning web app. Upload or paste any recipe (photo, URL, or text) and Claude extracts structured ingredients and steps. Plan meals for the week, generate shopping lists, get AI-powered suggestions.

Public portfolio project — every architecture decision should be explainable in an interview.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 8 + TypeScript |
| Styling | Tailwind CSS v4 (Vite plugin, no config file) |
| Backend/DB | Supabase (Postgres + Auth + REST) |
| Serverless | Vercel Edge Functions (`/api/*`) |
| AI | Anthropic Claude API (Haiku for parsing, Sonnet for suggestions) |
| Routing | React Router v7 |

## Commands

```bash
npm run dev       # start local dev server
npm run build     # type-check + production build
npm run lint      # ESLint
```

**Windows note:** Node.js may not be on the system PATH for tool shells. Prefix npm commands with:
`$env:PATH = "C:\Program Files\nodejs\;$env:PATH";`

## Folder structure

```
src/
  pages/       # one file per route (RecipesPage, PlannerPage, etc.)
  components/  # reusable UI components
  lib/         # supabase.ts client, utility functions
  types/       # database.ts — TypeScript interfaces for all DB tables
journal/       # dated session notes (one file per session)
```

## Environment variables

Stored in `.env.local` (never committed). See `.env.example` for required keys:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Vercel secrets are set in the Vercel dashboard, not the repo.

## Current phase

**Phase 1 — Foundation (in progress)**

Done: Supabase project created, Vercel connected, frontend scaffolded.
Next: push to GitHub, apply Supabase schema, add auth, build recipe list view.

See `PLANNING.md` for full phase breakdown and guardrails.

## Guardrails

These are out of scope until all 7 phases are complete — do not build them:
- Kids' meal tracking
- Nutrition/calorie tracking
- Social features / recipe sharing
- Mobile app
- Multiple household logins

If I suggest something outside the current phase, remind me of the guardrails.

## Journal

After each session, add an entry to `journal/YYYY-MM-DD-description.md` covering:
- What was done
- Why each decision was made
- Any blockers encountered
- What's next

This doubles as portfolio documentation.

## Data model (summary)

```
recipes          — id, user_id, name, ingredients (jsonb), instructions, tags, rating, notes
meal_plans       — id, user_id, recipe_id, planned_date, meal_slot, calendar_event_id
shopping_list_cache — id, user_id, week_start, items (jsonb), generated_at
```

All tables use Supabase Row Level Security locked to `auth.users.id = user_id`.
