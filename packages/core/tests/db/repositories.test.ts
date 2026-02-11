import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '../../src/db/database.js';
import { up } from '../../src/db/migrations/0001_initial.js';
import {
  GoalRepository,
  EpicRepository,
  TicketRepository,
  AgentRepository,
  ActivityLogRepository,
  TokenUsageRepository,
  ConventionRepository,
  ProposalRepository,
  ReverseProposalRepository,
  HeartbeatLogRepository,
} from '../../src/db/repositories/index.js';

describe('Repositories', () => {
  let db: DatabaseManager;

  beforeEach(() => {
    db = DatabaseManager.create({ path: ':memory:' });
    up(db);
  });

  afterEach(() => {
    db.close();
  });

  // ---------------------------------------------------------------------------
  // GoalRepository
  // ---------------------------------------------------------------------------
  describe('GoalRepository', () => {
    let repo: GoalRepository;
    beforeEach(() => { repo = new GoalRepository(db.orm); });

    it('should create and find a goal', () => {
      const goal = repo.create({ id: 'g1', description: 'Build MVP' });
      expect(goal.id).toBe('g1');
      expect(goal.status).toBe('active');
      expect(goal.progress).toBe(0);

      const found = repo.findById('g1');
      expect(found?.description).toBe('Build MVP');
    });

    it('should list all goals', () => {
      repo.create({ id: 'g1', description: 'A' });
      repo.create({ id: 'g2', description: 'B' });
      expect(repo.findAll()).toHaveLength(2);
      expect(repo.findAll({ limit: 1 })).toHaveLength(1);
    });

    it('should update a goal', () => {
      repo.create({ id: 'g1', description: 'Old' });
      const updated = repo.update('g1', { description: 'New', progress: 50 });
      expect(updated?.description).toBe('New');
      expect(updated?.progress).toBe(50);
    });

    it('should return undefined when updating non-existent', () => {
      expect(repo.update('nope', { description: 'X' })).toBeUndefined();
    });

    it('should delete a goal', () => {
      repo.create({ id: 'g1', description: 'A' });
      expect(repo.delete('g1')).toBe(true);
      expect(repo.delete('g1')).toBe(false);
      expect(repo.findById('g1')).toBeUndefined();
    });

    it('should find by status', () => {
      repo.create({ id: 'g1', description: 'A', status: 'active' });
      repo.create({ id: 'g2', description: 'B', status: 'completed' });
      expect(repo.findByStatus('active')).toHaveLength(1);
      expect(repo.findByStatus('completed')).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // EpicRepository
  // ---------------------------------------------------------------------------
  describe('EpicRepository', () => {
    let goalRepo: GoalRepository;
    let repo: EpicRepository;
    beforeEach(() => {
      goalRepo = new GoalRepository(db.orm);
      repo = new EpicRepository(db.orm);
      goalRepo.create({ id: 'g1', description: 'Goal' });
    });

    it('should CRUD epics', () => {
      const epic = repo.create({ id: 'e1', goalId: 'g1', title: 'Auth' });
      expect(epic.title).toBe('Auth');
      expect(repo.findById('e1')?.goalId).toBe('g1');

      repo.update('e1', { title: 'Authentication' });
      expect(repo.findById('e1')?.title).toBe('Authentication');

      expect(repo.delete('e1')).toBe(true);
    });

    it('should find by goalId', () => {
      repo.create({ id: 'e1', goalId: 'g1', title: 'A' });
      repo.create({ id: 'e2', goalId: 'g1', title: 'B' });
      expect(repo.findByGoalId('g1')).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // TicketRepository
  // ---------------------------------------------------------------------------
  describe('TicketRepository', () => {
    let repo: TicketRepository;
    beforeEach(() => {
      new GoalRepository(db.orm).create({ id: 'g1', description: 'Goal' });
      new EpicRepository(db.orm).create({ id: 'e1', goalId: 'g1', title: 'Epic' });
      repo = new TicketRepository(db.orm);
    });

    it('should CRUD tickets', () => {
      const ticket = repo.create({ id: 't1', epicId: 'e1', title: 'Task', description: 'Do something' });
      expect(ticket.status).toBe('pending_approval');
      expect(ticket.retryCount).toBe(0);

      repo.update('t1', { status: 'backlog' });
      expect(repo.findById('t1')?.status).toBe('backlog');

      expect(repo.delete('t1')).toBe(true);
    });

    it('should find by status, epicId, agentId', () => {
      repo.create({ id: 't1', epicId: 'e1', title: 'A', description: 'X', status: 'backlog', assignedAgentId: 'a1' });
      repo.create({ id: 't2', epicId: 'e1', title: 'B', description: 'Y', status: 'in_progress' });
      expect(repo.findByStatus('backlog')).toHaveLength(1);
      expect(repo.findByEpicId('e1')).toHaveLength(2);
      expect(repo.findByAgentId('a1')).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // AgentRepository
  // ---------------------------------------------------------------------------
  describe('AgentRepository', () => {
    let repo: AgentRepository;
    beforeEach(() => { repo = new AgentRepository(db.orm); });

    it('should CRUD agents', () => {
      const agent = repo.create({ id: 'a1', role: 'backend', name: 'Backend-1' });
      expect(agent.status).toBe('idle');
      repo.update('a1', { status: 'running' });
      expect(repo.findById('a1')?.status).toBe('running');
      expect(repo.delete('a1')).toBe(true);
    });

    it('should find by role and status', () => {
      repo.create({ id: 'a1', role: 'backend', name: 'B1' });
      repo.create({ id: 'a2', role: 'qa', name: 'QA1' });
      expect(repo.findByRole('backend')).toHaveLength(1);
      expect(repo.findByStatus('idle')).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // ActivityLogRepository
  // ---------------------------------------------------------------------------
  describe('ActivityLogRepository', () => {
    let repo: ActivityLogRepository;
    beforeEach(() => { repo = new ActivityLogRepository(db.orm); });

    it('should create and query logs', () => {
      repo.create({ id: 'l1', action: 'started', agentId: null, ticketId: null });
      expect(repo.findAll()).toHaveLength(1);
      expect(repo.findById('l1')?.action).toBe('started');
    });
  });

  // ---------------------------------------------------------------------------
  // TokenUsageRepository
  // ---------------------------------------------------------------------------
  describe('TokenUsageRepository', () => {
    let repo: TokenUsageRepository;
    beforeEach(() => { repo = new TokenUsageRepository(db.orm); });

    it('should track token usage', () => {
      repo.create({ id: 'tu1', provider: 'anthropic', model: 'claude-sonnet', inputTokens: 100, outputTokens: 50 });
      const record = repo.findById('tu1');
      expect(record?.inputTokens).toBe(100);
      expect(record?.outputTokens).toBe(50);
    });
  });

  // ---------------------------------------------------------------------------
  // ConventionRepository
  // ---------------------------------------------------------------------------
  describe('ConventionRepository', () => {
    let repo: ConventionRepository;
    beforeEach(() => { repo = new ConventionRepository(db.orm); });

    it('should CRUD conventions', () => {
      repo.create({ id: 'c1', type: 'conventions', content: '# Rules' });
      expect(repo.findByType('conventions')?.content).toBe('# Rules');
      repo.update('c1', { content: '# Updated', version: 2 });
      expect(repo.findById('c1')?.version).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // ProposalRepository
  // ---------------------------------------------------------------------------
  describe('ProposalRepository', () => {
    let repo: ProposalRepository;
    beforeEach(() => { repo = new ProposalRepository(db.orm); });

    it('should CRUD proposals', () => {
      repo.create({ id: 'p1', type: 'new_ticket', title: 'Add caching', description: 'Improve perf' });
      expect(repo.findByStatus('pending')).toHaveLength(1);
      repo.update('p1', { status: 'approved' });
      expect(repo.findByStatus('approved')).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // ReverseProposalRepository
  // ---------------------------------------------------------------------------
  describe('ReverseProposalRepository', () => {
    let repo: ReverseProposalRepository;
    beforeEach(() => {
      new AgentRepository(db.orm).create({ id: 'a1', role: 'team-lead', name: 'TL' });
      repo = new ReverseProposalRepository(db.orm);
    });

    it('should CRUD reverse proposals', () => {
      repo.create({ id: 'rp1', agentId: 'a1', reason: 'Pattern detected', suggestion: 'Add error handling rule' });
      expect(repo.findByAgentId('a1')).toHaveLength(1);
      expect(repo.findByStatus('pending')).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // HeartbeatLogRepository
  // ---------------------------------------------------------------------------
  describe('HeartbeatLogRepository', () => {
    let repo: HeartbeatLogRepository;
    beforeEach(() => { repo = new HeartbeatLogRepository(db.orm); });

    it('should CRUD heartbeat logs', () => {
      repo.create({ id: 'hb1', report: '{"summary":"all good"}', interval: 30 });
      expect(repo.findByStatus('pending')).toHaveLength(1);
      repo.update('hb1', { status: 'acknowledged' });
      expect(repo.findByStatus('acknowledged')).toHaveLength(1);
    });
  });
});
