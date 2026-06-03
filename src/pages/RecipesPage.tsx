import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useNavigate } from 'react-router-dom'
import RecipeIndex from '../components/RecipeIndex'
import { parseRecipeText, sanitizeRecipeListLine, sanitizeRecipeTextLine } from '../lib/recipeParser'
import { supabase } from '../lib/supabase'
import type { Ingredient, Recipe } from '../types/database'

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
  const [importText, setImportText] = useState('')
  const [parseMessage, setParseMessage] = useState<string | null>(null)
  const [activeLetter, setActiveLetter] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [ingredientsText, setIngredientsText] = useState('')
  const [instructions, setInstructions] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [rating, setRating] = useState('')
  const [notes, setNotes] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

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
    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  function handleParseImportText() {
    const parsed = parseRecipeText(importText)

    if (!parsed.name && parsed.ingredients.length === 0 && !parsed.instructions) {
      setParseMessage(parsed.warnings.join(' '))
      return
    }

    if (parsed.name) {
      setName(parsed.name)
    }

    if (parsed.ingredients.length > 0) {
      setIngredientsText(parsed.ingredients.join('\n'))
    }

    if (parsed.instructions) {
      setInstructions(parsed.instructions)
    }

    setParseMessage(
      parsed.warnings.length > 0
        ? `Imported with notes: ${parsed.warnings.join(' ')}`
        : 'Imported recipe text into the form. Review and save.',
    )
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

    let imageDataUrl: string | null = null
    if (imageFile) {
      try {
        imageDataUrl = await fileToDataUrl(imageFile)
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
        image_url: imageDataUrl,
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
          <label className="block text-sm font-semibold text-gray-800">
            Paste Recipe Text
            <textarea
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              className="mt-1 min-h-32 w-full rounded-md border border-gray-400 bg-gray-50 px-3 py-2 text-gray-950 focus:border-gray-900 focus:outline-none"
              placeholder={"Best Chicken Tacos\n\nIngredients\n1 lb chicken thighs\n1 tsp salt\n\nInstructions\nSeason chicken and cook..."}
            />
          </label>

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleParseImportText}
              className="rounded-md border border-gray-400 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:border-gray-900 hover:text-gray-900"
            >
              Import From Text
            </button>
            {parseMessage ? <p className="text-sm text-gray-700">{parseMessage}</p> : null}
          </div>

          <form className="mt-4 grid gap-4" onSubmit={handleCreateRecipe}>
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
