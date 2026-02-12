-- Migration: Create users table
-- Version: 0005
-- Description: Add users table with authentication fields

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    last_login INTEGER
);

-- Create index for email lookups
CREATE INDEX idx_users_email ON users(email);

-- Create index for last_login for analytics
CREATE INDEX idx_users_last_login ON users(last_login);