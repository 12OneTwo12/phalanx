import { z } from 'zod';
import type { Tool, ToolResult, ToolExecutionContext } from '@phalanx/core';
import {
  getGoalRepository,
  getTicketRepository,
  getAgentRepository,
  getActivityLogRepository,
  getConventionRepository,
} from '../db';

// -- project_stats -----------------------------------------------------------

const projectStatsSchema = {};

export const projectStatsTool: Tool<typeof projectStatsSchema> = {
  name: 'project_stats',
  description: 'Get aggregated project statistics: goal counts by status, ticket breakdown, agent statuses, and recent activity. Use this to understand the overall project state.',
  category: 'database',
  schema: projectStatsSchema,
  async execute(_params: z.infer<z.ZodObject<typeof projectStatsSchema>>, _context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const goals = getGoalRepository().findAll({ limit: 100 });
      const tickets = getTicketRepository().findAll({ limit: 500 });
      const agents = getAgentRepository().findAll({ limit: 50 });
      const recentActivity = getActivityLogRepository().findAll({ limit: 10, offset: 0 });
      const conventions = getConventionRepository().findAll({ limit: 10 });

      const goalsByStatus = { active: 0, completed: 0, paused: 0 };
      for (const g of goals) goalsByStatus[g.status as keyof typeof goalsByStatus]++;

      const ticketsByStatus: Record<string, number> = {};
      for (const t of tickets) ticketsByStatus[t.status] = (ticketsByStatus[t.status] ?? 0) + 1;

      const agentsByStatus: Record<string, number> = {};
      for (const a of agents) agentsByStatus[a.status] = (agentsByStatus[a.status] ?? 0) + 1;

      const stats = {
        goals: { total: goals.length, ...goalsByStatus },
        tickets: { total: tickets.length, ...ticketsByStatus },
        agents: {
          total: agents.length,
          ...agentsByStatus,
          list: agents.map(a => ({ id: a.id, name: a.name, role: a.role, status: a.status })),
        },
        conventions: conventions.length,
        recentActivity: recentActivity.map(a => ({
          action: a.action,
          level: a.level,
          createdAt: a.createdAt,
        })),
      };

      return { success: true, content: JSON.stringify(stats, null, 2) };
    } catch (err) {
      return { success: false, content: '', error: `Failed to get stats: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

// -- convention_list ---------------------------------------------------------

const conventionListSchema = {
  type: z.enum(['conventions', 'architecture', 'style']).optional()
    .describe('Filter by convention type'),
};

export const conventionListTool: Tool<typeof conventionListSchema> = {
  name: 'convention_list',
  description: 'List project conventions. Conventions define coding standards, architecture guidelines, and style rules.',
  category: 'database',
  schema: conventionListSchema,
  async execute(params, _context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const repo = getConventionRepository();
      if (params.type) {
        const conv = repo.findByType(params.type);
        return { success: true, content: conv ? JSON.stringify(conv, null, 2) : 'No convention found for this type.' };
      }
      const all = repo.findAll({ limit: 20 });
      return { success: true, content: JSON.stringify(all, null, 2) };
    } catch (err) {
      return { success: false, content: '', error: `Failed to list conventions: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};
