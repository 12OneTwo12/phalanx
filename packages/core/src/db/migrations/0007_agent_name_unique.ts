/**
 * Migration: Add unique index on agents.name to prevent duplicate agent names.
 */
import type { DatabaseManager } from '../database.js';

export function up(db: DatabaseManager): void {
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_name ON agents(name);
  `);
}

export function down(db: DatabaseManager): void {
  db.exec(`DROP INDEX IF EXISTS idx_agents_name;`);
}
