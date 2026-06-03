import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useNavigate, useParams } from 'react-router-dom'
import { sanitizeRecipeListLine, sanitizeRecipeTextLine } from '../lib/recipeParser'
import { supabase } from '../lib/supabase'
import type { Ingredient, Recipe } from '../types/database'

type RecipeEditPageProps = {
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

export default function RecipeEditPage({ session }: RecipeEditPageProps) {
  const { recipeId } = useParams<{ recipeId: string }>()
  const navigate = useNavigate()

  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [name, setName] = useState('')
  const [ingredientsText, setIngredientsText] = useState('')
  const [instructions, setInstructions] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [rating, setRating] = useState('')
  const [notes, setNotes] = useState('')
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!recipeId) return

    async function loadRecipe() {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', recipeId)
        .eq('user_id', session.user.id)
        .single()

      if (error || !data) {
        setNotFound(true)
        setIsLoading(false)
        return
      }

      const recipe = data as Recipe
      setName(recipe.name)
      setIngredientsText(recipe.ingredients.map((i) => i.name).join('\n'))
      setInstructions(recipe.instructions)
      setTagsText(recipe.tags.join(', '))
      setRating(recipe.rating?.toString() ?? '')
      setNotes(recipe.notes ?? '')
      setCurrentImageUrl(recipe.image_url)
      setIsLoading(false)
    }

    void loadRecipe()
  }, [recipeId, session.user.id])

  async function handleSave(event: FormEvent<HTMLFormElement>) {
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
      setSaveMessage('Add at least one ingredient.')
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

    const parsedTags = tagsText.split(',').map(sanitizeRecipeTextLine).filter(Boolean)

    setIsSaving(true)

    let finalImageUrl: string | null = currentImageUrl
    if (imageFile) {
      try {
        finalImageUrl = await fileToDataUrl(imageFile)
      } catch {
        setSaveMessage('Failed to read the image file.')
        setIsSaving(false)
        return
      }
    }

    const { error } = await supabase
      .from('recipes')
      .update({
        name: trimmedName,
        ingredients: parsedIngredients,
        instructions: trimmedInstructions,
        tags: parsedTags,
        rating: parsedRating,
        notes: sanitizeMultilineText(notes) || null,
        image_url: finalImageUrl,
      })
      .eq('id', recipeId ?? '')
      .eq('user_id', session.user.id)

    if (error) {
      setSaveMessage(error.message)
      setIsSaving(false)
      return
    }

    navigate('/', { state: { newRecipeId: recipeId } })
  }

  async function handleDelete() {
    setIsDeleting(true)

    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', recipeId ?? '')
      .eq('user_id', session.user.id)

    if (error) {
      setSaveMessage(error.message)
      setIsDeleting(false)
      setShowDeleteConfirm(false)
      return
    }

    navigate('/')
  }

  if (isLoading) {
    return <div className="p-8 text-sm text-gray-600">Loading recipe...</div>
  }

  if (notFound) {
    return <div className="p-8 text-sm text-gray-600">Recipe not found.</div>
  }

  return (
    <div className="p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-950">Edit Recipe</h1>
        <p className="mt-2 text-gray-700">Update the details below, then save your changes.</p>
      </div>

      <div className="mt-8 rounded-lg border border-gray-300 bg-white p-5 shadow-sm">
        <form className="grid gap-4" onSubmit={handleSave}>
          <label className="text-sm font-semibold text-gray-800">
            Name
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-400 bg-gray-50 px-3 py-2 text-gray-950 focus:border-gray-900 focus:outline-none"
            />
          </label>

          <label className="text-sm font-semibold text-gray-800">
            Ingredients
            <textarea
              value={ingredientsText}
              onChange={(event) => setIngredientsText(event.target.value)}
              className="mt-1 min-h-28 w-full rounded-md border border-gray-400 bg-gray-50 px-3 py-2 text-gray-950 focus:border-gray-900 focus:outline-none"
            />
          </label>

          <label className="text-sm font-semibold text-gray-800">
            Instructions
            <textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              className="mt-1 min-h-28 w-full rounded-md border border-gray-400 bg-gray-50 px-3 py-2 text-gray-950 focus:border-gray-900 focus:outline-none"
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
              />
            </label>
          </div>

          <label className="text-sm font-semibold text-gray-800">
            Notes (optional)
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-1 min-h-20 w-full rounded-md border border-gray-400 bg-gray-50 px-3 py-2 text-gray-950 focus:border-gray-900 focus:outline-none"
            />
          </label>

          <label className="text-sm font-semibold text-gray-800">
            Photo (optional)
            {currentImageUrl && !imageFile ? (
              <div className="mt-1 flex items-center gap-3">
                <img src={currentImageUrl} alt="" className="h-16 w-16 rounded-md object-cover border border-gray-300" />
                <span className="text-sm text-gray-500">Current photo. Upload below to replace it.</span>
              </div>
            ) : null}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
              className="mt-1 block w-full cursor-pointer rounded-md border border-gray-400 bg-gray-50 px-3 py-2 text-sm text-gray-700 file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-gray-200 file:px-3 file:py-1 file:text-sm file:font-medium file:text-gray-700 focus:border-gray-900 focus:outline-none"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              disabled={isSaving}
              className="rounded-md border border-gray-400 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:border-gray-900 hover:text-gray-900 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isSaving}
              className="ml-auto rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:border-red-500 hover:bg-red-50 disabled:opacity-60"
            >
              Delete Recipe
            </button>
            {saveMessage ? <p className="w-full text-sm text-gray-700">{saveMessage}</p> : null}
          </div>
        </form>
      </div>

      {showDeleteConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-950">Delete &ldquo;{name}&rdquo;?</h2>
            <p className="mt-2 text-sm text-gray-600">This cannot be undone. The recipe will be permanently removed.</p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 rounded-md border border-gray-400 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:border-gray-900 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={isDeleting}
                className="flex-1 rounded-md border border-red-500 bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
