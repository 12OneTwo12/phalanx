import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { Tool, ToolResult, ToolExecutionContext } from '@phalanx/core';
import { getProposalRepository } from '../db';

// -- proposal_list -----------------------------------------------------------

const proposalListSchema = {
  status: z.enum(['pending', 'approved', 'rejected']).optional()
    .describe('Filter by proposal status'),
};

export const proposalListTool: Tool<typeof proposalListSchema> = {
  name: 'proposal_list',
  description: 'List proposals. Proposals are suggestions for new tickets, priority changes, or improvements that need user approval.',
  category: 'database',
  schema: proposalListSchema,
  async execute(params, _context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const repo = getProposalRepository();
      const proposals = params.status
        ? repo.findByStatus(params.status)
        : repo.findAll({ limit: 50 });
      return { success: true, content: JSON.stringify(proposals, null, 2) };
    } catch (err) {
      return { success: false, content: '', error: `Failed to list proposals: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

// -- proposal_create ---------------------------------------------------------

const proposalCreateSchema = {
  type: z.enum(['new_ticket', 'priority_change', 'improvement'])
    .describe('Proposal type'),
  title: z.string().describe('Proposal title'),
  description: z.string().describe('Detailed description of the proposal'),
  metadata: z.string().optional().describe('JSON metadata (e.g., epicId, ticketId for priority change)'),
};

export const proposalCreateTool: Tool<typeof proposalCreateSchema> = {
  name: 'proposal_create',
  description: 'Create a proposal for the user to review. Use for suggesting new tickets, priority changes, or improvements.',
  category: 'database',
  schema: proposalCreateSchema,
  async execute(params, _context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const repo = getProposalRepository();
      const proposal = repo.create({
        id: randomUUID(),
        type: params.type,
        title: params.title,
        description: params.description,
        status: 'pending',
        metadata: params.metadata ?? null,
      });
      return { success: true, content: JSON.stringify(proposal, null, 2) };
    } catch (err) {
      return { success: false, content: '', error: `Failed to create proposal: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

// -- proposal_update ---------------------------------------------------------

const proposalUpdateSchema = {
  id: z.string().describe('Proposal ID'),
  status: z.enum(['pending', 'approved', 'rejected']).describe('New status'),
};

export const proposalUpdateTool: Tool<typeof proposalUpdateSchema> = {
  name: 'proposal_update',
  description: 'Update a proposal status (approve or reject).',
  category: 'database',
  schema: proposalUpdateSchema,
  async execute(params, _context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const repo = getProposalRepository();
      const updated = repo.update(params.id, { status: params.status });
      if (!updated) return { success: false, content: '', error: `Proposal not found: ${params.id}` };
      return { success: true, content: JSON.stringify(updated, null, 2) };
    } catch (err) {
      return { success: false, content: '', error: `Failed to update proposal: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};
