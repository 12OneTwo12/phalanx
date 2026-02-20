/**
 * Migration: Add 'paused' status to epics CHECK constraint.
 * SQLite does not support ALTER TABLE to modify CHECK constraints,
 * so we recreate the table.
 */
import type { DatabaseManager } from '../database.js';

export function up(db: DatabaseManager): void {
  // Check if migration already applied (paused already in CHECK constraint).
  // Without this guard, re-running DROP TABLE epics CASCADE-deletes all tickets.
  const row = db.raw.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='epics'",
  ).get() as { sql: string } | undefined;
  if (row?.sql?.includes("'paused'")) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS epics_new (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'paused')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO epics_new SELECT * FROM epics;
    DROP TABLE epics;
    ALTER TABLE epics_new RENAME TO epics;

    CREATE INDEX IF NOT EXISTS idx_epics_goal_id ON epics(goal_id);
  `);
}

export function down(db: DatabaseManager): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS epics_old (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO epics_old SELECT * FROM epics;
    DROP TABLE epics;
    ALTER TABLE epics_old RENAME TO epics;

    CREATE INDEX IF NOT EXISTS idx_epics_goal_id ON epics(goal_id);
  `);
}
