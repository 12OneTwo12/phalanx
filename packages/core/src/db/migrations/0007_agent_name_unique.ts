/**
 * Migration: Add unique index on agents.name to prevent duplicate agent names.
 * Deduplicates existing records first (keeps the one with the lowest rowid).
 */
import type { DatabaseManager } from '../database.js';

export function up(db: DatabaseManager): void {
  // Remove duplicate agent names, keeping the earliest inserted record
  db.exec(`
    DELETE FROM agents WHERE rowid NOT IN (
      SELECT MIN(rowid) FROM agents GROUP BY name
    );
  `);
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_name ON agents(name);
  `);
}

export function down(db: DatabaseManager): void {
  db.exec(`DROP INDEX IF EXISTS idx_agents_name;`);
}
