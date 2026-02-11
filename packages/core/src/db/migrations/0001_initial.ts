/**
 * Initial database migration — creates all 10 core tables.
 */
import type { DatabaseManager } from '../database.js';

export const MIGRATION_ID = '0001_initial';

export function up(db: DatabaseManager): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'paused')),
      progress REAL NOT NULL DEFAULT 0,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS epics (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      epic_id TEXT NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_approval'
        CHECK(status IN ('pending_approval', 'backlog', 'assigned', 'in_progress', 'verification', 'done', 'failed', 'escalated')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('critical', 'high', 'medium', 'low')),
      assigned_agent_id TEXT,
      branch TEXT,
      pr_url TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      depends_on TEXT,
      proposed_by TEXT,
      approved_at TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL CHECK(role IN ('team-lead', 'backend', 'frontend', 'qa', 'devops', 'customer')),
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle', 'running', 'completed', 'error', 'escalated')),
      provider TEXT,
      model TEXT,
      current_ticket_id TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
      ticket_id TEXT REFERENCES tickets(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      details TEXT,
      level TEXT NOT NULL DEFAULT 'info' CHECK(level IN ('info', 'warn', 'error', 'debug')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS token_usage (
      id TEXT PRIMARY KEY,
      agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
      ticket_id TEXT REFERENCES tickets(id) ON DELETE SET NULL,
      goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      estimated_cost REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conventions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('conventions', 'architecture', 'style')),
      content TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      updated_by TEXT NOT NULL DEFAULT 'team-lead' CHECK(updated_by IN ('user', 'team-lead')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('new_ticket', 'priority_change', 'improvement')),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reverse_proposals (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      suggestion TEXT NOT NULL,
      diff TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS heartbeat_logs (
      id TEXT PRIMARY KEY,
      report TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'acknowledged', 'acted')),
      interval_minutes INTEGER NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_epics_goal_id ON epics(goal_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_epic_id ON tickets(epic_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_assigned_agent ON tickets(assigned_agent_id);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_agent ON activity_logs(agent_id);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_ticket ON activity_logs(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_token_usage_agent ON token_usage(agent_id);
    CREATE INDEX IF NOT EXISTS idx_token_usage_goal ON token_usage(goal_id);
  `);
}

export function down(db: DatabaseManager): void {
  db.exec(`
    DROP TABLE IF EXISTS heartbeat_logs;
    DROP TABLE IF EXISTS reverse_proposals;
    DROP TABLE IF EXISTS proposals;
    DROP TABLE IF EXISTS conventions;
    DROP TABLE IF EXISTS token_usage;
    DROP TABLE IF EXISTS activity_logs;
    DROP TABLE IF EXISTS agents;
    DROP TABLE IF EXISTS tickets;
    DROP TABLE IF EXISTS epics;
    DROP TABLE IF EXISTS goals;
  `);
}
