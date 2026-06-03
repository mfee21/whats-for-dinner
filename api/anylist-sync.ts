import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// anylist is a CJS module with no TypeScript types
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AnyList = require('anylist') as new (opts: { email: string; password: string }) => {
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
    return res.status(500).json({ error: 'Supabase not configured — add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to Vercel env vars' })
  }

  // Use the user's JWT so RLS applies — only their own user_settings are readable
  const db = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: settings } = await db
    .from('user_settings')
    .select('anylist_email, anylist_password, anylist_list_name')
    .maybeSingle()

  if (!settings?.anylist_email || !settings?.anylist_password) {
    // No credentials configured — not an error, integration is just disabled
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
    console.log(`anylist-sync: connected to AnyList as ${settings.anylist_email as string}`)

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
    console.error('anylist-sync error:', message)
    return res.status(502).json({ error: message })
  } finally {
    await anylist.teardown()
  }
}
