/**
 * Server-side database singleton for the dashboard.
 * Lazily initializes the DatabaseManager from @phalanx/core
 * using the PHALANX_DB_PATH environment variable.
 */
import {
  DatabaseManager,
  migrateUp,
  migrateUp0002,
  migrateUp0003,
  migrateUp0004,
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
  ProviderConfigRepository,
  CredentialRepository,
  EscalationRepository,
  WorkLogRepository,
  DecisionRecordRepository,
  KnowledgeEntryRepository,
  ChannelMessageRepository,
  TicketCommentRepository,
  DebateRepository,
  DebateArgumentRepository,
  MeetingRepository,
  MeetingParticipantRepository,
} from '@phalanx/core';

const DB_PATH = process.env.PHALANX_DB_PATH ?? 'phalanx.db';

let migrated = false;

/** Get (or create) the singleton DatabaseManager, running migrations on first call */
export function getDb(): DatabaseManager {
  const db = DatabaseManager.getInstance({ path: DB_PATH });
  if (!migrated) {
    migrateUp(db);
    migrateUp0002(db);
    migrateUp0003(db);
    migrateUp0004(db);
    migrated = true;
  }
  return db;
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

export function getProviderConfigRepository() {
  return new ProviderConfigRepository(getDb().orm);
}

export function getCredentialRepository() {
  return new CredentialRepository(getDb().orm);
}

export function getEscalationRepository() {
  return new EscalationRepository(getDb().orm);
}

export function getWorkLogRepository() {
  return new WorkLogRepository(getDb().orm);
}

export function getDecisionRecordRepository() {
  return new DecisionRecordRepository(getDb().orm);
}

export function getKnowledgeEntryRepository() {
  return new KnowledgeEntryRepository(getDb().orm);
}

export function getChannelMessageRepository() {
  return new ChannelMessageRepository(getDb().orm);
}

export function getTicketCommentRepository() {
  return new TicketCommentRepository(getDb().orm);
}

export function getDebateRepository() {
  return new DebateRepository(getDb().orm);
}

export function getDebateArgumentRepository() {
  return new DebateArgumentRepository(getDb().orm);
}

export function getMeetingRepository() {
  return new MeetingRepository(getDb().orm);
}

export function getMeetingParticipantRepository() {
  return new MeetingParticipantRepository(getDb().orm);
}
