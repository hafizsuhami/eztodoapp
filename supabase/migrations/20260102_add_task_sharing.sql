-- Migration: Add task sharing support
-- Run this in your Supabase SQL editor
-- This migration is idempotent - safe to run multiple times

-- Table to track shared task relationships
CREATE TABLE IF NOT EXISTS task_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL for pending invites
  shared_with_email TEXT,  -- Email for pending invites (before user signs up)
  share_token TEXT UNIQUE,  -- For shareable links (NULL if email-only invite)
  permission TEXT NOT NULL DEFAULT 'edit' CHECK (permission IN ('view', 'edit')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,  -- Optional expiry for share links

  -- Prevent duplicate shares to same user for same task
  CONSTRAINT unique_user_share UNIQUE (task_id, shared_with_id),
  CONSTRAINT unique_email_share UNIQUE (task_id, shared_with_email)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_task_shares_task_id ON task_shares(task_id);
CREATE INDEX IF NOT EXISTS idx_task_shares_shared_with_id ON task_shares(shared_with_id);
CREATE INDEX IF NOT EXISTS idx_task_shares_shared_with_email ON task_shares(shared_with_email);
CREATE INDEX IF NOT EXISTS idx_task_shares_share_token ON task_shares(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_shares_owner_id ON task_shares(owner_id);

-- Enable RLS on task_shares
ALTER TABLE task_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_shares (drop first to make idempotent)
DROP POLICY IF EXISTS "Users can view relevant shares" ON task_shares;
DROP POLICY IF EXISTS "Task owners can create shares" ON task_shares;
DROP POLICY IF EXISTS "Owners can revoke, users can accept" ON task_shares;
DROP POLICY IF EXISTS "Task owners can delete shares" ON task_shares;

-- Task owners and share recipients can view shares
CREATE POLICY "Users can view relevant shares"
  ON task_shares FOR SELECT
  USING (
    auth.uid() = owner_id
    OR auth.uid() = shared_with_id
  );

-- Only task owners can create shares
CREATE POLICY "Task owners can create shares"
  ON task_shares FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM tasks WHERE tasks.id = task_id AND tasks.user_id = auth.uid()
    )
  );

-- Owners can update (revoke) shares; shared users can accept
CREATE POLICY "Owners can revoke, users can accept"
  ON task_shares FOR UPDATE
  USING (
    auth.uid() = owner_id OR auth.uid() = shared_with_id
  );

-- Only owners can delete shares
CREATE POLICY "Task owners can delete shares"
  ON task_shares FOR DELETE
  USING (auth.uid() = owner_id);

-- Update tasks table RLS policies to allow shared access

-- Drop ALL existing policies on tasks (old and new names)
DROP POLICY IF EXISTS "Users can view their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view own and shared tasks" ON tasks;
DROP POLICY IF EXISTS "Users can create own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update own and shared-edit tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON tasks;

-- New SELECT policy: Owner OR has accepted share
CREATE POLICY "Users can view own and shared tasks"
  ON tasks FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM task_shares
      WHERE task_shares.task_id = tasks.id
        AND task_shares.shared_with_id = auth.uid()
        AND task_shares.status = 'accepted'
    )
  );

-- New INSERT policy: Owner only
CREATE POLICY "Users can create own tasks"
  ON tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- New UPDATE policy: Owner OR shared with edit permission
CREATE POLICY "Users can update own and shared-edit tasks"
  ON tasks FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM task_shares
      WHERE task_shares.task_id = tasks.id
        AND task_shares.shared_with_id = auth.uid()
        AND task_shares.status = 'accepted'
        AND task_shares.permission = 'edit'
    )
  );

-- New DELETE policy: Owner only
CREATE POLICY "Users can delete own tasks"
  ON tasks FOR DELETE
  USING (auth.uid() = user_id);

-- Function to generate secure share tokens
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT replace(replace(replace(encode(gen_random_bytes(16), 'base64'), '+', '-'), '/', '_'), '=', '');
$$;

-- Function to accept share via token (for link sharing)
-- Creates a NEW share record for each user so links can be reused
CREATE OR REPLACE FUNCTION accept_share_by_token(p_token TEXT)
RETURNS task_shares
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_share task_shares;
  v_new_share task_shares;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find the share by token (can be pending or accepted - links are reusable)
  SELECT * INTO v_share
  FROM task_shares
  WHERE share_token = p_token
    AND (expires_at IS NULL OR expires_at > NOW());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired share link';
  END IF;

  -- Prevent owner from accepting their own share
  IF v_share.owner_id = v_user_id THEN
    RAISE EXCEPTION 'Cannot accept share for your own task';
  END IF;

  -- Check if user already has this task shared
  IF EXISTS (
    SELECT 1 FROM task_shares
    WHERE task_id = v_share.task_id
      AND shared_with_id = v_user_id
      AND status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'Task already shared with you';
  END IF;

  -- Create a NEW share record for this user (keep original link intact)
  INSERT INTO task_shares (
    task_id,
    owner_id,
    shared_with_id,
    permission,
    status,
    accepted_at
  ) VALUES (
    v_share.task_id,
    v_share.owner_id,
    v_user_id,
    v_share.permission,
    'accepted',
    NOW()
  )
  RETURNING * INTO v_new_share;

  RETURN v_new_share;
END;
$$;

-- Function to claim pending email invites (for when user signs up/logs in)
CREATE OR REPLACE FUNCTION claim_pending_shares()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_email TEXT;
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;

  -- Get current user's email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = auth.uid();

  IF v_user_email IS NULL THEN
    RETURN 0;
  END IF;

  -- Update all pending shares for this email
  UPDATE task_shares
  SET
    shared_with_id = auth.uid(),
    status = 'accepted',
    accepted_at = NOW()
  WHERE LOWER(shared_with_email) = LOWER(v_user_email)
    AND status = 'pending'
    AND shared_with_id IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Function to get share preview (without accepting) - no auth required
CREATE OR REPLACE FUNCTION get_share_preview(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_share task_shares;
  v_task tasks;
  v_owner_name TEXT;
  v_owner_avatar TEXT;
BEGIN
  -- Find the share by token (pending OR accepted - so link works after first accept)
  SELECT * INTO v_share
  FROM task_shares
  WHERE share_token = p_token
    AND status IN ('pending', 'accepted')
    AND (expires_at IS NULL OR expires_at > NOW());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired share link';
  END IF;

  -- Get the task
  SELECT * INTO v_task
  FROM tasks
  WHERE id = v_share.task_id;

  -- Get owner info from profiles
  SELECT name, avatar_url INTO v_owner_name, v_owner_avatar
  FROM profiles
  WHERE id = v_share.owner_id;

  RETURN json_build_object(
    'task', json_build_object(
      'id', v_task.id,
      'title', v_task.title,
      'status', v_task.status,
      'category', v_task.category,
      'due_date', v_task.due_date,
      'subtasks', v_task.subtasks
    ),
    'owner', json_build_object(
      'id', v_share.owner_id,
      'name', COALESCE(v_owner_name, 'Someone'),
      'avatar', v_owner_avatar
    )
  );
END;
$$;

-- Enable real-time for task_shares (ignore error if already added)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE task_shares;
EXCEPTION WHEN duplicate_object THEN
  -- Table already in publication, ignore
END $$;
