import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useNavigate } from 'react-router-dom'
import RecipeIndex from '../components/RecipeIndex'
import { sanitizeRecipeListLine, sanitizeRecipeTextLine } from '../lib/recipeParser'
import { supabase } from '../lib/supabase'
import { PREP_TIMINGS } from '../types/database'
import type { Ingredient, PrepTask, PrepTiming, Recipe } from '../types/database'

type RecipesPageProps = {
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

export default function RecipesPage({ session }: RecipesPageProps) {
  const navigate = useNavigate()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [importUrl, setImportUrl] = useState('')
  const [importText, setImportText] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [parseMessage, setParseMessage] = useState<string | null>(null)
  const [activeLetter, setActiveLetter] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [ingredientsText, setIngredientsText] = useState('')
  const [instructions, setInstructions] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [rating, setRating] = useState('')
  const [notes, setNotes] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [importedImageUrl, setImportedImageUrl] = useState<string | null | undefined>(undefined)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const [prepTasks, setPrepTasks] = useState<PrepTask[]>([])
  const [newPrepTask, setNewPrepTask] = useState('')
  const [newPrepTiming, setNewPrepTiming] = useState<PrepTiming>('day_before')
  const [newPrepNotify, setNewPrepNotify] = useState(false)

  function clearRecipeForm() {
    setImportText('')
    setParseMessage(null)
    setName('')
    setIngredientsText('')
    setInstructions('')
    setTagsText('')
    setRating('')
    setNotes('')
    setImageFile(null)
    setImportedImageUrl(undefined)
    setPrepTasks([])
    setNewPrepTask('')
    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  function addPrepTask() {
    if (!newPrepTask.trim()) return
    setPrepTasks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), task: newPrepTask.trim(), timing: newPrepTiming, notify: newPrepNotify },
    ])
    setNewPrepTask('')
  }

  function removePrepTask(id: string) {
    setPrepTasks((prev) => prev.filter((pt) => pt.id !== id))
  }

  async function handleImport(type: 'text' | 'url', content: string) {
    if (!content.trim()) return

    setIsImporting(true)
    setParseMessage(null)

    try {
      const res = await fetch('/api/parse-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content }),
      })

      const data = await res.json() as {
        name?: string
        ingredients?: string[]
        instructions?: string
        notes?: string
        imageUrl?: string | null
        error?: string
      }

      if (!res.ok || data.error) {
        setParseMessage(data.error ?? 'Import failed.')
        return
      }

      if (data.name) setName(data.name)
      if (data.ingredients?.length) setIngredientsText(data.ingredients.join('\n'))
      if (data.instructions) setInstructions(data.instructions)
      if (data.notes) setNotes(data.notes)
      if (type === 'url') setImportedImageUrl(data.imageUrl ?? null)

      setParseMessage('Recipe imported. Review and save.')
    } catch {
      setParseMessage('Import failed. Check your connection and try again.')
    } finally {
      setIsImporting(false)
    }
  }

  function parseIngredients(value: string): Ingredient[] {
    return value
      .split('\n')
      .map(sanitizeRecipeListLine)
      .filter(Boolean)
      .map((line) => ({ name: line, amount: '', unit: '' }))
  }

  function sanitizeMultilineText(value: string): string {
    return value
      .split('\n')
      .map(sanitizeRecipeListLine)
      .filter(Boolean)
      .join('\n')
  }

  async function handleCreateRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaveMessage(null)

    const trimmedName = sanitizeRecipeTextLine(name)
    const trimmedInstructions = sanitizeMultilineText(instructions)
    const parsedIngredients = parseIngredients(ingredientsText)

    if (!trimmedName) {
      setSaveMessage('Recipe name is required.')
      return
    }

    if (parsedIngredients.length === 0) {
      setSaveMessage('Add at least one ingredient (one per line).')
      return
    }

    if (!trimmedInstructions) {
      setSaveMessage('Instructions are required.')
      return
    }

    const parsedRating = rating ? Number(rating) : null
    if (parsedRating !== null && (Number.isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5)) {
      setSaveMessage('Rating must be between 1 and 5.')
      return
    }

    const parsedTags = tagsText
      .split(',')
      .map(sanitizeRecipeTextLine)
      .filter(Boolean)

    setIsSaving(true)

    let finalImageUrl: string | null = importedImageUrl ?? null

    if (imageFile) {
      try {
        finalImageUrl = await fileToDataUrl(imageFile)
      } catch {
        setSaveMessage('Failed to read the image file.')
        setIsSaving(false)
        return
      }
    }

    const { data, error } = await supabase
      .from('recipes')
      .insert({
        user_id: session.user.id,
        name: trimmedName,
        ingredients: parsedIngredients,
        instructions: trimmedInstructions,
        tags: parsedTags,
        rating: parsedRating,
        notes: sanitizeMultilineText(notes) || null,
        image_url: finalImageUrl,
        prep_tasks: prepTasks,
      })
      .select('*')
      .single()

    if (error) {
      setSaveMessage(error.message)
      setIsSaving(false)
      return
    }

    setIsSaving(false)
    navigate('/', { state: { newRecipeId: (data as Recipe).id } })
  }

  useEffect(() => {
    let isMounted = true

    async function loadRecipes() {
      setIsLoading(true)
      setErrorMessage(null)

      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

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

  return (
    <div className="p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-950">Add Recipe</h1>
        <p className="mt-2 text-gray-700">Paste recipe text to auto-fill, then review and save.</p>
      </div>

      <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="rounded-lg border border-gray-300 bg-white p-5 shadow-sm">
          <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
            <label className="block text-sm font-semibold text-gray-800">
              Import from URL
              <div className="mt-1 flex gap-2">
                <input
                  type="url"
                  value={importUrl}
                  onChange={(event) => setImportUrl(event.target.value)}
                  placeholder="https://www.anyrecipesite.com/best-tacos"
                  className="flex-1 rounded-md border border-gray-400 bg-white px-3 py-2 text-sm text-gray-950 focus:border-gray-900 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={isImporting || !importUrl.trim()}
                  onClick={() => void handleImport('url', importUrl)}
                  className="rounded-md border border-gray-400 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:border-gray-900 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isImporting ? 'Fetching…' : 'Fetch'}
                </button>
              </div>
            </label>

            <div className="relative my-4 flex items-center">
              <div className="flex-1 border-t border-gray-300" />
              <span className="mx-3 text-sm font-semibold text-gray-600">or paste text</span>
              <div className="flex-1 border-t border-gray-300" />
            </div>

            <label className="block text-sm font-semibold text-gray-800">
              Paste Recipe Text
              <textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                className="mt-1 min-h-32 w-full rounded-md border border-gray-400 bg-white px-3 py-2 text-gray-950 focus:border-gray-900 focus:outline-none"
                placeholder={"Best Chicken Tacos\n\nIngredients\n1 lb chicken thighs\n1 tsp salt\n\nInstructions\nSeason chicken and cook..."}
              />
            </label>

            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                disabled={isImporting || !importText.trim()}
                onClick={() => void handleImport('text', importText)}
                className="rounded-md border border-gray-400 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:border-gray-900 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isImporting ? 'Importing…' : 'Import from Text'}
              </button>
              {parseMessage ? <p className="text-sm text-gray-700">{parseMessage}</p> : null}
            </div>
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 border-t border-gray-300" />
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Recipe Details</span>
            <div className="flex-1 border-t border-gray-300" />
          </div>

          <form className="grid gap-4" onSubmit={handleCreateRecipe}>
            <label className="text-sm font-semibold text-gray-800">
              Name
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-400 bg-gray-50 px-3 py-2 text-gray-950 focus:border-gray-900 focus:outline-none"
                placeholder="Weeknight tacos"
              />
            </label>

            <label className="text-sm font-semibold text-gray-800">
              Ingredients
              <textarea
                value={ingredientsText}
                onChange={(event) => setIngredientsText(event.target.value)}
                className="mt-1 min-h-28 w-full rounded-md border border-gray-400 bg-gray-50 px-3 py-2 text-gray-950 focus:border-gray-900 focus:outline-none"
                placeholder={"1 lb ground turkey\n1 tbsp olive oil\n1 packet taco seasoning"}
              />
            </label>

            <label className="text-sm font-semibold text-gray-800">
              Instructions
              <textarea
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                className="mt-1 min-h-28 w-full rounded-md border border-gray-400 bg-gray-50 px-3 py-2 text-gray-950 focus:border-gray-900 focus:outline-none"
                placeholder="Brown the meat, add seasoning, simmer, then serve with toppings."
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-gray-800">
                Tags
                <input
                  type="text"
                  value={tagsText}
                  onChange={(event) => setTagsText(event.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-400 bg-gray-50 px-3 py-2 text-gray-950 focus:border-gray-900 focus:outline-none"
                  placeholder="quick, family"
                />
              </label>

              <label className="text-sm font-semibold text-gray-800">
                Rating (optional)
                <input
                  type="number"
                  value={rating}
                  onChange={(event) => setRating(event.target.value)}
                  min={1}
                  max={5}
                  className="mt-1 w-full rounded-md border border-gray-400 bg-gray-50 px-3 py-2 text-gray-950 focus:border-gray-900 focus:outline-none"
                  placeholder="5"
                />
              </label>
            </div>

            <label className="text-sm font-semibold text-gray-800">
              Notes (optional)
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="mt-1 min-h-20 w-full rounded-md border border-gray-400 bg-gray-50 px-3 py-2 text-gray-950 focus:border-gray-900 focus:outline-none"
                placeholder="Kids liked this with extra cheese."
              />
            </label>

            <div>
              <p className="text-sm font-semibold text-gray-800">Advanced Prep (optional)</p>
              <p className="mt-0.5 mb-2 text-xs text-gray-500">Steps to complete ahead of time — marinating, sous vide, thawing, etc.</p>

              {prepTasks.length > 0 && (
                <ul className="mb-2 divide-y divide-gray-100 rounded-md border border-gray-200 bg-gray-50">
                  {prepTasks.map((pt) => (
                    <li key={pt.id} className="flex items-center gap-3 px-3 py-2">
                      <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{pt.task}</span>
                      <span className="shrink-0 text-xs text-gray-400">{PREP_TIMINGS[pt.timing]}</span>
                      {pt.notify && (
                        <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" viewBox="0 0 16 16" fill="currentColor" aria-label="Remind me">
                          <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2zm.995-14.901a1 1 0 1 0-1.99 0A5.002 5.002 0 0 0 3 6c0 1.098-.5 6-2 7h14c-1.5-1-2-5.902-2-7 0-2.42-1.72-4.44-4.005-4.901z"/>
                        </svg>
                      )}
                      <button
                        type="button"
                        onClick={() => removePrepTask(pt.id)}
                        aria-label={`Remove ${pt.task}`}
                        className="shrink-0 text-base leading-none text-gray-400 hover:text-red-500"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={newPrepTask}
                  onChange={(e) => setNewPrepTask(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPrepTask() } }}
                  placeholder="e.g. Marinate chicken"
                  className="min-w-0 flex-1 rounded-md border border-gray-400 bg-gray-50 px-3 py-2 text-sm text-gray-950 focus:border-gray-900 focus:outline-none"
                />
                <select
                  value={newPrepTiming}
                  onChange={(e) => setNewPrepTiming(e.target.value as PrepTiming)}
                  className="rounded-md border border-gray-400 bg-gray-50 px-2 py-2 text-sm text-gray-700 focus:border-gray-900 focus:outline-none"
                >
                  {Object.entries(PREP_TIMINGS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <label className="flex cursor-pointer items-center gap-1.5 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={newPrepNotify}
                    onChange={(e) => setNewPrepNotify(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Remind me
                </label>
                <button
                  type="button"
                  onClick={addPrepTask}
                  disabled={!newPrepTask.trim()}
                  className="rounded-md border border-gray-400 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-gray-900 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>

            <label className="text-sm font-semibold text-gray-800">
              Photo (optional)
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                className="mt-1 block w-full cursor-pointer rounded-md border border-gray-400 bg-gray-50 px-3 py-2 text-sm text-gray-700 file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-gray-200 file:px-3 file:py-1 file:text-sm file:font-medium file:text-gray-700 focus:border-gray-900 focus:outline-none"
              />
            </label>
            {!imageFile && importedImageUrl !== undefined ? (
              importedImageUrl ? (
                <div className="flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <img src={importedImageUrl} alt="" className="h-10 w-10 rounded object-cover" />
                  <p className="text-sm text-emerald-800">Image captured from URL. Upload a photo above to replace it.</p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No image found at that URL. You can upload one above.</p>
              )
            ) : null}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : 'Save Recipe'}
              </button>
              <button
                type="button"
                onClick={clearRecipeForm}
                disabled={isSaving}
                className="rounded-md border border-gray-400 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:border-gray-900 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Clear
              </button>
              {saveMessage ? <p className="text-sm text-gray-700">{saveMessage}</p> : null}
            </div>
          </form>
        </div>

        <RecipeIndex
          recipes={recipes}
          activeLetter={activeLetter}
          onActiveLetterChange={setActiveLetter}
        />
      </section>

      {isLoading ? <p className="mt-8 text-sm text-gray-500">Loading recipes...</p> : null}

      {errorMessage ? (
        <div className="mt-8 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {!isLoading && !errorMessage && recipes.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-gray-300 bg-white p-8 text-sm text-gray-500">
          No recipes yet. Add your first recipe above.
        </div>
      ) : null}
    </div>
  )
}
