import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

type AnyListInstance = {
  login(): Promise<void>
  getLists(): Promise<void>
  getListByName(name: string): {
    addItem(item: unknown): Promise<void>
    removeItem(item: unknown): Promise<void>
    getItemByName(name: string): unknown
  } | undefined
  createItem(opts: { name: string; details?: string }): unknown
  teardown(): Promise<void>
}

type AnyListConstructor = new (opts: { email: string; password: string }) => AnyListInstance

type NeedRow = { ingredient_name: string; recipes: { name: string } | null }

function normalizeIngredient(ingredient: string): string {
  return ingredient
    .replace(/^\d[\d\s./⁄¼½¾⅓⅔⅛⅜⅝⅞]*/, '')
    .replace(
      /^(cups?|tbsps?|tsps?|tablespoons?|teaspoons?|oz|ounces?|lbs?|pounds?|grams?|g|kg|ml|l|liters?|litres?|cloves?|bunch(?:es)?|stalks?|slices?|pieces?|cans?|packages?|pkgs?|bags?|jars?|bottles?|sprigs?|handfuls?|pinch(?:es)?)\b\s*/i,
      '',
    )
    .trim()
    .toLowerCase()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' })
  }
  const token = authHeader.slice(7)

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    console.error('anylist-sync: missing Supabase env vars')
    return res.status(500).json({ error: 'Supabase not configured' })
  }

  // Dynamic import works in ESM context; CJS module.exports becomes .default
  let AnyList: AnyListConstructor
  try {
    const mod = await import('anylist')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AnyList = ((mod as any).default ?? mod) as AnyListConstructor
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('anylist-sync: failed to import anylist:', message)
    return res.status(500).json({ error: `Module load failed: ${message}` })
  }

  const db = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: settings } = await db
    .from('user_settings')
    .select('anylist_email, anylist_password, anylist_list_name')
    .maybeSingle()

  if (!settings?.anylist_email || !settings?.anylist_password) {
    return res.status(200).json({ skipped: true, reason: 'No AnyList credentials configured' })
  }

  const body = req.body as { action?: 'add' | 'remove'; ingredientName?: string }
  if (!body.action || !body.ingredientName) {
    return res.status(400).json({ error: 'action and ingredientName are required' })
  }

  // The caller already applied the toggle to pantry_needs before calling this endpoint,
  // so querying now gives us the current desired state — no need to branch on action.
  const normalizedTarget = normalizeIngredient(body.ingredientName)

  const { data: allNeeds } = await db
    .from('pantry_needs')
    .select('ingredient_name, recipes(name)')

  const matchingNeeds = ((allNeeds as NeedRow[]) ?? []).filter(
    (n) => normalizeIngredient(n.ingredient_name) === normalizedTarget,
  )
  const recipeNames = [
    ...new Set(
      matchingNeeds.map((n) => n.recipes?.name).filter((name): name is string => Boolean(name)),
    ),
  ]

  const listName = (settings.anylist_list_name as string | null) ?? 'Groceries'
  const anylist = new AnyList({
    email: settings.anylist_email as string,
    password: settings.anylist_password as string,
  })

  try {
    await anylist.login()
    await anylist.getLists()
    console.log(`anylist-sync: connected as ${settings.anylist_email as string}`)

    const list = anylist.getListByName(listName)
    if (!list) {
      return res.status(404).json({ error: `AnyList list "${listName}" not found` })
    }

    // Remove existing entry for this normalized name (handles rename/update cleanly)
    const existing = list.getItemByName(normalizedTarget)
    if (existing) await list.removeItem(existing)

    // Re-add only if at least one recipe still needs it
    if (matchingNeeds.length > 0) {
      const details = recipeNames.length > 0 ? `Needed for: ${recipeNames.join(', ')}` : ''
      await list.addItem(anylist.createItem({ name: normalizedTarget, details }))
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AnyList sync failed'
    const stack = err instanceof Error ? err.stack : undefined
    console.error('anylist-sync error:', message, stack)
    return res.status(502).json({ error: message })
  } finally {
    try {
      await anylist.teardown()
    } catch {
      // teardown errors are non-fatal
    }
  }
}
