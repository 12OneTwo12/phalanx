/**
 * Shared helpers for integration tests.
 * Sets up in-memory SQLite with all tables and repositories.
 */
import { DatabaseManager, migrateUp } from '../../src/db/index.js';
import { GoalRepository } from '../../src/db/repositories/goal.repository.js';
import { EpicRepository } from '../../src/db/repositories/epic.repository.js';
import { TicketRepository } from '../../src/db/repositories/ticket.repository.js';
import { AgentRepository } from '../../src/db/repositories/agent.repository.js';
import { ActivityLogRepository } from '../../src/db/repositories/activity-log.repository.js';
import { ProposalRepository } from '../../src/db/repositories/proposal.repository.js';
import { ReverseProposalRepository } from '../../src/db/repositories/reverse-proposal.repository.js';
import { HeartbeatLogRepository } from '../../src/db/repositories/heartbeat-log.repository.js';

export interface TestContext {
  db: DatabaseManager;
  repos: {
    goal: GoalRepository;
    epic: EpicRepository;
    ticket: TicketRepository;
    agent: AgentRepository;
    activityLog: ActivityLogRepository;
    proposal: ProposalRepository;
    reverseProposal: ReverseProposalRepository;
    heartbeatLog: HeartbeatLogRepository;
  };
}

export function setupTestDb(): TestContext {
  const db = DatabaseManager.create({ path: ':memory:', walMode: false });
  migrateUp(db);

  return {
    db,
    repos: {
      goal: new GoalRepository(db.orm),
      epic: new EpicRepository(db.orm),
      ticket: new TicketRepository(db.orm),
      agent: new AgentRepository(db.orm),
      activityLog: new ActivityLogRepository(db.orm),
      proposal: new ProposalRepository(db.orm),
      reverseProposal: new ReverseProposalRepository(db.orm),
      heartbeatLog: new HeartbeatLogRepository(db.orm),
    },
  };
}
