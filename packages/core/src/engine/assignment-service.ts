/**
 * Assignment service — routes tickets to agents based on category/role matching.
 */
import { EventEmitter } from 'node:events';
import type { TicketRepository } from '../db/repositories/ticket.repository.js';
import type { AgentRepository } from '../db/repositories/agent.repository.js';
import type { Agent } from '../db/schema.js';
import { TicketStateMachine } from './ticket-state-machine.js';

/** Maps ticket categories to agent roles */
const CATEGORY_ROLE_MAP: Record<string, Agent['role']> = {
  backend: 'backend',
  frontend: 'frontend',
  qa: 'qa',
  devops: 'devops',
  general: 'backend', // Default fallback
};

export class AssignmentService extends EventEmitter {
  constructor(
    private readonly ticketRepo: TicketRepository,
    private readonly agentRepo: AgentRepository,
  ) {
    super();
  }

  /**
   * Assign a ticket to a specific agent.
   */
  assign(ticketId: string, agentId: string): void {
    const ticket = this.ticketRepo.findById(ticketId);
    if (!ticket) throw new Error(`Ticket not found: ${ticketId}`);

    const agent = this.agentRepo.findById(agentId);
    if (!agent) throw new Error(`Agent not found: ${agentId}`);

    if (ticket.status !== 'backlog') {
      throw new Error(`Ticket ${ticketId} must be in backlog to assign (current: ${ticket.status})`);
    }

    const newStatus = TicketStateMachine.transition(ticket.status, 'assign');
    this.ticketRepo.update(ticketId, {
      status: newStatus,
      assignedAgentId: agentId,
    });
    this.agentRepo.update(agentId, { currentTicketId: ticketId, status: 'running' });

    this.emit('ticket:assigned', { ticketId, agentId });
  }

  /**
   * Auto-assign a ticket based on its category metadata.
   * Finds the first idle agent with a matching role.
   */
  autoAssign(ticketId: string): string | null {
    const ticket = this.ticketRepo.findById(ticketId);
    if (!ticket) throw new Error(`Ticket not found: ${ticketId}`);

    // Extract category from ticket metadata
    const metadata = ticket.metadata ? JSON.parse(ticket.metadata) as Record<string, string> : {};
    const category = metadata.category ?? 'general';
    const targetRole = CATEGORY_ROLE_MAP[category] ?? 'backend';

    // Find idle agent with matching role
    const candidates = this.agentRepo.findByRole(targetRole).filter((a) => a.status === 'idle');

    if (candidates.length === 0) {
      this.emit('assignment:noAgent', { ticketId, role: targetRole });
      return null;
    }

    // Pick the first available agent
    const agent = candidates[0];
    this.assign(ticketId, agent.id);
    return agent.id;
  }

  /**
   * Release an agent from a ticket (mark agent as idle).
   */
  release(agentId: string): void {
    this.agentRepo.update(agentId, { currentTicketId: null, status: 'idle' });
    this.emit('agent:released', { agentId });
  }
}
