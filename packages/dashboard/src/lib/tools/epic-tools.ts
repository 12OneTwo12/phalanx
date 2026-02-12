import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { Tool, ToolResult, ToolExecutionContext } from '@phalanx/core';
import { getEpicRepository } from '../db';

// -- epic_list ---------------------------------------------------------------

const epicListSchema = {
  goalId: z.string().optional().describe('Filter epics by parent goal ID'),
  limit: z.number().optional().describe('Max results (default: 50)'),
};

export const epicListTool: Tool<typeof epicListSchema> = {
  name: 'epic_list',
  description: 'List epics. Optionally filter by parent goal ID to see epics under a specific goal.',
  category: 'database',
  schema: epicListSchema,
  async execute(params, _context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const repo = getEpicRepository();
      const epics = params.goalId
        ? repo.findByGoalId(params.goalId)
        : repo.findAll({ limit: params.limit ?? 50 });
      return { success: true, content: JSON.stringify(epics, null, 2) };
    } catch (err) {
      return { success: false, content: '', error: `Failed to list epics: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

// -- epic_create -------------------------------------------------------------

const epicCreateSchema = {
  goalId: z.string().describe('Parent goal ID'),
  title: z.string().describe('Epic title'),
  description: z.string().optional().describe('Epic description'),
};

export const epicCreateTool: Tool<typeof epicCreateSchema> = {
  name: 'epic_create',
  description: 'Create a new epic under a goal. Epics group related tickets together.',
  category: 'database',
  schema: epicCreateSchema,
  async execute(params, _context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const repo = getEpicRepository();
      const epic = repo.create({
        id: randomUUID(),
        goalId: params.goalId,
        title: params.title,
        description: params.description ?? null,
        status: 'active',
      });
      return { success: true, content: JSON.stringify(epic, null, 2) };
    } catch (err) {
      return { success: false, content: '', error: `Failed to create epic: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

// -- epic_update -------------------------------------------------------------

const epicUpdateSchema = {
  id: z.string().describe('Epic ID to update'),
  title: z.string().optional().describe('New title'),
  description: z.string().optional().describe('New description'),
  status: z.enum(['active', 'completed']).optional().describe('New status'),
};

export const epicUpdateTool: Tool<typeof epicUpdateSchema> = {
  name: 'epic_update',
  description: 'Update an existing epic by ID.',
  category: 'database',
  schema: epicUpdateSchema,
  async execute(params, _context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const repo = getEpicRepository();
      const { id, ...updates } = params;
      const updated = repo.update(id, updates);
      if (!updated) return { success: false, content: '', error: `Epic not found: ${id}` };
      return { success: true, content: JSON.stringify(updated, null, 2) };
    } catch (err) {
      return { success: false, content: '', error: `Failed to update epic: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};
