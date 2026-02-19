/**
 * Migration: Add execution_traces table for storing agent execution details.
 */
import type { DatabaseManager } from '../database.js';

export const MIGRATION_ID = '0006_execution_traces';

export function up(db: DatabaseManager): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS execution_traces (
      id TEXT PRIMARY KEY,
      ticket_id TEXT REFERENCES tickets(id) ON DELETE SET NULL,
      agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
      status TEXT NOT NULL,
      iterations INTEGER NOT NULL DEFAULT 0,
      tool_call_count INTEGER NOT NULL DEFAULT 0,
      conversation_history TEXT NOT NULL,
      token_usage TEXT,
      final_content TEXT,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_execution_traces_ticket_id
    ON execution_traces(ticket_id);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_execution_traces_agent_id
    ON execution_traces(agent_id);
  `);
}

export function down(db: DatabaseManager): void {
  db.exec(`DROP INDEX IF EXISTS idx_execution_traces_agent_id;`);
  db.exec(`DROP INDEX IF EXISTS idx_execution_traces_ticket_id;`);
  db.exec(`DROP TABLE IF EXISTS execution_traces;`);
}
