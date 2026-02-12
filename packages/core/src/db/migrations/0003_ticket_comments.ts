/**
 * Migration: Add ticket_comments table for threaded conversations on tickets.
 */
import type { DatabaseManager } from '../database.js';

export const MIGRATION_ID = '0003_ticket_comments';

export function up(db: DatabaseManager): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_comments (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      author TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'comment' CHECK(type IN ('plan', 'progress', 'completion', 'review', 'comment')),
      content TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_ticket_comments_author ON ticket_comments(author);
  `);
}

export function down(db: DatabaseManager): void {
  db.exec(`
    DROP INDEX IF EXISTS idx_ticket_comments_author;
    DROP INDEX IF EXISTS idx_ticket_comments_ticket_id;
    DROP TABLE IF EXISTS ticket_comments;
  `);
}
