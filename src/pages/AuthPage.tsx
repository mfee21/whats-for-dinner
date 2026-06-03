import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type AuthMode = 'sign-in' | 'sign-up'

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isSignIn = useMemo(() => mode === 'sign-in', [mode])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus(null)
    setIsSubmitting(true)

    const trimmedEmail = email.trim()

    if (!trimmedEmail || !password) {
      setStatus('Email and password are required.')
      setIsSubmitting(false)
      return
    }

    if (password.length < 6) {
      setStatus('Password must be at least 6 characters.')
      setIsSubmitting(false)
      return
    }

    const { error } = isSignIn
      ? await supabase.auth.signInWithPassword({ email: trimmedEmail, password })
      : await supabase.auth.signUp({ email: trimmedEmail, password })

    if (error) {
      setStatus(error.message)
      setIsSubmitting(false)
      return
    }

    setStatus(
      isSignIn
        ? 'Signed in successfully.'
        : 'Account created. Check your email if confirmation is enabled.',
    )
    setIsSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">What's For Dinner</h1>
        <p className="mt-2 text-sm text-gray-600">
          Sign in to manage your recipes and meal plans.
        </p>

        <div className="mt-6 flex rounded-md border border-gray-200 p-1 text-sm">
          <button
            type="button"
            className={`flex-1 rounded px-3 py-2 ${
              isSignIn ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setMode('sign-in')}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`flex-1 rounded px-3 py-2 ${
              !isSignIn ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setMode('sign-up')}
          >
            Sign Up
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-900 focus:outline-none"
              autoComplete="email"
              required
            />
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-900 focus:outline-none"
              autoComplete={isSignIn ? 'current-password' : 'new-password'}
              minLength={6}
              required
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Working...' : isSignIn ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {status ? <p className="mt-4 text-sm text-gray-600">{status}</p> : null}
      </div>
    </div>
  )
}
