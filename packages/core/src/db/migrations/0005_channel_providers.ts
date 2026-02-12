/**
 * Migration: Add multi-channel provider support to channel_messages table.
 *
 * Adds columns for tracking which provider/channel a message came from,
 * enabling routing across Telegram, Discord, Slack, and the web dashboard.
 */
import type { DatabaseManager } from '../database.js';

export function up(db: DatabaseManager): void {
  // Add provider tracking columns
  db.exec(`
    ALTER TABLE channel_messages ADD COLUMN channel_provider TEXT NOT NULL DEFAULT 'web';
  `);
  db.exec(`
    ALTER TABLE channel_messages ADD COLUMN channel_id TEXT NOT NULL DEFAULT 'dashboard';
  `);
  db.exec(`
    ALTER TABLE channel_messages ADD COLUMN sender_id TEXT;
  `);
  db.exec(`
    ALTER TABLE channel_messages ADD COLUMN sender_name TEXT;
  `);
  db.exec(`
    ALTER TABLE channel_messages ADD COLUMN reply_to_id TEXT;
  `);
  db.exec(`
    ALTER TABLE channel_messages ADD COLUMN thread_id TEXT;
  `);

  // Index for efficient queries by provider and channel
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_channel_messages_provider
    ON channel_messages(channel_provider, channel_id);
  `);
}

export function down(db: DatabaseManager): void {
  // SQLite doesn't support DROP COLUMN before 3.35.0,
  // so we recreate the table without the new columns.
  db.exec(`
    CREATE TABLE channel_messages_backup AS
    SELECT id, role, content, metadata, created_at, updated_at
    FROM channel_messages;
  `);
  db.exec(`DROP TABLE channel_messages;`);
  db.exec(`
    CREATE TABLE channel_messages (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec(`
    INSERT INTO channel_messages SELECT * FROM channel_messages_backup;
  `);
  db.exec(`DROP TABLE channel_messages_backup;`);
  db.exec(`DROP INDEX IF EXISTS idx_channel_messages_provider;`);
}
