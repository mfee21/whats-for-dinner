import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Link } from 'react-router-dom'
import { CookBadge } from '../components/CookBadge'
import { supabase } from '../lib/supabase'
import type { Cook, MealPlan, Recipe } from '../types/database'

type DashboardPageProps = { session: Session }

type DayPlan = {
  date: Date
  dateStr: string
  meals: Array<{ plan: MealPlan; recipe: Recipe }>
}

type ShoppingItem = {
  id: string
  ingredient_name: string
  recipe_id: string | null
  recipe_name: string | null
  checked: boolean
}

function localDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

export default function DashboardPage({ session }: DashboardPageProps) {
  const [dayPlans, setDayPlans] = useState<DayPlan[]>([])
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([])
  const [cookMap, setCookMap] = useState<Map<string, Cook>>(new Map())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const days = Array.from({ length: 6 }, (_, i) => addDays(today, i))
      const todayStr = localDateStr(today)
      const endStr = localDateStr(addDays(today, 5))

      const { data: plansData } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('user_id', session.user.id)
        .gte('planned_date', todayStr)
        .lte('planned_date', endStr)

      const plans = (plansData ?? []) as MealPlan[]
      const recipeIds = [...new Set(plans.map((p) => p.recipe_id))]

      let recipes: Recipe[] = []
      let shoppingRows: ShoppingItem[] = []

      if (recipeIds.length > 0) {
        const { data: recipesData } = await supabase
          .from('recipes')
          .select('*')
          .in('id', recipeIds)
        recipes = (recipesData ?? []) as Recipe[]

        const { data: needsData } = await supabase
          .from('pantry_needs')
          .select('id, ingredient_name, recipe_id, recipes(id, name)')
          .eq('user_id', session.user.id)
          .in('recipe_id', recipeIds)
          .order('ingredient_name')

        shoppingRows = (needsData ?? []).map((r) => {
          const recipe = (Array.isArray(r.recipes) ? r.recipes[0] : r.recipes) as {
            id: string
            name: string
          } | null
          return {
            id: r.id as string,
            ingredient_name: r.ingredient_name as string,
            recipe_id: r.recipe_id as string | null,
            recipe_name: recipe?.name ?? null,
            checked: false,
          }
        })
      }

      const recipeMap = new Map(recipes.map((r) => [r.id, r]))
      const plansByDate = new Map<string, MealPlan[]>()
      for (const plan of plans) {
        const arr = plansByDate.get(plan.planned_date) ?? []
        arr.push(plan)
        plansByDate.set(plan.planned_date, arr)
      }

      const { data: cooksData } = await supabase
        .from('cooks')
        .select('*')
        .eq('user_id', session.user.id)
      const cooks = (cooksData ?? []) as Cook[]
      setCookMap(new Map(cooks.map((c) => [c.id, c])))

      setDayPlans(
        days.map((date) => {
          const dateStr = localDateStr(date)
          return {
            date,
            dateStr,
            meals: (plansByDate.get(dateStr) ?? [])
              .map((p) => ({ plan: p, recipe: recipeMap.get(p.recipe_id)! }))
              .filter((x) => x.recipe !== undefined),
          }
        }),
      )
      setShoppingItems(shoppingRows)
      setIsLoading(false)
    }

    void load()
  }, [session.user.id])

  function toggleItem(id: string) {
    setShoppingItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)),
    )
  }

  if (isLoading) {
    return <div className="p-8 text-sm text-gray-500">Loading...</div>
  }

  const todayPlan = dayPlans[0]
  const futureDays = dayPlans.slice(1)

  const shoppingByRecipe = new Map<
    string,
    { name: string | null; items: ShoppingItem[] }
  >()
  for (const item of shoppingItems) {
    const key = item.recipe_id ?? '__none__'
    if (!shoppingByRecipe.has(key)) {
      shoppingByRecipe.set(key, { name: item.recipe_name, items: [] })
    }
    shoppingByRecipe.get(key)!.items.push(item)
  }

  const todayLabel = todayPlan?.date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-950">Dashboard</h1>

      <div className="grid grid-cols-[1fr_17rem] gap-6">
        {/* Left: today + next 5 days */}
        <div className="flex min-w-0 flex-col gap-5">
          {/* Today panel */}
          <div className="rounded-xl border-2 border-emerald-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                  Today
                </span>
                <h2 className="text-xl font-bold text-gray-950">{todayLabel}</h2>
              </div>
              <Link
                to="/plan"
                className="shrink-0 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:border-gray-900 hover:text-gray-900"
              >
                Edit Plan
              </Link>
            </div>

            {todayPlan.meals.length === 0 ? (
              <p className="text-sm text-gray-400">
                No meals planned.{' '}
                <Link to="/plan" className="underline hover:text-gray-700">
                  Add one →
                </Link>
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {todayPlan.meals.map(({ plan, recipe }) => (
                  <li key={plan.id}>
                    <Link
                      to={`/recipes/${recipe.id}/cook`}
                      className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-base font-medium text-gray-800 transition-colors hover:border-gray-400 hover:bg-white"
                    >
                      {recipe.image_url ? (
                        <img
                          src={recipe.image_url}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gray-200 text-lg">
                          🍽
                        </div>
                      )}
                      <span className="min-w-0 flex-1 truncate">{recipe.name}</span>
                      {plan.cook_id && cookMap.get(plan.cook_id) ? (
                        <CookBadge cook={cookMap.get(plan.cook_id)!} />
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Next 5 days */}
          <div className="grid grid-cols-5 gap-3">
            {futureDays.map((day) => {
              const dayName = day.date.toLocaleDateString('en-US', { weekday: 'short' })
              const dateLabel = day.date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })
              return (
                <div
                  key={day.dateStr}
                  className="flex min-h-[6rem] flex-col gap-1.5 rounded-lg border border-gray-200 bg-white p-3"
                >
                  <div className="mb-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {dayName}
                    </p>
                    <p className="text-xs text-gray-400">{dateLabel}</p>
                  </div>
                  {day.meals.length === 0 ? (
                    <p className="text-xs text-gray-300">—</p>
                  ) : (
                    day.meals.map(({ plan, recipe }) => (
                      <div key={plan.id} className="flex flex-col gap-0.5">
                        <Link
                          to={`/recipes/${recipe.id}/cook`}
                          className="truncate text-xs text-gray-700 hover:text-gray-950 hover:underline"
                        >
                          {recipe.name}
                        </Link>
                        {plan.cook_id && cookMap.get(plan.cook_id) ? (
                          <CookBadge cook={cookMap.get(plan.cook_id)!} />
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Shopping sidebar */}
        <aside className="sticky top-4 self-start rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-950">Shopping This Week</h2>
          <p className="mt-0.5 mb-4 text-xs text-gray-500">Today + next 5 days</p>

          {shoppingByRecipe.size === 0 ? (
            <p className="text-xs text-gray-400">
              No items added yet. Open a recipe in cook mode and mark what you need.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {Array.from(shoppingByRecipe.entries()).map(([key, group]) => (
                <div key={key}>
                  {group.name ? (
                    <p className="mb-1.5 text-xs font-semibold text-gray-600">{group.name}</p>
                  ) : null}
                  <ul className="flex flex-col gap-1">
                    {group.items.map((item) => (
                      <li key={item.id} className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          id={`si-${item.id}`}
                          checked={item.checked}
                          onChange={() => toggleItem(item.id)}
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-gray-300 accent-emerald-600"
                        />
                        <label
                          htmlFor={`si-${item.id}`}
                          className={`cursor-pointer text-xs leading-snug ${
                            item.checked ? 'text-gray-400 line-through' : 'text-gray-700'
                          }`}
                        >
                          {item.ingredient_name}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 border-t border-gray-100 pt-3">
            <Link
              to="/shopping"
              className="text-xs text-gray-500 hover:text-gray-900 hover:underline"
            >
              Full shopping list →
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
