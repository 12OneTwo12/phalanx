/**
 * Ticket pipeline — E2E facade orchestrating branch creation, agent execution,
 * verification, and PR control for a single ticket lifecycle.
 */
import { EventEmitter } from 'node:events';
import type { Ticket } from '../db/schema.js';
import type { TicketExecutor } from './orchestrator.js';
import type { VerificationStrategy } from './verification-service.js';
import type { BranchManager } from './branch-manager.js';
import type { PRController } from './pr/pr-controller.js';
import type { PRCreator } from './pr/pr-creator.js';
import type { PRCreateResult, TicketInfo } from './pr/types.js';
import type { VerificationResult } from './types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PipelineStage =
  | 'execution'
  | 'verification'
  | 'pr_decision'
  | 'completed'
  | 'failed';

export interface PipelineResult {
  ticketId: string;
  stage: PipelineStage;
  success: boolean;
  verificationResult?: VerificationResult;
  prResult?: PRCreateResult;
  error?: string;
  attempts: number;
}

export interface TicketPipelineConfig {
  /** Maximum retry attempts for failed verification */
  maxRetries: number;
  /** Base branch for ticket branches */
  baseBranch: string;
  /** Number of consecutive identical results before stability detection */
  stabilityThreshold: number;
}

const DEFAULT_PIPELINE_CONFIG: TicketPipelineConfig = {
  maxRetries: 3,
  baseBranch: 'dev',
  stabilityThreshold: 3,
};

// ---------------------------------------------------------------------------
// TicketPipeline
// ---------------------------------------------------------------------------

export class TicketPipeline extends EventEmitter {
  private readonly config: TicketPipelineConfig;

  constructor(
    private readonly executor: TicketExecutor,
    private readonly verificationStrategy: VerificationStrategy,
    private readonly branchManager: BranchManager,
    private readonly prController: PRController,
    private readonly prCreator: PRCreator,
    config?: Partial<TicketPipelineConfig>,
  ) {
    super();
    this.config = { ...DEFAULT_PIPELINE_CONFIG, ...config };
  }

  /**
   * Run the full pipeline for a ticket.
   */
  async run(ticket: Ticket): Promise<PipelineResult> {
    let attempts = 0;
    const consecutiveResults: string[] = [];

    while (attempts < this.config.maxRetries) {
      attempts++;
      this.emit('pipeline:attempt', { ticketId: ticket.id, attempt: attempts });

      // Stage 1: Execute
      this.emit('pipeline:stage', { ticketId: ticket.id, stage: 'execution' });
      const execResult = await this.executor.execute(ticket);

      if (!execResult.success) {
        this.emit('pipeline:execution-failed', { ticketId: ticket.id, error: execResult.error });

        // Track stability
        const resultKey = `fail:${execResult.error}`;
        consecutiveResults.push(resultKey);
        if (this.isStable(consecutiveResults)) {
          return {
            ticketId: ticket.id,
            stage: 'failed',
            success: false,
            error: `Stable failure detected after ${attempts} attempts: ${execResult.error}`,
            attempts,
          };
        }
        continue;
      }

      // Stage 2: Verification
      this.emit('pipeline:stage', { ticketId: ticket.id, stage: 'verification' });
      let verificationResult: VerificationResult;
      try {
        verificationResult = await this.verificationStrategy.verify(ticket.id);
      } catch (err) {
        return {
          ticketId: ticket.id,
          stage: 'verification',
          success: false,
          error: `Verification error: ${err instanceof Error ? err.message : String(err)}`,
          attempts,
        };
      }

      if (verificationResult.status === 'passed') {
        // Stage 3: PR decision
        this.emit('pipeline:stage', { ticketId: ticket.id, stage: 'pr_decision' });

        let changedFiles: string[] = [];
        let diff = '';
        try {
          changedFiles = await this.branchManager.getChangedFiles(this.config.baseBranch);
          diff = await this.branchManager.getDiff(this.config.baseBranch);
        } catch {
          // Continue with empty data
        }

        const prDecision = this.prController.decide({
          ticketId: ticket.id,
          branch: ticket.branch ?? '',
          baseBranch: this.config.baseBranch,
          changedFiles,
          diff,
          verificationResult,
        });

        const ticketInfo: TicketInfo = {
          id: ticket.id,
          title: ticket.title,
          description: ticket.description,
          epicId: ticket.epicId,
        };

        const prResult = await this.prCreator.create({
          ticket: ticketInfo,
          branch: ticket.branch ?? '',
          baseBranch: this.config.baseBranch,
          verificationResult,
          decision: prDecision.decision,
        });

        this.emit('pipeline:completed', { ticketId: ticket.id, decision: prDecision.decision });

        return {
          ticketId: ticket.id,
          stage: 'completed',
          success: true,
          verificationResult,
          prResult,
          attempts,
        };
      }

      // Verification failed — track and retry
      const resultKey = `verify-fail:${verificationResult.feedback ?? 'unknown'}`;
      consecutiveResults.push(resultKey);
      this.emit('pipeline:verification-failed', {
        ticketId: ticket.id,
        attempt: attempts,
        feedback: verificationResult.feedback,
      });

      if (this.isStable(consecutiveResults)) {
        return {
          ticketId: ticket.id,
          stage: 'failed',
          success: false,
          verificationResult,
          error: `Stable verification failure after ${attempts} attempts`,
          attempts,
        };
      }
    }

    return {
      ticketId: ticket.id,
      stage: 'failed',
      success: false,
      error: `Max retries (${this.config.maxRetries}) exceeded`,
      attempts,
    };
  }

  /**
   * Detect stability: N consecutive identical results.
   */
  private isStable(results: string[]): boolean {
    const threshold = this.config.stabilityThreshold;
    if (results.length < threshold) return false;

    const lastN = results.slice(-threshold);
    return lastN.every((r) => r === lastN[0]);
  }
}
