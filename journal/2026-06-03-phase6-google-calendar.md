# 2026-06-03 — Phase 6: Google Calendar Sync + Polish

## What was done

### Google Calendar integration
- OAuth 2.0 flow: "Connect Google Calendar" button in Settings → Google consent screen → callback creates a dedicated "What's For Dinner" calendar in the user's Google account
- Tokens (access + refresh) and the calendar ID stored in `user_settings`
- On reconnect, reuses the existing calendar if it still exists rather than creating duplicates
- `api/google-auth.ts` — returns OAuth URL with Supabase JWT encoded in state parameter
- `api/google-callback.ts` — exchanges code for tokens, creates/reuses calendar, upserts into user_settings, redirects to /settings
- `api/calendar-sync.ts` — creates or deletes all-day events; handles token refresh automatically

### Planner → Calendar sync
- Adding a meal creates an all-day Google Calendar event; the returned event ID is stored in `meal_plans.calendar_event_id`
- Removing a meal deletes the corresponding Google Calendar event using the stored ID
- All sync is best-effort — calendar failures never block the UI or prevent Supabase writes
- Event description includes the full ingredient list formatted with bullet points

### Shopping list rework
- Source of truth changed from week's meal plan aggregation to `pantry_needs` table
- Grouped by recipe with the recipe name as a clickable link to cook mode
- Checking an ingredient off is strikethrough-only (local state) — the only way to remove an item is via the Need? toggle in cook mode
- `pantry_needs` migration added `recipe_id` column so items group correctly; old constraint `(user_id, ingredient_name)` replaced with `(user_id, recipe_id, ingredient_name)`

### Planner recipe sidebar
- Replaced flat draggable list with full `RecipeIndex` component (search + A–Z letter browse)
- Added `renderItem` render prop to `RecipeIndex` so the planner can inject `DraggableRecipe` items while reusing all search/filter logic
- HomePage unchanged — still uses the default Link rendering

### AnyList ESM fix
- Root cause of FUNCTION_INVOCATION_FAILED: `"type": "module"` in package.json makes the project ESM; `require()` doesn't exist
- Fixed by switching to `await import('anylist')` with `.default` extraction (CJS module.exports becomes .default in ESM interop)

## Key decisions

**Dedicated "What's For Dinner" calendar, not an existing one.** Keeps meal plan events isolated and easy to find. User doesn't have to configure anything — it's created automatically on first connect.

**State encoded in OAuth state parameter.** The Supabase JWT is base64url-encoded into Google's `state` param so the callback knows which user is connecting. Standard pattern for personal apps — the token is short-lived and the redirect is HTTPS.

**Ingredients in event description at creation time only.** Shopping list flags (pantry_needs) are set in cook mode, typically after planning, so there's nothing to include at plan time. Static ingredient list is still useful as a grocery reference.

**`renderItem` render prop on RecipeIndex.** The component handles all search/filter/letter logic; rendering is delegated to the parent. Keeps drag-and-drop concern in the planner and link concern in the home page.

## Where things stand

Phases 1–4 and 6 complete. Phase 5 (AI suggestions) and Phase 7 (Playwright testing) intentionally deferred — the app is being used by a real family and feature requests will drive what gets built next.

Shared login (one account for two users) is the current approach for household sharing — multi-user household functionality is out of scope per PLANNING.md guardrails.
