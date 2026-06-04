import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

type DbClient = ReturnType<typeof createClient>

async function getValidToken(
  settings: { google_access_token: string; google_refresh_token: string; google_token_expiry: number },
  db: DbClient,
  userId: string,
): Promise<string> {
  if (Date.now() < settings.google_token_expiry - 60_000) {
    return settings.google_access_token
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: settings.google_refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json() as { access_token: string; expires_in: number }

  await db.from('user_settings').update({
    google_access_token: data.access_token,
    google_token_expiry: Date.now() + data.expires_in * 1000,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId)

  return data.access_token
}

function offsetDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function nextDay(dateStr: string): string {
  return offsetDate(dateStr, 1)
}

// How many days before the planned date each timing creates its event.
const PREP_DAY_OFFSET: Record<string, number> = {
  '30min': 0,
  '1hr': 0,
  '2hr': 0,
  '4hr': 0,
  'evening_before': -1,
  'day_before': -1,
  '2days_before': -2,
}

const PREP_TIMING_LABEL: Record<string, string> = {
  '30min': '30 min before',
  '1hr': '1 hour before',
  '2hr': '2 hours before',
  '4hr': '4 hours before',
  'evening_before': 'evening before',
  'day_before': 'day before',
  '2days_before': '2 days before',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing auth' })
  const token = authHeader.slice(7)

  const db = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )

  const { data: { user } } = await db.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Invalid token' })

  const { data: settings } = await db
    .from('user_settings')
    .select('google_access_token, google_refresh_token, google_token_expiry, google_calendar_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!settings?.google_calendar_id || !settings?.google_refresh_token) {
    return res.status(200).json({ skipped: true, reason: 'Google Calendar not connected' })
  }

  const accessToken = await getValidToken(
    settings as { google_access_token: string; google_refresh_token: string; google_token_expiry: number },
    db,
    user.id,
  )

  const calendarId = settings.google_calendar_id as string
  const body = req.body as {
    action: 'create' | 'delete'
    recipeName?: string
    plannedDate?: string
    calendarEventId?: string
    ingredients?: { name: string; amount: string; unit: string }[]
    prepTasks?: { id: string; task: string; timing: string }[]
    prepEventIds?: Record<string, string>
  }

  try {
    if (body.action === 'create') {
      if (!body.recipeName || !body.plannedDate) {
        return res.status(400).json({ error: 'recipeName and plannedDate required' })
      }

      const description = body.ingredients?.length
        ? 'Ingredients:\n' + body.ingredients.map((ing) => {
            const prefix = [ing.amount.trim(), ing.unit.trim()].filter(Boolean).join(' ')
            return `• ${prefix ? `${prefix} ` : ''}${ing.name.trim()}`
          }).join('\n')
        : undefined

      const eventRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            summary: body.recipeName,
            description,
            start: { date: body.plannedDate },
            end: { date: nextDay(body.plannedDate) },
          }),
        },
      )
      const event = await eventRes.json() as { id: string }

      // Create one all-day event per prep task that has notify:true
      const prepEventIds: Record<string, string> = {}
      for (const pt of (body.prepTasks ?? [])) {
        const dayOffset = PREP_DAY_OFFSET[pt.timing] ?? 0
        const prepDate = offsetDate(body.plannedDate, dayOffset)
        const label = PREP_TIMING_LABEL[pt.timing] ?? pt.timing
        const prepRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              summary: `Prep: ${pt.task} — ${body.recipeName}`,
              description: `${label} cooking ${body.recipeName}`,
              start: { date: prepDate },
              end: { date: nextDay(prepDate) },
            }),
          },
        )
        const prepEvent = await prepRes.json() as { id?: string }
        if (prepEvent.id) prepEventIds[pt.id] = prepEvent.id
      }

      return res.status(200).json({ eventId: event.id, prepEventIds })

    } else if (body.action === 'delete') {
      if (body.calendarEventId) {
        await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(body.calendarEventId)}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
        )
      }

      for (const eventId of Object.values(body.prepEventIds ?? {})) {
        await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
        )
      }

      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'Invalid action' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Calendar sync failed'
    console.error('calendar-sync error:', message)
    return res.status(502).json({ error: message })
  }
}
