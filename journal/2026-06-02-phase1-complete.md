# Session: Phase 1 complete — shipped to GitHub and Vercel
**Date:** 2026-06-02
**Phase:** 1 — Foundation (complete)

## What we did

- Confirmed Supabase schema was correctly applied (all three tables + RLS policies + `image_url` column)
- Fixed `.gitignore` — it had `*.local` but not `.env`, which would have committed real credentials; added `.env` and `.env.*` exclusions with a `!.env.example` exception
- Recreated `.env.example` for portfolio/documentation purposes
- Committed all Phase 1 work in one clean commit: auth, home page, add recipe, cook mode, RecipeIndex, schema SQL, journals
- Pushed to GitHub → triggered Vercel auto-deploy
- Wired post-save navigation: saving a recipe now redirects to the home page with the new recipe highlighted in a green ring for 3 seconds, then scrolls it into view
- Fixed recipe tile height: the outer two-column section grid was stretching the recipe list container to match the RecipeIndex sidebar height, causing the inner grid to distribute that extra space across all tile rows; fixed with `content-start` on the recipe list div
- Moved photo button from below the image into an overlay at the image bottom, giving the tile equal top/bottom spacing around the photo frame
- Added keyword search to RecipeIndex (local state, swaps alphabet nav for flat filtered list when active)
- Fixed `▢` checkbox characters in stored ingredient names (parser regex gap + render-time sanitization in cook mode)

## Why these choices

**`.gitignore` fix before committing:** Credentials in a public GitHub repo are immediately scraped by bots. The `*.local` pattern only protected `.env.local`; `.env` was completely exposed. Fixed before any push.

**`.env.example` kept in the repo:** Standard practice — documents what environment variables the app needs without exposing values. Useful for anyone cloning the repo, and a signal of professional discipline on a portfolio project.

**One large commit for Phase 1:** All the work was local and unpublished. A single well-described commit is cleaner than a series of half-baked intermediate states appearing in the public history. Future phases will have smaller, incremental commits.

**Post-save highlight + scroll:** A small UX touch that closes the loop — you added a recipe, you land on the home page and immediately see it. The green ring + 3s fade is a standard "success confirmation" pattern. `scrollIntoView` ensures it's visible even in a long list. The highlight is driven by React Router `location.state` (not a URL param) so it only fires once and doesn't pollute the URL.

**`content-start` for tile height:** CSS Grid's default `align-content: normal` (= stretch) distributes extra container height across rows when the container is stretched by a parent grid. The fix is `align-content: start` on the inner grid, which packs rows at the top and ignores the extra space. One class, correct behaviour.

**Image overlay button:** The original separate "Change Photo" button below the image was adding ~32px to the tile's minimum height, making the top/bottom gaps around the photo frame unequal. Collapsing it into a semi-transparent overlay at the image bottom removes that extra height entirely, making the tile exactly as tall as the image + equal padding on both sides.

## Blockers encountered

- `.env` not in `.gitignore` — caught before push, fixed immediately.
- Recipe tiles visually too tall — root cause was outer grid stretching inner grid rows, not the article styles. Took several iterations to diagnose; `content-start` resolved it cleanly.

## What's next

**Phase 2 — Recipe ingestion (AI extraction)**

1. Create Vercel edge function: `api/parse-recipe.ts`
   - Accept: raw text, a URL (server-side fetch), or a base64 image
   - Call Claude Haiku to extract `{ name, ingredients, instructions }`
   - Return structured JSON for the user to review
2. Wire the Add Recipe page to call the edge function from the "Import From Text" button (and add URL + photo input methods)
3. Keep the existing review-before-save step — the human quality gate stays
4. Set `ANTHROPIC_API_KEY` as a Vercel environment variable (never in the repo)

The manual paste parser (`recipeParser.ts`) can stay as a client-side fallback or be retired once the AI version is proven reliable.
