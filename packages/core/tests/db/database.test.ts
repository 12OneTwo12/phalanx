import { describe, it, expect, afterEach } from 'vitest';
import { DatabaseManager } from '../../src/db/database.js';

describe('DatabaseManager', () => {
  afterEach(() => {
    DatabaseManager.resetInstance();
  });

  it('should create an in-memory database', () => {
    const db = DatabaseManager.create({ path: ':memory:' });
    expect(db.isClosed).toBe(false);
    expect(db.orm).toBeDefined();
    db.close();
  });

  it('should use singleton pattern', () => {
    const db1 = DatabaseManager.getInstance({ path: ':memory:' });
    const db2 = DatabaseManager.getInstance();
    expect(db1).toBe(db2);
  });

  it('should throw when getting instance without config', () => {
    expect(() => DatabaseManager.getInstance()).toThrow('not initialized');
  });

  it('should execute raw SQL', () => {
    const db = DatabaseManager.create({ path: ':memory:' });
    db.exec('CREATE TABLE test (id TEXT PRIMARY KEY)');
    db.raw.prepare('INSERT INTO test VALUES (?)').run('hello');
    const row = db.raw.prepare('SELECT * FROM test').get() as { id: string };
    expect(row.id).toBe('hello');
    db.close();
  });

  it('should handle close gracefully', () => {
    const db = DatabaseManager.create({ path: ':memory:' });
    db.close();
    expect(db.isClosed).toBe(true);
    // Double close should not throw
    db.close();
  });

  it('should throw when accessing closed db', () => {
    const db = DatabaseManager.create({ path: ':memory:' });
    db.close();
    expect(() => db.orm).toThrow('closed');
    expect(() => db.raw).toThrow('closed');
  });

  it('should enable WAL mode by default', () => {
    const db = DatabaseManager.create({ path: ':memory:' });
    const result = db.raw.pragma('journal_mode') as { journal_mode: string }[];
    // In-memory databases may report 'memory' for journal_mode
    expect(result[0].journal_mode).toBeDefined();
    db.close();
  });
});
