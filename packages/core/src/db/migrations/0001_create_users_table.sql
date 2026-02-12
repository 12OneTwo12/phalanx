-- Migration: Create users table
-- Created: 2024-02-13

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  last_login TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create index for email lookups
CREATE INDEX idx_users_email ON users(email);

-- Create trigger to update updated_at on row update
CREATE TRIGGER update_users_updated_at
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
  UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
END;