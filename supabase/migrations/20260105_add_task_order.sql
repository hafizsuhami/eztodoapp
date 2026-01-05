-- Add order_index column for task ordering within groups
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- Backfill existing tasks with sequential order based on created_at (per user)
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) - 1 AS new_order
  FROM tasks
)
UPDATE tasks t
SET order_index = o.new_order
FROM ordered o
WHERE t.id = o.id;

-- Create index for efficient ordering queries
CREATE INDEX IF NOT EXISTS idx_tasks_order ON tasks(user_id, order_index);
