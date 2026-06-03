import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Link, useParams } from 'react-router-dom'
import { sanitizeRecipeListLine } from '../lib/recipeParser'
import { supabase } from '../lib/supabase'
import type { Recipe } from '../types/database'

async function syncToAnyList(
  action: 'add' | 'remove',
  ingredientName: string,
  accessToken: string,
) {
  try {
    await fetch('/api/anylist-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ action, ingredientName }),
    })
  } catch {
    // Best-effort — AnyList sync failure never blocks the UI
  }
}

function AnyListToggle({ added, onClick }: { added: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={added ? 'Remove from AnyList' : 'Add to AnyList'}
      className="relative shrink-0 transition-opacity hover:opacity-80 active:scale-95"
    >
      {/* Icon tile — blue when added, gray when not */}
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
          added ? 'bg-blue-500' : 'bg-gray-200'
        }`}
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
          {/* Three list rows: mark on left, line on right */}
          {added ? (
            <>
              {/* Checkmarks */}
              <polyline points="2,4.5 3.2,6 4.5,3.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="2,8 3.2,9.5 4.5,7" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="2,11.5 3.2,13 4.5,10.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </>
          ) : (
            <>
              {/* Empty bullet dots */}
              <circle cx="3" cy="4.5" r="1.1" fill="#9CA3AF"/>
              <circle cx="3" cy="8" r="1.1" fill="#9CA3AF"/>
              <circle cx="3" cy="11.5" r="1.1" fill="#9CA3AF"/>
            </>
          )}
          {/* Horizontal lines */}
          <line x1="6" y1="4.5" x2="13" y2="4.5" stroke={added ? 'white' : '#9CA3AF'} strokeWidth="1.4" strokeLinecap="round"/>
          <line x1="6" y1="8" x2="13" y2="8" stroke={added ? 'white' : '#9CA3AF'} strokeWidth="1.4" strokeLinecap="round"/>
          <line x1="6" y1="11.5" x2="13" y2="11.5" stroke={added ? 'white' : '#9CA3AF'} strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      </span>

      {/* Green checkmark badge when added */}
      {added && (
        <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-green-500 ring-1 ring-white">
          <svg width="7" height="7" viewBox="0 0 7 7" fill="none" aria-hidden="true">
            <polyline points="1,3.5 2.8,5.5 6,1.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      )}
    </button>
  )
}

type RecipeCookPageProps = {
  session: Session
}

function instructionStepsFromText(text: string): string[] {
  return text
    .split('\n')
    .map(sanitizeRecipeListLine)
    .filter(Boolean)
}

export default function RecipeCookPage({ session }: RecipeCookPageProps) {
  const { recipeId } = useParams<{ recipeId: string }>()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({})
  const [neededIngredients, setNeededIngredients] = useState<Set<string>>(new Set())

  const steps = useMemo(() => instructionStepsFromText(recipe?.instructions ?? ''), [recipe?.instructions])

  const progressKey = recipe
    ? `cook-progress:${session.user.id}:${recipe.id}`
    : `cook-progress:${session.user.id}:unknown`

  useEffect(() => {
    let isMounted = true

    async function loadRecipe() {
      if (!recipeId) {
        setErrorMessage('Recipe id is missing.')
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setErrorMessage(null)

      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', recipeId)
        .eq('user_id', session.user.id)
        .single()

      if (!isMounted) {
        return
      }

      if (error || !data) {
        setErrorMessage(error?.message ?? 'Recipe not found.')
        setRecipe(null)
        setIsLoading(false)
        return
      }

      setRecipe(data as Recipe)
      setIsLoading(false)
    }

    void loadRecipe()

    return () => {
      isMounted = false
    }
  }, [recipeId, session.user.id])

  useEffect(() => {
    if (!recipe) {
      return
    }

    try {
      const raw = window.localStorage.getItem(progressKey)
      if (!raw) {
        setCheckedSteps({})
        return
      }

      const parsed = JSON.parse(raw) as Record<string, boolean>
      const normalized = Object.entries(parsed).reduce<Record<number, boolean>>((acc, [key, value]) => {
        const index = Number(key)
        if (!Number.isNaN(index) && value) {
          acc[index] = true
        }
        return acc
      }, {})

      setCheckedSteps(normalized)
    } catch {
      setCheckedSteps({})
    }
  }, [progressKey, recipe])

  useEffect(() => {
    async function loadNeeds() {
      const { data } = await supabase
        .from('pantry_needs')
        .select('ingredient_name')
        .eq('user_id', session.user.id)
      if (data) setNeededIngredients(new Set(data.map((r) => r.ingredient_name as string)))
    }
    void loadNeeds()
  }, [session.user.id])

  async function toggleNeed(ingredientName: string) {
    const isNeeded = neededIngredients.has(ingredientName)

    setNeededIngredients((prev) => {
      const next = new Set(prev)
      isNeeded ? next.delete(ingredientName) : next.add(ingredientName)
      return next
    })

    if (isNeeded) {
      await supabase
        .from('pantry_needs')
        .delete()
        .eq('user_id', session.user.id)
        .eq('ingredient_name', ingredientName)
    } else {
      await supabase.from('pantry_needs').insert({ user_id: session.user.id, ingredient_name: ingredientName })
    }

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (token) void syncToAnyList(isNeeded ? 'remove' : 'add', ingredientName, token)
  }

  function toggleStep(index: number) {
    setCheckedSteps((previous) => {
      const next = { ...previous, [index]: !previous[index] }
      try {
        window.localStorage.setItem(progressKey, JSON.stringify(next))
      } catch {
        // Ignore localStorage failures and keep in-memory progress.
      }
      return next
    })
  }

  function clearProgress() {
    setCheckedSteps({})
    try {
      window.localStorage.removeItem(progressKey)
    } catch {
      // Ignore localStorage failures and keep in-memory progress.
    }
  }

  if (isLoading) {
    return <div className="p-8 text-sm text-gray-600">Loading recipe...</div>
  }

  if (errorMessage || !recipe) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-700">{errorMessage ?? 'Recipe unavailable.'}</p>
        <Link
          to="/"
          className="mt-4 inline-flex rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-gray-900 hover:text-gray-900"
        >
          Back to recipes
        </Link>
      </div>
    )
  }

  const completedCount = steps.filter((_step, index) => checkedSteps[index]).length

  return (
    <div className="p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Cook Mode</p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">{recipe.name}</h1>
          <p className="mt-2 text-sm text-gray-500">
            {completedCount}/{steps.length} steps completed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clearProgress}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-gray-900 hover:text-gray-900"
          >
            Reset checkboxes
          </button>
          <Link
            to={`/recipes/${recipeId}/edit`}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-gray-900 hover:text-gray-900"
          >
            Edit
          </Link>
          <Link
            to="/"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-gray-900 hover:text-gray-900"
          >
            Back to recipes
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Instructions</h2>
          {steps.length > 0 ? (
            <ol className="mt-4 grid gap-3">
              {steps.map((step, index) => (
                <li key={`${index}-${step}`} className="rounded-md border border-gray-200 p-3">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={Boolean(checkedSteps[index])}
                      onChange={() => toggleStep(index)}
                      className="mt-1 h-4 w-4 rounded border-gray-300"
                    />
                    <span className={checkedSteps[index] ? 'text-sm text-gray-400 line-through' : 'text-sm text-gray-700'}>
                      <span className="mr-2 font-semibold text-gray-500">{index + 1}.</span>
                      {step}
                    </span>
                  </label>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-gray-500">No instruction steps available for this recipe.</p>
          )}
        </section>

        <aside className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm lg:sticky lg:top-24 lg:self-start">
          <h2 className="text-lg font-semibold text-gray-900">Ingredients</h2>
          {recipe.ingredients.length > 0 ? (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-2 text-left font-medium text-gray-500">Ingredient</th>
                  <th className="pb-2 text-center font-medium text-gray-500">Need?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recipe.ingredients.map((ingredient, index) => {
                  const cleanName = sanitizeRecipeListLine(ingredient.name)
                  const amountPart = ingredient.amount.trim()
                  const unitPart = ingredient.unit.trim()
                  const prefix = [amountPart, unitPart].filter(Boolean).join(' ')
                  const isNeeded = neededIngredients.has(cleanName)

                  return (
                    <tr key={`${ingredient.name}-${index}`}>
                      <td className="py-2 pr-3 text-gray-700">
                        {prefix ? `${prefix} ${cleanName}` : cleanName}
                      </td>
                      <td className="py-2 text-center">
                        <AnyListToggle added={isNeeded} onClick={() => void toggleNeed(cleanName)} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <p className="mt-3 text-sm text-gray-500">No ingredients found.</p>
          )}
        </aside>
      </div>
    </div>
  )
}
