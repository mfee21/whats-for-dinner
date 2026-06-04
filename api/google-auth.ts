import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing auth' })
  const token = authHeader.slice(7)

  const clientId = process.env.GOOGLE_CLIENT_ID
  const baseUrl = process.env.APP_BASE_URL
  if (!clientId || !baseUrl) return res.status(500).json({ error: 'Google OAuth not configured' })

  // Encode the Supabase JWT in state so the callback knows which user is connecting
  const state = Buffer.from(token).toString('base64url')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${baseUrl}/api/google-callback`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar',
    access_type: 'offline',
    prompt: 'consent', // Always return a refresh token
    state,
  })

  return res.status(200).json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` })
}
