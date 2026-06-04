import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

async function ensureCalendar(accessToken: string, existingId: string | null): Promise<string> {
  // Reuse existing calendar if it still exists
  if (existingId) {
    const check = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(existingId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (check.ok) return existingId
  }

  // Create a new "What's For Dinner" calendar
  const create = await fetch('https://www.googleapis.com/calendar/v3/calendars', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary: "What's For Dinner", description: 'Family meal plan' }),
  })
  const calendar = await create.json() as { id: string }
  return calendar.id
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const baseUrl = process.env.APP_BASE_URL ?? ''
  const { code, state, error } = req.query

  if (error || !code || !state) {
    return res.redirect(`${baseUrl}/settings?google=denied`)
  }

  let token: string
  try {
    token = Buffer.from(state as string, 'base64url').toString('utf8')
  } catch {
    return res.redirect(`${baseUrl}/settings?google=error`)
  }

  // Exchange authorization code for Google tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: code as string,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${baseUrl}/api/google-callback`,
      grant_type: 'authorization_code',
    }),
  })

  const tokenData = await tokenRes.json() as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    error?: string
  }

  if (!tokenData.access_token) {
    console.error('google-callback: token exchange failed', tokenData)
    return res.redirect(`${baseUrl}/settings?google=error`)
  }

  const db = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )

  const { data: { user } } = await db.auth.getUser()
  if (!user) return res.redirect(`${baseUrl}/settings?google=error`)

  // Check for an existing calendar so we don't create duplicates on reconnect
  const { data: existing } = await db
    .from('user_settings')
    .select('google_calendar_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const calendarId = await ensureCalendar(
    tokenData.access_token,
    (existing?.google_calendar_id as string | null) ?? null,
  )

  await db.from('user_settings').upsert({
    user_id: user.id,
    google_access_token: tokenData.access_token,
    google_refresh_token: tokenData.refresh_token ?? null,
    google_token_expiry: Date.now() + ((tokenData.expires_in ?? 3600) * 1000),
    google_calendar_id: calendarId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  return res.redirect(`${baseUrl}/settings?google=connected`)
}
