/**
 * Server-side database singleton for the dashboard.
 * Lazily initializes the DatabaseManager from @phalanx/core
 * using the PHALANX_DB_PATH environment variable.
 */
import {
  DatabaseManager,
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
} from '@phalanx/core';

const DB_PATH = process.env.PHALANX_DB_PATH ?? 'phalanx.db';

/** Get (or create) the singleton DatabaseManager */
export function getDb(): DatabaseManager {
  return DatabaseManager.getInstance({ path: DB_PATH });
}

/** Pre-built repository accessors */
export function getGoalRepository() {
  return new GoalRepository(getDb().orm);
}

export function getEpicRepository() {
  return new EpicRepository(getDb().orm);
}

export function getTicketRepository() {
  return new TicketRepository(getDb().orm);
}

export function getAgentRepository() {
  return new AgentRepository(getDb().orm);
}

export function getActivityLogRepository() {
  return new ActivityLogRepository(getDb().orm);
}

export function getTokenUsageRepository() {
  return new TokenUsageRepository(getDb().orm);
}

export function getConventionRepository() {
  return new ConventionRepository(getDb().orm);
}

export function getProposalRepository() {
  return new ProposalRepository(getDb().orm);
}

export function getReverseProposalRepository() {
  return new ReverseProposalRepository(getDb().orm);
}

export function getHeartbeatLogRepository() {
  return new HeartbeatLogRepository(getDb().orm);
}
