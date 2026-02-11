import { describe, it, expect } from 'vitest';
import {
  IterationGuard,
  DEFAULT_ITERATION_CONFIG,
} from '../../src/agents/iteration-guard.js';

describe('IterationGuard', () => {
  describe('DEFAULT_ITERATION_CONFIG', () => {
    it('has maxIterations of 25', () => {
      expect(DEFAULT_ITERATION_CONFIG.maxIterations).toBe(25);
    });

    it('has warningThreshold of 20', () => {
      expect(DEFAULT_ITERATION_CONFIG.warningThreshold).toBe(20);
    });
  });

  describe('constructor', () => {
    it('uses default config when none provided', () => {
      const guard = new IterationGuard();
      // Default warningThreshold is 20
      expect(guard.warningThreshold).toBe(20);
      // Below threshold => continue
      expect(guard.check(19)).toBe('continue');
      // At threshold => warning
      expect(guard.check(20)).toBe('warning');
      // At max => exceeded
      expect(guard.check(25)).toBe('exceeded');
    });

    it('accepts custom maxIterations and warningThreshold', () => {
      const guard = new IterationGuard({
        maxIterations: 10,
        warningThreshold: 8,
      });

      expect(guard.warningThreshold).toBe(8);
      expect(guard.check(7)).toBe('continue');
      expect(guard.check(8)).toBe('warning');
      expect(guard.check(10)).toBe('exceeded');
    });

    it('merges partial config with defaults', () => {
      const guard = new IterationGuard({ maxIterations: 50 });
      // warningThreshold should still be the default 20
      expect(guard.warningThreshold).toBe(20);
      // maxIterations changed to 50
      expect(guard.check(50)).toBe('exceeded');
      expect(guard.check(49)).toBe('warning');
    });
  });

  describe('check', () => {
    it('returns continue for iterations below threshold', () => {
      const guard = new IterationGuard();
      expect(guard.check(0)).toBe('continue');
      expect(guard.check(1)).toBe('continue');
      expect(guard.check(10)).toBe('continue');
      expect(guard.check(19)).toBe('continue');
    });

    it('returns warning at warning threshold', () => {
      const guard = new IterationGuard();
      expect(guard.check(20)).toBe('warning');
      expect(guard.check(21)).toBe('warning');
      expect(guard.check(24)).toBe('warning');
    });

    it('returns exceeded at max iterations', () => {
      const guard = new IterationGuard();
      expect(guard.check(25)).toBe('exceeded');
      expect(guard.check(30)).toBe('exceeded');
      expect(guard.check(100)).toBe('exceeded');
    });
  });

  describe('getWarningMessage', () => {
    it('includes current and max in the message', () => {
      const guard = new IterationGuard({ maxIterations: 30 });
      const message = guard.getWarningMessage(24);
      expect(message).toContain('24');
      expect(message).toContain('30');
      expect(message).toContain('wrap up');
    });
  });

  describe('getExceededMessage', () => {
    it('includes max in the message', () => {
      const guard = new IterationGuard({ maxIterations: 15 });
      const message = guard.getExceededMessage();
      expect(message).toContain('15');
      expect(message).toContain('Escalating');
    });
  });

  describe('warningThreshold getter', () => {
    it('returns the configured warning threshold', () => {
      const guard = new IterationGuard({ warningThreshold: 12 });
      expect(guard.warningThreshold).toBe(12);
    });

    it('returns the default when not overridden', () => {
      const guard = new IterationGuard();
      expect(guard.warningThreshold).toBe(DEFAULT_ITERATION_CONFIG.warningThreshold);
    });
  });
});
