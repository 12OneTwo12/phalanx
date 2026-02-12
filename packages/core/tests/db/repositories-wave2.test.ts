import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '../../src/db/database.js';
import { up as migrateUp0001 } from '../../src/db/migrations/0001_initial.js';
import { up as migrateUp0002 } from '../../src/db/migrations/0002_add_missing_tables.js';
import { up as migrateUp0005 } from '../../src/db/migrations/0005_channel_providers.js';
import {
  ProviderConfigRepository,
  CredentialRepository,
  EscalationRepository,
  WorkLogRepository,
  DecisionRecordRepository,
  KnowledgeEntryRepository,
  ChannelMessageRepository,
} from '../../src/db/repositories/index.js';

describe('Repositories Wave 2', () => {
  let db: DatabaseManager;

  beforeEach(() => {
    db = DatabaseManager.create({ path: ':memory:' });
    migrateUp0001(db);
    migrateUp0002(db);
    migrateUp0005(db);
  });

  afterEach(() => {
    db.close();
  });

  // ---------------------------------------------------------------------------
  // ProviderConfigRepository
  // ---------------------------------------------------------------------------
  describe('ProviderConfigRepository', () => {
    let repo: ProviderConfigRepository;
    beforeEach(() => { repo = new ProviderConfigRepository(db.orm); });

    it('should create and find a provider config', () => {
      const config = repo.create({ id: 'pc1', type: 'anthropic', name: 'Anthropic Claude' });
      expect(config.id).toBe('pc1');
      expect(config.type).toBe('anthropic');
      expect(config.enabled).toBe(true);

      const found = repo.findById('pc1');
      expect(found?.name).toBe('Anthropic Claude');
    });

    it('should find by type', () => {
      repo.create({ id: 'pc1', type: 'anthropic', name: 'Claude' });
      repo.create({ id: 'pc2', type: 'openai', name: 'GPT' });
      repo.create({ id: 'pc3', type: 'anthropic', name: 'Claude 2' });

      expect(repo.findByType('anthropic')).toHaveLength(2);
      expect(repo.findByType('openai')).toHaveLength(1);
      expect(repo.findByType('ollama')).toHaveLength(0);
    });

    it('should find enabled providers', () => {
      repo.create({ id: 'pc1', type: 'anthropic', name: 'Active', enabled: true });
      repo.create({ id: 'pc2', type: 'openai', name: 'Disabled', enabled: false });

      const enabled = repo.findEnabled();
      expect(enabled).toHaveLength(1);
      expect(enabled[0].name).toBe('Active');
    });

    it('should update and delete', () => {
      repo.create({ id: 'pc1', type: 'anthropic', name: 'Original' });
      repo.update('pc1', { name: 'Updated' });
      expect(repo.findById('pc1')?.name).toBe('Updated');

      expect(repo.delete('pc1')).toBe(true);
      expect(repo.findById('pc1')).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // CredentialRepository
  // ---------------------------------------------------------------------------
  describe('CredentialRepository', () => {
    let repo: CredentialRepository;
    let configRepo: ProviderConfigRepository;

    beforeEach(() => {
      configRepo = new ProviderConfigRepository(db.orm);
      repo = new CredentialRepository(db.orm);
      configRepo.create({ id: 'pc1', type: 'anthropic', name: 'Anthropic' });
    });

    it('should create and find credentials', () => {
      const cred = repo.create({
        id: 'c1',
        providerConfigId: 'pc1',
        service: 'anthropic',
        encryptedValue: 'enc-key-123',
      });
      expect(cred.status).toBe('active');
      expect(repo.findById('c1')?.encryptedValue).toBe('enc-key-123');
    });

    it('should find by provider ID', () => {
      repo.create({ id: 'c1', providerConfigId: 'pc1', service: 'anthropic', encryptedValue: 'k1' });
      repo.create({ id: 'c2', providerConfigId: 'pc1', service: 'anthropic', encryptedValue: 'k2' });
      expect(repo.findByProviderId('pc1')).toHaveLength(2);
    });

    it('should find by service', () => {
      repo.create({ id: 'c1', providerConfigId: 'pc1', service: 'anthropic', encryptedValue: 'k1' });
      repo.create({ id: 'c2', providerConfigId: 'pc1', service: 'openai', encryptedValue: 'k2' });
      expect(repo.findByService('anthropic')).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // EscalationRepository
  // ---------------------------------------------------------------------------
  describe('EscalationRepository', () => {
    let repo: EscalationRepository;
    beforeEach(() => { repo = new EscalationRepository(db.orm); });

    it('should create and find an escalation', () => {
      const esc = repo.create({
        id: 'e1',
        type: 'cost_gate',
        title: 'Budget exceeded',
        description: 'Token budget at 100%',
      });
      expect(esc.status).toBe('pending');
      expect(repo.findById('e1')?.title).toBe('Budget exceeded');
    });

    it('should find by status', () => {
      repo.create({ id: 'e1', type: 'alert', title: 'A', description: 'D' });
      repo.create({ id: 'e2', type: 'alert', title: 'B', description: 'D' });
      repo.update('e2', { status: 'resolved' });

      expect(repo.findByStatus('pending')).toHaveLength(1);
      expect(repo.findByStatus('resolved')).toHaveLength(1);
    });

    it('should find pending', () => {
      repo.create({ id: 'e1', type: 'alert', title: 'A', description: 'D' });
      expect(repo.findPending()).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // WorkLogRepository
  // ---------------------------------------------------------------------------
  describe('WorkLogRepository', () => {
    let repo: WorkLogRepository;

    beforeEach(() => {
      repo = new WorkLogRepository(db.orm);
    });

    it('should create and find work logs', () => {
      const log = repo.create({
        id: 'wl1',
        date: '2026-02-12',
        action: 'started',
        description: 'Started working on auth',
      });
      expect(log.action).toBe('started');
      expect(repo.findAll()).toHaveLength(1);
    });

    it('should find by agent ID', () => {
      db.exec(`INSERT INTO agents (id, role, name) VALUES ('a1', 'backend', 'Agent 1')`);
      repo.create({ id: 'wl1', date: '2026-02-12', agentId: 'a1', action: 'started', description: 'A' });
      repo.create({ id: 'wl2', date: '2026-02-12', action: 'progressed', description: 'B' });
      expect(repo.findByAgentId('a1')).toHaveLength(1);
    });

    it('should find by date', () => {
      repo.create({ id: 'wl1', date: '2026-02-12', action: 'started', description: 'A' });
      repo.create({ id: 'wl2', date: '2026-02-13', action: 'completed', description: 'B' });
      expect(repo.findByDate('2026-02-12')).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // DecisionRecordRepository
  // ---------------------------------------------------------------------------
  describe('DecisionRecordRepository', () => {
    let repo: DecisionRecordRepository;
    beforeEach(() => { repo = new DecisionRecordRepository(db.orm); });

    it('should create and find decision records', () => {
      const dr = repo.create({
        id: 'dr1',
        title: 'Use SQLite',
        what: 'Chose SQLite over PostgreSQL',
        why: 'Simpler deployment, no server needed',
        madeBy: 'team-lead',
      });
      expect(dr.title).toBe('Use SQLite');
      expect(repo.findById('dr1')?.why).toBe('Simpler deployment, no server needed');
    });

    it('should find by ticket ID', () => {
      // Insert parent rows in FK order: goals → epics → tickets
      db.exec(`INSERT INTO goals (id, description) VALUES ('g1', 'Goal')`);
      db.exec(`INSERT INTO epics (id, goal_id, title) VALUES ('ep1', 'g1', 'E1')`);
      db.exec(`INSERT INTO tickets (id, epic_id, title, description) VALUES ('t1', 'ep1', 'T1', 'D1')`);

      repo.create({ id: 'dr1', title: 'A', what: 'W', why: 'Y', madeBy: 'ai', relatedTicketId: 't1' });
      repo.create({ id: 'dr2', title: 'B', what: 'W', why: 'Y', madeBy: 'ai', relatedTicketId: 't1' });
      repo.create({ id: 'dr3', title: 'C', what: 'W', why: 'Y', madeBy: 'ai' });

      expect(repo.findByTicketId('t1')).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // KnowledgeEntryRepository
  // ---------------------------------------------------------------------------
  describe('KnowledgeEntryRepository', () => {
    let repo: KnowledgeEntryRepository;
    beforeEach(() => { repo = new KnowledgeEntryRepository(db.orm); });

    it('should create and find knowledge entries', () => {
      const ke = repo.create({
        id: 'ke1',
        category: 'pattern',
        title: 'Repository Pattern',
        content: 'Use BaseRepository for all DB access',
        createdBy: 'team-lead',
      });
      expect(ke.category).toBe('pattern');
    });

    it('should find by category', () => {
      repo.create({ id: 'ke1', category: 'pattern', title: 'A', content: 'C', createdBy: 'ai' });
      repo.create({ id: 'ke2', category: 'failure', title: 'B', content: 'C', createdBy: 'ai' });
      repo.create({ id: 'ke3', category: 'pattern', title: 'C', content: 'C', createdBy: 'ai' });

      expect(repo.findByCategory('pattern')).toHaveLength(2);
      expect(repo.findByCategory('failure')).toHaveLength(1);
      expect(repo.findByCategory('architecture')).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // ChannelMessageRepository
  // ---------------------------------------------------------------------------
  describe('ChannelMessageRepository', () => {
    let repo: ChannelMessageRepository;
    beforeEach(() => { repo = new ChannelMessageRepository(db.orm); });

    it('should create and find messages', () => {
      const msg = repo.create({ id: 'm1', role: 'user', content: 'Hello' });
      expect(msg.role).toBe('user');
      expect(repo.findById('m1')?.content).toBe('Hello');
    });

    it('should find by role', () => {
      repo.create({ id: 'm1', role: 'user', content: 'Hello' });
      repo.create({ id: 'm2', role: 'team-lead', content: 'Hi!' });
      repo.create({ id: 'm3', role: 'user', content: 'What is the status?' });

      expect(repo.findByRole('user')).toHaveLength(2);
      expect(repo.findByRole('team-lead')).toHaveLength(1);
    });

    it('should find recent messages', () => {
      for (let i = 0; i < 5; i++) {
        repo.create({ id: `m${i}`, role: 'user', content: `Message ${i}` });
      }
      const recent = repo.findRecent(3);
      expect(recent).toHaveLength(3);
    });

    it('should delete messages', () => {
      repo.create({ id: 'm1', role: 'user', content: 'test' });
      expect(repo.delete('m1')).toBe(true);
      expect(repo.findById('m1')).toBeUndefined();
    });
  });
});
