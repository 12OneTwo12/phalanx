import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { Tool, ToolResult, ToolExecutionContext } from '@phalanx/core';
import { getTicketRepository } from '../db';

const TICKET_STATUSES = [
  'pending_approval', 'backlog', 'assigned', 'in_progress',
  'verification', 'done', 'failed', 'escalated',
] as const;

const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;

// -- ticket_list -------------------------------------------------------------

const ticketListSchema = {
  status: z.enum(TICKET_STATUSES).optional().describe('Filter by ticket status'),
  epicId: z.string().optional().describe('Filter by parent epic ID'),
  agentId: z.string().optional().describe('Filter by assigned agent ID'),
  limit: z.number().optional().describe('Max results (default: 50)'),
};

export const ticketListTool: Tool<typeof ticketListSchema> = {
  name: 'ticket_list',
  description: 'List tickets. Filter by status, epic, or assigned agent. Use this to check work progress.',
  category: 'database',
  schema: ticketListSchema,
  async execute(params, _context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const repo = getTicketRepository();
      let tickets;
      if (params.status) tickets = repo.findByStatus(params.status);
      else if (params.epicId) tickets = repo.findByEpicId(params.epicId);
      else if (params.agentId) tickets = repo.findByAgentId(params.agentId);
      else tickets = repo.findAll({ limit: params.limit ?? 50 });
      return { success: true, content: JSON.stringify(tickets, null, 2) };
    } catch (err) {
      return { success: false, content: '', error: `Failed to list tickets: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

// -- ticket_create -----------------------------------------------------------

const ticketCreateSchema = {
  epicId: z.string().describe('Parent epic ID'),
  title: z.string().describe('Ticket title — concise summary of the work'),
  description: z.string().describe('Detailed description of what needs to be done'),
  priority: z.enum(PRIORITIES).optional().describe('Priority level (default: medium)'),
  assignedAgentId: z.string().optional().describe('Agent ID to assign this ticket to'),
};

export const ticketCreateTool: Tool<typeof ticketCreateSchema> = {
  name: 'ticket_create',
  description: 'Create a new ticket under an epic. Tickets represent individual units of work.',
  category: 'database',
  schema: ticketCreateSchema,
  async execute(params, _context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const repo = getTicketRepository();
      const ticket = repo.create({
        id: randomUUID(),
        epicId: params.epicId,
        title: params.title,
        description: params.description,
        status: 'backlog',
        priority: params.priority ?? 'medium',
        assignedAgentId: params.assignedAgentId ?? null,
        branch: null,
        prUrl: null,
        retryCount: 0,
        maxRetries: 3,
        dependsOn: null,
        proposedBy: 'team-lead',
        approvedAt: null,
        metadata: null,
      });
      return { success: true, content: JSON.stringify(ticket, null, 2) };
    } catch (err) {
      return { success: false, content: '', error: `Failed to create ticket: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

// -- ticket_update -----------------------------------------------------------

const ticketUpdateSchema = {
  id: z.string().describe('Ticket ID to update'),
  status: z.enum(TICKET_STATUSES).optional().describe('New status'),
  priority: z.enum(PRIORITIES).optional().describe('New priority'),
  assignedAgentId: z.string().optional().describe('Assign to agent ID'),
  title: z.string().optional().describe('New title'),
  description: z.string().optional().describe('New description'),
  branch: z.string().optional().describe('Git branch name'),
  prUrl: z.string().optional().describe('Pull request URL'),
};

export const ticketUpdateTool: Tool<typeof ticketUpdateSchema> = {
  name: 'ticket_update',
  description: 'Update a ticket by ID. Use for status transitions, priority changes, agent assignment, etc.',
  category: 'database',
  schema: ticketUpdateSchema,
  async execute(params, _context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const repo = getTicketRepository();
      const { id, ...updates } = params;
      const updated = repo.update(id, updates);
      if (!updated) return { success: false, content: '', error: `Ticket not found: ${id}` };
      return { success: true, content: JSON.stringify(updated, null, 2) };
    } catch (err) {
      return { success: false, content: '', error: `Failed to update ticket: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};
