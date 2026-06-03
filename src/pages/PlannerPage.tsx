import { useEffect, useState } from 'react'
import { DndContext, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { MealPlan, Recipe } from '../types/database'

type PlannerPageProps = {
  session: Session
}

const MAX_PER_DAY = 6

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

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function DraggableRecipe({ recipe }: { recipe: Recipe }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: recipe.id,
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`cursor-grab rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm transition-opacity active:cursor-grabbing ${isDragging ? 'opacity-40' : ''}`}
    >
      {recipe.name}
    </div>
  )
}

function RecipeCard({
  recipe,
  isPast,
  onRemove,
}: {
  recipe: Recipe
  isPast: boolean
  onRemove: () => void
}) {
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  return (
    <div className={`group relative rounded border px-2 py-1.5 ${isPast ? 'border-gray-200 bg-gray-100' : 'border-gray-200 bg-gray-50'}`}>
      {confirmingRemove ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-gray-500">Remove?</p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => { onRemove(); setConfirmingRemove(false) }}
              className="flex-1 rounded border border-red-200 bg-white py-0.5 text-xs text-red-600 hover:bg-red-50"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setConfirmingRemove(false)}
              className="flex-1 rounded border border-gray-200 bg-white py-0.5 text-xs text-gray-500 hover:border-gray-400"
            >
              No
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className={`break-words text-xs ${isPast ? 'text-gray-400' : 'pr-4 text-gray-700'}`}>
            {recipe.name}
          </p>
          <button
            type="button"
            onClick={() => isPast ? setConfirmingRemove(true) : onRemove()}
            aria-label="Remove meal"
            className={`absolute right-1 top-1 hidden text-sm leading-none group-hover:block ${isPast ? 'text-gray-400 hover:text-gray-600' : 'text-gray-400 hover:text-red-500'}`}
          >
            ×
          </button>
        </>
      )}
    </div>
  )
}

function DroppableDay({
  date,
  plans,
  recipes,
  onRemove,
  onRandom,
}: {
  date: Date
  plans: MealPlan[]
  recipes: Recipe[]
  onRemove: (planId: string) => void
  onRandom: () => void
}) {
  const dateStr = localDateStr(date)
  const todayStr = localDateStr(new Date())
  const isToday = dateStr === todayStr
  const isPast = dateStr < todayStr
  const atMax = plans.length >= MAX_PER_DAY
  const { isOver, setNodeRef } = useDroppable({ id: dateStr, disabled: isPast || atMax })

  const dayRecipes = plans
    .map((p) => ({ plan: p, recipe: recipes.find((r) => r.id === p.recipe_id) }))
    .filter((x): x is { plan: MealPlan; recipe: Recipe } => x.recipe !== undefined)

  return (
    <div
      ref={setNodeRef}
      className={`flex min-w-0 flex-col gap-2 rounded-lg border p-2 transition-colors ${
        isPast
          ? 'border-gray-200 bg-gray-50'
          : isOver
            ? 'border-gray-500 bg-gray-100'
            : 'border-gray-300 bg-white'
      } ${isToday ? 'ring-2 ring-emerald-200' : ''}`}
    >
      <div className="flex items-start justify-between gap-1">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${isPast ? 'text-gray-400' : 'text-gray-600'}`}>
            {DAY_NAMES[date.getDay()]}
          </p>
          <p className={`text-sm font-medium ${isToday ? 'text-emerald-700' : isPast ? 'text-gray-400' : 'text-gray-800'}`}>
            {formatDisplay(date)}
          </p>
        </div>
        {isToday ? (
          <span className="mt-0.5 rounded border border-emerald-300 bg-emerald-50 px-1 py-0.5 text-[10px] font-medium text-emerald-700">
            Today
          </span>
        ) : null}
      </div>

      {dayRecipes.map(({ plan, recipe }) => (
        <RecipeCard
          key={plan.id}
          recipe={recipe}
          isPast={isPast}
          onRemove={() => onRemove(plan.id)}
        />
      ))}

      {!isPast && (
        atMax ? (
          <p className="text-center text-[10px] text-gray-400">Max {MAX_PER_DAY} reached</p>
        ) : (
          <div className="flex flex-col gap-1">
            <div className={`rounded border border-dashed py-2 text-center text-xs transition-colors ${isOver ? 'border-gray-400 bg-gray-100 text-gray-600' : 'border-gray-300 text-gray-500'}`}>
              Drop here
            </div>
            <button
              type="button"
              onClick={onRandom}
              className="rounded border border-gray-200 bg-white py-0.5 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700"
            >
              Random
            </button>
          </div>
        )
      )}

      {isPast && dayRecipes.length === 0 && (
        <p className="text-xs text-gray-300">—</p>
      )}
    </div>
  )
}

export default function PlannerPage({ session }: PlannerPageProps) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null)

  const weekEnd = addDays(weekStart, 6)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  useEffect(() => {
    async function loadRecipes() {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('user_id', session.user.id)
        .order('name', { ascending: true })

      if (!error) setRecipes((data as Recipe[]) ?? [])
    }
    void loadRecipes()
  }, [session.user.id])

  useEffect(() => {
    async function loadMealPlans() {
      setIsLoading(true)
      setErrorMessage(null)

      const { data, error } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('user_id', session.user.id)
        .gte('planned_date', localDateStr(weekStart))
        .lte('planned_date', localDateStr(weekEnd))

      if (error) {
        setErrorMessage(error.message)
      } else {
        setMealPlans((data as MealPlan[]) ?? [])
      }
      setIsLoading(false)
    }
    void loadMealPlans()
  }, [weekStart, session.user.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function getPlansForDay(date: Date): MealPlan[] {
    return mealPlans.filter((mp) => mp.planned_date === localDateStr(date))
  }

  async function addMeal(date: Date, recipeId: string) {
    const { data, error } = await supabase
      .from('meal_plans')
      .insert({
        user_id: session.user.id,
        recipe_id: recipeId,
        planned_date: localDateStr(date),
        meal_slot: 'meal',
      })
      .select('*')
      .single()

    if (error) { setErrorMessage(error.message); return }
    setMealPlans((prev) => [...prev, data as MealPlan])
  }

  async function removeMeal(planId: string) {
    const { error } = await supabase.from('meal_plans').delete().eq('id', planId)
    if (error) { setErrorMessage(error.message); return }
    setMealPlans((prev) => prev.filter((mp) => mp.id !== planId))
  }

  function addRandomMeal(date: Date) {
    if (recipes.length === 0) return
    const pick = recipes[Math.floor(Math.random() * recipes.length)]
    void addMeal(date, pick.id)
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveRecipe(recipes.find((r) => r.id === String(event.active.id)) ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveRecipe(null)
    const { active, over } = event
    if (!over) return

    const recipeId = String(active.id)
    const [year, month, day] = String(over.id).split('-').map(Number)
    const date = new Date(year, month - 1, day)

    void addMeal(date, recipeId)
  }

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">Meal Planner</h1>
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

      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_14rem]">
          <div className={`overflow-x-auto transition-opacity ${isLoading ? 'opacity-50' : ''}`}>
            <div className="grid min-w-[560px] grid-cols-7 gap-2">
              {weekDays.map((date) => (
                <DroppableDay
                  key={localDateStr(date)}
                  date={date}
                  plans={getPlansForDay(date)}
                  recipes={recipes}
                  onRemove={(planId) => void removeMeal(planId)}
                  onRandom={() => addRandomMeal(date)}
                />
              ))}
            </div>
          </div>

          <aside>
            <h2 className="text-sm font-semibold text-gray-700">Recipes</h2>
            <p className="mt-0.5 text-xs text-gray-600">Drag onto a day to add it.</p>
            <div className="mt-3 grid gap-2">
              {recipes.length === 0 ? (
                <p className="text-xs text-gray-400">No recipes yet.</p>
              ) : (
                recipes.map((recipe) => <DraggableRecipe key={recipe.id} recipe={recipe} />)
              )}
            </div>
          </aside>
        </div>

        <DragOverlay>
          {activeRecipe ? (
            <div className="cursor-grabbing rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-lg">
              {activeRecipe.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
