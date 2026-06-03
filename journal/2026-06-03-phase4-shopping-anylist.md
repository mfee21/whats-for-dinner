# 2026-06-03 — Phase 4: Shopping List + AnyList Integration

## What was done

### Shopping list page (`/shopping`)
- Week navigator matching the planner's Prev/Today/Next pattern
- Client-side aggregation: groups ingredients by `name+unit`, sums numeric amounts, string-concatenates non-numeric ones
- Loads from `shopping_list_cache` on mount; auto-generates if no cache exists
- Interactive checklist: unchecked items on top, checked items in a "Done" section with strikethrough
- Upserts to cache with `{ onConflict: 'user_id,week_start' }` — only one cache row per user per week
- Regenerate button + "Generated [timestamp]" label

### Cook mode ingredient flags (`/recipes/:id/cook`)
- Added a "Need?" column to the ingredients table — 2-column layout (ingredient | toggle)
- `AnyListToggle` component: gray tile (not needed) vs blue tile with green checkmark badge (needed)
- Per-ingredient `pantry_needs` rows in Supabase, loaded on mount and updated optimistically on toggle
- "Need?" header has a circled-i tooltip (rendered via `createPortal` to escape table stacking context) explaining the column and AnyList integration

### AnyList integration (`/api/anylist-sync`)
- Vercel serverless function (Node.js runtime, not edge) calling the unofficial `anylist` npm package
- Reads AnyList credentials from `user_settings` via the user's JWT so RLS applies
- Best-effort: `syncToAnyList()` is called with `void` — failures never block the UI
- Add on flag, remove on unflag

### Settings page (`/settings`)
- AnyList email, password, list name stored in `user_settings` (upsert on save)
- Nav link replaced text with a gear SVG icon

### Database (`supabase/migrations/002_pantry_needs_user_settings.sql`)
- `pantry_needs (user_id, ingredient_name)` with unique constraint and RLS
- `user_settings (user_id)` with unique constraint and RLS

## Key decisions

**Client-side aggregation, no AI.** The shopping list aggregates by exact `name|unit` match and sums amounts numerically (with string fallback). No unit normalization (tsp vs teaspoon). Simple and fast — AI would be overkill for a personal family app.

**Cook mode for the "need" flag, not a standalone page.** The flag lives where you're most likely to notice you're out of something — while cooking.

**Best-effort AnyList sync.** AnyList's API is unofficial and has no uptime guarantees. The sync fires and forgets; a failure just means the item isn't in AnyList, not that the app breaks.

**Credentials stored in Supabase behind RLS.** Plaintext is acceptable for a single-family personal app. Would need encryption at rest if this ever became multi-tenant.

## Bugs fixed during the session

**Tooltip appearing below icon instead of beside it.** CSS `absolute` positioning inside `<th>` table cells doesn't establish a reliable containing block. Fixed with `createPortal` to `document.body` + `getBoundingClientRect()` + `position: fixed`. Added viewport-edge detection so the tooltip falls to the left of the icon when the aside is near the right edge of the screen.

**`FUNCTION_INVOCATION_FAILED` on anylist-sync.** Three layers of root cause:
1. The `require('anylist')` call was at module top-level — a crash there gives Vercel no chance to return a response, so it emits a raw 500 with no body. Fixed by moving the load inside the handler with try-catch.
2. `"type": "module"` in `package.json` makes the project ESM — `require` doesn't exist in ESM. Fixed by switching to `await import('anylist')` with `.default` extraction (CJS module.exports becomes `.default` in ESM interop).
3. AnyList rejected credentials with 401 — wrong password stored in Settings. Fixed by user re-entering correct password.

**`vercel.json` SPA rewrite was catching `/api/*` routes.** Tightened from `/(.*) → /index.html` to `/((?!api/).*) → /index.html`.

## What's next

Phase 5: AI-powered recipe suggestions / meal planning assistant.
