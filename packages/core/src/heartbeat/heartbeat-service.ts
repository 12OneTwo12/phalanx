/**
 * HeartbeatService — facade that wires together Scheduler, ContextChecker,
 * Reporter, and AdaptiveIntervalCalculator into a cohesive heartbeat system.
 */
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { HeartbeatLogRepository } from '../db/repositories/heartbeat-log.repository.js';
import { ContextChecker, type ContextCheckerDeps } from './heartbeat-context.js';
import { HeartbeatReporter } from './heartbeat-reporter.js';
import { AdaptiveIntervalCalculator } from './adaptive-interval.js';
import { HeartbeatScheduler } from './heartbeat-scheduler.js';
import {
  type HeartbeatConfig,
  type HeartbeatServiceState,
  type HeartbeatReport,
  DEFAULT_HEARTBEAT_CONFIG,
  createInitialState,
} from './types.js';

export interface HeartbeatServiceDeps extends ContextCheckerDeps {
  heartbeatLogRepo: HeartbeatLogRepository;
}

/**
 * Top-level heartbeat service that orchestrates periodic system health checks.
 *
 * Events emitted:
 * - 'heartbeat:report' — { report: HeartbeatReport }
 * - 'heartbeat:error'  — { error: Error }
 */
export class HeartbeatService extends EventEmitter {
  private readonly config: HeartbeatConfig;
  private readonly state: HeartbeatServiceState;
  private readonly contextChecker: ContextChecker;
  private readonly reporter: HeartbeatReporter;
  private readonly adaptiveCalc: AdaptiveIntervalCalculator;
  private readonly scheduler: HeartbeatScheduler;
  private readonly heartbeatLogRepo: HeartbeatLogRepository;

  constructor(deps: HeartbeatServiceDeps, config?: Partial<HeartbeatConfig>) {
    super();
    this.config = { ...DEFAULT_HEARTBEAT_CONFIG, ...config };
    this.state = createInitialState(this.config);
    this.contextChecker = new ContextChecker(deps);
    this.reporter = new HeartbeatReporter();
    this.adaptiveCalc = new AdaptiveIntervalCalculator();
    this.heartbeatLogRepo = deps.heartbeatLogRepo;

    this.scheduler = new HeartbeatScheduler(this.state, () => this.onTick());
  }

  /**
   * Start the heartbeat service.
   */
  start(): void {
    this.scheduler.start();
  }

  /**
   * Stop the heartbeat service.
   */
  stop(): void {
    this.scheduler.stop();
    this.reporter.reset();
    this.adaptiveCalc.reset();
  }

  /**
   * Whether the heartbeat service is currently active.
   */
  get isActive(): boolean {
    return this.scheduler.isActive;
  }

  /**
   * Get the current service state (for monitoring).
   */
  getState(): Readonly<Omit<HeartbeatServiceState, 'timer'>> {
    const { timer: _timer, ...rest } = this.state;
    return rest;
  }

  /**
   * The tick handler — called by the scheduler on each heartbeat.
   */
  private async onTick(): Promise<void> {
    // Collect context
    const context = this.contextChecker.collect();

    // Generate report
    const report = this.reporter.generate(context);

    // Persist to database
    this.persistReport(report);

    // Emit event for dashboard/SSE bridge
    this.emit('heartbeat:report', { report });

    // Adjust interval adaptively
    if (this.config.adaptiveEnabled) {
      const newInterval = this.adaptiveCalc.calculate(
        context,
        this.config,
        report.hasChanges,
      );
      this.state.currentIntervalMs = newInterval;
    }
  }

  private persistReport(report: HeartbeatReport): void {
    try {
      this.heartbeatLogRepo.create({
        id: randomUUID(),
        report: JSON.stringify({
          summary: report.summary,
          proposals: report.proposals,
          hasChanges: report.hasChanges,
        }),
        status: 'pending',
        interval: Math.round(this.state.currentIntervalMs / 60_000),
      });
    } catch (err) {
      this.emit('heartbeat:error', { error: err });
    }
  }
}
