import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { sanitizeRecipeTextLine } from '../lib/recipeParser'
import type { Recipe } from '../types/database'

type RecipeIndexProps = {
  recipes: Recipe[]
  activeLetter: string | null
  onActiveLetterChange: (letter: string) => void
  title?: string
  description?: string
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function getRecipeLetter(name: string): string {
  const firstCharacter = sanitizeRecipeTextLine(name).charAt(0).toUpperCase()
  return /^[A-Z]$/.test(firstCharacter) ? firstCharacter : '#'
}

export default function RecipeIndex({
  recipes,
  activeLetter,
  onActiveLetterChange,
  title = 'Recipe Index',
  description = 'Choose a letter to reveal recipe titles.',
}: RecipeIndexProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const sortedRecipes = useMemo(
    () => [...recipes].sort((left, right) => left.name.localeCompare(right.name)),
    [recipes],
  )

  const recipesByLetter = useMemo(() => {
    return sortedRecipes.reduce<Record<string, Recipe[]>>((groups, recipe) => {
      const letter = getRecipeLetter(recipe.name)
      groups[letter] ??= []
      groups[letter].push(recipe)
      return groups
    }, {})
  }, [sortedRecipes])

  const availableLetters = useMemo(
    () => [...ALPHABET, '#'].filter((letter) => (recipesByLetter[letter] ?? []).length > 0),
    [recipesByLetter],
  )

  const selectedLetter = activeLetter && availableLetters.includes(activeLetter) ? activeLetter : (availableLetters[0] ?? null)
  const activeLetterRecipes = selectedLetter ? recipesByLetter[selectedLetter] ?? [] : []

  const trimmedQuery = searchQuery.trim().toLowerCase()
  const searchResults = trimmedQuery
    ? sortedRecipes.filter((r) => r.name.toLowerCase().includes(trimmedQuery))
    : null

  return (
    <aside className="rounded-lg border border-gray-300 bg-white p-4 shadow-sm">
      <input
        type="search"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder="Search recipes…"
        className="w-full rounded-md border border-gray-400 bg-gray-50 px-3 py-1.5 text-sm text-gray-950 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none"
      />

      <h2 className="mt-3 text-sm font-semibold text-gray-950">{title}</h2>
      <p className="mt-1 text-xs text-gray-700">{description}</p>

      {searchResults !== null ? (
        <div className="mt-3">
          {searchResults.length > 0 ? (
            <ul className="grid gap-2">
              {searchResults.map((recipe) => (
                <li key={recipe.id}>
                  <Link
                    to={`/recipes/${recipe.id}/cook`}
                    className="block rounded border border-gray-300 bg-gray-50 px-2 py-1.5 text-sm text-gray-800 hover:border-gray-900 hover:text-gray-900"
                  >
                    {recipe.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">No recipes match "{searchQuery.trim()}".</p>
          )}
        </div>
      ) : (
        <>
          <div className="mt-3 flex max-h-64 flex-col gap-1 overflow-auto pr-1">
            {ALPHABET.map((letter) => {
              const recipeCount = (recipesByLetter[letter] ?? []).length
              const hasRecipes = recipeCount > 0
              const isActive = selectedLetter === letter

              return (
                <button
                  key={letter}
                  type="button"
                  disabled={!hasRecipes}
                  onClick={() => onActiveLetterChange(letter)}
                  className={`flex items-center justify-between rounded px-2 py-1 text-left text-sm font-medium ${
                    isActive
                      ? 'bg-gray-900 text-white'
                      : hasRecipes
                        ? 'bg-gray-300 text-gray-900'
                        : 'cursor-not-allowed bg-gray-200 text-gray-500'
                  }`}
                >
                  <span>{letter}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : hasRecipes
                          ? 'bg-gray-400 text-gray-900'
                          : 'bg-gray-300 text-gray-500'
                    }`}
                  >
                    {recipeCount}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-4 border-t border-gray-200 pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {selectedLetter ? `Recipes: ${selectedLetter}` : 'Recipes'}
            </h3>
            {activeLetterRecipes.length > 0 ? (
              <ul className="mt-2 grid gap-2">
                {activeLetterRecipes.map((recipe) => (
                  <li key={recipe.id}>
                    <Link
                      to={`/recipes/${recipe.id}/cook`}
                      className="block rounded border border-gray-300 bg-gray-50 px-2 py-1.5 text-sm text-gray-800 hover:border-gray-900 hover:text-gray-900"
                    >
                      {recipe.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-gray-400">No recipes available yet.</p>
            )}
          </div>
        </>
      )}
    </aside>
  )
}
