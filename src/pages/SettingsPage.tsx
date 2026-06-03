import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { UserSettings } from '../types/database'

type SettingsPageProps = {
  session: Session
}

export default function SettingsPage({ session }: SettingsPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [listName, setListName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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
      }
      setIsLoading(false)
    }
    void loadSettings()
  }, [session.user.id])

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

  if (isLoading) {
    return <div className="p-8 text-sm text-gray-600">Loading settings...</div>
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-950">Settings</h1>

      <section className="mt-8 max-w-md">
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
    </div>
  )
}
