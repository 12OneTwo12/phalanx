/**
 * Migration: Add missing tables from PLANNING.md
 * Tables: provider_configs, credentials, escalations, work_logs,
 *         decision_records, knowledge_entries, channel_messages
 */
import type { DatabaseManager } from '../database.js';

export const MIGRATION_ID = '0002_add_missing_tables';

export function up(db: DatabaseManager): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS provider_configs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('anthropic', 'openai', 'ollama', 'gemini', 'custom')),
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      default_model TEXT,
      base_url TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS credentials (
      id TEXT PRIMARY KEY,
      provider_config_id TEXT REFERENCES provider_configs(id) ON DELETE CASCADE,
      service TEXT NOT NULL,
      encrypted_value TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'revoked', 'expired')),
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS escalations (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('resource_access', 'cost_gate', 'decision_deadlock', 'alert')),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      options TEXT,
      requested_by TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'resolved', 'dismissed')),
      user_response TEXT,
      blocked_tasks TEXT,
      resolved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS work_logs (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
      ticket_id TEXT REFERENCES tickets(id) ON DELETE SET NULL,
      action TEXT NOT NULL CHECK(action IN ('started', 'progressed', 'completed', 'blocked')),
      description TEXT NOT NULL,
      tokens_used INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS decision_records (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      what TEXT NOT NULL,
      why TEXT NOT NULL,
      alternatives TEXT,
      evidence TEXT,
      made_by TEXT NOT NULL,
      related_ticket_id TEXT REFERENCES tickets(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS knowledge_entries (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL CHECK(category IN ('architecture', 'pattern', 'failure', 'research', 'context')),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      learned_from TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS channel_messages (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL CHECK(role IN ('user', 'team-lead')),
      content TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_credentials_provider ON credentials(provider_config_id);
    CREATE INDEX IF NOT EXISTS idx_escalations_status ON escalations(status);
    CREATE INDEX IF NOT EXISTS idx_work_logs_agent ON work_logs(agent_id);
    CREATE INDEX IF NOT EXISTS idx_work_logs_date ON work_logs(date);
    CREATE INDEX IF NOT EXISTS idx_decision_records_ticket ON decision_records(related_ticket_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_entries_category ON knowledge_entries(category);
    CREATE INDEX IF NOT EXISTS idx_channel_messages_role ON channel_messages(role);
  `);
}

export function down(db: DatabaseManager): void {
  db.exec(`
    DROP TABLE IF EXISTS channel_messages;
    DROP TABLE IF EXISTS knowledge_entries;
    DROP TABLE IF EXISTS decision_records;
    DROP TABLE IF EXISTS work_logs;
    DROP TABLE IF EXISTS escalations;
    DROP TABLE IF EXISTS credentials;
    DROP TABLE IF EXISTS provider_configs;
  `);
}
