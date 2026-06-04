import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type NeedRow = {
  id: string
  ingredient_name: string
  recipe_id: string | null
  recipe_name: string | null
  recipe_db_id: string | null
  checked: boolean
}

type RecipeGroup = {
  recipe_id: string | null
  recipe_name: string | null
  items: NeedRow[]
}

type ShoppingListPageProps = {
  session: Session
}

export default function ShoppingListPage({ session }: ShoppingListPageProps) {
  const [groups, setGroups] = useState<RecipeGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('pantry_needs')
        .select('id, ingredient_name, recipe_id, recipes(id, name)')
        .eq('user_id', session.user.id)
        .order('ingredient_name')

      const rows: NeedRow[] = (data ?? []).map((r) => {
        const recipe = (Array.isArray(r.recipes) ? r.recipes[0] : r.recipes) as { id: string; name: string } | null
        return {
          id: r.id as string,
          ingredient_name: r.ingredient_name as string,
          recipe_id: r.recipe_id as string | null,
          recipe_name: recipe?.name ?? null,
          recipe_db_id: recipe?.id ?? null,
          checked: false,
        }
      })

      // Group by recipe_id, preserving insertion order
      const groupMap = new Map<string | null, RecipeGroup>()
      for (const row of rows) {
        const key = row.recipe_id ?? null
        if (!groupMap.has(key)) {
          groupMap.set(key, { recipe_id: key, recipe_name: row.recipe_name, items: [] })
        }
        groupMap.get(key)!.items.push(row)
      }

      setGroups(Array.from(groupMap.values()))
      setIsLoading(false)
    }
    void load()
  }, [session.user.id])

  function toggleItem(id: string) {
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        items: group.items.map((item) =>
          item.id === id ? { ...item, checked: !item.checked } : item,
        ),
      })),
    )
  }

  const totalCount = groups.reduce((n, g) => n + g.items.length, 0)

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-950">Shopping List</h1>
        <p className="mt-1 text-sm text-gray-500">
          {totalCount === 0
            ? 'No items flagged as needed.'
            : `${totalCount} item${totalCount === 1 ? '' : 's'} needed`}
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : groups.length === 0 ? (
        <div className="max-w-md rounded-lg border border-gray-200 bg-white p-6 text-center">
          <p className="text-sm text-gray-500">No items flagged as needed.</p>
          <p className="mt-1 text-xs text-gray-400">
            Open a recipe in cook mode and toggle the Need? column for ingredients you're out of.
          </p>
        </div>
      ) : (
        <div className="flex max-w-md flex-col gap-4">
          {groups.map((group) => (
            <div
              key={group.recipe_id ?? 'no-recipe'}
              className="rounded-lg border border-gray-200 bg-white"
            >
              <div className="border-b border-gray-100 px-4 py-3">
                {group.recipe_id ? (
                  <Link
                    to={`/recipes/${group.recipe_id}/cook`}
                    className="font-semibold text-gray-900 hover:text-blue-600 hover:underline"
                  >
                    {group.recipe_name ?? 'Untitled recipe'}
                  </Link>
                ) : (
                  <span className="font-semibold text-gray-500">Other</span>
                )}
              </div>

              <ul className="divide-y divide-gray-100">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggleItem(item.id)}
                        className="shrink-0 accent-gray-800"
                      />
                      <span
                        className={
                          item.checked
                            ? 'text-sm text-gray-400 line-through'
                            : 'text-sm text-gray-800'
                        }
                      >
                        {item.ingredient_name}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
