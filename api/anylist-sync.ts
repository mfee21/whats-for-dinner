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

// --- Ingredient parsing ---

const UNICODE_FRACTIONS: Record<string, number> = {
  '¼': 0.25, '½': 0.5, '¾': 0.75,
  '⅓': 1 / 3, '⅔': 2 / 3,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
}

function parseFraction(s: string): number {
  const t = s.trim()
  if (UNICODE_FRACTIONS[t] !== undefined) return UNICODE_FRACTIONS[t]
  for (const [char, val] of Object.entries(UNICODE_FRACTIONS)) {
    const m = t.match(new RegExp(`^(\\d+)\\s*${char}$`))
    if (m) return parseInt(m[1]) + val
  }
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixed) return parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3])
  const frac = t.match(/^(\d+)\/(\d+)$/)
  if (frac) return parseInt(frac[1]) / parseInt(frac[2])
  return parseFloat(t) || 0
}

function formatQuantity(n: number): string {
  if (n <= 0) return ''
  const whole = Math.floor(n)
  const frac = n - whole
  const FRACS: [number, string][] = [
    [3 / 4, '3/4'], [2 / 3, '2/3'], [1 / 2, '1/2'],
    [1 / 3, '1/3'], [1 / 4, '1/4'], [1 / 8, '1/8'],
  ]
  const fracStr = FRACS.find(([v]) => Math.abs(frac - v) < 0.04)?.[1] ?? ''
  if (whole === 0) return fracStr || String(Math.round(n * 100) / 100)
  if (!fracStr || frac < 0.04) return String(whole)
  return `${whole} ${fracStr}`
}

const UNIT_MAP: Record<string, string> = {
  tablespoons: 'tbsp', tablespoon: 'tbsp', tbsps: 'tbsp', tbsp: 'tbsp',
  teaspoons: 'tsp', teaspoon: 'tsp', tsps: 'tsp', tsp: 'tsp',
  ounces: 'oz', ounce: 'oz', oz: 'oz',
  pounds: 'lb', pound: 'lb', lbs: 'lb', lb: 'lb',
  grams: 'g', gram: 'g', g: 'g', kg: 'kg',
  liters: 'l', liter: 'l', litres: 'l', litre: 'l', ml: 'ml', l: 'l',
  cups: 'cup', cup: 'cup',
  bunches: 'bunch', bunch: 'bunch',
  cloves: 'clove', clove: 'clove',
  stalks: 'stalk', stalk: 'stalk',
  slices: 'slice', slice: 'slice',
  pieces: 'piece', piece: 'piece',
  cans: 'can', can: 'can',
  packages: 'package', package: 'package', pkgs: 'package', pkg: 'package',
  bags: 'bag', bag: 'bag',
  jars: 'jar', jar: 'jar',
  bottles: 'bottle', bottle: 'bottle',
  sprigs: 'sprig', sprig: 'sprig',
  handfuls: 'handful', handful: 'handful',
  pinches: 'pinch', pinch: 'pinch',
}

const PLURAL_UNITS: Record<string, string> = {
  cup: 'cups', clove: 'cloves', bunch: 'bunches', stalk: 'stalks',
  slice: 'slices', piece: 'pieces', can: 'cans', package: 'packages',
  bag: 'bags', jar: 'jars', bottle: 'bottles', sprig: 'sprigs',
  handful: 'handfuls', pinch: 'pinches',
}

const UNIT_PATTERN = new RegExp(
  `^(${Object.keys(UNIT_MAP)
    .sort((a, b) => b.length - a.length)
    .join('|')})(?=\\b|\\s|$)`,
  'i',
)

const SIZE_WORDS =
  /\b(extra-?large|extra large|large|small|medium|xl|big|tiny|fresh|dried|frozen|ripe|raw|cooked|whole|halved|quartered|boneless|skinless|chopped|diced|sliced|minced|crushed|grated|shredded)\b\s*/gi

function parseIngredient(str: string): { quantity: number; unit: string; name: string } {
  let s = str.trim()

  const qtyRe =
    /^([¼½¾⅓⅔⅛⅜⅝⅞]|\d+\s*[¼½¾⅓⅔⅛⅜⅝⅞]|\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*/
  const qtyMatch = s.match(qtyRe)
  let quantity = 0
  if (qtyMatch) {
    quantity = parseFraction(qtyMatch[1])
    s = s.slice(qtyMatch[0].length)
  }

  const unitMatch = s.match(UNIT_PATTERN)
  let unit = ''
  if (unitMatch) {
    unit = UNIT_MAP[unitMatch[1].toLowerCase()] ?? unitMatch[1].toLowerCase()
    s = s.slice(unitMatch[0].length).replace(/^[\s,]+(?:of\s+)?/, '')
  }

  const name = s
    .replace(SIZE_WORDS, '')
    .replace(/\bto\s+taste\b.*/i, '')
    .replace(/,.*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

  return { quantity, unit, name }
}

// --- Handler ---

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
  // so querying now reflects current desired state — no need to branch on action.
  const parsedTarget = parseIngredient(body.ingredientName)
  const baseName = parsedTarget.name || body.ingredientName.toLowerCase().trim()

  const { data: allNeeds } = await db
    .from('pantry_needs')
    .select('ingredient_name, recipes(name)')

  const matchingNeeds = ((allNeeds as NeedRow[]) ?? []).filter(
    (n) => parseIngredient(n.ingredient_name).name === baseName,
  )

  // Sum quantities across matching recipes when units agree
  let totalQty = 0
  let commonUnit = ''
  let unitMismatch = false
  for (const need of matchingNeeds) {
    const p = parseIngredient(need.ingredient_name)
    if (!commonUnit && p.unit) commonUnit = p.unit
    if (p.unit && p.unit !== commonUnit) unitMismatch = true
    totalQty += p.quantity
  }
  if (unitMismatch) totalQty = 0

  const recipeNames = [
    ...new Set(
      matchingNeeds
        .map((n) => n.recipes?.name)
        .filter((name): name is string => Boolean(name)),
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

    // Key is always baseName so getItemByName is stable regardless of quantity changes
    const existing = list.getItemByName(baseName)
    if (existing) await list.removeItem(existing)

    if (matchingNeeds.length > 0) {
      const detailParts: string[] = []
      if (totalQty > 0) {
        const qtyStr = formatQuantity(totalQty)
        const unitStr = commonUnit
          ? ` ${totalQty > 1 ? (PLURAL_UNITS[commonUnit] ?? commonUnit) : commonUnit}`
          : ''
        detailParts.push(`${qtyStr}${unitStr} total`)
      }
      if (recipeNames.length > 0) detailParts.push(`Needed for: ${recipeNames.join(', ')}`)

      await list.addItem(
        anylist.createItem({ name: baseName, details: detailParts.join(' • ') }),
      )
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
