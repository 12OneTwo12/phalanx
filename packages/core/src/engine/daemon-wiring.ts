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
 *   ticket:failed / ticket:error → retry or escalate + release agent
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
import type { AutoCommenter } from './auto-commenter.js';
import type { WorkLogRecorder } from './work-log-recorder.js';
import type { MeetingOrchestrator } from './meeting-orchestrator.js';
import type { DebateOrchestrator } from './debate-orchestrator.js';
import type { ApprovalService } from './approval-service.js';

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
  /** Optional auto-commenter for lifecycle comments on tickets */
  autoCommenter?: AutoCommenter;
  /** Optional work log recorder for daily tracking */
  workLogRecorder?: WorkLogRecorder;
  /** Optional SSE event emitter for dashboard integration */
  eventBus?: { emit(type: string, payload?: Record<string, unknown>): void };
  /** Optional meeting orchestrator for team meetings */
  meetingOrchestrator?: MeetingOrchestrator;
  /** Optional debate orchestrator for intra-role debates */
  debateOrchestrator?: DebateOrchestrator;
  /** Optional approval service for auto-approve mode */
  approvalService?: ApprovalService;
  /** Callback to read current approval mode at runtime (supports config changes via API) */
  getApprovalMode?: () => 'manual' | 'auto';
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

    // 2. Proposal approved → execute side effects (synchronous)
    this.on(proposalService, 'proposal:approved', (data: { proposalId: string }) => {
      try {
        const result = proposalExecutor.execute(data.proposalId);
        eventBus?.emit('proposal:executed', { result });
      } catch {
        /* proposal execution failure is non-fatal */
      }
    });

    // 3. Ticket submitted → verification
    this.on(orchestrator, 'ticket:submitted', (data: { ticketId: string }) => {
      void completionHandler.handleSubmitted(data.ticketId).catch(() => {
        /* verification failure handled by VerificationService events */
      });
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

    // 5. Backlog → smart assign on every scheduler tick
    //    Previously this only fired on `ticket:started`, creating a deadlock:
    //    backlog tickets never got assigned because `ticket:started` only fires
    //    when an already-assigned ticket begins execution.
    //    Fix: scan backlog on every scheduler tick to assign idle agents.
    if (smartAssignment) {
      const sa = smartAssignment;
      const { orchestratorScheduler } = this.deps;

      this.on(orchestratorScheduler, 'scheduler:tick', () => {
        const backlog = ticketRepo.findByStatus('backlog');
        for (const ticket of backlog) {
          void sa.smartAssign(ticket.id).catch((err) => {
            console.warn(`[phalanx] Smart assignment failed for ticket ${ticket.id}:`, err);
          });
        }
      });
    }

    // 5b. Auto-approve pending tickets when configured
    {
      const { orchestratorScheduler, approvalService, getApprovalMode } = this.deps;
      if (approvalService && getApprovalMode) {
        this.on(orchestratorScheduler, 'scheduler:tick', () => {
          if (getApprovalMode() === 'auto') {
            try {
              approvalService.approveAll();
            } catch { /* auto-approve failure is non-fatal */ }
          }
        });
      }
    }

    // 6. Ticket failure handling — retry or escalate + release agent
    this.on(orchestrator, 'ticket:failed', (data: { ticketId: string; error?: string }) => {
      completionHandler.handleFailure(data.ticketId);
      eventBus?.emit('ticket:failed', { ticketId: data.ticketId, error: data.error });
    });

    // Handle unexpected execution errors the same way
    this.on(orchestrator, 'ticket:error', (data: { ticketId: string; error?: string }) => {
      completionHandler.handleFailure(data.ticketId);
      eventBus?.emit('ticket:error', { ticketId: data.ticketId, error: data.error });
    });

    // 8. AutoCommenter — write lifecycle comments on tickets
    const { autoCommenter } = this.deps;
    if (autoCommenter) {
      this.on(orchestrator, 'ticket:started', (data: { ticketId: string; agentId?: string }) => {
        autoCommenter.onTicketStarted(data.ticketId, data.agentId ?? 'unknown');
      });
      this.on(orchestrator, 'ticket:submitted', (data: { ticketId: string }) => {
        autoCommenter.onTicketSubmitted(data.ticketId);
      });
      this.on(verificationService, 'verification:passed', (data: { ticketId: string }) => {
        autoCommenter.onVerificationPassed(data.ticketId);
      });
      this.on(verificationService, 'verification:failed', (data: { ticketId: string; feedback?: string }) => {
        autoCommenter.onVerificationFailed(data.ticketId, data.feedback);
      });
      this.on(verificationService, 'verification:escalated', (data: { ticketId: string }) => {
        autoCommenter.onTicketEscalated(data.ticketId);
      });
      this.on(orchestrator, 'ticket:failed', (data: { ticketId: string; error?: string }) => {
        autoCommenter.onTicketFailed(data.ticketId, data.error);
      });
      this.on(orchestrator, 'ticket:error', (data: { ticketId: string; error?: string }) => {
        autoCommenter.onTicketFailed(data.ticketId, data.error);
      });
    }

    // 9. WorkLogRecorder — record daily work logs from lifecycle events
    const { workLogRecorder } = this.deps;
    if (workLogRecorder) {
      this.on(orchestrator, 'ticket:started', (data: { ticketId: string; agentId?: string }) => {
        workLogRecorder.onTicketStarted(data.ticketId, data.agentId);
      });
      this.on(completionHandler, 'ticket:completed', (data: { ticketId: string; agentId?: string }) => {
        workLogRecorder.onTicketCompleted(data.ticketId, data.agentId);
      });
      this.on(orchestrator, 'ticket:failed', (data: { ticketId: string; agentId?: string; error?: string }) => {
        workLogRecorder.onTicketFailed(data.ticketId, data.agentId, data.error);
      });
      this.on(orchestrator, 'ticket:error', (data: { ticketId: string; agentId?: string; error?: string }) => {
        workLogRecorder.onTicketFailed(data.ticketId, data.agentId, data.error);
      });
    }

    // 7. Forward key orchestrator events to SSE
    if (eventBus) {
      this.on(orchestrator, 'ticket:started', (data: { ticketId: string }) => {
        eventBus.emit('ticket:started', { ticketId: data.ticketId });
      });
      this.on(completionHandler, 'ticket:completed', (data: { ticketId: string }) => {
        eventBus.emit('ticket:completed', { ticketId: data.ticketId });
      });
      this.on(completionHandler, 'ticket:escalated', (data: { ticketId: string }) => {
        eventBus.emit('ticket:escalated', { ticketId: data.ticketId });
      });
      this.on(completionHandler, 'ticket:retrying', (data: { ticketId: string; retryCount: number }) => {
        eventBus.emit('ticket:retrying', { ticketId: data.ticketId, retryCount: data.retryCount });
      });
      this.on(completionHandler, 'goal:progressUpdated', (data: { goalId: string; progress: number }) => {
        eventBus.emit('goal:progress', { goalId: data.goalId, progress: data.progress });
      });
    }

    // 10. Meeting/Debate events → SSE
    const { meetingOrchestrator, debateOrchestrator } = this.deps;
    if (meetingOrchestrator && eventBus) {
      this.on(meetingOrchestrator, 'meeting:scheduled', (data: { meetingId: string; title: string; type: string }) => {
        eventBus.emit('meeting:scheduled', data);
      });
      this.on(meetingOrchestrator, 'meeting:started', (data: { meetingId: string }) => {
        eventBus.emit('meeting:started', data);
      });
      this.on(meetingOrchestrator, 'meeting:contribution', (data: { meetingId: string; agentId: string }) => {
        eventBus.emit('meeting:contribution', data);
      });
      this.on(meetingOrchestrator, 'meeting:completed', (data: { meetingId: string; summary: string }) => {
        eventBus.emit('meeting:completed', data);
      });
    }
    if (debateOrchestrator && eventBus) {
      this.on(debateOrchestrator, 'debate:started', (data: { debateId: string; topic: string; roleGroup: string }) => {
        eventBus.emit('debate:started', data);
      });
      this.on(debateOrchestrator, 'debate:argument', (data: { debateId: string; agentId: string; round: number }) => {
        eventBus.emit('debate:argument', data);
      });
      this.on(debateOrchestrator, 'debate:concluded', (data: { debateId: string; conclusion: string }) => {
        eventBus.emit('debate:concluded', data);
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
   * Stop the daemon gracefully. Waits for in-flight operations to complete.
   */
  async stop(): Promise<void> {
    await this.deps.orchestratorScheduler.stop();
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
