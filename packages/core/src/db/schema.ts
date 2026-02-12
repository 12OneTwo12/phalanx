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
// Users
// ---------------------------------------------------------------------------

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  lastLogin: text('last_login'),
  ...timestamps,
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

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

// ---------------------------------------------------------------------------
// Provider Configs
// ---------------------------------------------------------------------------

export const providerConfigs = sqliteTable('provider_configs', {
  id: text('id').primaryKey(),
  type: text('type', {
    enum: ['anthropic', 'openai', 'ollama', 'gemini', 'custom'],
  }).notNull(),
  name: text('name').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  defaultModel: text('default_model'),
  baseUrl: text('base_url'),
  metadata: text('metadata'),
  ...timestamps,
});

export type ProviderConfigRow = typeof providerConfigs.$inferSelect;
export type NewProviderConfigRow = typeof providerConfigs.$inferInsert;

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

export const credentials = sqliteTable('credentials', {
  id: text('id').primaryKey(),
  providerConfigId: text('provider_config_id')
    .references(() => providerConfigs.id, { onDelete: 'cascade' }),
  service: text('service').notNull(),
  encryptedValue: text('encrypted_value').notNull(),
  status: text('status', { enum: ['active', 'revoked', 'expired'] })
    .notNull()
    .default('active'),
  expiresAt: text('expires_at'),
  ...timestamps,
});

export type Credential = typeof credentials.$inferSelect;
export type NewCredential = typeof credentials.$inferInsert;

// ---------------------------------------------------------------------------
// Escalations
// ---------------------------------------------------------------------------

export const escalations = sqliteTable('escalations', {
  id: text('id').primaryKey(),
  type: text('type', {
    enum: ['resource_access', 'cost_gate', 'decision_deadlock', 'alert'],
  }).notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  options: text('options'),
  requestedBy: text('requested_by'),
  status: text('status', { enum: ['pending', 'resolved', 'dismissed'] })
    .notNull()
    .default('pending'),
  userResponse: text('user_response'),
  blockedTasks: text('blocked_tasks'),
  resolvedAt: text('resolved_at'),
  ...timestamps,
});

export type Escalation = typeof escalations.$inferSelect;
export type NewEscalation = typeof escalations.$inferInsert;

// ---------------------------------------------------------------------------
// Work Logs
// ---------------------------------------------------------------------------

export const workLogs = sqliteTable('work_logs', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
  ticketId: text('ticket_id').references(() => tickets.id, { onDelete: 'set null' }),
  action: text('action', {
    enum: ['started', 'progressed', 'completed', 'blocked'],
  }).notNull(),
  description: text('description').notNull(),
  tokensUsed: integer('tokens_used').default(0),
  ...timestamps,
});

export type WorkLog = typeof workLogs.$inferSelect;
export type NewWorkLog = typeof workLogs.$inferInsert;

// ---------------------------------------------------------------------------
// Decision Records
// ---------------------------------------------------------------------------

export const decisionRecords = sqliteTable('decision_records', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  what: text('what').notNull(),
  why: text('why').notNull(),
  alternatives: text('alternatives'),
  evidence: text('evidence'),
  madeBy: text('made_by').notNull(),
  relatedTicketId: text('related_ticket_id')
    .references(() => tickets.id, { onDelete: 'set null' }),
  ...timestamps,
});

export type DecisionRecord = typeof decisionRecords.$inferSelect;
export type NewDecisionRecord = typeof decisionRecords.$inferInsert;

// ---------------------------------------------------------------------------
// Knowledge Entries
// ---------------------------------------------------------------------------

export const knowledgeEntries = sqliteTable('knowledge_entries', {
  id: text('id').primaryKey(),
  category: text('category', {
    enum: ['architecture', 'pattern', 'failure', 'research', 'context'],
  }).notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  learnedFrom: text('learned_from'),
  createdBy: text('created_by').notNull(),
  ...timestamps,
});

export type KnowledgeEntry = typeof knowledgeEntries.$inferSelect;
export type NewKnowledgeEntry = typeof knowledgeEntries.$inferInsert;

// ---------------------------------------------------------------------------
// Ticket Comments
// ---------------------------------------------------------------------------

export const ticketComments = sqliteTable('ticket_comments', {
  id: text('id').primaryKey(),
  ticketId: text('ticket_id')
    .notNull()
    .references(() => tickets.id, { onDelete: 'cascade' }),
  author: text('author').notNull(), // agent role | 'user' | 'system'
  type: text('type', {
    enum: ['plan', 'progress', 'completion', 'review', 'comment'],
  })
    .notNull()
    .default('comment'),
  content: text('content').notNull(), // Markdown
  metadata: text('metadata'), // JSON
  ...timestamps,
});

export type TicketComment = typeof ticketComments.$inferSelect;
export type NewTicketComment = typeof ticketComments.$inferInsert;

// ---------------------------------------------------------------------------
// Debates
// ---------------------------------------------------------------------------

export const debates = sqliteTable('debates', {
  id: text('id').primaryKey(),
  topic: text('topic').notNull(),
  roleGroup: text('role_group').notNull(), // e.g. 'backend', 'frontend', 'qa'
  status: text('status', { enum: ['pending', 'active', 'concluded'] })
    .notNull()
    .default('pending'),
  initiatorId: text('initiator_id').references(() => agents.id, { onDelete: 'set null' }),
  conclusion: text('conclusion'), // LLM-generated conclusion
  metadata: text('metadata'), // JSON
  ...timestamps,
});

export type Debate = typeof debates.$inferSelect;
export type NewDebate = typeof debates.$inferInsert;

// ---------------------------------------------------------------------------
// Debate Arguments
// ---------------------------------------------------------------------------

export const debateArguments = sqliteTable('debate_arguments', {
  id: text('id').primaryKey(),
  debateId: text('debate_id')
    .notNull()
    .references(() => debates.id, { onDelete: 'cascade' }),
  agentId: text('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  position: text('position').notNull(), // e.g. 'for', 'against', 'neutral'
  argument: text('argument').notNull(),
  evidence: text('evidence'), // Supporting evidence
  round: integer('round').notNull().default(1),
  ...timestamps,
});

export type DebateArgument = typeof debateArguments.$inferSelect;
export type NewDebateArgument = typeof debateArguments.$inferInsert;

// ---------------------------------------------------------------------------
// Meetings
// ---------------------------------------------------------------------------

export const meetings = sqliteTable('meetings', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  type: text('type', { enum: ['standup', 'review', 'planning', 'retrospective'] }).notNull(),
  status: text('status', { enum: ['scheduled', 'active', 'completed'] })
    .notNull()
    .default('scheduled'),
  facilitatorId: text('facilitator_id').references(() => agents.id, { onDelete: 'set null' }),
  agenda: text('agenda'), // Markdown
  minutes: text('minutes'), // LLM-generated minutes
  summary: text('summary'), // Brief summary
  metadata: text('metadata'), // JSON
  ...timestamps,
});

export type Meeting = typeof meetings.$inferSelect;
export type NewMeeting = typeof meetings.$inferInsert;

// ---------------------------------------------------------------------------
// Meeting Participants
// ---------------------------------------------------------------------------

export const meetingParticipants = sqliteTable('meeting_participants', {
  id: text('id').primaryKey(),
  meetingId: text('meeting_id')
    .notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  agentId: text('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // e.g. 'presenter', 'participant', 'observer'
  contributions: text('contributions'), // Markdown: what this agent contributed
  ...timestamps,
});

export type MeetingParticipant = typeof meetingParticipants.$inferSelect;
export type NewMeetingParticipant = typeof meetingParticipants.$inferInsert;

// ---------------------------------------------------------------------------
// Channel Messages
// ---------------------------------------------------------------------------

export const channelMessages = sqliteTable('channel_messages', {
  id: text('id').primaryKey(),
  role: text('role', { enum: ['user', 'team-lead'] }).notNull(),
  content: text('content').notNull(),
  channelProvider: text('channel_provider').notNull().default('web'),
  channelId: text('channel_id').notNull().default('dashboard'),
  senderId: text('sender_id'),
  senderName: text('sender_name'),
  replyToId: text('reply_to_id'),
  threadId: text('thread_id'),
  metadata: text('metadata'),
  ...timestamps,
});

export type ChannelMessage = typeof channelMessages.$inferSelect;
export type NewChannelMessage = typeof channelMessages.$inferInsert;
