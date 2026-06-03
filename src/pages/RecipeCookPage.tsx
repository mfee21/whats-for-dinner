import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Link, useParams } from 'react-router-dom'
import { sanitizeRecipeListLine } from '../lib/recipeParser'
import { supabase } from '../lib/supabase'
import type { Recipe } from '../types/database'

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
          <ul className="mt-4 grid gap-2 text-sm text-gray-700">
            {recipe.ingredients.length > 0 ? (
              recipe.ingredients.map((ingredient, index) => {
                const cleanName = sanitizeRecipeListLine(ingredient.name)
                const amountPart = ingredient.amount.trim()
                const unitPart = ingredient.unit.trim()
                const prefix = [amountPart, unitPart].filter(Boolean).join(' ')

                return (
                  <li key={`${ingredient.name}-${index}`} className="rounded border border-gray-200 px-3 py-2">
                    {prefix ? `${prefix} ${cleanName}` : cleanName}
                  </li>
                )
              })
            ) : (
              <li className="text-gray-500">No ingredients found.</li>
            )}
          </ul>
        </aside>
      </div>
    </div>
  )
}
