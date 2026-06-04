export interface Ingredient {
  name: string
  amount: string
  unit: string
}

export const PREP_TIMINGS = {
  '30min': '30 min before',
  '1hr': '1 hour before',
  '2hr': '2 hours before',
  '4hr': '4 hours before',
  'evening_before': 'Evening before',
  'day_before': 'Day before',
  '2days_before': '2 days before',
} as const

export type PrepTiming = keyof typeof PREP_TIMINGS

export interface PrepTask {
  id: string
  task: string
  timing: PrepTiming
  notify: boolean
}

export interface Recipe {
  id: string
  user_id: string
  name: string
  ingredients: Ingredient[]
  instructions: string
  tags: string[]
  rating: number | null
  notes: string | null
  image_url: string | null
  favorited: boolean
  prep_tasks: PrepTask[]
  created_at: string
  updated_at: string
}

export interface Cook {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

export interface MealPlan {
  id: string
  user_id: string
  recipe_id: string
  planned_date: string
  meal_slot: string
  calendar_event_id: string | null
  cook_id: string | null
  prep_event_ids: Record<string, string> | null
  created_at: string
}

export interface ShoppingListCache {
  id: string
  user_id: string
  week_start: string
  items: Ingredient[]
  generated_at: string
}

export interface PantryNeed {
  id: string
  user_id: string
  recipe_id: string | null
  ingredient_name: string
  added_at: string
}

export interface UserSettings {
  id: string
  user_id: string
  anylist_email: string | null
  anylist_password: string | null
  anylist_list_name: string | null
  google_access_token: string | null
  google_refresh_token: string | null
  google_token_expiry: number | null
  google_calendar_id: string | null
  updated_at: string
}
