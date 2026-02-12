import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { Tool, ToolResult, ToolExecutionContext } from '@phalanx/core';
import { getGoalRepository } from '../db';

// -- goal_list ---------------------------------------------------------------

const goalListSchema = {
  status: z.enum(['active', 'completed', 'paused']).optional()
    .describe('Filter goals by status'),
  limit: z.number().optional().describe('Max results (default: 20)'),
};

export const goalListTool: Tool<typeof goalListSchema> = {
  name: 'goal_list',
  description: 'List goals from the project database. Returns all goals or filtered by status. Use this to understand what the team is working on.',
  category: 'database',
  schema: goalListSchema,
  async execute(params, _context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const repo = getGoalRepository();
      const goals = params.status
        ? repo.findByStatus(params.status)
        : repo.findAll({ limit: params.limit ?? 20 });
      return { success: true, content: JSON.stringify(goals, null, 2) };
    } catch (err) {
      return { success: false, content: '', error: `Failed to list goals: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

// -- goal_create -------------------------------------------------------------

const goalCreateSchema = {
  description: z.string().describe('Goal description — what should be achieved'),
  status: z.enum(['active', 'completed', 'paused']).optional()
    .describe('Initial status (default: active)'),
  metadata: z.string().optional().describe('Optional JSON metadata string'),
};

export const goalCreateTool: Tool<typeof goalCreateSchema> = {
  name: 'goal_create',
  description: 'Create a new goal in the project database. After creating, consider decomposing it into epics and tickets.',
  category: 'database',
  schema: goalCreateSchema,
  async execute(params, _context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const repo = getGoalRepository();
      const goal = repo.create({
        id: randomUUID(),
        description: params.description,
        status: params.status ?? 'active',
        progress: 0,
        metadata: params.metadata ?? null,
      });
      return { success: true, content: JSON.stringify(goal, null, 2) };
    } catch (err) {
      return { success: false, content: '', error: `Failed to create goal: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

// -- goal_update -------------------------------------------------------------

const goalUpdateSchema = {
  id: z.string().describe('Goal ID to update'),
  description: z.string().optional().describe('New description'),
  status: z.enum(['active', 'completed', 'paused']).optional().describe('New status'),
  progress: z.number().min(0).max(100).optional().describe('Progress percentage (0-100)'),
  metadata: z.string().optional().describe('JSON metadata string'),
};

export const goalUpdateTool: Tool<typeof goalUpdateSchema> = {
  name: 'goal_update',
  description: 'Update an existing goal by ID. You can change description, status, or progress.',
  category: 'database',
  schema: goalUpdateSchema,
  async execute(params, _context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const repo = getGoalRepository();
      const { id, ...updates } = params;
      const updated = repo.update(id, updates);
      if (!updated) return { success: false, content: '', error: `Goal not found: ${id}` };
      return { success: true, content: JSON.stringify(updated, null, 2) };
    } catch (err) {
      return { success: false, content: '', error: `Failed to update goal: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

// -- goal_delete -------------------------------------------------------------

const goalDeleteSchema = {
  id: z.string().describe('Goal ID to delete. WARNING: this cascades to all epics and tickets under this goal.'),
};

export const goalDeleteTool: Tool<typeof goalDeleteSchema> = {
  name: 'goal_delete',
  description: 'Delete a goal by ID. WARNING: this cascades — all epics and tickets under this goal will also be deleted.',
  category: 'database',
  schema: goalDeleteSchema,
  async execute(params, _context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const repo = getGoalRepository();
      const deleted = repo.delete(params.id);
      if (!deleted) return { success: false, content: '', error: `Goal not found: ${params.id}` };
      return { success: true, content: `Goal ${params.id} deleted successfully.` };
    } catch (err) {
      return { success: false, content: '', error: `Failed to delete goal: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};
