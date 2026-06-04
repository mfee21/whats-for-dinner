import { useEffect, useState } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import HomePage from './pages/HomePage'
import RecipesPage from './pages/RecipesPage'
import RecipeCookPage from './pages/RecipeCookPage'
import RecipeEditPage from './pages/RecipeEditPage'
import PlannerPage from './pages/PlannerPage'
import ShoppingListPage from './pages/ShoppingListPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)

  useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return
      }

      setSession(data.session)
      setIsLoadingSession(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsLoadingSession(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (isLoadingSession) {
    return <div className="p-8 text-sm text-gray-600">Loading session...</div>
  }

  if (!session) {
    return <AuthPage />
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-6">
          <Link to="/" className="font-semibold text-gray-900 hover:text-black">
            What's For Dinner
          </Link>
          <Link
            to="/recipes"
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-gray-900 hover:text-gray-900"
          >
            Recipes
          </Link>
          <Link
            to="/add"
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-gray-900 hover:text-gray-900"
          >
            Add Recipe
          </Link>
          <Link
            to="/plan"
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-gray-900 hover:text-gray-900"
          >
            Planner
          </Link>
          <Link
            to="/shopping"
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-gray-900 hover:text-gray-900"
          >
            Shopping
          </Link>
          <Link
            to="/settings"
            className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-gray-700 hover:border-gray-900 hover:text-gray-900"
            aria-label="Settings"
            title="Settings"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
              <path
                d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.4 3.4l.7.7M11.9 11.9l.7.7M12.6 3.4l-.7.7M4.1 11.9l-.7.7"
                stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
              />
            </svg>
          </Link>
          <div className="ml-auto flex items-center gap-4 text-sm text-gray-500">
            <span>{session.user.email}</span>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded border border-gray-300 px-3 py-1.5 text-gray-700 hover:border-gray-900 hover:text-gray-900"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto">
        <Routes>
          <Route path="/" element={<DashboardPage session={session} />} />
          <Route path="/recipes" element={<HomePage session={session} />} />
          <Route path="/add" element={<RecipesPage session={session} />} />
          <Route path="/recipes/:recipeId/cook" element={<RecipeCookPage session={session} />} />
          <Route path="/recipes/:recipeId/edit" element={<RecipeEditPage session={session} />} />
          <Route path="/plan" element={<PlannerPage session={session} />} />
          <Route path="/shopping" element={<ShoppingListPage session={session} />} />
          <Route path="/settings" element={<SettingsPage session={session} />} />
        </Routes>
      </main>
    </div>
  )
}
