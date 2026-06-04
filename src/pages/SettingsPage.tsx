import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useSearchParams } from 'react-router-dom'
import { CookBadge } from '../components/CookBadge'
import { supabase } from '../lib/supabase'
import type { Cook, UserSettings } from '../types/database'

const COOK_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#6366f1', // indigo
  '#a855f7', // purple
  '#ec4899', // pink
]

type SettingsPageProps = {
  session: Session
}

export default function SettingsPage({ session }: SettingsPageProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const googleStatus = searchParams.get('google')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [listName, setListName] = useState('')
  const [googleCalendarId, setGoogleCalendarId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [cooks, setCooks] = useState<Cook[]>([])
  const [newCookName, setNewCookName] = useState('')
  const [newCookColor, setNewCookColor] = useState('#6366f1')
  const [isAddingCook, setIsAddingCook] = useState(false)

  useEffect(() => {
    async function loadSettings() {
      const { data } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (data) {
        const s = data as UserSettings
        setEmail(s.anylist_email ?? '')
        setPassword(s.anylist_password ?? '')
        setListName(s.anylist_list_name ?? '')
        setGoogleCalendarId(s.google_calendar_id)
      }
      setIsLoading(false)
    }
    void loadSettings()

    async function loadCooks() {
      const { data } = await supabase
        .from('cooks')
        .select('*')
        .eq('user_id', session.user.id)
        .order('name')
      if (data) {
        const loaded = data as Cook[]
        setCooks(loaded)
        const takenColors = new Set(loaded.map((c) => c.color))
        setNewCookColor(COOK_COLORS.find((c) => !takenColors.has(c)) ?? COOK_COLORS[0])
      }
    }
    void loadCooks()
  }, [session.user.id])

  // Clear ?google= param from URL after reading it
  useEffect(() => {
    if (googleStatus) {
      setSearchParams({}, { replace: true })
    }
  }, [googleStatus, setSearchParams])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setIsSaving(true)
    setSaveMessage(null)

    const { error } = await supabase.from('user_settings').upsert(
      {
        user_id: session.user.id,
        anylist_email: email.trim() || null,
        anylist_password: password || null,
        anylist_list_name: listName.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

    setIsSaving(false)
    setSaveMessage(error ? { type: 'error', text: error.message } : { type: 'success', text: 'Settings saved.' })
  }

  async function handleConnectGoogle() {
    setIsConnectingGoogle(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) { setIsConnectingGoogle(false); return }

    const res = await fetch('/api/google-auth', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const { url } = await res.json() as { url: string }
    window.location.href = url
  }

  async function handleAddCook(e: React.FormEvent) {
    e.preventDefault()
    if (!newCookName.trim()) return
    setIsAddingCook(true)
    const { data, error } = await supabase
      .from('cooks')
      .insert({ user_id: session.user.id, name: newCookName.trim(), color: newCookColor })
      .select('*')
      .single()
    if (!error && data) {
      const updated = [...cooks, data as Cook].sort((a, b) => a.name.localeCompare(b.name))
      setCooks(updated)
      setNewCookName('')
      const takenColors = new Set(updated.map((c) => c.color))
      setNewCookColor(COOK_COLORS.find((c) => !takenColors.has(c)) ?? COOK_COLORS[0])
    }
    setIsAddingCook(false)
  }

  async function handleDeleteCook(id: string) {
    await supabase.from('cooks').delete().eq('id', id)
    setCooks((prev) => {
      const updated = prev.filter((c) => c.id !== id)
      const takenColors = new Set(updated.map((c) => c.color))
      setNewCookColor(COOK_COLORS.find((c) => !takenColors.has(c)) ?? COOK_COLORS[0])
      return updated
    })
  }

  async function handleDisconnectGoogle() {
    await supabase.from('user_settings').update({
      google_access_token: null,
      google_refresh_token: null,
      google_token_expiry: null,
      google_calendar_id: null,
      updated_at: new Date().toISOString(),
    }).eq('user_id', session.user.id)

    setGoogleCalendarId(null)
  }

  if (isLoading) {
    return <div className="p-8 text-sm text-gray-600">Loading settings...</div>
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-950">Settings</h1>

      {/* Google Calendar */}
      <section className="mt-8 max-w-md">
        <h2 className="text-base font-semibold text-gray-800">Google Calendar</h2>
        <p className="mt-1 text-sm text-gray-500">
          Sync your meal plan to a dedicated "What's For Dinner" Google Calendar.
          Events are created when you add a meal and removed when you remove one.
        </p>

        {googleStatus === 'connected' && (
          <p className="mt-2 text-sm text-emerald-700">Google Calendar connected.</p>
        )}
        {googleStatus === 'denied' && (
          <p className="mt-2 text-sm text-amber-700">Authorization cancelled.</p>
        )}
        {googleStatus === 'error' && (
          <p className="mt-2 text-sm text-red-700">Something went wrong. Try connecting again.</p>
        )}

        <div className="mt-4">
          {googleCalendarId ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-700">Connected</span>
              <button
                type="button"
                onClick={() => void handleDisconnectGoogle()}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-red-400 hover:text-red-600"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void handleConnectGoogle()}
              disabled={isConnectingGoogle}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {isConnectingGoogle ? 'Redirecting…' : 'Connect Google Calendar'}
            </button>
          )}
        </div>
      </section>

      {/* AnyList */}
      <section className="mt-10 max-w-md">
        <h2 className="text-base font-semibold text-gray-800">AnyList integration</h2>
        <p className="mt-1 text-sm text-gray-500">
          When you mark an ingredient as needed in cook mode, it will automatically be added to
          your AnyList grocery list.
        </p>
        <p className="mt-1 text-xs text-gray-400">
          AnyList credentials are stored in your account and never shared.
          Leave blank to disable the integration.
        </p>

        <form onSubmit={(e) => void handleSave(e)} className="mt-4 grid gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="anylist-email">
              AnyList email
            </label>
            <input
              id="anylist-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="anylist-password">
              AnyList password
            </label>
            <input
              id="anylist-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="anylist-list-name">
              List name
            </label>
            <input
              id="anylist-list-name"
              type="text"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder="Groceries"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none"
            />
            <p className="mt-1 text-xs text-gray-400">
              Must match the list name exactly as it appears in AnyList. Defaults to "Groceries".
            </p>
          </div>

          {saveMessage ? (
            <p className={`text-sm ${saveMessage.type === 'success' ? 'text-emerald-700' : 'text-red-700'}`}>
              {saveMessage.text}
            </p>
          ) : null}

          <div>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </form>
      </section>

      {/* Cooks */}
      <section className="mt-10 max-w-md">
        <h2 className="text-base font-semibold text-gray-800">Cooks</h2>
        <p className="mt-1 text-sm text-gray-500">
          Add household cooks and assign a color. Badges appear on planned meals in the
          Dashboard and Planner.
        </p>

        {cooks.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {cooks.map((cook) => (
              <span key={cook.id} className="group relative inline-flex items-center gap-1">
                <CookBadge cook={cook} />
                <button
                  type="button"
                  onClick={() => void handleDeleteCook(cook.id)}
                  aria-label={`Remove ${cook.name}`}
                  className="ml-0.5 text-[10px] text-gray-400 hover:text-red-500"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <form onSubmit={(e) => void handleAddCook(e)} className="mt-4 grid gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="cook-name">
              Name
            </label>
            <input
              id="cook-name"
              type="text"
              value={newCookName}
              onChange={(e) => setNewCookName(e.target.value)}
              placeholder="e.g. Matt"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none"
            />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700">Color</p>
            <div className="mt-2 flex gap-2">
              {COOK_COLORS.map((hex) => {
                const taken = cooks.some((c) => c.color === hex)
                return (
                  <button
                    key={hex}
                    type="button"
                    disabled={taken}
                    onClick={() => setNewCookColor(hex)}
                    title={hex}
                    className={`h-7 w-7 rounded-full border-2 transition-transform ${
                      taken
                        ? 'cursor-not-allowed opacity-30'
                        : newCookColor === hex
                          ? 'scale-110 border-gray-900'
                          : 'border-transparent hover:scale-105 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                )
              })}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isAddingCook || !newCookName.trim()}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {isAddingCook ? 'Adding…' : 'Add cook'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
