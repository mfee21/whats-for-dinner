import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type NeedItem = {
  id: string
  ingredient_name: string
  checked: boolean
}

type ShoppingListPageProps = {
  session: Session
}

async function syncRemoveToAnyList(ingredientName: string, accessToken: string) {
  try {
    await fetch('/api/anylist-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ action: 'remove', ingredientName }),
    })
  } catch {
    // Best-effort
  }
}

export default function ShoppingListPage({ session }: ShoppingListPageProps) {
  const [items, setItems] = useState<NeedItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('pantry_needs')
        .select('id, ingredient_name')
        .eq('user_id', session.user.id)
        .order('ingredient_name')

      setItems(
        (data ?? []).map((r) => ({
          id: r.id as string,
          ingredient_name: r.ingredient_name as string,
          checked: false,
        })),
      )
      setIsLoading(false)
    }
    void load()
  }, [session.user.id])

  async function toggleItem(item: NeedItem) {
    if (item.checked) {
      // Uncheck: just restore locally
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, checked: false } : i))
      return
    }

    // Check: mark locally first, then remove from DB + AnyList
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, checked: true } : i))

    await supabase.from('pantry_needs').delete().eq('id', item.id)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (token) void syncRemoveToAnyList(item.ingredient_name, token)

    // Remove from list after a short delay so the strikethrough is visible
    setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    }, 600)
  }

  const unchecked = items.filter((i) => !i.checked)
  const checked = items.filter((i) => i.checked)

  return (
    <div className="p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">Shopping List</h1>
          <p className="mt-1 text-sm text-gray-500">
            Ingredients flagged as needed in cook mode. Check off as you shop — items are removed automatically.
          </p>
        </div>
      </div>

      <div className="mt-6 max-w-md">
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
            <p className="text-sm text-gray-500">No items flagged as needed.</p>
            <p className="mt-1 text-xs text-gray-400">
              Open a recipe in cook mode and toggle the Need? column for ingredients you're out of.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white">
            <ul className="divide-y divide-gray-100">
              {unchecked.map((item) => (
                <li key={item.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => void toggleItem(item)}
                      className="shrink-0 accent-gray-800"
                    />
                    <span className="text-sm text-gray-800">{item.ingredient_name}</span>
                  </label>
                </li>
              ))}
            </ul>

            {checked.length > 0 && (
              <>
                <div className="border-t border-gray-200 px-4 py-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Done</p>
                </div>
                <ul className="divide-y divide-gray-100">
                  {checked.map((item) => (
                    <li key={item.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={true}
                          onChange={() => void toggleItem(item)}
                          className="shrink-0 accent-gray-800"
                        />
                        <span className="text-sm text-gray-400 line-through">{item.ingredient_name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
