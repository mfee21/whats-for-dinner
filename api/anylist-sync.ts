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
  createItem(opts: { name: string }): unknown
  teardown(): Promise<void>
}

type AnyListConstructor = new (opts: { email: string; password: string }) => AnyListInstance

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
    console.error('anylist-sync: missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY env vars')
    return res.status(500).json({ error: 'Supabase not configured' })
  }

  // Lazy-require inside handler so module load errors return a readable response
  // instead of FUNCTION_INVOCATION_FAILED
  let AnyList: AnyListConstructor
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    AnyList = require('anylist') as AnyListConstructor
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('anylist-sync: failed to load anylist module:', message)
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

  const listName = (settings.anylist_list_name as string | null) ?? 'Groceries'
  const anylist = new AnyList({ email: settings.anylist_email as string, password: settings.anylist_password as string })

  try {
    await anylist.login()
    await anylist.getLists()
    console.log(`anylist-sync: connected as ${settings.anylist_email as string}`)

    const list = anylist.getListByName(listName)
    if (!list) {
      return res.status(404).json({ error: `AnyList list "${listName}" not found` })
    }

    if (body.action === 'add') {
      await list.addItem(anylist.createItem({ name: body.ingredientName }))
    } else {
      const item = list.getItemByName(body.ingredientName)
      if (item) await list.removeItem(item)
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
