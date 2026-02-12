/**
 * DebateOrchestrator — manages intra-role group debates between agents.
 *
 * Agents within the same role group can debate approaches, with the system
 * generating a conclusion from the arguments presented.
 */
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { DebateRepository } from '../db/repositories/debate.repository.js';
import type { DebateArgumentRepository } from '../db/repositories/debate-argument.repository.js';
import type { Debate, DebateArgument } from '../db/schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DebateOrchestratorDeps {
  debateRepo: DebateRepository;
  debateArgRepo: DebateArgumentRepository;
}

export interface DebateEvents {
  'debate:started': [{ debateId: string; topic: string; roleGroup: string }];
  'debate:argument': [{ debateId: string; agentId: string; round: number }];
  'debate:concluded': [{ debateId: string; conclusion: string }];
}

// ---------------------------------------------------------------------------
// DebateOrchestrator
// ---------------------------------------------------------------------------

export class DebateOrchestrator extends EventEmitter<DebateEvents> {
  constructor(private readonly deps: DebateOrchestratorDeps) {
    super();
  }

  /** Start a new debate on a topic within a role group. */
  startDebate(topic: string, roleGroup: string, initiatorId?: string): Debate {
    const debate = this.deps.debateRepo.create({
      id: randomUUID(),
      topic,
      roleGroup,
      status: 'active',
      initiatorId: initiatorId ?? null,
    });
    this.emit('debate:started', { debateId: debate.id, topic, roleGroup });
    return debate;
  }

  /** Submit an argument to an active debate. */
  submitArgument(
    debateId: string,
    agentId: string,
    position: string,
    argument: string,
    evidence?: string,
  ): DebateArgument {
    const debate = this.deps.debateRepo.findById(debateId);
    if (!debate) throw new Error(`Debate ${debateId} not found`);
    if (debate.status !== 'active') throw new Error(`Debate ${debateId} is not active`);

    // Determine the round based on existing arguments from this agent
    const existingArgs = this.deps.debateArgRepo.findByDebateId(debateId);
    const agentRounds = existingArgs.filter(a => a.agentId === agentId);
    const round = agentRounds.length + 1;

    const arg = this.deps.debateArgRepo.create({
      id: randomUUID(),
      debateId,
      agentId,
      position,
      argument,
      evidence: evidence ?? null,
      round,
    });
    this.emit('debate:argument', { debateId, agentId, round });
    return arg;
  }

  /** Conclude a debate with a summary/conclusion. */
  concludeDebate(debateId: string, conclusion: string): Debate | undefined {
    const debate = this.deps.debateRepo.findById(debateId);
    if (!debate) throw new Error(`Debate ${debateId} not found`);

    const updated = this.deps.debateRepo.update(debateId, {
      status: 'concluded',
      conclusion,
    });
    this.emit('debate:concluded', { debateId, conclusion });
    return updated;
  }

  /** Get all arguments for a debate. */
  getArguments(debateId: string): DebateArgument[] {
    return this.deps.debateArgRepo.findByDebateId(debateId);
  }

  /** Get debates by status. */
  findByStatus(status: Debate['status']): Debate[] {
    return this.deps.debateRepo.findByStatus(status);
  }
}
