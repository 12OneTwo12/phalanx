/**
 * Drizzle ORM SQLite schema for Phalanx data layer.
 * Defines all 10 core tables for goals, tickets, agents, logs, and conventions.
 */
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Common timestamp columns */
const timestamps = {
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
};

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  description: text('description').notNull(),
  status: text('status', { enum: ['active', 'completed', 'paused'] })
    .notNull()
    .default('active'),
  progress: real('progress').notNull().default(0),
  metadata: text('metadata'), // JSON string for extensibility
  ...timestamps,
});

export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;

// ---------------------------------------------------------------------------
// Epics
// ---------------------------------------------------------------------------

export const epics = sqliteTable('epics', {
  id: text('id').primaryKey(),
  goalId: text('goal_id')
    .notNull()
    .references(() => goals.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status', { enum: ['active', 'completed'] })
    .notNull()
    .default('active'),
  ...timestamps,
});

export type Epic = typeof epics.$inferSelect;
export type NewEpic = typeof epics.$inferInsert;

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export const tickets = sqliteTable('tickets', {
  id: text('id').primaryKey(),
  epicId: text('epic_id')
    .notNull()
    .references(() => epics.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  status: text('status', {
    enum: [
      'pending_approval',
      'backlog',
      'assigned',
      'in_progress',
      'verification',
      'done',
      'failed',
      'escalated',
    ],
  })
    .notNull()
    .default('pending_approval'),
  priority: text('priority', { enum: ['critical', 'high', 'medium', 'low'] })
    .notNull()
    .default('medium'),
  assignedAgentId: text('assigned_agent_id'),
  branch: text('branch'),
  prUrl: text('pr_url'),
  retryCount: integer('retry_count').notNull().default(0),
  maxRetries: integer('max_retries').notNull().default(3),
  dependsOn: text('depends_on'), // JSON array of ticket IDs
  proposedBy: text('proposed_by'), // 'team-lead' | 'user'
  approvedAt: text('approved_at'),
  metadata: text('metadata'), // JSON string
  ...timestamps,
});

export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  role: text('role', {
    enum: ['team-lead', 'backend', 'frontend', 'qa', 'devops', 'customer'],
  }).notNull(),
  name: text('name').notNull(),
  status: text('status', {
    enum: ['idle', 'running', 'completed', 'error', 'escalated'],
  })
    .notNull()
    .default('idle'),
  provider: text('provider'),
  model: text('model'),
  currentTicketId: text('current_ticket_id'),
  metadata: text('metadata'), // JSON string
  ...timestamps,
});

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;

// ---------------------------------------------------------------------------
// Activity Logs
// ---------------------------------------------------------------------------

export const activityLogs = sqliteTable('activity_logs', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
  ticketId: text('ticket_id').references(() => tickets.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  details: text('details'), // JSON string
  level: text('level', { enum: ['info', 'warn', 'error', 'debug'] })
    .notNull()
    .default('info'),
  ...timestamps,
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;

// ---------------------------------------------------------------------------
// Token Usage
// ---------------------------------------------------------------------------

export const tokenUsage = sqliteTable('token_usage', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
  ticketId: text('ticket_id').references(() => tickets.id, { onDelete: 'set null' }),
  goalId: text('goal_id').references(() => goals.id, { onDelete: 'set null' }),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  estimatedCost: real('estimated_cost').notNull().default(0),
  ...timestamps,
});

export type TokenUsageRow = typeof tokenUsage.$inferSelect;
export type NewTokenUsageRow = typeof tokenUsage.$inferInsert;

// ---------------------------------------------------------------------------
// Conventions
// ---------------------------------------------------------------------------

export const conventions = sqliteTable('conventions', {
  id: text('id').primaryKey(),
  type: text('type', { enum: ['conventions', 'architecture', 'style'] }).notNull(),
  content: text('content').notNull(),
  version: integer('version').notNull().default(1),
  updatedBy: text('updated_by', { enum: ['user', 'team-lead'] })
    .notNull()
    .default('team-lead'),
  ...timestamps,
});

export type Convention = typeof conventions.$inferSelect;
export type NewConvention = typeof conventions.$inferInsert;

// ---------------------------------------------------------------------------
// Proposals (Heartbeat suggestions)
// ---------------------------------------------------------------------------

export const proposals = sqliteTable('proposals', {
  id: text('id').primaryKey(),
  type: text('type', { enum: ['new_ticket', 'priority_change', 'improvement'] }).notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] })
    .notNull()
    .default('pending'),
  metadata: text('metadata'), // JSON string
  ...timestamps,
});

export type Proposal = typeof proposals.$inferSelect;
export type NewProposal = typeof proposals.$inferInsert;

// ---------------------------------------------------------------------------
// Reverse Proposals (Team Lead suggestions to user)
// ---------------------------------------------------------------------------

export const reverseProposals = sqliteTable('reverse_proposals', {
  id: text('id').primaryKey(),
  agentId: text('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  reason: text('reason').notNull(),
  suggestion: text('suggestion').notNull(),
  diff: text('diff'), // Proposed changes in diff format
  status: text('status', { enum: ['pending', 'approved', 'rejected'] })
    .notNull()
    .default('pending'),
  metadata: text('metadata'), // JSON string
  ...timestamps,
});

export type ReverseProposal = typeof reverseProposals.$inferSelect;
export type NewReverseProposal = typeof reverseProposals.$inferInsert;

// ---------------------------------------------------------------------------
// Heartbeat Logs
// ---------------------------------------------------------------------------

export const heartbeatLogs = sqliteTable('heartbeat_logs', {
  id: text('id').primaryKey(),
  report: text('report').notNull(), // JSON: summary + suggestions
  status: text('status', { enum: ['pending', 'acknowledged', 'acted'] })
    .notNull()
    .default('pending'),
  interval: integer('interval_minutes').notNull(), // Interval in minutes
  metadata: text('metadata'), // JSON string
  ...timestamps,
});

export type HeartbeatLog = typeof heartbeatLogs.$inferSelect;
export type NewHeartbeatLog = typeof heartbeatLogs.$inferInsert;
