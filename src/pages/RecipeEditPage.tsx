import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useNavigate, useParams } from 'react-router-dom'
import { sanitizeRecipeListLine, sanitizeRecipeTextLine } from '../lib/recipeParser'
import { supabase } from '../lib/supabase'
import { PREP_TIMINGS } from '../types/database'
import type { Ingredient, PrepTask, PrepTiming, Recipe } from '../types/database'

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

  const [prepTasks, setPrepTasks] = useState<PrepTask[]>([])
  const [newPrepTask, setNewPrepTask] = useState('')
  const [newPrepTiming, setNewPrepTiming] = useState<PrepTiming>('day_before')
  const [newPrepNotify, setNewPrepNotify] = useState(false)

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
      setPrepTasks((recipe.prep_tasks ?? []) as PrepTask[])
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
        prep_tasks: prepTasks,
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
