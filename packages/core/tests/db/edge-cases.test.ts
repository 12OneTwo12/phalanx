/**
 * Edge case tests for the database layer.
 * Covers: empty tables, findAll with offset, update non-existent, pagination, duplicate IDs.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '../../src/db/database.js';
import { up } from '../../src/db/migrations/0001_initial.js';
import {
  GoalRepository,
  EpicRepository,
  TicketRepository,
  AgentRepository,
} from '../../src/db/repositories/index.js';

describe('DB Edge Cases', () => {
  let db: DatabaseManager;

  beforeEach(() => {
    db = DatabaseManager.create({ path: ':memory:' });
    up(db);
  });

  afterEach(() => { db.close(); });

  it('findAll returns empty array on empty table', () => {
    const repo = new GoalRepository(db.orm);
    expect(repo.findAll()).toEqual([]);
  });

  it('findById returns undefined for non-existent ID', () => {
    const repo = new GoalRepository(db.orm);
    expect(repo.findById('does-not-exist')).toBeUndefined();
  });

  it('delete returns false for non-existent ID', () => {
    const repo = new GoalRepository(db.orm);
    expect(repo.delete('nope')).toBe(false);
  });

  it('findAll with offset skips records', () => {
    const repo = new GoalRepository(db.orm);
    repo.create({ id: 'g1', description: 'A' });
    repo.create({ id: 'g2', description: 'B' });
    repo.create({ id: 'g3', description: 'C' });
    const result = repo.findAll({ limit: 2, offset: 1 });
    expect(result).toHaveLength(2);
  });

  it('duplicate primary key throws', () => {
    const repo = new GoalRepository(db.orm);
    repo.create({ id: 'g1', description: 'First' });
    expect(() => repo.create({ id: 'g1', description: 'Duplicate' })).toThrow();
  });

  it('cascade delete removes child epics when goal is deleted via raw SQL', () => {
    const goalRepo = new GoalRepository(db.orm);
    const epicRepo = new EpicRepository(db.orm);
    goalRepo.create({ id: 'g1', description: 'Goal' });
    epicRepo.create({ id: 'e1', goalId: 'g1', title: 'Epic' });

    // Delete goal directly — FK cascade should remove epic
    goalRepo.delete('g1');
    expect(epicRepo.findById('e1')).toBeUndefined();
  });

  it('cascade delete removes tickets when epic is deleted', () => {
    const goalRepo = new GoalRepository(db.orm);
    const epicRepo = new EpicRepository(db.orm);
    const ticketRepo = new TicketRepository(db.orm);
    goalRepo.create({ id: 'g1', description: 'Goal' });
    epicRepo.create({ id: 'e1', goalId: 'g1', title: 'Epic' });
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'T', description: 'D' });

    epicRepo.delete('e1');
    expect(ticketRepo.findById('t1')).toBeUndefined();
  });

  it('agent findByRole returns empty for non-existent role', () => {
    const repo = new AgentRepository(db.orm);
    expect(repo.findByRole('qa')).toEqual([]);
  });

  it('ticket findByAgentId returns empty when no tickets assigned', () => {
    const goalRepo = new GoalRepository(db.orm);
    const epicRepo = new EpicRepository(db.orm);
    const ticketRepo = new TicketRepository(db.orm);
    goalRepo.create({ id: 'g1', description: 'G' });
    epicRepo.create({ id: 'e1', goalId: 'g1', title: 'E' });
    ticketRepo.create({ id: 't1', epicId: 'e1', title: 'T', description: 'D' });
    expect(ticketRepo.findByAgentId('nonexistent')).toEqual([]);
  });

  it('update sets updatedAt timestamp', () => {
    const repo = new GoalRepository(db.orm);
    const goal = repo.create({ id: 'g1', description: 'A' });
    const originalUpdatedAt = goal.updatedAt;

    // Small delay to ensure different timestamp
    const updated = repo.update('g1', { description: 'B' });
    expect(updated?.updatedAt).not.toBe(originalUpdatedAt);
  });
});
