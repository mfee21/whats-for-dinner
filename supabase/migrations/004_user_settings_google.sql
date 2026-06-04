-- Run this in the Supabase SQL Editor.
-- Adds Google Calendar OAuth fields to user_settings.

alter table public.user_settings
  add column if not exists google_access_token text,
  add column if not exists google_refresh_token text,
  add column if not exists google_token_expiry bigint,
  add column if not exists google_calendar_id text;
