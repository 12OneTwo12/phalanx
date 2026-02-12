import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { DaemonWiring, type DaemonDeps } from '../../src/engine/daemon-wiring.js';

/**
 * Tests that DaemonWiring triggers smart assignment on scheduler:tick,
 * resolving the deadlock where backlog tickets were never auto-assigned.
 */
describe('DaemonWiring — smart assignment on scheduler tick', () => {
  let deps: DaemonDeps;
  let schedulerEmitter: EventEmitter;
  let smartAssignFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    schedulerEmitter = new EventEmitter();
    smartAssignFn = vi.fn(async () => ({
      agentId: 'a1',
      isNewAgent: false,
      selectedModel: { provider: 'test', model: 'test', fullId: 'test/test', resolvedFrom: 'system' as const },
      reasoning: 'test',
    }));

    const orchestratorEmitter = new EventEmitter();
    const verificationEmitter = new EventEmitter();
    const completionEmitter = new EventEmitter();
    const heartbeatEmitter = new EventEmitter();
    const proposalEmitter = new EventEmitter();

    deps = {
      heartbeatService: Object.assign(heartbeatEmitter, { start: vi.fn(), stop: vi.fn() }),
      orchestrator: orchestratorEmitter,
      orchestratorScheduler: Object.assign(schedulerEmitter, {
        start: vi.fn(),
        stop: vi.fn(async () => {}),
        isActive: true,
      }),
      verificationService: verificationEmitter,
      proposalService: proposalEmitter,
      proposalExecutor: { execute: vi.fn() },
      completionHandler: Object.assign(completionEmitter, {
        handleSubmitted: vi.fn(async () => {}),
        handlePass: vi.fn(),
        handleEscalation: vi.fn(),
      }),
      smartAssignment: { smartAssign: smartAssignFn } as any,
      proposalRepo: { create: vi.fn() } as any,
      ticketRepo: {
        findByStatus: vi.fn((status: string) => {
          if (status === 'backlog') {
            return [{ id: 't1' }, { id: 't2' }];
          }
          return [];
        }),
      } as any,
    } as unknown as DaemonDeps;
  });

  it('should call smartAssign for backlog tickets on scheduler:tick', async () => {
    const wiring = new DaemonWiring(deps);
    wiring.wire();

    // Simulate scheduler tick
    schedulerEmitter.emit('scheduler:tick');

    // Allow promises to resolve
    await new Promise((r) => setTimeout(r, 10));

    expect(smartAssignFn).toHaveBeenCalledTimes(2);
    expect(smartAssignFn).toHaveBeenCalledWith('t1');
    expect(smartAssignFn).toHaveBeenCalledWith('t2');

    wiring.unwire();
  });

  it('should not crash when smartAssign fails', async () => {
    smartAssignFn.mockRejectedValue(new Error('no agent'));

    const wiring = new DaemonWiring(deps);
    wiring.wire();

    // Should not throw
    schedulerEmitter.emit('scheduler:tick');
    await new Promise((r) => setTimeout(r, 10));

    expect(smartAssignFn).toHaveBeenCalled();
    wiring.unwire();
  });
});
