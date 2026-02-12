/**
 * OrchestratorScheduler — periodic queue processor with start/stop lifecycle.
 * Handles both auto-assignment of backlog tickets and execution of assigned tickets.
 */
import type { Orchestrator } from './orchestrator.js';

export interface OrchestratorSchedulerConfig {
  /** Polling interval in milliseconds (default: 5000) */
  pollIntervalMs: number;
}

const DEFAULT_SCHEDULER_CONFIG: OrchestratorSchedulerConfig = {
  pollIntervalMs: 5000,
};

export class OrchestratorScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private processing = false;
  private readonly config: OrchestratorSchedulerConfig;

  constructor(
    private readonly orchestrator: Orchestrator,
    config?: Partial<OrchestratorSchedulerConfig>,
  ) {
    this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config };
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.config.pollIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  get isActive(): boolean {
    return this.timer !== null;
  }

  /** Exposed for testing — run one tick manually */
  async tick(): Promise<void> {
    if (this.processing) return; // re-entrancy guard
    this.processing = true;
    try {
      await this.orchestrator.processQueue();
    } finally {
      this.processing = false;
    }
  }
}
