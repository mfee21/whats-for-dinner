import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Ingredient, MealPlan, Recipe } from '../types/database'

type ShoppingItem = Ingredient & { checked: boolean }

type ShoppingListPageProps = {
  session: Session
}

function localDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function aggregateIngredients(recipes: Recipe[]): Ingredient[] {
  // Key by normalized name + unit so "2 garlic cloves" + "2 garlic cloves" → "4 garlic cloves"
  const map = new Map<string, Ingredient>()

  for (const recipe of recipes) {
    for (const ing of recipe.ingredients) {
      const name = ing.name.trim()
      const unit = ing.unit.trim().toLowerCase()
      const key = `${name.toLowerCase()}|${unit}`
      const existing = map.get(key)

      if (existing) {
        const a = parseFloat(existing.amount)
        const b = parseFloat(ing.amount)
        if (!isNaN(a) && !isNaN(b)) {
          existing.amount = String(a + b)
        } else {
          existing.amount = `${existing.amount} + ${ing.amount}`
        }
      } else {
        map.set(key, { name, amount: ing.amount.trim(), unit: ing.unit.trim() })
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export default function ShoppingListPage({ session }: ShoppingListPageProps) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [cachedAt, setCachedAt] = useState<string | null>(null)

  const weekEnd = addDays(weekStart, 6)
  const weekStartStr = localDateStr(weekStart)

  const loadFromCache = useCallback(async (): Promise<Ingredient[] | null> => {
    const { data } = await supabase
      .from('shopping_list_cache')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('week_start', weekStartStr)
      .maybeSingle()

    if (data) {
      setCachedAt(data.generated_at as string)
      return data.items as Ingredient[]
    }
    return null
  }, [session.user.id, weekStartStr])

  const generate = useCallback(async () => {
    setIsGenerating(true)
    setErrorMessage(null)

    // Fetch meal plans for the week
    const { data: plans, error: plansError } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('user_id', session.user.id)
      .gte('planned_date', weekStartStr)
      .lte('planned_date', localDateStr(addDays(weekStart, 6)))

    if (plansError) { setErrorMessage(plansError.message); setIsGenerating(false); return }

    const recipeIds = [...new Set((plans as MealPlan[]).map((p) => p.recipe_id))]

    if (recipeIds.length === 0) {
      setItems([])
      setIsGenerating(false)
      return
    }

    // Fetch those recipes
    const { data: recipes, error: recipesError } = await supabase
      .from('recipes')
      .select('*')
      .in('id', recipeIds)

    if (recipesError) { setErrorMessage(recipesError.message); setIsGenerating(false); return }

    const aggregated = aggregateIngredients(recipes as Recipe[])
    const generatedAt = new Date().toISOString()

    // Upsert into cache
    await supabase.from('shopping_list_cache').upsert(
      {
        user_id: session.user.id,
        week_start: weekStartStr,
        items: aggregated,
        generated_at: generatedAt,
      },
      { onConflict: 'user_id,week_start' },
    )

    setCachedAt(generatedAt)
    setItems(aggregated.map((i) => ({ ...i, checked: false })))
    setIsGenerating(false)
  }, [session.user.id, weekStart, weekStartStr])

  useEffect(() => {
    setItems([])
    setCachedAt(null)
    setIsLoading(true)

    async function init() {
      const cached = await loadFromCache()
      if (cached) {
        setItems(cached.map((i) => ({ ...i, checked: false })))
        setIsLoading(false)
      } else {
        setIsLoading(false)
        await generate()
      }
    }

    void init()
  }, [weekStart]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleItem(idx: number) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, checked: !item.checked } : item))
  }

  const unchecked = items.filter((i) => !i.checked)
  const checked = items.filter((i) => i.checked)

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">Shopping List</h1>
          <p className="mt-1 text-sm text-gray-600">
            {formatDisplay(weekStart)} – {formatDisplay(weekEnd)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekStart((d) => addDays(d, -7))}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-gray-900 hover:text-gray-900"
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(getWeekStart(new Date()))}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-gray-900 hover:text-gray-900"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setWeekStart((d) => addDays(d, 7))}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-gray-900 hover:text-gray-900"
          >
            Next →
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-6 max-w-md">
        {isLoading || isGenerating ? (
          <p className="text-sm text-gray-500">{isGenerating ? 'Generating list…' : 'Loading…'}</p>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
            <p className="text-sm text-gray-500">No meals planned for this week.</p>
            <p className="mt-1 text-xs text-gray-400">Add meals in the planner, then regenerate.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white">
            <ul className="divide-y divide-gray-100">
              {unchecked.map((item, i) => {
                const globalIdx = items.indexOf(item)
                return (
                  <li key={`${item.name}|${item.unit}|${i}`}>
                    <label className="flex cursor-pointer items-baseline gap-3 px-4 py-2.5 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => toggleItem(globalIdx)}
                        className="mt-0.5 shrink-0 accent-gray-800"
                      />
                      <span className="flex-1 text-sm text-gray-800">
                        {item.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {item.amount}{item.unit ? ` ${item.unit}` : ''}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>

            {checked.length > 0 && (
              <>
                <div className="border-t border-gray-200 px-4 py-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Done</p>
                </div>
                <ul className="divide-y divide-gray-100">
                  {checked.map((item, i) => {
                    const globalIdx = items.indexOf(item)
                    return (
                      <li key={`checked-${item.name}|${item.unit}|${i}`}>
                        <label className="flex cursor-pointer items-baseline gap-3 px-4 py-2.5 hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={true}
                            onChange={() => toggleItem(globalIdx)}
                            className="mt-0.5 shrink-0 accent-gray-800"
                          />
                          <span className="flex-1 text-sm text-gray-400 line-through">
                            {item.name}
                          </span>
                          <span className="text-xs text-gray-300">
                            {item.amount}{item.unit ? ` ${item.unit}` : ''}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </div>
        )}

        {!isLoading && (
          <div className="mt-3 flex items-center justify-between">
            {cachedAt ? (
              <p className="text-xs text-gray-400">
                Generated {new Date(cachedAt).toLocaleString()}
              </p>
            ) : <span />}
            <button
              type="button"
              onClick={() => void generate()}
              disabled={isGenerating}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-900 hover:text-gray-900 disabled:opacity-50"
            >
              {isGenerating ? 'Generating…' : 'Regenerate'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
