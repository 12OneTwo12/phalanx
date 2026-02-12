/**
 * DaemonWiring — central event hub connecting all engine services.
 *
 * SRP: Only responsibility is event routing between services. No business logic.
 * DIP: All dependencies injected. No hardcoded service references.
 *
 * Event flow:
 *   heartbeat:report → persist proposals to DB
 *   proposal:approved → execute proposal side effects
 *   ticket:submitted → verification → pass/fail/escalation
 *   verification:passed → goal progress + release agent
 *   verification:escalated → escalation record + release agent
 *   Smart assignment: backlog tickets → analyze → assign
 */
import { randomUUID } from 'node:crypto';
import type { EventEmitter } from 'node:events';
import type { HeartbeatService } from '../heartbeat/heartbeat-service.js';
import type { HeartbeatReport } from '../heartbeat/types.js';
import type { Orchestrator } from './orchestrator.js';
import type { OrchestratorScheduler } from './orchestrator-scheduler.js';
import type { VerificationService } from './verification-service.js';
import type { ProposalService } from './proposal-service.js';
import type { ProposalExecutor } from './proposal-executor.js';
import type { CompletionHandler } from './completion-handler.js';
import type { SmartAssignmentService } from './smart-assignment-service.js';
import type { ProposalRepository } from '../db/repositories/proposal.repository.js';
import type { TicketRepository } from '../db/repositories/ticket.repository.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DaemonDeps {
  heartbeatService: HeartbeatService;
  orchestrator: Orchestrator;
  orchestratorScheduler: OrchestratorScheduler;
  verificationService: VerificationService;
  proposalService: ProposalService;
  proposalExecutor: ProposalExecutor;
  completionHandler: CompletionHandler;
  smartAssignment?: SmartAssignmentService;
  proposalRepo: ProposalRepository;
  ticketRepo: TicketRepository;
  /** Optional SSE event emitter for dashboard integration */
  eventBus?: { emit(type: string, payload?: Record<string, unknown>): void };
}

// ---------------------------------------------------------------------------
// DaemonWiring
// ---------------------------------------------------------------------------

export class DaemonWiring {
  private readonly cleanups: Array<() => void> = [];
  private started = false;

  constructor(private readonly deps: DaemonDeps) {}

  /**
   * Register all event listeners between services.
   * Call this once before start().
   */
  wire(): void {
    const {
      heartbeatService,
      orchestrator,
      verificationService,
      proposalService,
      proposalExecutor,
      completionHandler,
      smartAssignment,
      proposalRepo,
      ticketRepo,
      eventBus,
    } = this.deps;

    // 1. Heartbeat → persist proposals to DB + SSE
    this.on(heartbeatService, 'heartbeat:report', (data: { report: HeartbeatReport }) => {
      for (const p of data.report.proposals) {
        proposalRepo.create({
          id: randomUUID(),
          type: p.type,
          title: p.title,
          description: p.description,
          status: 'pending',
        });
      }
      eventBus?.emit('heartbeat:report', { report: data.report });
    });

    // 2. Proposal approved → execute side effects
    this.on(proposalService, 'proposal:approved', (data: { proposalId: string }) => {
      const result = proposalExecutor.execute(data.proposalId);
      eventBus?.emit('proposal:executed', { result });
    });

    // 3. Ticket submitted → verification
    this.on(orchestrator, 'ticket:submitted', (data: { ticketId: string }) => {
      void completionHandler.handleSubmitted(data.ticketId);
      eventBus?.emit('ticket:submitted', { ticketId: data.ticketId });
    });

    // 4. Verification results → completion actions
    this.on(verificationService, 'verification:passed', (data: { ticketId: string }) => {
      completionHandler.handlePass(data.ticketId);
      eventBus?.emit('verification:passed', { ticketId: data.ticketId });
    });

    this.on(verificationService, 'verification:escalated', (data: { ticketId: string }) => {
      completionHandler.handleEscalation(data.ticketId);
      eventBus?.emit('verification:escalated', { ticketId: data.ticketId });
    });

    this.on(verificationService, 'verification:failed', (data: { ticketId: string; feedback?: string }) => {
      // Ticket goes back to in_progress. Orchestrator will re-process it on next tick.
      eventBus?.emit('verification:failed', { ticketId: data.ticketId, feedback: data.feedback });
    });

    // 5. Ticket approved (enters backlog) → smart assign
    if (smartAssignment) {
      const sa = smartAssignment;
      // Listen for approval events from the approval flow
      // When a ticket enters backlog, auto-assign via smart assignment
      this.on(orchestrator, 'ticket:started', () => {
        // Check for any unassigned backlog tickets and assign them
        const backlog = ticketRepo.findByStatus('backlog');
        for (const ticket of backlog) {
          void sa.smartAssign(ticket.id).catch(() => {
            // Assignment failure is non-fatal; will retry on next tick
          });
        }
      });
    }

    // 6. Forward key orchestrator events to SSE
    if (eventBus) {
      this.on(orchestrator, 'ticket:started', (data: { ticketId: string }) => {
        eventBus.emit('ticket:started', { ticketId: data.ticketId });
      });
      this.on(orchestrator, 'ticket:failed', (data: { ticketId: string; error?: string }) => {
        eventBus.emit('ticket:failed', { ticketId: data.ticketId, error: data.error });
      });
      this.on(completionHandler, 'ticket:completed', (data: { ticketId: string }) => {
        eventBus.emit('ticket:completed', { ticketId: data.ticketId });
      });
      this.on(completionHandler, 'ticket:escalated', (data: { ticketId: string }) => {
        eventBus.emit('ticket:escalated', { ticketId: data.ticketId });
      });
      this.on(completionHandler, 'goal:progressUpdated', (data: { goalId: string; progress: number }) => {
        eventBus.emit('goal:progress', { goalId: data.goalId, progress: data.progress });
      });
    }
  }

  /**
   * Start the daemon: begin heartbeat and orchestrator scheduling.
   */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.deps.heartbeatService.start();
    this.deps.orchestratorScheduler.start();
  }

  /**
   * Stop the daemon gracefully.
   */
  stop(): void {
    this.deps.orchestratorScheduler.stop();
    this.deps.heartbeatService.stop();
    this.started = false;
  }

  /**
   * Remove all event listeners registered by wire().
   */
  unwire(): void {
    for (const cleanup of this.cleanups) {
      cleanup();
    }
    this.cleanups.length = 0;
  }

  /** Helper: subscribe to an emitter event and track for cleanup */
  private on<T>(emitter: EventEmitter, event: string, handler: (data: T) => void): void {
    emitter.on(event, handler as (...args: unknown[]) => void);
    this.cleanups.push(() => {
      emitter.off(event, handler as (...args: unknown[]) => void);
    });
  }
}
