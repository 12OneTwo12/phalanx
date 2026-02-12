/**
 * OrchestratorScheduler — periodic queue processor with start/stop lifecycle.
 * Handles both auto-assignment of backlog tickets and execution of assigned tickets.
 *
 * Emits:
 *   - `scheduler:tick` after each successful tick (used by DaemonWiring for backlog scanning)
 */
import { EventEmitter } from 'node:events';
import type { Orchestrator } from './orchestrator.js';

export interface OrchestratorSchedulerConfig {
  /** Polling interval in milliseconds (default: 5000) */
  pollIntervalMs: number;
}

const DEFAULT_SCHEDULER_CONFIG: OrchestratorSchedulerConfig = {
  pollIntervalMs: 5000,
};

export class OrchestratorScheduler extends EventEmitter {
  private timer: ReturnType<typeof setInterval> | null = null;
  private processing = false;
  private currentTick: Promise<void> | null = null;
  private readonly config: OrchestratorSchedulerConfig;

  constructor(
    private readonly orchestrator: Orchestrator,
    config?: Partial<OrchestratorSchedulerConfig>,
  ) {
    super();
    this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config };
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.config.pollIntervalMs);
  }

  /**
   * Stop the scheduler. Waits for any in-flight tick to complete.
   */
  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // Wait for in-flight tick to finish
    if (this.currentTick) {
      await this.currentTick;
    }
  }

  get isActive(): boolean {
    return this.timer !== null;
  }

  /** Exposed for testing — run one tick manually */
  async tick(): Promise<void> {
    if (this.processing || !this.timer) return; // re-entrancy + stopped guard
    this.processing = true;
    try {
      this.currentTick = this.orchestrator.processQueue();
      await this.currentTick;
      this.emit('scheduler:tick');
    } catch {
      // processQueue errors are non-fatal; will retry on next tick
    } finally {
      this.currentTick = null;
      this.processing = false;
    }
  }
}
