-- Add deleted_at column for soft delete / trash bin feature
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Index for efficient filtering of active vs deleted tasks
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at);

-- Composite index for fetching active tasks by user
CREATE INDEX IF NOT EXISTS idx_tasks_user_active ON tasks(user_id, deleted_at) WHERE deleted_at IS NULL;
