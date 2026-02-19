/**
 * Server-side database singleton for the dashboard.
 * Lazily initializes the DatabaseManager from @phalanx/core.
 *
 * DB path resolution (in priority order):
 * 1. PHALANX_DB_PATH env var (set by CLI `serve` command)
 * 2. {projectRoot}/.phalanx/phalanx.db (auto-detected via findProjectRoot)
 */
import { resolve } from 'node:path';
import {
  DatabaseManager,
  migrateUp,
  migrateUp0002,
  migrateUp0003,
  migrateUp0004,
  migrateUp0005,
  migrateUp0006,
  migrateUp0007,
  migrateUp0008,
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
  ExecutionTraceRepository,
} from '@phalanx/core';
import { findProjectRoot } from './convention-sync';

function resolveDbPath(): string {
  if (process.env.PHALANX_DB_PATH) return process.env.PHALANX_DB_PATH;
  const projectRoot = process.env.PHALANX_PROJECT_ROOT ?? findProjectRoot(process.cwd());
  return resolve(projectRoot, '.phalanx', 'phalanx.db');
}

const DB_PATH = resolveDbPath();

let migrated = false;

/** Get (or create) the singleton DatabaseManager, running migrations on first call */
export function getDb(): DatabaseManager {
  const db = DatabaseManager.getInstance({ path: DB_PATH });
  if (!migrated) {
    migrateUp(db);
    migrateUp0002(db);
    migrateUp0003(db);
    migrateUp0004(db);
    migrateUp0005(db);
    migrateUp0006(db);
    migrateUp0007(db);
    migrateUp0008(db);
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

export function getExecutionTraceRepository() {
  return new ExecutionTraceRepository(getDb().orm);
}
