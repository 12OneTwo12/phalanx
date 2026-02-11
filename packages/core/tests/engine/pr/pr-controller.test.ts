import { describe, it, expect } from 'vitest';
import { PRController } from '../../../src/engine/pr/pr-controller.js';
import { SmartModeEngine, MaxFilesChangedRule } from '../../../src/engine/pr/smart-mode-rules.js';
import type { PRContext } from '../../../src/engine/pr/types.js';

function makeContext(overrides: Partial<PRContext> = {}): PRContext {
  return {
    ticketId: 't1', branch: 'b', baseBranch: 'dev',
    changedFiles: ['a.ts'], diff: '',
    verificationResult: { ticketId: 't1', status: 'passed', checks: [] },
    ...overrides,
  };
}

describe('PRController', () => {
  it('manual mode always returns manual_review', () => {
    const ctrl = new PRController('manual');
    expect(ctrl.decide(makeContext()).decision).toBe('manual_review');
  });

  it('auto mode returns auto_merge when verification passed', () => {
    const ctrl = new PRController('auto');
    expect(ctrl.decide(makeContext()).decision).toBe('auto_merge');
  });

  it('auto mode returns manual_review when verification failed', () => {
    const ctrl = new PRController('auto');
    const ctx = makeContext({
      verificationResult: { ticketId: 't1', status: 'failed', checks: [] },
    });
    expect(ctrl.decide(ctx).decision).toBe('manual_review');
  });

  it('smart mode returns auto_merge when all rules pass', () => {
    const engine = new SmartModeEngine([new MaxFilesChangedRule(10)]);
    const ctrl = new PRController('smart', engine);
    expect(ctrl.decide(makeContext()).decision).toBe('auto_merge');
  });

  it('smart mode returns manual_review when rules fail', () => {
    const engine = new SmartModeEngine([new MaxFilesChangedRule(0)]);
    const ctrl = new PRController('smart', engine);
    expect(ctrl.decide(makeContext()).decision).toBe('manual_review');
  });

  it('should allow changing mode', () => {
    const ctrl = new PRController('manual');
    ctrl.setMode('auto');
    expect(ctrl.getMode()).toBe('auto');
  });
});
