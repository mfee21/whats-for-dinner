import { Routes, Route, NavLink } from 'react-router-dom'
import RecipesPage from './pages/RecipesPage'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-6">
          <span className="font-semibold text-gray-900">What's For Dinner</span>
          <NavLink
            to="/"
            className={({ isActive }) =>
              isActive ? 'text-indigo-600 font-medium' : 'text-gray-500 hover:text-gray-900'
            }
          >
            Recipes
          </NavLink>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto">
        <Routes>
          <Route path="/" element={<RecipesPage />} />
        </Routes>
      </main>
    </div>
  )
}
