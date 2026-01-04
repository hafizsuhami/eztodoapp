-- Migration: Add per-task notification preference for shared task completions
-- Run this in your Supabase SQL editor

-- Add notification setting column to task_shares (per-share/per-task setting)
-- When enabled, owner gets notified when shared user completes the task
ALTER TABLE task_shares
ADD COLUMN IF NOT EXISTS notify_on_complete BOOLEAN DEFAULT true;
