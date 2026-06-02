# Session: Phase 1 scaffold
**Date:** 2026-06-02
**Phase:** 1 — Foundation

## What we did

- Created Supabase project (`whats-for-dinner`) — database and auth backend
- Connected GitHub repo to Vercel — auto-deploy pipeline in place
- Installed Node.js (was not present on machine)
- Scaffolded Vite + React + TypeScript project
- Installed and configured Tailwind CSS v4
- Installed Supabase JS client and React Router
- Created project folder structure (`src/pages/`, `src/lib/`, `src/types/`)
- Wrote TypeScript types mirroring the data model from the planning doc
- Set up Supabase client stub (reads credentials from env vars)
- Replaced Vite boilerplate with a real app shell and routing

## Why these choices

**Supabase over Firebase:** Postgres is SQL — universally understood in enterprise environments and interviews. Firebase uses a proprietary NoSQL query model. Supabase also gives us a REST API and Auth out of the box at no cost.

**Vercel over self-hosting:** Zero infrastructure to manage. Every push to `main` auto-deploys. Free tier is sufficient for this app. Keeps secrets server-side (env vars set in the Vercel dashboard, never in the repo).

**Vite over Create React App:** CRA is deprecated. Vite is the current standard — faster builds, better DX, actively maintained.

**TypeScript over plain JavaScript:** Type safety catches bugs at write time. For a QA-oriented portfolio, using TypeScript signals you care about correctness — it's also industry standard.

**Tailwind v4 over v3:** v4 integrates directly as a Vite plugin — no config file needed. Simpler setup, faster builds.

**React Router added early:** Adding routing in Phase 1 means each subsequent phase just adds a new `<Route>` — no refactoring needed later.

**Supabase client in a single `lib/supabase.ts` file:** One place manages the connection. All other files import from here. If credentials or the client config ever change, there's one place to update.

**`.env.example` committed to repo:** Documents what credentials the app needs without exposing actual secrets. Standard practice — anyone cloning the repo knows what to set up.

## Blockers encountered

- Node.js was not installed — had to install before any scaffolding could happen
- Node.js was not on the system PATH for cmd.exe — required setting PATH explicitly in tool commands. User's terminal worked fine after restarting it post-install.

## What's next

- Create `.env.local` with real Supabase credentials (URL + anon key from Supabase dashboard)
- Push to GitHub → triggers first real Vercel deploy
- Apply Supabase schema (create `recipes`, `meal_plans`, `shopping_list_cache` tables + RLS)
- Build auth (email/password login via Supabase Auth)
- Build recipe list view and add-recipe form
