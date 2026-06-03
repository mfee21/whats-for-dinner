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

const SLOTS = ['breakfast', 'lunch', 'dinner'] as const
type Slot = typeof SLOTS[number]

const SLOT_LABELS: Record<Slot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
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

function DroppableSlot({
  dropId,
  slot,
  recipe,
  isPast,
  onRemove,
  onRandom,
}: {
  dropId: string
  slot: Slot
  recipe: Recipe | undefined
  isPast: boolean
  onRemove: () => void
  onRandom: () => void
}) {
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const { isOver, setNodeRef } = useDroppable({ id: dropId, disabled: isPast })

  return (
    <div ref={setNodeRef} className="flex flex-col gap-1">
      <p className={`text-[10px] font-semibold uppercase tracking-wide ${isPast ? 'text-gray-300' : 'text-gray-400'}`}>
        {SLOT_LABELS[slot]}
      </p>

      {recipe ? (
        <div className={`group relative rounded border px-2 py-1.5 ${isPast ? 'border-gray-200 bg-gray-100' : isOver ? 'border-gray-400 bg-gray-100' : 'border-gray-200 bg-gray-50'}`}>
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
              {isPast ? (
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(true)}
                  aria-label="Remove meal"
                  className="absolute right-1 top-1 hidden text-sm leading-none text-gray-400 hover:text-gray-600 group-hover:block"
                >
                  ×
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onRemove}
                  aria-label="Remove meal"
                  className="absolute right-1 top-1 hidden text-sm leading-none text-gray-400 hover:text-red-500 group-hover:block"
                >
                  ×
                </button>
              )}
            </>
          )}
        </div>
      ) : isPast ? (
        <p className="text-xs text-gray-300">—</p>
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
      )}
    </div>
  )
}

function DroppableDay({
  date,
  getRecipeForSlot,
  onRemoveSlot,
  onRandomSlot,
}: {
  date: Date
  getRecipeForSlot: (slot: Slot) => Recipe | undefined
  onRemoveSlot: (slot: Slot) => void
  onRandomSlot: (slot: Slot) => void
}) {
  const dateStr = localDateStr(date)
  const todayStr = localDateStr(new Date())
  const isToday = dateStr === todayStr
  const isPast = dateStr < todayStr

  return (
    <div
      className={`flex min-w-0 flex-col gap-3 rounded-lg border p-2 ${
        isPast ? 'border-gray-200 bg-gray-50' : 'border-gray-300 bg-white'
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

      {SLOTS.map((slot) => (
        <DroppableSlot
          key={slot}
          dropId={`${dateStr}:${slot}`}
          slot={slot}
          recipe={getRecipeForSlot(slot)}
          isPast={isPast}
          onRemove={() => onRemoveSlot(slot)}
          onRandom={() => onRandomSlot(slot)}
        />
      ))}
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

  function getMealPlanForSlot(date: Date, slot: string): MealPlan | undefined {
    return mealPlans.find(
      (mp) => mp.planned_date === localDateStr(date) && mp.meal_slot === slot,
    )
  }

  function getRecipeForSlot(date: Date, slot: string): Recipe | undefined {
    const plan = getMealPlanForSlot(date, slot)
    if (!plan) return undefined
    return recipes.find((r) => r.id === plan.recipe_id)
  }

  async function assignMeal(date: Date, slot: string, recipeId: string) {
    const existing = getMealPlanForSlot(date, slot)

    if (existing) {
      const { data, error } = await supabase
        .from('meal_plans')
        .update({ recipe_id: recipeId })
        .eq('id', existing.id)
        .select('*')
        .single()

      if (error) { setErrorMessage(error.message); return }
      setMealPlans((prev) => prev.map((mp) => (mp.id === existing.id ? (data as MealPlan) : mp)))
    } else {
      const { data, error } = await supabase
        .from('meal_plans')
        .insert({
          user_id: session.user.id,
          recipe_id: recipeId,
          planned_date: localDateStr(date),
          meal_slot: slot,
        })
        .select('*')
        .single()

      if (error) { setErrorMessage(error.message); return }
      setMealPlans((prev) => [...prev, data as MealPlan])
    }
  }

  async function removeMeal(date: Date, slot: string) {
    const existing = getMealPlanForSlot(date, slot)
    if (!existing) return

    const { error } = await supabase.from('meal_plans').delete().eq('id', existing.id)

    if (error) { setErrorMessage(error.message); return }
    setMealPlans((prev) => prev.filter((mp) => mp.id !== existing.id))
  }

  function assignRandomMeal(date: Date, slot: string) {
    if (recipes.length === 0) return
    const pick = recipes[Math.floor(Math.random() * recipes.length)]
    void assignMeal(date, slot, pick.id)
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveRecipe(recipes.find((r) => r.id === String(event.active.id)) ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveRecipe(null)
    const { active, over } = event
    if (!over) return

    const recipeId = String(active.id)
    const overId = String(over.id) // "YYYY-MM-DD:slot"
    const colonIdx = overId.lastIndexOf(':')
    const dateStr = overId.slice(0, colonIdx)
    const slot = overId.slice(colonIdx + 1)
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)

    void assignMeal(date, slot, recipeId)
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
                  getRecipeForSlot={(slot) => getRecipeForSlot(date, slot)}
                  onRemoveSlot={(slot) => void removeMeal(date, slot)}
                  onRandomSlot={(slot) => assignRandomMeal(date, slot)}
                />
              ))}
            </div>
          </div>

          <aside>
            <h2 className="text-sm font-semibold text-gray-700">Recipes</h2>
            <p className="mt-0.5 text-xs text-gray-600">Drag onto a slot to plan it.</p>
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
