-- Migration: Add reminder support to tasks table
-- Run this in your Supabase SQL editor

-- Add reminder columns to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS reminder_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;

-- Create index for efficient reminder queries
CREATE INDEX IF NOT EXISTS idx_tasks_pending_reminders 
  ON tasks(reminder_at) 
  WHERE reminder_at IS NOT NULL AND reminder_sent = false;

-- Optional: Set up pg_cron to trigger the Edge Function every minute
-- Note: pg_cron must be enabled in your Supabase project (Dashboard > Database > Extensions)
-- After enabling, run:

-- SELECT cron.schedule(
--   'check-reminders',
--   '* * * * *',  -- Every minute
--   $$
--   SELECT net.http_post(
--     url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-reminders',
--     headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
--     body := '{}'::jsonb
--   )
--   $$
-- );

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To remove a scheduled job:
-- SELECT cron.unschedule('check-reminders');
