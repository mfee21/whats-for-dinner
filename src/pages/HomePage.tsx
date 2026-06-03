import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, MouseEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Link, useLocation } from 'react-router-dom'
import RecipeIndex from '../components/RecipeIndex'
import { supabase } from '../lib/supabase'
import type { Recipe } from '../types/database'

type HomePageProps = {
  session: Session
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Failed to read image file.'))
    reader.readAsDataURL(file)
  })
}

export default function HomePage({ session }: HomePageProps) {
  const location = useLocation()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [activeLetter, setActiveLetter] = useState<string | null>(null)
  const [updatingImageRecipeId, setUpdatingImageRecipeId] = useState<string | null>(null)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [highlightedId, setHighlightedId] = useState<string | null>(
    (location.state as { newRecipeId?: string } | null)?.newRecipeId ?? null,
  )
  const highlightRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (highlightedId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightedId, recipes])

  useEffect(() => {
    if (!highlightedId) return
    const timer = setTimeout(() => setHighlightedId(null), 3000)
    return () => clearTimeout(timer)
  }, [highlightedId])

  useEffect(() => {
    let isMounted = true

    async function loadRecipes() {
      setIsLoading(true)
      setErrorMessage(null)

      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('user_id', session.user.id)
        .order('name', { ascending: true })

      if (!isMounted) {
        return
      }

      if (error) {
        setErrorMessage(error.message)
        setRecipes([])
        setIsLoading(false)
        return
      }

      setRecipes((data as Recipe[]) ?? [])
      setIsLoading(false)
    }

    void loadRecipes()

    return () => {
      isMounted = false
    }
  }, [session.user.id])

  async function handleRecipeImageChange(recipeId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please choose an image file.')
      return
    }

    setUpdatingImageRecipeId(recipeId)
    setErrorMessage(null)

    try {
      const imageDataUrl = await fileToDataUrl(file)
      const { data, error } = await supabase
        .from('recipes')
        .update({ image_url: imageDataUrl })
        .eq('id', recipeId)
        .eq('user_id', session.user.id)
        .select('*')
        .single()

      if (error) {
        setErrorMessage(error.message)
        setUpdatingImageRecipeId(null)
        return
      }

      setRecipes((previous) => previous.map((recipe) => (recipe.id === recipeId ? (data as Recipe) : recipe)))
    } catch {
      setErrorMessage('Failed to read the image file.')
    } finally {
      setUpdatingImageRecipeId(null)
      event.target.value = ''
    }
  }

  async function handleToggleFavorite(event: MouseEvent, recipeId: string, current: boolean) {
    event.preventDefault()
    const { data, error } = await supabase
      .from('recipes')
      .update({ favorited: !current })
      .eq('id', recipeId)
      .eq('user_id', session.user.id)
      .select('*')
      .single()

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setRecipes((previous) => previous.map((r) => (r.id === recipeId ? (data as Recipe) : r)))
  }

  const displayedRecipes = showFavoritesOnly ? recipes.filter((r) => r.favorited) : recipes

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-950">Home</h1>
          <p className="mt-2 text-gray-700">Browse your dishes and jump into cook mode quickly.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowFavoritesOnly((v) => !v)}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
            showFavoritesOnly
              ? 'border-red-300 bg-red-50 text-red-600'
              : 'border-gray-300 bg-white text-gray-700 hover:border-gray-900 hover:text-gray-900'
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill={showFavoritesOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          Favorites
        </button>
      </div>

      {errorMessage ? (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div>
      ) : null}

      <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="grid gap-4 content-start">
          {isLoading ? <p className="text-sm text-gray-600">Loading recipes...</p> : null}

          {!isLoading && displayedRecipes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-sm text-gray-500">
              {showFavoritesOnly ? 'No favorites yet. Click the heart on a recipe to save it here.' : 'No recipes yet. Use Add Recipe to create your first dish.'}
            </div>
          ) : null}

          {!isLoading && displayedRecipes.length > 0
            ? displayedRecipes.map((recipe) => (
                <article
                  key={recipe.id}
                  ref={highlightedId === recipe.id ? (el) => { highlightRef.current = el } : undefined}
                  className={`relative flex items-center justify-between gap-4 rounded-lg border bg-white px-4 shadow-sm transition-colors duration-700 ${
                    highlightedId === recipe.id
                      ? 'border-emerald-500 ring-2 ring-emerald-200'
                      : 'border-gray-300'
                  }`}
                >
                  <div className="min-w-0 flex-1 py-2">
                    <Link to={`/recipes/${recipe.id}/cook`} className="text-lg font-semibold text-gray-950 after:absolute after:inset-0 after:rounded-lg hover:underline">
                      {recipe.name}
                    </Link>
                    <p className="mt-1 text-sm text-gray-700">
                      {recipe.tags.length > 0 ? recipe.tags.join(', ') : 'No tags yet'}
                    </p>
                    <button
                      type="button"
                      aria-label={recipe.favorited ? 'Remove from favorites' : 'Add to favorites'}
                      onClick={(e) => void handleToggleFavorite(e, recipe.id, recipe.favorited)}
                      className="relative z-10 mt-1.5"
                    >
                      <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-colors ${recipe.favorited ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`} fill={recipe.favorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </button>
                  </div>

                  <div className="relative z-10 w-28 shrink-0 py-2">
                    <label className="relative block h-20 w-full cursor-pointer overflow-hidden rounded-md border border-gray-300 bg-gray-100">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => void handleRecipeImageChange(recipe.id, event)}
                      />
                      {recipe.image_url ? (
                        <img src={recipe.image_url} alt={recipe.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-2xl text-gray-500">📷</div>
                      )}
                      <span className="absolute inset-x-0 bottom-0 bg-black/50 py-0.5 text-center text-xs font-medium text-white">
                        {updatingImageRecipeId === recipe.id ? 'Uploading…' : recipe.image_url ? 'Change' : 'Add Photo'}
                      </span>
                    </label>
                  </div>
                </article>
              ))
            : null}
        </div>

        <RecipeIndex
          recipes={recipes}
          activeLetter={activeLetter}
          onActiveLetterChange={setActiveLetter}
          title="Recipe Index"
          description="Use this here too for quick jump-to-cook navigation."
        />
      </section>
    </div>
  )
}
