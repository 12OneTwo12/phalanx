import { z } from 'zod';
import type { Tool, ToolResult, ToolExecutionContext } from '@phalanx/core';
import { getAgentRepository } from '../db';

const AGENT_ROLES = ['team-lead', 'backend', 'frontend', 'qa', 'devops', 'customer'] as const;
const AGENT_STATUSES = ['idle', 'running', 'completed', 'error', 'escalated'] as const;

// -- agent_list --------------------------------------------------------------

const agentListSchema = {
  role: z.enum(AGENT_ROLES).optional().describe('Filter by agent role'),
  status: z.enum(AGENT_STATUSES).optional().describe('Filter by agent status'),
};

export const agentListTool: Tool<typeof agentListSchema> = {
  name: 'agent_list',
  description: 'List registered agents in the team. Filter by role or status to find specific agents.',
  category: 'database',
  schema: agentListSchema,
  async execute(params, _context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const repo = getAgentRepository();
      let agents;
      if (params.role) agents = repo.findByRole(params.role);
      else if (params.status) agents = repo.findByStatus(params.status);
      else agents = repo.findAll({ limit: 50 });
      return { success: true, content: JSON.stringify(agents, null, 2) };
    } catch (err) {
      return { success: false, content: '', error: `Failed to list agents: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

// -- agent_update ------------------------------------------------------------

const agentUpdateSchema = {
  id: z.string().describe('Agent ID to update'),
  status: z.enum(AGENT_STATUSES).optional().describe('New status'),
  currentTicketId: z.string().optional().describe('Assign a ticket to this agent'),
};

export const agentUpdateTool: Tool<typeof agentUpdateSchema> = {
  name: 'agent_update',
  description: 'Update an agent status or current ticket assignment.',
  category: 'database',
  schema: agentUpdateSchema,
  async execute(params, _context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const repo = getAgentRepository();
      const { id, ...updates } = params;
      const updated = repo.update(id, updates);
      if (!updated) return { success: false, content: '', error: `Agent not found: ${id}` };
      return { success: true, content: JSON.stringify(updated, null, 2) };
    } catch (err) {
      return { success: false, content: '', error: `Failed to update agent: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};
