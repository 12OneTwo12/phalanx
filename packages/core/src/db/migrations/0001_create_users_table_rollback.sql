-- Rollback Migration: Drop users table
-- Created: 2024-02-13

-- Drop the trigger
DROP TRIGGER IF EXISTS update_users_updated_at;

-- Drop the index
DROP INDEX IF EXISTS idx_users_email;

-- Drop the table
DROP TABLE IF EXISTS users;