/**
 * Migration: Add debates and meetings tables for agent collaboration.
 */
import type { DatabaseManager } from '../database.js';

export const MIGRATION_ID = '0004_debates_meetings';

export function up(db: DatabaseManager): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS debates (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      role_group TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'concluded')),
      initiator_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
      conclusion TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_debates_status ON debates(status);
    CREATE INDEX IF NOT EXISTS idx_debates_role_group ON debates(role_group);

    CREATE TABLE IF NOT EXISTS debate_arguments (
      id TEXT PRIMARY KEY,
      debate_id TEXT NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      position TEXT NOT NULL,
      argument TEXT NOT NULL,
      evidence TEXT,
      round INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_debate_arguments_debate_id ON debate_arguments(debate_id);

    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('standup', 'review', 'planning', 'retrospective')),
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'active', 'completed')),
      facilitator_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
      agenda TEXT,
      minutes TEXT,
      summary TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
    CREATE INDEX IF NOT EXISTS idx_meetings_type ON meetings(type);

    CREATE TABLE IF NOT EXISTS meeting_participants (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      contributions TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting_id ON meeting_participants(meeting_id);
  `);
}

export function down(db: DatabaseManager): void {
  db.exec(`
    DROP INDEX IF EXISTS idx_meeting_participants_meeting_id;
    DROP TABLE IF EXISTS meeting_participants;
    DROP INDEX IF EXISTS idx_meetings_type;
    DROP INDEX IF EXISTS idx_meetings_status;
    DROP TABLE IF EXISTS meetings;
    DROP INDEX IF EXISTS idx_debate_arguments_debate_id;
    DROP TABLE IF EXISTS debate_arguments;
    DROP INDEX IF EXISTS idx_debates_role_group;
    DROP INDEX IF EXISTS idx_debates_status;
    DROP TABLE IF EXISTS debates;
  `);
}
