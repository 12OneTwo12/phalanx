-- Rollback Migration: Drop users table
-- Version: 0005
-- Description: Remove users table and related indexes

DROP INDEX IF EXISTS idx_users_last_login;
DROP INDEX IF EXISTS idx_users_email;
DROP TABLE IF EXISTS users;