-- Stores Google Calendar event IDs for advanced prep task reminders.
-- Structure: { [prepTaskId]: calendarEventId }

alter table public.meal_plans
  add column if not exists prep_event_ids jsonb;
