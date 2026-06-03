export interface Ingredient {
  name: string
  amount: string
  unit: string
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
  created_at: string
  updated_at: string
}

export interface MealPlan {
  id: string
  user_id: string
  recipe_id: string
  planned_date: string
  meal_slot: string
  calendar_event_id: string | null
  created_at: string
}

export interface ShoppingListCache {
  id: string
  user_id: string
  week_start: string
  items: Ingredient[]
  generated_at: string
}
