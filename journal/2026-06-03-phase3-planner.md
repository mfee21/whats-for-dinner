# Session: Phase 3 complete — weekly meal planner
**Date:** 2026-06-03
**Phase:** 3 — Meal Planner (complete)

## What we did

- Built the full weekly meal planner (`PlannerPage`) using `@dnd-kit` for drag-and-drop
- Added week navigation (Prev / Today / Next) with a today badge and emerald highlight on the current day
- Locked past days read-only — no drops accepted, no remove without confirmation
- Added inline remove confirmation on past-day recipe cards (two-step: click × → confirm Yes/No)
- Added a per-day "Random" button that picks a recipe at random from the library and adds it
- Supported multiple recipes per day (up to 6), stacking freely within each day cell
- Made planned recipe cards clickable links to cook mode
- Added SPA rewrite rule (`vercel.json`) so direct page loads and refreshes don't 404
- Added favorites: heart toggle on recipe tiles, filter button in the home page header
- Included tags in recipe keyword search (searches name + tags simultaneously)
- Fixed planner day cells stretching to equal height — `items-start` on the 7-column grid so cells shrink to their content

## Why these choices

**`@dnd-kit` for drag-and-drop:** Lightweight, accessible, and designed for React. The DragOverlay component gives the floating ghost card without fighting browser drag semantics. `useDroppable` / `useDraggable` map cleanly onto day cells and recipe cards.

**Past-day locking:** Meal plans are a historical record once the day passes. Preventing drops on past days (and adding a confirmation step for removal) reflects a QA instinct: don't let the UI silently corrupt records. The muted styling communicates the distinction without an explicit warning banner.

**Two-step remove on past days vs immediate remove on future days:** Future days are low-stakes (you're still planning); a stray click is harmless to undo. Past days are more like a log entry — the extra confirmation friction is intentional.

**Per-day Random button vs a single global shuffle:** A global "random week" is hard to undo and feels coercive. Per-day Random lets you slot in a surprise for one specific night while keeping your other plans intact. Much lower blast radius.

**Multiple recipes per day (up to 6):** Real family use often means cooking two things (e.g. a main + a side, or planning both lunch and dinner). Hard cap at 6 prevents the UI from overflowing the day cell.

**SPA rewrite rule:** Vite builds a single `index.html` — React Router handles `/planner`, `/recipes/:id/cook`, etc. client-side. Without the Vercel rewrite, refreshing any non-root URL returns a 404 from the CDN because no server file exists at that path. One config line in `vercel.json` fixes it permanently.

**Favorites in Phase 3 (slightly out of phase order):** Added as a small quality-of-life feature that required no new infrastructure — just a boolean column and a UI toggle. Kept scope tight: no separate favorites page, just a filter in the existing list.

## Blockers encountered

- Planner day cells stretching to equal row height: the 7-column CSS Grid was applying `align-items: stretch` by default, making all cells as tall as the tallest cell. Fixed with `items-start` on the grid so each cell sizes to its own content.
- Recipe card link area conflicting with the remove button z-index: the `after:absolute after:inset-0` click target on the `<Link>` was covering the × button. Fixed with `relative z-10` on the button to lift it above the link overlay.

## What's next

**Phase 4 — Shopping list**

1. Create `ShoppingListPage` — week picker, generate button, interactive checklist
2. Vercel edge function `api/generate-shopping-list.ts` (or client-side aggregation — see decision below)
3. Aggregate all ingredients from `meal_plans` for the selected week → join to `recipes.ingredients`
4. Deduplicate and combine quantities (e.g. two entries of "2 garlic cloves" → "4 garlic cloves")
5. Render as a checkable list grouped by ingredient category (optional)
6. Cache result in `shopping_list_cache` with `week_start` as the key; invalidate when the week's plan changes

The deduplication step is the interesting algorithmic piece — unit normalization (tsp vs teaspoon, oz vs ounce) and fuzzy ingredient matching. Worth doing a simple version first (exact name match) and noting the limitation.
