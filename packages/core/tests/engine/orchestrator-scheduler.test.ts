import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrchestratorScheduler } from '../../src/engine/orchestrator-scheduler.js';
import type { Orchestrator } from '../../src/engine/orchestrator.js';

describe('OrchestratorScheduler', () => {
  let mockOrchestrator: Orchestrator;
  let scheduler: OrchestratorScheduler;

  beforeEach(() => {
    mockOrchestrator = {
      processQueue: vi.fn(async () => {}),
    } as unknown as Orchestrator;
  });

  it('should emit scheduler:tick after each successful tick', async () => {
    scheduler = new OrchestratorScheduler(mockOrchestrator, { pollIntervalMs: 100 });
    scheduler.start();

    const tickSpy = vi.fn();
    scheduler.on('scheduler:tick', tickSpy);

    // Wait for at least one tick
    await new Promise((r) => setTimeout(r, 250));
    await scheduler.stop();

    expect(tickSpy).toHaveBeenCalled();
    expect(mockOrchestrator.processQueue).toHaveBeenCalled();
  });

  it('should not emit scheduler:tick when processQueue throws', async () => {
    (mockOrchestrator.processQueue as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('boom'),
    );
    scheduler = new OrchestratorScheduler(mockOrchestrator, { pollIntervalMs: 100 });
    scheduler.start();

    const tickSpy = vi.fn();
    scheduler.on('scheduler:tick', tickSpy);

    await new Promise((r) => setTimeout(r, 250));
    await scheduler.stop();

    expect(tickSpy).not.toHaveBeenCalled();
  });
});
