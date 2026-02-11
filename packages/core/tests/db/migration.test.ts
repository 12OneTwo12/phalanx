import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '../../src/db/database.js';
import { up, down } from '../../src/db/migrations/0001_initial.js';

describe('Migration 0001_initial', () => {
  let db: DatabaseManager;

  beforeEach(() => {
    db = DatabaseManager.create({ path: ':memory:' });
  });

  afterEach(() => {
    db.close();
  });

  it('should create all 10 tables on up', () => {
    up(db);
    const tables = db.raw
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as { name: string }[];
    const tableNames = tables.map((t) => t.name).sort();
    expect(tableNames).toEqual([
      'activity_logs',
      'agents',
      'conventions',
      'epics',
      'goals',
      'heartbeat_logs',
      'proposals',
      'reverse_proposals',
      'tickets',
      'token_usage',
    ]);
  });

  it('should drop all tables on down', () => {
    up(db);
    down(db);
    const tables = db.raw
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all();
    expect(tables).toHaveLength(0);
  });

  it('should be idempotent (up twice)', () => {
    up(db);
    up(db); // Should not throw
    const tables = db.raw
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all();
    expect(tables.length).toBe(10);
  });

  it('should create indexes', () => {
    up(db);
    const indexes = db.raw
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'")
      .all() as { name: string }[];
    expect(indexes.length).toBeGreaterThanOrEqual(8);
  });
});
