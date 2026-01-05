-- Add order_index column for category ordering
ALTER TABLE categories ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- Backfill existing categories with sequential order based on created_at
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) - 1 AS new_order
  FROM categories
)
UPDATE categories c
SET order_index = o.new_order
FROM ordered o
WHERE c.id = o.id;

-- Create index for efficient ordering queries
CREATE INDEX IF NOT EXISTS idx_categories_order ON categories(user_id, order_index);
